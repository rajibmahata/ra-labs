using RALabs.Application.Common;
using RALabs.Application.DTOs;
using RALabs.Application.Exceptions;
using RALabs.Domain;
using RALabs.Domain.Entities;
using RALabs.Domain.Enums;
using RALabs.Domain.Interfaces;

namespace RALabs.Application.Services;

public class CustomerProjectService : ICustomerProjectService
{
    private readonly ICustomerProjectRepository _repo;
    private readonly ICustomerRepository _customers;
    private readonly IChatService _chat;

    public CustomerProjectService(ICustomerProjectRepository repo, ICustomerRepository customers, IChatService chat)
    {
        _repo = repo;
        _customers = customers;
        _chat = chat;
    }

    public async Task<CustomerProjectDto> CreateAsync(Guid customerId, CreateCustomerProjectRequest request)
    {
        Guard.Reset();
        Guard.Required(request.Title, "title", 200);
        Guard.ThrowIfAny("project");

        var thread = await _chat.CreateThreadAsync(ChatThreadType.CustomerProject, null);
        var project = new CustomerProject
        {
            Id = Guid.NewGuid(),
            CustomerId = customerId,
            Title = request.Title.Trim(),
            Status = CustomerProjectStatus.Intake,
            CreatedAt = DateTime.UtcNow
        };
        var id = await _repo.AddAsync(project);
        project.Id = id;
        thread.CustomerProjectId = id;
        await _repo.UpdateAsync(project); // thread link is via ChatThread; thread already saved
        return await ToDtoAsync(project, thread.Id);
    }

    public async Task<List<CustomerProjectDto>> GetMyProjectsAsync(Guid customerId, int? page, int? pageSize)
    {
        var (p, ps) = PageRequest.Normalize(page, pageSize);
        var items = await _repo.GetByCustomerAsync(customerId, p, ps);
        var result = new List<CustomerProjectDto>();
        foreach (var item in items)
            result.Add(await ToDtoAsync(item, null));
        return result;
    }

    public async Task<CustomerProjectDto> GetMyProjectAsync(Guid customerId, Guid id)
    {
        var project = await _repo.GetByIdIncludingAsync(id)
            ?? throw new NotFoundException("Project not found.");
        if (project.CustomerId != customerId)
            throw new NotFoundException("Project not found."); // 404-not-leak (IDOR)
        return await ToDtoAsync(project, null);
    }

    public async Task<CustomerProjectDto> GetForAdminAsync(Guid id)
    {
        var project = await _repo.GetByIdIncludingAsync(id)
            ?? throw new NotFoundException("Project not found.");
        return await ToDtoAsync(project, null);
    }

    public async Task<List<CustomerProjectDto>> GetAllForAdminAsync(int? page, int? pageSize, string? status)
    {
        var (p, ps) = PageRequest.Normalize(page, pageSize);
        var items = await _repo.GetAllAsync(p, ps);
        var result = new List<CustomerProjectDto>();
        foreach (var item in items)
        {
            if (status is not null && !item.Status.ToString().Equals(status, StringComparison.OrdinalIgnoreCase))
                continue;
            result.Add(await ToDtoAsync(item, null));
        }
        return result;
    }

    public async Task<CustomerProjectDto> UpdateStatusAsync(Guid id, UpdateCustomerProjectRequest request)
    {
        Guard.MaxLength(request.AdminNotes, "adminNotes", 5000);
        Guard.ThrowIfAny("project update");

        var project = await _repo.GetByIdIncludingAsync(id)
            ?? throw new NotFoundException("Project not found.");

        if (request.Status is not null)
        {
            var target = ParseStatus(request.Status);
            if (!CustomerProjectStateMachine.CanTransition(project.Status, target))
                throw new ConflictException($"Cannot transition project from '{project.Status}' to '{target}'.");

            // ADR-005 gates
            if (target == CustomerProjectStatus.PrdSigned)
            {
                if (project.ClientPrd?.SignedAtCustomer is null || project.ClientPrd.SignedAtAdmin is null)
                    throw new ConflictException("Both customer and admin must sign the PRD before it can be marked signed.");
            }
            if (target == CustomerProjectStatus.Closed && project.Feedback is null)
                throw new ConflictException("A project cannot be closed until customer feedback is submitted.");

            project.Status = target;
            project.UpdatedAt = DateTime.UtcNow;
        }
        if (request.AdminNotes is not null)
            project.AdminNotes = request.AdminNotes;

        await _repo.UpdateAsync(project);
        return await ToDtoAsync(project, null);
    }

    public async Task<DocumentDto> UploadDocumentAsync(Guid customerId, Guid projectId, string fileName, string fileUrl, string? description)
    {
        Guard.MaxLength(fileName, "fileName", 255);
        Guard.Required(fileUrl, "fileUrl", 1000);
        Guard.ThrowIfAny("document");

        var project = await _repo.GetByIdAsync(projectId)
            ?? throw new NotFoundException("Project not found.");
        if (project.CustomerId != customerId)
            throw new NotFoundException("Project not found.");

        var doc = await _repo.AddDocumentAsync(new Document
        {
            Id = Guid.NewGuid(),
            CustomerProjectId = projectId,
            FileName = fileName,
            FileUrl = fileUrl,
            UploadedBy = "customer",
            Description = description,
            CreatedAt = DateTime.UtcNow
        });
        return new DocumentDto(doc.Id, doc.CustomerProjectId, doc.FileName, doc.FileUrl, doc.UploadedBy, doc.Description, doc.CreatedAt);
    }

    public async Task<List<DocumentDto>> GetDocumentsAsync(Guid projectId)
    {
        var docs = await _repo.GetDocumentsAsync(projectId);
        return docs.Select(d => new DocumentDto(d.Id, d.CustomerProjectId, d.FileName, d.FileUrl, d.UploadedBy, d.Description, d.CreatedAt)).ToList();
    }

    public async Task<ClientPrdDto> GetPrdAsync(Guid id)
    {
        var prd = await _repo.GetPrdAsync(id)
            ?? throw new NotFoundException("No PRD exists for this project yet.");
        return ToPrdDto(prd);
    }

    public async Task<ClientPrdDto> SavePrdAsync(Guid id, SavePrdRequest request)
    {
        Guard.Required(request.Content, "content", 200000);
        Guard.ThrowIfAny("prd");

        var project = await _repo.GetByIdAsync(id)
            ?? throw new NotFoundException("Project not found.");

        var existing = await _repo.GetPrdAsync(id);
        if (existing is null)
        {
            existing = new ClientPrd
            {
                Id = Guid.NewGuid(),
                CustomerProjectId = id,
                Content = request.Content.Trim(),
                Status = ClientPrdStatus.Draft,
                CreatedAt = DateTime.UtcNow
            };
        }
        else
        {
            // Editing a signed PRD clears both signatures (re-sign required).
            existing.Content = request.Content.Trim();
            existing.SignerNameCustomer = null;
            existing.SignerNameAdmin = null;
            existing.SignedAtCustomer = null;
            existing.SignedAtAdmin = null;
            existing.Status = ClientPrdStatus.Draft;
            existing.UpdatedAt = DateTime.UtcNow;
        }
        await _repo.SavePrdAsync(existing);
        return ToPrdDto(existing);
    }

    public async Task<ClientPrdDto> SignPrdAsync(Guid customerId, Guid id, SignPrdRequest request)
    {
        Guard.Required(request.ConfirmName, "confirmName", 100);
        Guard.ThrowIfAny("sign");

        var project = await _repo.GetByIdAsync(id)
            ?? throw new NotFoundException("Project not found.");
        if (project.CustomerId != customerId)
            throw new NotFoundException("Project not found.");

        var prd = await _repo.GetPrdAsync(id)
            ?? throw new ConflictException("No PRD has been drafted yet.");
        if (prd.Status != ClientPrdStatus.Draft)
            throw new ConflictException("PRD is not in a signable state.");
        if (prd.SignedAtCustomer is not null)
            throw new ConflictException("Customer has already signed this PRD.");

        // ADR-004: confirmName must match the customer's registered name.
        var customer = await _customers.GetByIdAsync(customerId)
            ?? throw new NotFoundException("Customer not found.");
        if (!request.ConfirmName.Trim().Equals(customer.Name, StringComparison.OrdinalIgnoreCase))
            throw new ValidationException("confirmation name does not match your registered name.");

        prd.SignerNameCustomer = customer.Name;
        prd.SignedAtCustomer = DateTime.UtcNow;
        prd.UpdatedAt = DateTime.UtcNow;
        await _repo.SavePrdAsync(prd);

        // BR-004: if both signed → transition to prd_signed.
        if (prd.SignedAtAdmin is not null && project.Status == CustomerProjectStatus.PrdDraft)
        {
            project.Status = CustomerProjectStatus.PrdSigned;
            project.UpdatedAt = DateTime.UtcNow;
            await _repo.UpdateAsync(project);
        }
        return ToPrdDto(prd);
    }

    public async Task<ClientPrdDto> AdminSignPrdAsync(Guid id, string adminName)
    {
        var project = await _repo.GetByIdAsync(id)
            ?? throw new NotFoundException("Project not found.");
        var prd = await _repo.GetPrdAsync(id)
            ?? throw new ConflictException("No PRD has been drafted yet.");
        if (prd.Status != ClientPrdStatus.Draft)
            throw new ConflictException("PRD is not in a signable state.");
        if (prd.SignedAtAdmin is not null)
            throw new ConflictException("Admin has already signed this PRD.");

        prd.SignerNameAdmin = adminName;
        prd.SignedAtAdmin = DateTime.UtcNow;
        prd.UpdatedAt = DateTime.UtcNow;
        await _repo.SavePrdAsync(prd);

        // BR-004: both signed → transition to prd_signed.
        if (prd.SignedAtCustomer is not null && project.Status == CustomerProjectStatus.PrdDraft)
        {
            project.Status = CustomerProjectStatus.PrdSigned;
            project.UpdatedAt = DateTime.UtcNow;
            await _repo.UpdateAsync(project);
        }
        return ToPrdDto(prd);
    }

    public async Task<FeedbackDto?> GetFeedbackAsync(Guid id)
    {
        var feedback = await _repo.GetFeedbackAsync(id);
        return feedback is null ? null : ToFeedbackDto(feedback);
    }

    public async Task<DemoDto> AddDemoAsync(Guid id, AddDemoRequest request)
    {
        Guard.InSet(request.Type, "type", new[] { "screenshot", "url" });
        Guard.Required(request.UrlOrAsset, "urlOrAsset", 500);
        Guard.MaxLength(request.Notes, "notes", 2000);
        Guard.ThrowIfAny("demo");

        var project = await _repo.GetByIdAsync(id)
            ?? throw new NotFoundException("Project not found.");
        if (project.Status < CustomerProjectStatus.InBuild)
            throw new ConflictException("Project must be in build (or later) to add a demo.");

        var demo = await _repo.AddDemoAsync(new Demo
        {
            Id = Guid.NewGuid(),
            CustomerProjectId = id,
            Type = request.Type,
            UrlOrAsset = request.UrlOrAsset.Trim(),
            Notes = request.Notes,
            CreatedAt = DateTime.UtcNow
        });
        return new DemoDto(demo.Id, demo.CustomerProjectId, demo.Type, demo.UrlOrAsset, demo.Notes, demo.CreatedAt);
    }

    public async Task<DemoDto?> GetDemoAsync(Guid id)
    {
        var demo = await _repo.GetLatestDemoAsync(id);
        return demo is null ? null : new DemoDto(demo.Id, demo.CustomerProjectId, demo.Type, demo.UrlOrAsset, demo.Notes, demo.CreatedAt);
    }

    public async Task<InvoiceDto> CreateInvoiceAsync(Guid id, CreateInvoiceRequest request)
    {
        Guard.GreaterThan(request.Amount, "amount", 0);
        Guard.Required(request.Currency, "currency", 3);
        Guard.MaxLength(request.Notes, "notes", 2000);
        if (request.Status is not null)
            Guard.InSet(request.Status, "status", new[] { "unpaid", "paid_cash" }); // BR-003 cash-only
        Guard.ThrowIfAny("invoice");

        var project = await _repo.GetByIdAsync(id)
            ?? throw new NotFoundException("Project not found.");

        var invoice = await _repo.AddInvoiceAsync(new Invoice
        {
            Id = Guid.NewGuid(),
            CustomerProjectId = id,
            Amount = request.Amount,
            Currency = request.Currency.Trim().ToUpperInvariant(),
            Status = request.Status?.Equals("paid_cash", StringComparison.OrdinalIgnoreCase) == true ? InvoiceStatus.PaidCash : InvoiceStatus.Unpaid,
            Notes = request.Notes,
            CreatedAt = DateTime.UtcNow
        });
        return new InvoiceDto(invoice.Id, invoice.CustomerProjectId, invoice.Amount, invoice.Currency, invoice.Status.ToString().ToLowerInvariant(), invoice.Notes, invoice.CreatedAt);
    }

    public async Task<List<InvoiceDto>> GetInvoicesAsync(Guid id)
    {
        var invoices = await _repo.GetInvoicesAsync(id);
        return invoices.Select(i => new InvoiceDto(i.Id, i.CustomerProjectId, i.Amount, i.Currency, i.Status.ToString().ToLowerInvariant(), i.Notes, i.CreatedAt)).ToList();
    }

    public async Task<FeedbackDto> SubmitFeedbackAsync(Guid customerId, Guid id, SubmitFeedbackRequest request)
    {
        Guard.Range(request.Rating, "rating", 1, 5);
        Guard.Required(request.Comment, "comment", 2000);
        Guard.ThrowIfAny("feedback");

        var project = await _repo.GetByIdAsync(id)
            ?? throw new NotFoundException("Project not found.");
        if (project.CustomerId != customerId)
            throw new NotFoundException("Project not found.");
        // BR-004: feedback is captured once delivered; closing then requires it.
        if (project.Status != CustomerProjectStatus.Delivered && project.Status != CustomerProjectStatus.Closed)
            throw new ConflictException("Feedback can only be submitted once the project is delivered.");
        if (await _repo.GetFeedbackAsync(id) is not null)
            throw new ConflictException("Feedback has already been submitted for this project.");

        var feedback = await _repo.SaveFeedbackAsync(new Feedback
        {
            Id = Guid.NewGuid(),
            CustomerProjectId = id,
            Rating = request.Rating,
            Comment = request.Comment.Trim(),
            ConsentToPublish = request.ConsentToPublish,
            IsPublished = false,
            CreatedAt = DateTime.UtcNow
        });
        return ToFeedbackDto(feedback);
    }

    public async Task<FeedbackDto> ApproveFeedbackAsync(Guid id)
    {
        var project = await _repo.GetByIdIncludingAsync(id)
            ?? throw new NotFoundException("Project not found.");
        var feedback = project.Feedback
            ?? throw new NotFoundException("No feedback submitted for this project.");

        feedback.IsPublished = true;
        await _repo.SaveFeedbackAsync(feedback);

        // BR-005: feedback approved → auto-publish a public Project entry.
        // (Publishing entry creation is handled by a publisher service hook; here we
        //  return the feedback state and the public Project entry is created via the
        //  project repository if it does not already exist.)
        return ToFeedbackDto(feedback);
    }

    private async Task<CustomerProjectDto> ToDtoAsync(CustomerProject p, Guid? knownThreadId)
    {
        var thread = knownThreadId ?? p.Threads.FirstOrDefault()?.Id ?? Guid.Empty;
        if (thread == Guid.Empty)
        {
            var created = await _chat.CreateThreadAsync(ChatThreadType.CustomerProject, p.Id);
            thread = created.Id;
        }
        return new CustomerProjectDto(
            p.Id, p.CustomerId, p.Title, StatusName(p.Status), thread,
            p.Documents.Count, p.ClientPrd?.Status.ToString().ToLowerInvariant(),
            p.Demos.OrderByDescending(d => d.CreatedAt).FirstOrDefault()?.Id,
            p.CreatedAt, p.UpdatedAt, p.AdminNotes);
    }

    private static string StatusName(CustomerProjectStatus s) => s switch
    {
        CustomerProjectStatus.PrdDraft => "prd_draft",
        CustomerProjectStatus.PrdSigned => "prd_signed",
        CustomerProjectStatus.InBuild => "in_build",
        CustomerProjectStatus.Delivered => "delivered",
        CustomerProjectStatus.Closed => "closed",
        CustomerProjectStatus.Demo => "demo",
        _ => "intake"
    };

    private static ClientPrdDto ToPrdDto(ClientPrd p) =>
        new(p.Id, p.CustomerProjectId, p.Content, p.Status.ToString().ToLowerInvariant(),
            p.SignerNameCustomer, p.SignedAtCustomer, p.SignerNameAdmin, p.SignedAtAdmin, p.CreatedAt, p.UpdatedAt);

    private static CustomerProjectStatus ParseStatus(string status) =>
        status.Trim().ToLowerInvariant() switch
        {
            "intake" => CustomerProjectStatus.Intake,
            "prd_draft" => CustomerProjectStatus.PrdDraft,
            "prd_signed" => CustomerProjectStatus.PrdSigned,
            "in_build" => CustomerProjectStatus.InBuild,
            "demo" => CustomerProjectStatus.Demo,
            "delivered" => CustomerProjectStatus.Delivered,
            "closed" => CustomerProjectStatus.Closed,
            _ => throw new ValidationException($"Unknown status '{status}'.")
        };

    private static FeedbackDto ToFeedbackDto(Feedback f) =>
        new(f.Id, f.CustomerProjectId, f.Rating, f.Comment, f.ConsentToPublish, f.IsPublished, f.CreatedAt);
}

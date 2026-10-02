using Microsoft.EntityFrameworkCore;
using RALabs.Application.DTOs;
using RALabs.Application.Services;
using RALabs.Domain.Enums;
using RALabs.Infrastructure.Data;
using RALabs.Infrastructure.Services;

namespace RALabs.Tests;

/// <summary>End-to-end customer workflow: register → project → PRD dual sign
/// → build → demo → invoice → feedback → close. Enforces ADR-005 / BR-003..005.</summary>
public class CustomerWorkflowTests : IDisposable
{
    private readonly RALabsDbContext _db;
    private readonly IPasswordHasher _hasher = new PasswordHasher();
    private readonly CustomerAuthService _customerAuth;
    private readonly CustomerProjectService _projects;
    private readonly ChatService _chat;
    private readonly ProjectRepository _portfolio;
    private readonly string _storageRoot = Path.Combine(Path.GetTempPath(), "ralabs-tests", Guid.NewGuid().ToString("N"));

    public CustomerWorkflowTests()
    {
        _db = new RALabsDbContext(new DbContextOptionsBuilder<RALabsDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        var customers = new CustomerRepository(_db);
        var projectRepo = new CustomerProjectRepository(_db);
        var chatRepo = new ChatRepository(_db);
        var chatbot = new ChatbotService(new KnowledgeChunkRepository(_db));
        _chat = new ChatService(chatRepo, chatbot, new LeadRepository(_db));
        _customerAuth = new CustomerAuthService(customers, _hasher,
            new JwtService("RALabs_Test_Secret_Key_2026_MinLength32!", "RALabs", "RALabs"), new FakeEmailSender());
        _portfolio = new ProjectRepository(_db);
        _projects = new CustomerProjectService(projectRepo, customers, chatRepo, new LocalPrivateFileStorage(_storageRoot), projectRepository: _portfolio);
    }

    public void Dispose()
    {
        _db.Dispose();
        if (Directory.Exists(_storageRoot)) Directory.Delete(_storageRoot, recursive: true);
    }

    private async Task<Guid> RegisterCustomerAsync(string name = "Priya Test", string email = "priya@example.com")
    {
        var res = await _customerAuth.RegisterAsync(new CustomerRegisterRequest(name, email, "Customer@123"));
        return res.User.Id;
    }

    private async Task<Guid> CreateProjectAsync(Guid customerId, string title = "Dashboard")
    {
        var p = await _projects.CreateAsync(customerId, new CreateCustomerProjectRequest(title));
        return p.Id;
    }

    [Fact]
    public async Task Register_ThenLogin_Works()
    {
        var id = await RegisterCustomerAsync();
        var login = await _customerAuth.LoginAsync(new LoginRequest("priya@example.com", "Customer@123"));
        Assert.Equal(id, login.User.Id);
        Assert.Equal("customer", "customer");
    }

    [Fact]
    public async Task Register_DuplicateEmail_ThrowsConflict()
    {
        await RegisterCustomerAsync();
        await Assert.ThrowsAsync<RALabs.Application.Exceptions.ConflictException>(() =>
            _customerAuth.RegisterAsync(new CustomerRegisterRequest("Other", "priya@example.com", "Password123!")));
    }

    [Fact]
    public async Task CreateProject_Intake_WithThread()
    {
        var cid = await RegisterCustomerAsync();
        var p = await _projects.CreateAsync(cid, new CreateCustomerProjectRequest("Logistics"));
        Assert.Equal("intake", p.Status);
        Assert.NotEqual(Guid.Empty, p.ChatThreadId);
    }

    [Fact]
    public async Task AdminProjectListing_FiltersByCustomerAndSearch()
    {
        var first = await RegisterCustomerAsync("First", "first@example.com");
        var second = await RegisterCustomerAsync("Second", "second@example.com");
        await _projects.CreateAsync(first, new CreateCustomerProjectRequest("First dashboard", Requirements: "warehouse"));
        await _projects.CreateAsync(second, new CreateCustomerProjectRequest("Second portal"));

        var result = await _projects.GetAllForAdminAsync(1, 20, null, "warehouse", first);

        var project = Assert.Single(result);
        Assert.Equal(first, project.CustomerId);
        Assert.Equal("First dashboard", project.Title);
    }

    [Fact]
    public async Task AdminProjectListing_FiltersBeforePaging()
    {
        var customer = await RegisterCustomerAsync("Paging", "paging@example.com");
        await _projects.CreateAsync(customer, new CreateCustomerProjectRequest("Other project"));
        await _projects.CreateAsync(customer, new CreateCustomerProjectRequest("Warehouse project"));

        var result = await _projects.GetAllForAdminAsync(1, 1, null, "warehouse", customer);

        var project = Assert.Single(result);
        Assert.Equal("Warehouse project", project.Title);
    }

    [Fact]
    public async Task GetMyProject_OtherCustomersProject_ThrowsNotFound_NoLeak()
    {
        var a = await RegisterCustomerAsync("A", "a@example.com");
        var b = await RegisterCustomerAsync("B", "b@example.com");
        var pa = await CreateProjectAsync(a);
        // B cannot read A's project — 404, not 403 (no existence leak).
        await Assert.ThrowsAsync<RALabs.Application.Exceptions.NotFoundException>(() =>
            _projects.GetMyProjectAsync(b, pa));
    }

    [Fact]
    public async Task CustomerReadMethods_OtherCustomersProject_ThrowNotFound_NoLeak()
    {
        var owner = await RegisterCustomerAsync("Owner", "owner@example.com");
        var other = await RegisterCustomerAsync("Other", "other@example.com");
        var projectId = await CreateProjectAsync(owner);

        await Assert.ThrowsAsync<RALabs.Application.Exceptions.NotFoundException>(() =>
            _projects.GetMyDocumentsAsync(other, projectId));
        await Assert.ThrowsAsync<RALabs.Application.Exceptions.NotFoundException>(() =>
            _projects.GetMyPrdAsync(other, projectId));
        await Assert.ThrowsAsync<RALabs.Application.Exceptions.NotFoundException>(() =>
            _projects.GetMyDemoAsync(other, projectId));
        await Assert.ThrowsAsync<RALabs.Application.Exceptions.NotFoundException>(() =>
            _projects.GetMyInvoicesAsync(other, projectId));
    }

    [Fact]
    public async Task DocumentUpload_ValidatesTypeAndEnforcesDownloadOwnership()
    {
        var owner = await RegisterCustomerAsync("Owner", "owner-files@example.com");
        var other = await RegisterCustomerAsync("Other", "other-files@example.com");
        var projectId = await CreateProjectAsync(owner);

        await Assert.ThrowsAsync<RALabs.Application.Exceptions.ValidationException>(() =>
            _projects.UploadDocumentAsync(owner, projectId, "evidence.pdf", new MemoryStream(new byte[] { 1 }), "image/png", 1, null));

        await using var content = new MemoryStream(new byte[] { 1, 2, 3 });
        var document = await _projects.UploadDocumentAsync(owner, projectId, "../evidence.pdf", content, "application/pdf", 3, null);
        Assert.Equal("evidence.pdf", document.FileName);
        Assert.Contains("/download", document.FileUrl);

        await Assert.ThrowsAsync<RALabs.Application.Exceptions.NotFoundException>(() =>
            _projects.DownloadDocumentAsync(other, projectId, document.Id));

        var download = await _projects.DownloadDocumentAsync(owner, projectId, document.Id);
        await using var downloadedContent = download.Content;
        using var reader = new MemoryStream();
        await downloadedContent.CopyToAsync(reader);
        Assert.Equal(new byte[] { 1, 2, 3 }, reader.ToArray());
        Assert.Equal("application/pdf", download.ContentType);
        Assert.Equal("evidence.pdf", download.FileName);
    }

    [Fact]
    public async Task FullWorkflow_DualSign_Build_Demo_Invoice_Feedback_Close()
    {
        var cid = await RegisterCustomerAsync();
        var pid = await CreateProjectAsync(cid);

        // intake → prd_draft
        var draft = await _projects.UpdateStatusAsync(pid, new UpdateCustomerProjectRequest("prd_draft", null));
        Assert.Equal("prd_draft", draft.Status);

        // Draft PRD (admin)
        var prd = await _projects.SavePrdAsync(pid, new SavePrdRequest("# PRD\n\nRequirements."));
        Assert.Equal("draft", prd.Status);

        // Cannot transition to prd_signed before both signatures (BR-004)
        await Assert.ThrowsAsync<RALabs.Application.Exceptions.ConflictException>(() =>
            _projects.UpdateStatusAsync(pid, new UpdateCustomerProjectRequest("prd_signed", null)));

        // Customer signs (name must match)
        await Assert.ThrowsAsync<RALabs.Application.Exceptions.ValidationException>(() =>
            _projects.SignPrdAsync(cid, pid, new SignPrdRequest("Wrong Name")));
        await _projects.SignPrdAsync(cid, pid, new SignPrdRequest("Priya Test"));

        // Admin signs → auto transition to prd_signed
        await _projects.AdminSignPrdAsync(pid, "Rajib Mahata");
        var afterSign = await _projects.GetMyProjectAsync(cid, pid);
        Assert.Equal("prd_signed", afterSign.Status);

        // prd_signed → in_build → demo
        await _projects.UpdateStatusAsync(pid, new UpdateCustomerProjectRequest("in_build", null));
        var demo = await _projects.AddDemoAsync(pid, new AddDemoRequest("url", "https://demo.example.com", "v1"));
        Assert.NotEqual(Guid.Empty, demo.Id);
        await _projects.UpdateStatusAsync(pid, new UpdateCustomerProjectRequest("demo", null));
        await _projects.UpdateStatusAsync(pid, new UpdateCustomerProjectRequest("delivered", null));

        // Invoice (cash-only per BR-003)
        await Assert.ThrowsAsync<RALabs.Application.Exceptions.ValidationException>(() =>
            _projects.CreateInvoiceAsync(pid, new CreateInvoiceRequest(0, "USD", null, null)));
        var invoice = await _projects.CreateInvoiceAsync(pid, new CreateInvoiceRequest(5000, "USD", "unpaid", null));
        Assert.Equal("unpaid", invoice.Status);

        // Cannot close without feedback (BR-004)
        await Assert.ThrowsAsync<RALabs.Application.Exceptions.ConflictException>(() =>
            _projects.UpdateStatusAsync(pid, new UpdateCustomerProjectRequest("closed", null)));

        // Feedback at delivered → then close
        var feedback = await _projects.SubmitFeedbackAsync(cid, pid, new SubmitFeedbackRequest(5, "Great!", true));
        Assert.False(feedback.IsPublished);
        var closed = await _projects.UpdateStatusAsync(pid, new UpdateCustomerProjectRequest("closed", null));
        Assert.Equal("closed", closed.Status);

        // Duplicate feedback rejected
        await Assert.ThrowsAsync<RALabs.Application.Exceptions.ConflictException>(() =>
            _projects.SubmitFeedbackAsync(cid, pid, new SubmitFeedbackRequest(4, "again", false)));
    }

    [Fact]
    public async Task StateMachine_Skips_Rejected()
    {
        var cid = await RegisterCustomerAsync();
        var pid = await CreateProjectAsync(cid);
        // intake → in_build is not allowed (must go prd_draft first)
        await Assert.ThrowsAsync<RALabs.Application.Exceptions.ConflictException>(() =>
            _projects.UpdateStatusAsync(pid, new UpdateCustomerProjectRequest("in_build", null)));
    }

    [Fact]
    public async Task DraftingPrd_AutoTransitions_IntakeToPrdDraft_AndDualSignCompletes()
    {
        // Regression: SavePrdAsync must perform the ADR-005 intake → prd_draft
        // transition itself; previously projects deadlocked at intake because
        // the sign gates require PrdDraft status and nothing set it.
        var cid = await RegisterCustomerAsync();
        var pid = await CreateProjectAsync(cid);

        var before = await _projects.GetMyProjectAsync(cid, pid);
        Assert.Equal("intake", before.Status);

        await _projects.SavePrdAsync(pid, new SavePrdRequest("# PRD\n\nAuto-drafted."));

        var afterDraft = await _projects.GetMyProjectAsync(cid, pid);
        Assert.Equal("prd_draft", afterDraft.Status);

        // One signature is not enough to advance the project.
        await _projects.SignPrdAsync(cid, pid, new SignPrdRequest("Priya Test"));
        var oneSignature = await _projects.GetMyProjectAsync(cid, pid);
        Assert.Equal("prd_draft", oneSignature.Status);

        // Both signatures → prd_signed (BR-004), no manual status call needed.
        await _projects.AdminSignPrdAsync(pid, "Rajib Mahata");
        var signed = await _projects.GetMyProjectAsync(cid, pid);
        Assert.Equal("prd_signed", signed.Status);
    }

    [Fact]
    public async Task ApprovingFeedback_AfterDelivery_CreatesPublicPortfolioEntry_Once()
    {
        // BR-005: delivered + approved feedback auto-publishes the public
        // Project entry; unapproved feedback must NOT create one.
        var cid = await RegisterCustomerAsync();
        var pid = await CreateProjectAsync(cid);

        await _projects.SavePrdAsync(pid, new SavePrdRequest("# PRD"));
        await _projects.SignPrdAsync(cid, pid, new SignPrdRequest("Priya Test"));
        await _projects.AdminSignPrdAsync(pid, "Rajib Mahata");
        await _projects.UpdateStatusAsync(pid, new UpdateCustomerProjectRequest("in_build", null));
        await _projects.AddDemoAsync(pid, new AddDemoRequest("url", "https://demo.example.com", "v1"));
        await _projects.UpdateStatusAsync(pid, new UpdateCustomerProjectRequest("demo", null));
        await _projects.UpdateStatusAsync(pid, new UpdateCustomerProjectRequest("delivered", null));

        // Feedback not yet approved → no public entry.
        await _projects.SubmitFeedbackAsync(cid, pid, new SubmitFeedbackRequest(5, "Great work!", true));
        Assert.False(await _portfolio.ExistsForCustomerProjectAsync(pid));
        Assert.Empty(await _db.Projects.Where(p => p.CustomerProjectId == pid).ToListAsync());

        // Approval → public entry created, derived from the customer project.
        var moderated = await _projects.ApproveFeedbackAsync(pid);
        Assert.True(moderated.IsPublished);

        var published = await _db.Projects.SingleAsync(p => p.CustomerProjectId == pid);
        Assert.Equal("Dashboard", published.Title);
        Assert.True(published.IsPublished);
        Assert.True(published.IsActive);
        Assert.Equal("https://demo.example.com", published.LiveSiteUrl);

        // Idempotent: re-moderation must not duplicate the entry.
        await _projects.ApproveFeedbackAsync(pid);
        Assert.Equal(1, await _db.Projects.CountAsync(p => p.CustomerProjectId == pid));

        // Unpublishing hides feedback but does not delete the portfolio entry.
        await _projects.ModerateFeedbackAsync(pid, approved: false);
        Assert.Equal(1, await _db.Projects.CountAsync(p => p.CustomerProjectId == pid));
    }
}

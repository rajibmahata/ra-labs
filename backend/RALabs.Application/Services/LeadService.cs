using RALabs.Application.Common;
using RALabs.Application.DTOs;
using RALabs.Domain.Entities;
using RALabs.Domain.Enums;
using RALabs.Domain.Interfaces;

namespace RALabs.Application.Services;

public interface ILeadService
{
    Task<LeadDto> CreateAsync(CreateLeadRequest request);
    Task<PaginatedResult<LeadDto>> GetAllAsync(string? status, string? source, int? page, int? pageSize);
    Task<LeadDto> UpdateAsync(Guid id, UpdateLeadRequest request);
}

public class LeadService : ILeadService
{
    private readonly ILeadRepository _repo;
    private readonly INotificationService? _notifications;

    public LeadService(ILeadRepository repo, INotificationService? notifications = null)
    {
        _repo = repo;
        _notifications = notifications;
    }

    public async Task<LeadDto> CreateAsync(CreateLeadRequest r)
    {
        Guard.Reset();
        Guard.Required(r.Name, "name", 100);
        Guard.EmailOrPhone(r.ContactInfo, "contactInfo", 200);
        Guard.Required(r.Message, "message", 2000);
        Guard.InSet(r.Source, "source", new[] { "form", "chatbot" });
        Guard.ThrowIfAny("lead");

        var lead = new Lead
        {
            Id = Guid.NewGuid(),
            Name = r.Name.Trim(),
            ContactInfo = r.ContactInfo.Trim(),
            Message = r.Message.Trim(),
            Source = r.Source.Equals("chatbot", StringComparison.OrdinalIgnoreCase) ? LeadSource.Chatbot : LeadSource.Form,
            Status = LeadStatus.New,
            CreatedAt = DateTime.UtcNow
        };
        var id = await _repo.AddAsync(lead);
        lead.Id = id;
        if (_notifications is not null)
        {
            await _notifications.CreateAsync(
                "lead",
                "New contact request",
                $"{lead.Name} sent a new {lead.Source.ToString().ToLowerInvariant()} request.",
                leadId: lead.Id);
        }
        return ToDto(lead);
    }

    public async Task<PaginatedResult<LeadDto>> GetAllAsync(string? status, string? source, int? page, int? pageSize)
    {
        var (p, ps) = PageRequest.Normalize(page, pageSize);
        LeadStatus? statusFilter = null;
        if (!string.IsNullOrWhiteSpace(status))
        {
            Guard.Reset();
            Guard.EnumValue<LeadStatus>(status, "status");
            Guard.ThrowIfAny("lead filter");
            statusFilter = Enum.Parse<LeadStatus>(status, true);
        }
        LeadSource? sourceFilter = null;
        if (!string.IsNullOrWhiteSpace(source))
        {
            Guard.Reset();
            Guard.EnumValue<LeadSource>(source, "source");
            Guard.ThrowIfAny("lead filter");
            sourceFilter = Enum.Parse<LeadSource>(source, true);
        }

        var items = await _repo.GetAllAsync(statusFilter, sourceFilter, p, ps);
        var total = await _repo.CountAsync(statusFilter, sourceFilter);
        return new PaginatedResult<LeadDto>
        {
            Items = items.Select(ToDto).ToList(),
            Page = p,
            PageSize = ps,
            TotalCount = total
        };
    }

    public async Task<LeadDto> UpdateAsync(Guid id, UpdateLeadRequest r)
    {
        Guard.NotDefault(id, "id");
        Guard.MaxLength(r.Notes, "notes", 2000);
        if (r.Status is not null) Guard.EnumValue<LeadStatus>(r.Status, "status");
        Guard.ThrowIfAny("lead update");

        var lead = await _repo.GetByIdAsync(id)
            ?? throw new Exceptions.NotFoundException("Lead not found.");

        if (r.Status is not null)
            lead.Status = Enum.Parse<LeadStatus>(r.Status, true);
        if (r.Notes is not null)
            lead.Notes = r.Notes;
        lead.UpdatedAt = DateTime.UtcNow;
        await _repo.UpdateAsync(lead);
        return ToDto(lead);
    }

    private static LeadDto ToDto(Lead l) => new(
        l.Id, l.Name, l.ContactInfo, l.Message,
        l.Source == LeadSource.Chatbot ? "chatbot" : "form",
        l.Status.ToString().ToLowerInvariant(), l.Notes, l.CreatedAt, l.UpdatedAt);
}

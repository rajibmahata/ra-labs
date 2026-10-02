using System.Globalization;
using System.Text;
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
    Task<LeadImportResultDto> ImportAsync(Stream csv);
    Task<byte[]> ExportAsync(string? status, string? source);
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

    public async Task<LeadImportResultDto> ImportAsync(Stream csv)
    {
        using var reader = new StreamReader(csv, Encoding.UTF8, leaveOpen: true);
        var rows = new List<string[]>();
        string? line;
        while ((line = await reader.ReadLineAsync()) is not null)
        {
            if (!string.IsNullOrWhiteSpace(line)) rows.Add(CsvHelper.ParseLine(line));
            if (rows.Count > ImportMaxRows + 1) break;
        }

        var errors = new List<ImportErrorDto>();
        if (rows.Count == 0)
            return new LeadImportResultDto(0, 0, new List<ImportErrorDto> { new(1, "The CSV file is empty.") });
        if (rows[0].Length != 4 || !rows[0][0].Equals("name", StringComparison.OrdinalIgnoreCase) ||
            !rows[0][1].Equals("contactInfo", StringComparison.OrdinalIgnoreCase) ||
            !rows[0][2].Equals("message", StringComparison.OrdinalIgnoreCase) ||
            !rows[0][3].Equals("source", StringComparison.OrdinalIgnoreCase))
            return new LeadImportResultDto(0, 0, new List<ImportErrorDto> { new(1, "Headers must be: name,contactInfo,message,source.") });
        if (rows.Count - 1 > ImportMaxRows)
            return new LeadImportResultDto(0, 0, new List<ImportErrorDto> { new(2, $"Import cannot exceed {ImportMaxRows} rows.") });

        var created = 0;
        var skipped = 0;
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        for (var index = 1; index < rows.Count; index++)
        {
            var rowNumber = index + 1;
            var row = rows[index];
            if (row.Length != 4)
            {
                errors.Add(new(rowNumber, "Each row must contain name, contactInfo, message, and source."));
                continue;
            }
            var name = row[0].Trim();
            var contactInfo = row[1].Trim();
            var message = row[2].Trim();
            var source = row[3].Trim();
            Guard.Reset();
            Guard.Required(name, "name", 100);
            Guard.EmailOrPhone(contactInfo, "contactInfo", 200);
            Guard.Required(message, "message", 2000);
            Guard.InSet(source, "source", new[] { "form", "chatbot" });
            try { Guard.ThrowIfAny("lead row"); }
            catch (Exceptions.ValidationException ex) { errors.Add(new(rowNumber, ex.Message)); continue; }
            if (!seen.Add(contactInfo) || await _repo.ContactInfoExistsAsync(contactInfo))
            {
                skipped++;
                errors.Add(new(rowNumber, "A lead with this contact info already exists."));
                continue;
            }
            await _repo.AddAsync(new Lead
            {
                Id = Guid.NewGuid(),
                Name = name,
                ContactInfo = contactInfo,
                Message = message,
                Source = source.Equals("chatbot", StringComparison.OrdinalIgnoreCase) ? LeadSource.Chatbot : LeadSource.Form,
                Status = LeadStatus.New,
                CreatedAt = DateTime.UtcNow
            });
            created++;
        }
        return new LeadImportResultDto(created, skipped, errors);
    }

    public async Task<byte[]> ExportAsync(string? status, string? source)
    {
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

        var leads = await _repo.GetAllAsync(statusFilter, sourceFilter, 1, int.MaxValue);
        var builder = new StringBuilder("id,name,contactInfo,message,source,status,notes,createdAt\r\n");
        foreach (var lead in leads)
        {
            builder.AppendLine(string.Join(',',
                lead.Id,
                CsvHelper.Escape(lead.Name),
                CsvHelper.Escape(lead.ContactInfo),
                CsvHelper.Escape(lead.Message),
                lead.Source == LeadSource.Chatbot ? "chatbot" : "form",
                lead.Status.ToString().ToLowerInvariant(),
                CsvHelper.Escape(lead.Notes ?? string.Empty),
                lead.CreatedAt.ToString("O", CultureInfo.InvariantCulture)));
        }
        return Encoding.UTF8.GetBytes(builder.ToString());
    }

    private const int ImportMaxRows = 500;

    private static LeadDto ToDto(Lead l) => new(
        l.Id, l.Name, l.ContactInfo, l.Message,
        l.Source == LeadSource.Chatbot ? "chatbot" : "form",
        l.Status.ToString().ToLowerInvariant(), l.Notes, l.CreatedAt, l.UpdatedAt);
}

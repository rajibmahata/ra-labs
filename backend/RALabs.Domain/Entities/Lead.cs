using RALabs.Domain.Enums;

namespace RALabs.Domain.Entities;

public class Lead
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string ContactInfo { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public LeadSource Source { get; set; }
    public LeadStatus Status { get; set; } = LeadStatus.New;
    public string? Notes { get; set; }
    public Guid? ChatThreadId { get; set; }
    public ChatThread? ChatThread { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
}

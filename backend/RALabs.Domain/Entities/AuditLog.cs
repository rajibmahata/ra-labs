namespace RALabs.Domain.Entities;

/// <summary>
/// Append-only audit trail for privileged actions (admin auth, admin and
/// team CRUD, settings, portfolio, content, RAG and GitHub operations).
/// </summary>
public class AuditLog
{
    public Guid Id { get; set; }
    public Guid? ActorId { get; set; }
    public string? ActorName { get; set; }
    public string Action { get; set; } = string.Empty;
    public string? EntityType { get; set; }
    public string? EntityId { get; set; }
    public string? Details { get; set; }
    public string? IpAddress { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

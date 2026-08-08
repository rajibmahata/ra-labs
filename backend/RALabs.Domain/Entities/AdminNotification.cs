namespace RALabs.Domain.Entities;

public class AdminNotification
{
    public Guid Id { get; set; }
    public string Type { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public Guid? RelatedLeadId { get; set; }
    public Guid? RelatedThreadId { get; set; }
    public Guid? RelatedCustomerId { get; set; }
    public Guid? RelatedCustomerProjectId { get; set; }
    public bool IsRead { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? ReadAt { get; set; }
}

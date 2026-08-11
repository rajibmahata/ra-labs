namespace RALabs.Domain.Entities;

public class ContentDraft
{
    public Guid Id { get; set; }
    public string Kind { get; set; } = "project";
    public string Title { get; set; } = string.Empty;
    public string Summary { get; set; } = string.Empty;
    public string? Body { get; set; }
    public string? SourceUrl { get; set; }
    public string? SourceSnapshot { get; set; }
    public string Status { get; set; } = "pending";
    public string? ReviewNote { get; set; }
    public Guid? ProjectDraftId { get; set; }
    public Guid? ApprovedProjectId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? ReviewedAt { get; set; }
}
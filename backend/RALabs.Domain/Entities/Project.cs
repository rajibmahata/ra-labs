using RALabs.Domain.Enums;

namespace RALabs.Domain.Entities;

public class Project
{
    public Guid Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public string Summary { get; set; } = string.Empty;
    public List<string> StackTags { get; set; } = new();
    public ProjectStatus Status { get; set; } = ProjectStatus.InBuild;
    public string? GithubUrl { get; set; }
    public string? LiveSiteUrl { get; set; }
    public string? Category { get; set; }
    public string? BusinessPurpose { get; set; }
    public string? ProblemSolved { get; set; }
    public string? Solution { get; set; }
    public List<string> KeyFeatures { get; set; } = new();
    public string? CaseStudyBody { get; set; }
    public string? CoverImageUrl { get; set; }
    public List<string> Screenshots { get; set; } = new();
    public string? Duration { get; set; }
    public List<Guid> TeamMemberIds { get; set; } = new();
    public DateTime? CompletedAt { get; set; }
    public string? CustomerReference { get; set; }
    public bool ShowCustomerReference { get; set; }
    public int SortOrder { get; set; }
    public bool IsFeatured { get; set; }
    public bool IsActive { get; set; } = true;
    public bool IsPublished { get; set; }
    public bool IsDeleted { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
    public Guid? CustomerProjectId { get; set; }
}

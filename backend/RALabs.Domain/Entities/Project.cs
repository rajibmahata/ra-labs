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
    public string? CaseStudyBody { get; set; }
    public string? CoverImageUrl { get; set; }
    public int SortOrder { get; set; }
    public bool IsPublished { get; set; }
    public bool IsDeleted { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
    public Guid? CustomerProjectId { get; set; }
}

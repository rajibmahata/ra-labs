namespace RALabs.Domain.Entities;

public class GithubRepository
{
    public Guid Id { get; set; }
    public string Owner { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string HtmlUrl { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? Readme { get; set; }
    public string? PrimaryLanguage { get; set; }
    public string TechnologiesJson { get; set; } = "[]";
    public DateTime? PushedAt { get; set; }
    public DateTime SyncedAt { get; set; } = DateTime.UtcNow;
}
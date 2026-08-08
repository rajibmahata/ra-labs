namespace RALabs.Domain.Entities;

public class TeamMember
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public string Bio { get; set; } = string.Empty;
    public string? GithubUsername { get; set; }
    public string? GithubAccountUrl { get; set; }
    public string? GithubTokenEncrypted { get; set; }
    public string? AvatarUrl { get; set; }
    public string? Email { get; set; }
    public string? LinkedinUrl { get; set; }
    public string? Location { get; set; }
    public bool IsPublished { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
    public List<GithubSnapshot> GithubSnapshots { get; set; } = new();
}

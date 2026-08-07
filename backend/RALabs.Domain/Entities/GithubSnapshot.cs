namespace RALabs.Domain.Entities;

public class GithubSnapshot
{
    public Guid Id { get; set; }
    public Guid TeamMemberId { get; set; }
    public TeamMember TeamMember { get; set; } = null!;
    public int Commits90d { get; set; }
    public int ActiveRepos { get; set; }
    public DateTime? LastCommitAt { get; set; }
    public DateTime CapturedAt { get; set; } = DateTime.UtcNow;
}

using System.Net.Http.Headers;
using System.Text.Json;
using System.Text.Json.Serialization;
using RALabs.Application.Services;
using RALabs.Domain.Entities;
using RALabs.Domain.Enums;
using RALabs.Domain.Interfaces;

namespace RALabs.Application.Services;

public interface IGithubSyncService
{
    Task<GithubSyncResult> SyncMemberAsync(TeamMember member, CancellationToken ct);
    Task<GithubSyncResult> SyncAllAsync(CancellationToken ct);
}

public record GithubSyncResult(string Type, string? MemberName, string Status, int Commits90d, int ActiveRepos, DateTime? LastCommitAt, string? Error);

public class GithubSyncService : IGithubSyncService
{
    private readonly ITeamRepository _team;
    private readonly IAgentTaskRepository _tasks;
    private readonly IHttpClientFactory _httpFactory;
    private readonly string? _token;

    public GithubSyncService(ITeamRepository team, IAgentTaskRepository tasks, IHttpClientFactory httpFactory, string? token)
    {
        _team = team;
        _tasks = tasks;
        _httpFactory = httpFactory;
        _token = token;
    }

    public async Task<GithubSyncResult> SyncAllAsync(CancellationToken ct)
    {
        var members = await _team.GetAllAsync();
        var results = new List<GithubSyncResult>();
        foreach (var m in members.Where(x => !string.IsNullOrWhiteSpace(x.GithubUsername)))
            results.Add(await SyncMemberAsync(m, ct));
        return results.FirstOrDefault() ?? new GithubSyncResult("github-sync", null, "skipped", 0, 0, null, "No team members with github_username.");
    }

    public async Task<GithubSyncResult> SyncMemberAsync(TeamMember member, CancellationToken ct)
    {
        var taskId = await _tasks.AddAsync(new AgentTask
        {
            Id = Guid.NewGuid(),
            Type = "github-sync",
            Status = AgentTaskStatus.Running,
            Payload = JsonSerializer.Serialize(new { memberId = member.Id, githubUsername = member.GithubUsername }),
            CreatedAt = DateTime.UtcNow
        });

        try
        {
            var username = member.GithubUsername!;
            var stats = await FetchStatsAsync(username, ct);

            await _team.AddSnapshotAsync(new GithubSnapshot
            {
                Id = Guid.NewGuid(),
                TeamMemberId = member.Id,
                Commits90d = stats.Commits90d,
                ActiveRepos = stats.ActiveRepos,
                LastCommitAt = stats.LastCommitAt,
                CapturedAt = DateTime.UtcNow
            });

            await _tasks.UpdateAsync(new AgentTask
            {
                Id = taskId,
                Type = "github-sync",
                Status = AgentTaskStatus.Completed,
                Payload = JsonSerializer.Serialize(new { memberId = member.Id, githubUsername = username }),
                Result = JsonSerializer.Serialize(stats),
                CompletedAt = DateTime.UtcNow,
                CreatedAt = DateTime.UtcNow
            });

            return new GithubSyncResult("github-sync", member.Name, "completed", stats.Commits90d, stats.ActiveRepos, stats.LastCommitAt, null);
        }
        catch (Exception ex)
        {
            await _tasks.UpdateAsync(new AgentTask
            {
                Id = taskId,
                Type = "github-sync",
                Status = AgentTaskStatus.Failed,
                Payload = JsonSerializer.Serialize(new { memberId = member.Id, githubUsername = member.GithubUsername }),
                Error = ex.Message,
                CompletedAt = DateTime.UtcNow,
                CreatedAt = DateTime.UtcNow
            });
            return new GithubSyncResult("github-sync", member.Name, "failed", 0, 0, null, ex.Message);
        }
    }

    private async Task<(int Commits90d, int ActiveRepos, DateTime? LastCommitAt)> FetchStatsAsync(string username, CancellationToken ct)
    {
        using var http = _httpFactory.CreateClient("github");
        http.DefaultRequestHeaders.UserAgent.ParseAdd("RALabs");
        if (!string.IsNullOrWhiteSpace(_token))
            http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", _token);

        // Repos
        var repos = new List<GithubRepoDto>();
        for (var page = 1; page <= 3; page++)
        {
            var url = $"https://api.github.com/users/{username}/repos?per_page=100&page={page}&sort=pushed";
            var response = await http.GetAsync(url, ct);
            if (!response.IsSuccessStatusCode) break;
            var json = await response.Content.ReadAsStringAsync(ct);
            var batch = JsonSerializer.Deserialize<List<GithubRepoDto>>(json, JsonOpts) ?? new();
            if (batch.Count == 0) break;
            repos.AddRange(batch);
            if (batch.Count < 100) break;
        }

        var cutoff = DateTime.UtcNow.AddDays(-90);
        var recent = repos.Where(r => r.PushedAt.HasValue && r.PushedAt.Value.ToUniversalTime() >= cutoff).ToList();
        var activeRepos = recent.Count;

        // Commits in last 90d via events endpoint (simplified: sum per recent repo, capped)
        var commits90d = 0;
        var lastCommit = repos
            .Where(r => r.PushedAt.HasValue)
            .Select(r => r.PushedAt!.Value.ToUniversalTime())
            .OrderByDescending(x => x)
            .Cast<DateTime?>()
            .FirstOrDefault();

        foreach (var repo in recent.Take(5))
        {
            try
            {
                var url = $"https://api.github.com/repos/{username}/{repo.Name}/commits?per_page=100&since={cutoff:yyyy-MM-ddTHH:mm:ssZ}";
                var response = await http.GetAsync(url, ct);
                if (!response.IsSuccessStatusCode) continue;
                var json = await response.Content.ReadAsStringAsync(ct);
                var commits = JsonSerializer.Deserialize<List<JsonElement>>(json, JsonOpts) ?? new();
                commits90d += commits.Count;
                if (commits.Count == 100) commits90d += 50; // heuristic cap for pagination
            }
            catch { }
        }

        return (commits90d, activeRepos, lastCommit == default ? null : lastCommit);
    }

    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNameCaseInsensitive = true,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
    };
}

internal class GithubRepoDto
{
    public string? Name { get; set; }
    public DateTimeOffset? PushedAt { get; set; }
}

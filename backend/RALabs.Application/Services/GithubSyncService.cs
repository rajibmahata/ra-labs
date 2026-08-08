using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Security.Cryptography;
using RALabs.Application.Services;
using RALabs.Domain.Entities;
using RALabs.Domain.Enums;
using RALabs.Domain.Interfaces;
using Microsoft.AspNetCore.DataProtection;

namespace RALabs.Application.Services;

public interface IGithubSyncService
{
    Task<GithubSyncResult> SyncMemberAsync(TeamMember member, CancellationToken ct);
    Task<GithubSyncResult> SyncAllAsync(CancellationToken ct);
}

public record GithubSyncResult(string Type, string? MemberName, string Status, int Commits90d, int ActiveRepos, DateTime? LastCommitAt, string? Error, int ChangedRepositories = 0, int AnalysisTasksQueued = 0);

public class GithubSyncService : IGithubSyncService
{
    private readonly ITeamRepository _team;
    private readonly IAgentTaskRepository _tasks;
    private readonly IGithubRepositoryRepository _repositories;
    private readonly IHttpClientFactory _httpFactory;
    private readonly string? _token;
    private readonly IDataProtector _githubProtector;

    public GithubSyncService(ITeamRepository team, IAgentTaskRepository tasks, IGithubRepositoryRepository repositories, IHttpClientFactory httpFactory, string? token, IDataProtectionProvider protectionProvider)
    {
        _team = team;
        _tasks = tasks;
        _repositories = repositories;
        _httpFactory = httpFactory;
        _token = token;
        _githubProtector = protectionProvider.CreateProtector("RALabs.TeamMember.GithubToken.v1");
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
            var memberToken = string.IsNullOrWhiteSpace(member.GithubTokenEncrypted)
                ? _token
                : _githubProtector.Unprotect(member.GithubTokenEncrypted);
            var stats = await FetchStatsAsync(username, memberToken, ct);

            var changedRepositories = 0;
            foreach (var repo in stats.Repositories)
            {
                var existing = await _repositories.GetByFullNameAsync(repo.FullName);
                if (existing is null || HasMeaningfulChange(existing, repo))
                    changedRepositories++;
                await _repositories.UpsertAsync(repo);
            }

            var analysisTasksQueued = 0;
            if (changedRepositories > 0)
            {
                await _tasks.AddAsync(new AgentTask
                {
                    Id = Guid.NewGuid(),
                    Type = "github-reanalysis",
                    Status = AgentTaskStatus.Pending,
                    Payload = JsonSerializer.Serialize(new
                    {
                        memberId = member.Id,
                        githubUsername = username,
                        changedRepositories,
                        reason = "meaningful repository metadata or README change"
                    }),
                    CreatedAt = DateTime.UtcNow
                });
                analysisTasksQueued = 1;
            }

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

            return new GithubSyncResult("github-sync", member.Name, "completed", stats.Commits90d, stats.ActiveRepos, stats.LastCommitAt, null, changedRepositories, analysisTasksQueued);
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

    private static bool HasMeaningfulChange(GithubRepository existing, GithubRepository current)
    {
        return ComputeFingerprint(existing) != ComputeFingerprint(current);
    }

    private static string ComputeFingerprint(GithubRepository repository)
    {
        var source = string.Join("\n", repository.FullName, repository.Description, repository.Readme,
            repository.PrimaryLanguage, repository.TechnologiesJson, repository.PushedAt?.ToUniversalTime().ToString("O"));
        return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(source)));
    }

    private async Task<(int Commits90d, int ActiveRepos, DateTime? LastCommitAt, List<GithubRepository> Repositories)> FetchStatsAsync(string username, string? token, CancellationToken ct)
    {
        using var http = _httpFactory.CreateClient("github");
        http.DefaultRequestHeaders.UserAgent.ParseAdd("RALabs");
        if (!string.IsNullOrWhiteSpace(token))
            http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

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
        var repositories = new List<GithubRepository>();
        foreach (var repo in repos)
        {
            var readme = await FetchReadmeAsync(http, username, repo.Name ?? string.Empty, ct);
            repositories.Add(new GithubRepository
            {
                Id = Guid.NewGuid(), Owner = username, Name = repo.Name ?? string.Empty,
                FullName = $"{username}/{repo.Name}", HtmlUrl = repo.HtmlUrl ?? $"https://github.com/{username}/{repo.Name}",
                Description = repo.Description, Readme = readme, PrimaryLanguage = repo.Language,
                TechnologiesJson = JsonSerializer.Serialize(new[] { repo.Language }.Where(x => !string.IsNullOrWhiteSpace(x))),
                PushedAt = repo.PushedAt?.UtcDateTime, SyncedAt = DateTime.UtcNow
            });
        }

        // Commits in last 90d via events endpoint (simplified: sum per recent repo, capped)
        var commits90d = 0;
        var lastCommit = repos
            .Where(r => r.PushedAt.HasValue)
            .Select(r => r.PushedAt!.Value.UtcDateTime)
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

        return (commits90d, activeRepos, lastCommit == default ? null : lastCommit, repositories);
    }

    private static async Task<string?> FetchReadmeAsync(HttpClient http, string username, string repoName, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(repoName)) return null;
        var response = await http.GetAsync($"https://api.github.com/repos/{username}/{repoName}/readme", ct);
        if (!response.IsSuccessStatusCode) return null;
        var payload = JsonSerializer.Deserialize<GithubReadmeDto>(await response.Content.ReadAsStringAsync(ct), JsonOpts);
        if (string.IsNullOrWhiteSpace(payload?.Content)) return null;
        try { return Encoding.UTF8.GetString(Convert.FromBase64String(payload.Content.Replace("\n", string.Empty))); }
        catch (FormatException) { return null; }
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
    public string? HtmlUrl { get; set; }
    public string? Description { get; set; }
    public string? Language { get; set; }
}

internal class GithubReadmeDto
{
    public string? Content { get; set; }
}

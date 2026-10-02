using RALabs.Domain.Enums;
using RALabs.Domain.Interfaces;

namespace RALabs.Application.Services;

/// <summary>Server-side dashboard aggregate (GAP-011): one call instead of
/// N client-side paginated fetches, so counts stay accurate at scale.
/// Also carries the RAG/GitHub observability surface (GAP-012).</summary>
public record DashboardStatsDto(
    int CustomersTotal,
    int CustomersActive,
    int CustomersInactive,
    int CustomerProjectsTotal,
    Dictionary<string, int> CustomerProjectsByStatus,
    int LeadsTotal,
    int LeadsNewTotal,
    int LeadsNew7d,
    Dictionary<string, int> LeadsByStatus,
    int ReviewsTotal,
    int ReviewsPublished,
    int ReviewsPending,
    int TeamTotal,
    int TeamActive,
    int PortfolioTotal,
    int PortfolioPublished,
    int DraftsPending,
    int ChatIntervention,
    int NotificationsUnread,
    DateTime? GithubSyncedAt,
    DateTime? GithubLastCommitAt,
    int GithubRepositories,
    int KnowledgeChunks,
    int AgentTasksPending);

public interface IDashboardStatsService
{
    Task<DashboardStatsDto> GetAsync();
}

public sealed class DashboardStatsService : IDashboardStatsService
{
    private readonly ICustomerRepository _customers;
    private readonly ICustomerProjectRepository _projects;
    private readonly ILeadRepository _leads;
    private readonly ITeamRepository _team;
    private readonly IProjectRepository _portfolio;
    private readonly IContentDraftRepository _drafts;
    private readonly IChatRepository _chat;
    private readonly INotificationRepository _notifications;
    private readonly IGithubRepositoryRepository _github;
    private readonly IKnowledgeChunkRepository _chunks;
    private readonly IAgentTaskRepository _tasks;

    public DashboardStatsService(
        ICustomerRepository customers,
        ICustomerProjectRepository projects,
        ILeadRepository leads,
        ITeamRepository team,
        IProjectRepository portfolio,
        IContentDraftRepository drafts,
        IChatRepository chat,
        INotificationRepository notifications,
        IGithubRepositoryRepository github,
        IKnowledgeChunkRepository chunks,
        IAgentTaskRepository tasks)
    {
        _customers = customers;
        _projects = projects;
        _leads = leads;
        _team = team;
        _portfolio = portfolio;
        _drafts = drafts;
        _chat = chat;
        _notifications = notifications;
        _github = github;
        _chunks = chunks;
        _tasks = tasks;
    }

    public async Task<DashboardStatsDto> GetAsync()
    {
        var since7d = DateTime.UtcNow.AddDays(-7);

        var customersTotal = await _customers.CountAllAsync();
        var customersActive = await _customers.CountAllAsync(isActive: true);
        var projectStatusCounts = await _projects.CountByStatusAsync();
        var leadsTotal = await _leads.CountAsync(null, null);
        var leadsNew = await _leads.CountAsync(LeadStatus.New, null);
        var leadsNew7d = await _leads.CountNewSinceAsync(since7d);
        var reviewsTotal = await _projects.CountFeedbacksForAdminAsync(null, null);
        var reviewsPublished = await _projects.CountFeedbacksForAdminAsync(null, true);
        var team = await _team.GetAllAsync();
        var portfolio = await _portfolio.GetAllAsync(includeUnpublished: true);
        var draftsPending = await _drafts.CountAsync("pending");
        var chatIntervention = await _chat.CountThreadsAsync(null, needsManualIntervention: true);
        var notificationsUnread = await _notifications.CountAsync(true);
        var githubRepositories = await _github.CountAsync(null);
        var knowledgeChunks = await _chunks.CountAsync();
        var taskCounts = await _tasks.CountByStatusAsync();

        DateTime? syncedAt = null;
        DateTime? lastCommitAt = null;
        var snapshots = await _team.GetLatestSnapshotsAsync(team.Select(m => m.Id));
        foreach (var snap in snapshots.Values)
        {
            if (snap.CapturedAt > syncedAt) syncedAt = snap.CapturedAt;
            if (snap.LastCommitAt > lastCommitAt) lastCommitAt = snap.LastCommitAt;
        }

        var leadStatusCounts = new Dictionary<string, int>();
        foreach (var status in new[] { LeadStatus.New, LeadStatus.Contacted, LeadStatus.Converted, LeadStatus.Closed })
            leadStatusCounts[status.ToString().ToLowerInvariant()] = await _leads.CountAsync(status, null);

        return new DashboardStatsDto(
            CustomersTotal: customersTotal,
            CustomersActive: customersActive,
            CustomersInactive: customersTotal - customersActive,
            CustomerProjectsTotal: projectStatusCounts.Values.Sum(),
            CustomerProjectsByStatus: projectStatusCounts
                .ToDictionary(kv => kv.Key.ToString().ToLowerInvariant(), kv => kv.Value),
            LeadsTotal: leadsTotal,
            LeadsNewTotal: leadsNew,
            LeadsNew7d: leadsNew7d,
            LeadsByStatus: leadStatusCounts,
            ReviewsTotal: reviewsTotal,
            ReviewsPublished: reviewsPublished,
            ReviewsPending: reviewsTotal - reviewsPublished,
            TeamTotal: team.Count,
            TeamActive: team.Count(m => m.IsActive),
            PortfolioTotal: portfolio.Count,
            PortfolioPublished: portfolio.Count(p => p.IsPublished),
            DraftsPending: draftsPending,
            ChatIntervention: chatIntervention,
            NotificationsUnread: notificationsUnread,
            GithubSyncedAt: syncedAt,
            GithubLastCommitAt: lastCommitAt,
            GithubRepositories: githubRepositories,
            KnowledgeChunks: knowledgeChunks,
            AgentTasksPending: taskCounts.GetValueOrDefault(AgentTaskStatus.Pending) + taskCounts.GetValueOrDefault(AgentTaskStatus.Running));
    }
}

using Microsoft.EntityFrameworkCore;
using RALabs.Application.Services;
using RALabs.Domain.Entities;
using RALabs.Domain.Enums;
using RALabs.Infrastructure.Data;

namespace RALabs.Tests;

/// <summary>Server-side dashboard aggregate (GAP-011) + RAG/GitHub observability
/// counts (GAP-012): single-call accuracy instead of N client-side fetches.</summary>
public class DashboardStatsTests
{
    private static RALabsDbContext CreateDb() => new(
        new DbContextOptionsBuilder<RALabsDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);

    [Fact]
    public async Task GetAsync_ReturnsAccurateCounts()
    {
        var db = CreateDb();
        var customerA = Guid.NewGuid();
        var customerB = Guid.NewGuid();
        db.Customers.AddRange(
            new Customer { Id = customerA, Name = "A", Email = "a@example.com", PasswordHash = "x", IsActive = true },
            new Customer { Id = customerB, Name = "B", Email = "b@example.com", PasswordHash = "x", IsActive = false });
        await db.SaveChangesAsync();
        db.CustomerProjects.AddRange(
            new CustomerProject { Id = Guid.NewGuid(), CustomerId = customerA, Title = "P1", Status = CustomerProjectStatus.Intake },
            new CustomerProject { Id = Guid.NewGuid(), CustomerId = customerA, Title = "P2", Status = CustomerProjectStatus.InBuild },
            new CustomerProject { Id = Guid.NewGuid(), CustomerId = customerA, Title = "P3", Status = CustomerProjectStatus.InBuild });
        db.Leads.AddRange(
            new Lead { Id = Guid.NewGuid(), Name = "L1", ContactInfo = "l1@example.com", Source = LeadSource.Form, Status = LeadStatus.New, CreatedAt = DateTime.UtcNow.AddDays(-1) },
            new Lead { Id = Guid.NewGuid(), Name = "L2", ContactInfo = "l2@example.com", Source = LeadSource.Chatbot, Status = LeadStatus.Contacted, CreatedAt = DateTime.UtcNow.AddDays(-30) });
        db.ContentDrafts.AddRange(
            new ContentDraft { Id = Guid.NewGuid(), Title = "D1", SourceUrl = "https://example.com", Status = "pending" });
        db.ChatThreads.Add(
            new ChatThread { Id = Guid.NewGuid(), Type = ChatThreadType.Lead, NeedsManualIntervention = true, CreatedAt = DateTime.UtcNow });
        db.AdminNotifications.Add(
            new AdminNotification { Id = Guid.NewGuid(), Type = "lead", Title = "N", IsRead = false, CreatedAt = DateTime.UtcNow });
        db.GithubRepositories.Add(
            new GithubRepository { Id = Guid.NewGuid(), FullName = "org/repo", Name = "repo", HtmlUrl = "https://github.com/org/repo" });
        db.KnowledgeChunks.AddRange(
            new KnowledgeChunk { Id = Guid.NewGuid(), SourceType = KnowledgeSourceType.CustomerDocument, SourceId = "project:1", ChunkText = "chunk one" },
            new KnowledgeChunk { Id = Guid.NewGuid(), SourceType = KnowledgeSourceType.CustomerDocument, SourceId = "project:2", ChunkText = "chunk two" });
        db.AgentTasks.AddRange(
            new AgentTask { Id = Guid.NewGuid(), Type = "github-reanalysis", Status = AgentTaskStatus.Pending },
            new AgentTask { Id = Guid.NewGuid(), Type = "github-reanalysis", Status = AgentTaskStatus.Completed });
        await db.SaveChangesAsync();

        var service = new DashboardStatsService(
            new CustomerRepository(db),
            new CustomerProjectRepository(db),
            new LeadRepository(db),
            new TeamRepository(db),
            new ProjectRepository(db),
            new ContentDraftRepository(db),
            new ChatRepository(db),
            new NotificationRepository(db),
            new GithubRepositoryRepository(db),
            new KnowledgeChunkRepository(db),
            new AgentTaskRepository(db));

        var stats = await service.GetAsync();

        Assert.Equal(2, stats.CustomersTotal);
        Assert.Equal(1, stats.CustomersActive);
        Assert.Equal(1, stats.CustomersInactive);
        Assert.Equal(3, stats.CustomerProjectsTotal);
        Assert.Equal(1, stats.CustomerProjectsByStatus["intake"]);
        Assert.Equal(2, stats.CustomerProjectsByStatus["inbuild"]);
        Assert.Equal(2, stats.LeadsTotal);
        Assert.Equal(1, stats.LeadsNew7d);
        Assert.Equal(1, stats.LeadsByStatus["new"]);
        Assert.Equal(1, stats.LeadsByStatus["contacted"]);
        Assert.Equal(1, stats.DraftsPending);
        Assert.Equal(1, stats.ChatIntervention);
        Assert.Equal(1, stats.NotificationsUnread);
        Assert.Equal(1, stats.GithubRepositories);
        Assert.Equal(2, stats.KnowledgeChunks);
        Assert.Equal(1, stats.AgentTasksPending);
        Assert.Equal(0, stats.ReviewsTotal);
        Assert.Equal(0, stats.TeamTotal);
        Assert.Equal(0, stats.PortfolioTotal);
    }
}

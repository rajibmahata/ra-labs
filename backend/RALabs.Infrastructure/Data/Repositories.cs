using Microsoft.EntityFrameworkCore;
using RALabs.Domain.Entities;
using RALabs.Domain.Enums;
using RALabs.Domain.Interfaces;

namespace RALabs.Infrastructure.Data;

public class ProjectRepository : IProjectRepository
{
    private readonly RALabsDbContext _db;
    public ProjectRepository(RALabsDbContext db) => _db = db;

    public Task<Project?> GetByIdAsync(Guid id) =>
        _db.Projects.FirstOrDefaultAsync(p => p.Id == id);

    public Task<Project?> GetBySlugAsync(string slug) =>
        _db.Projects.FirstOrDefaultAsync(p => p.Slug == slug && !p.IsDeleted);

    public async Task<List<Project>> GetPublishedAsync(int page, int pageSize, string? tag)
    {
        var q = _db.Projects.Where(p => p.IsPublished && !p.IsDeleted);
        if (!string.IsNullOrWhiteSpace(tag))
            q = q.Where(p => p.StackTags.Contains(tag));
        return await q.OrderBy(p => p.SortOrder).ThenBy(p => p.CreatedAt)
            .Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();
    }

    public Task<int> CountPublishedAsync(string? tag)
    {
        var q = _db.Projects.Where(p => p.IsPublished && !p.IsDeleted);
        if (!string.IsNullOrWhiteSpace(tag))
            q = q.Where(p => p.StackTags.Contains(tag));
        return q.CountAsync();
    }

    public async Task<List<Project>> GetAllAsync(bool includeUnpublished) =>
        await _db.Projects.Where(p => !p.IsDeleted)
            .OrderBy(p => p.SortOrder).ToListAsync();

    public async Task<Guid> AddAsync(Project project)
    {
        _db.Projects.Add(project);
        await _db.SaveChangesAsync();
        return project.Id;
    }

    public Task UpdateAsync(Project project)
    {
        _db.Projects.Update(project);
        return _db.SaveChangesAsync();
    }

    public Task<bool> SlugExistsAsync(string slug, Guid? excludeId = null)
    {
        var q = _db.Projects.Where(p => p.Slug == slug);
        if (excludeId.HasValue) q = q.Where(p => p.Id != excludeId.Value);
        return q.AnyAsync();
    }
}

public class TeamRepository : ITeamRepository
{
    private readonly RALabsDbContext _db;
    public TeamRepository(RALabsDbContext db) => _db = db;

    public Task<TeamMember?> GetByIdAsync(Guid id) =>
        _db.TeamMembers.FirstOrDefaultAsync(m => m.Id == id);

    public Task<TeamMember?> GetBySlugAsync(string slug) =>
        _db.TeamMembers.FirstOrDefaultAsync(m => m.Slug == slug);

    public async Task<List<TeamMember>> GetPublishedAsync() =>
        await _db.TeamMembers.Where(m => m.IsPublished).OrderBy(m => m.Name).ToListAsync();

    public async Task<List<TeamMember>> GetAllAsync() =>
        await _db.TeamMembers.OrderBy(m => m.Name).ToListAsync();

    public async Task<Guid> AddAsync(TeamMember member)
    {
        _db.TeamMembers.Add(member);
        await _db.SaveChangesAsync();
        return member.Id;
    }

    public Task UpdateAsync(TeamMember member)
    {
        _db.TeamMembers.Update(member);
        return _db.SaveChangesAsync();
    }

    public Task<bool> SlugExistsAsync(string slug, Guid? excludeId = null)
    {
        var q = _db.TeamMembers.Where(m => m.Slug == slug);
        if (excludeId.HasValue) q = q.Where(m => m.Id != excludeId.Value);
        return q.AnyAsync();
    }

    public async Task<TeamMember?> GetByAdminUserIdAsync(Guid adminUserId)
    {
        var admin = await _db.AdminUsers.FirstOrDefaultAsync(a => a.Id == adminUserId);
        if (admin?.TeamMemberId is null) return null;
        return await _db.TeamMembers.FirstOrDefaultAsync(m => m.Id == admin.TeamMemberId);
    }

    public async Task<GithubSnapshot> AddSnapshotAsync(GithubSnapshot snapshot)
    {
        _db.GithubSnapshots.Add(snapshot);
        await _db.SaveChangesAsync();
        return snapshot;
    }

    public async Task<GithubSnapshot?> GetLatestSnapshotAsync(Guid teamMemberId) =>
        await _db.GithubSnapshots
            .Where(s => s.TeamMemberId == teamMemberId)
            .OrderByDescending(s => s.CapturedAt)
            .FirstOrDefaultAsync();

    public async Task<Dictionary<Guid, GithubSnapshot>> GetLatestSnapshotsAsync(IEnumerable<Guid> teamMemberIds)
    {
        var ids = teamMemberIds.ToList();
        if (ids.Count == 0) return new Dictionary<Guid, GithubSnapshot>();
        var rows = await _db.GithubSnapshots
            .Where(s => ids.Contains(s.TeamMemberId))
            .OrderBy(s => s.CapturedAt)
            .ToListAsync();
        return rows.GroupBy(s => s.TeamMemberId)
            .ToDictionary(g => g.Key, g => g.Last());
    }
}

public class ContentRepository : IContentRepository
{
    private readonly RALabsDbContext _db;
    public ContentRepository(RALabsDbContext db) => _db = db;

    public async Task<List<PageContent>> GetByLocaleAsync(string locale) =>
        await _db.PageContents.Where(c => c.Locale == locale).ToListAsync();

    public async Task<List<PageContent>> GetAllAsync(string? locale)
    {
        var q = _db.PageContents.AsQueryable();
        if (!string.IsNullOrWhiteSpace(locale)) q = q.Where(c => c.Locale == locale);
        return await q.OrderBy(c => c.Locale).ThenBy(c => c.Key).ToListAsync();
    }

    public Task<PageContent?> GetByKeyAsync(string key, string locale) =>
        _db.PageContents.FirstOrDefaultAsync(c => c.Key == key && c.Locale == locale);

    public async Task<Guid> AddAsync(PageContent content)
    {
        _db.PageContents.Add(content);
        await _db.SaveChangesAsync();
        return content.Id;
    }

    public Task UpdateAsync(PageContent content)
    {
        _db.PageContents.Update(content);
        return _db.SaveChangesAsync();
    }

    public Task<bool> ExistsAsync(string key, string locale) =>
        _db.PageContents.AnyAsync(c => c.Key == key && c.Locale == locale);

    public async Task DeleteAsync(string key, string locale)
    {
        var item = await _db.PageContents.FirstOrDefaultAsync(c => c.Key == key && c.Locale == locale);
        if (item is not null)
        {
            _db.PageContents.Remove(item);
            await _db.SaveChangesAsync();
        }
    }

    public async Task<List<Locale>> GetLocalesAsync() => await _db.Locales.ToListAsync();

    public Task<bool> LocaleExistsAsync(string code) => _db.Locales.AnyAsync(l => l.Code == code);
}

public class LeadRepository : ILeadRepository
{
    private readonly RALabsDbContext _db;
    public LeadRepository(RALabsDbContext db) => _db = db;

    public async Task<Guid> AddAsync(Lead lead)
    {
        _db.Leads.Add(lead);
        await _db.SaveChangesAsync();
        return lead.Id;
    }

    public Task<Lead?> GetByIdAsync(Guid id) => _db.Leads.FirstOrDefaultAsync(l => l.Id == id);

    public async Task<List<Lead>> GetAllAsync(LeadStatus? status, LeadSource? source, int page, int pageSize)
    {
        var q = _db.Leads.AsQueryable();
        if (status.HasValue) q = q.Where(l => l.Status == status.Value);
        if (source.HasValue) q = q.Where(l => l.Source == source.Value);
        return await q.OrderByDescending(l => l.CreatedAt)
            .Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();
    }

    public Task<int> CountAsync(LeadStatus? status, LeadSource? source)
    {
        var q = _db.Leads.AsQueryable();
        if (status.HasValue) q = q.Where(l => l.Status == status.Value);
        if (source.HasValue) q = q.Where(l => l.Source == source.Value);
        return q.CountAsync();
    }

    public Task UpdateAsync(Lead lead)
    {
        _db.Leads.Update(lead);
        return _db.SaveChangesAsync();
    }
}

public class ChatRepository : IChatRepository
{
    private readonly RALabsDbContext _db;
    public ChatRepository(RALabsDbContext db) => _db = db;

    public Task<ChatThread?> GetThreadAsync(Guid id) =>
        _db.ChatThreads.Include(t => t.Messages).FirstOrDefaultAsync(t => t.Id == id);

    public async Task<ChatThread> CreateThreadAsync(ChatThread thread)
    {
        _db.ChatThreads.Add(thread);
        await _db.SaveChangesAsync();
        return thread;
    }

    public async Task<Guid> AddMessageAsync(ChatMessage message)
    {
        _db.ChatMessages.Add(message);
        await _db.SaveChangesAsync();
        return message.Id;
    }

    public async Task<List<ChatThread>> ListThreadsAsync(ChatThreadType? type, bool? needsManualIntervention, int page, int pageSize)
    {
        var q = _db.ChatThreads.Include(t => t.Messages).AsQueryable();
        if (type.HasValue) q = q.Where(t => t.Type == type.Value);
        if (needsManualIntervention.HasValue) q = q.Where(t => t.NeedsManualIntervention == needsManualIntervention.Value);
        return await q.OrderByDescending(t => t.CreatedAt)
            .Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();
    }

    public Task<int> CountThreadsAsync(ChatThreadType? type, bool? needsManualIntervention)
    {
        var q = _db.ChatThreads.AsQueryable();
        if (type.HasValue) q = q.Where(t => t.Type == type.Value);
        if (needsManualIntervention.HasValue) q = q.Where(t => t.NeedsManualIntervention == needsManualIntervention.Value);
        return q.CountAsync();
    }

    public Task UpdateThreadAsync(ChatThread thread)
    {
        _db.ChatThreads.Update(thread);
        return _db.SaveChangesAsync();
    }
}

public class AgentTaskRepository : IAgentTaskRepository
{
    private readonly RALabsDbContext _db;
    public AgentTaskRepository(RALabsDbContext db) => _db = db;

    public async Task<Guid> AddAsync(AgentTask task)
    {
        _db.AgentTasks.Add(task);
        await _db.SaveChangesAsync();
        return task.Id;
    }

    public Task UpdateAsync(AgentTask task)
    {
        var existing = _db.AgentTasks.Local.FirstOrDefault(t => t.Id == task.Id)
            ?? _db.AgentTasks.Find(task.Id);
        if (existing is not null)
        {
            existing.Status = task.Status;
            existing.Result = task.Result;
            existing.Error = task.Error;
            existing.CompletedAt = task.CompletedAt;
            return _db.SaveChangesAsync();
        }
        _db.AgentTasks.Attach(task);
        _db.Entry(task).State = EntityState.Modified;
        return _db.SaveChangesAsync();
    }

    public async Task<List<AgentTask>> ListRecentAsync(string? type, int page, int pageSize)
    {
        var q = _db.AgentTasks.AsQueryable();
        if (!string.IsNullOrWhiteSpace(type)) q = q.Where(t => t.Type == type);
        return await q.OrderByDescending(t => t.CreatedAt)
            .Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();
    }
}

public class AdminUserRepository : IAdminUserRepository
{
    private readonly RALabsDbContext _db;
    public AdminUserRepository(RALabsDbContext db) => _db = db;

    public Task<AdminUser?> GetByEmailAsync(string email) =>
        _db.AdminUsers.FirstOrDefaultAsync(u => u.Email == email);

    public Task<AdminUser?> GetByIdAsync(Guid id) => _db.AdminUsers.FirstOrDefaultAsync(u => u.Id == id);

    public Task<AdminUser?> GetByRefreshTokenHashAsync(string hash) =>
        _db.AdminUsers.FirstOrDefaultAsync(u => u.RefreshTokenHash == hash);

    public async Task<Guid> AddAsync(AdminUser user)
    {
        _db.AdminUsers.Add(user);
        await _db.SaveChangesAsync();
        return user.Id;
    }

    public Task UpdateAsync(AdminUser user)
    {
        _db.AdminUsers.Update(user);
        return _db.SaveChangesAsync();
    }

    public Task<bool> EmailExistsAsync(string email) => _db.AdminUsers.AnyAsync(u => u.Email == email);

    public async Task<List<AdminUser>> GetAllAsync() => await _db.AdminUsers.OrderBy(u => u.Name).ToListAsync();
}

public class KnowledgeChunkRepository : IKnowledgeChunkRepository
{
    private readonly RALabsDbContext _db;
    public KnowledgeChunkRepository(RALabsDbContext db) => _db = db;

    public async Task AddAsync(KnowledgeChunk chunk)
    {
        _db.KnowledgeChunks.Add(chunk);
        await _db.SaveChangesAsync();
    }

    public async Task DeleteBySourceAsync(string sourceType, string sourceId)
    {
        var items = await _db.KnowledgeChunks
            .Where(k => k.SourceType.ToString() == sourceType && k.SourceId == sourceId)
            .ToListAsync();
        if (items.Count > 0)
        {
            _db.KnowledgeChunks.RemoveRange(items);
            await _db.SaveChangesAsync();
        }
    }

    public async Task<List<KnowledgeChunk>> GetPublicChunksAsync() =>
        await _db.KnowledgeChunks.Where(k => k.CustomerProjectId == null).ToListAsync();

    public async Task<List<KnowledgeChunk>> GetChunksByProjectAsync(Guid customerProjectId) =>
        await _db.KnowledgeChunks.Where(k => k.CustomerProjectId == customerProjectId).ToListAsync();
}

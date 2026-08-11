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
        _db.Projects.FirstOrDefaultAsync(p => p.Slug == slug && !p.IsDeleted && p.IsActive);

    public async Task<List<Project>> GetPublishedAsync(int page, int pageSize, string? tag)
    {
        var q = _db.Projects.Where(p => p.IsPublished && p.IsActive && !p.IsDeleted);
        if (!string.IsNullOrWhiteSpace(tag))
            q = q.Where(p => p.StackTags.Contains(tag));
        return await q.OrderBy(p => p.SortOrder).ThenBy(p => p.CreatedAt)
            .Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();
    }

    public Task<int> CountPublishedAsync(string? tag)
    {
        var q = _db.Projects.Where(p => p.IsPublished && p.IsActive && !p.IsDeleted);
        if (!string.IsNullOrWhiteSpace(tag))
            q = q.Where(p => p.StackTags.Contains(tag));
        return q.CountAsync();
    }

    public async Task<List<Project>> GetFeaturedAsync(int page, int pageSize)
    {
        var q = _db.Projects.Where(p => p.IsPublished && p.IsActive && p.IsFeatured && !p.IsDeleted);
        return await q.OrderByDescending(p => p.CreatedAt)
            .Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();
    }

    public Task<int> CountFeaturedAsync() =>
        _db.Projects.CountAsync(p => p.IsPublished && p.IsActive && p.IsFeatured && !p.IsDeleted);

    public async Task<(List<Project> Items, int TotalCount)> ListAdminAsync(string? search, string? category, string? status, bool? featured, bool? active, bool? published, int page, int pageSize)
    {
        var q = _db.Projects.Where(p => !p.IsDeleted);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var needle = search.Trim();
            q = q.Where(p => p.Title.Contains(needle) || p.Summary.Contains(needle) || p.Category!.Contains(needle));
        }
        if (!string.IsNullOrWhiteSpace(category)) q = q.Where(p => p.Category == category);
        if (!string.IsNullOrWhiteSpace(status)) q = q.Where(p => p.Status.ToString() == status);
        if (featured.HasValue) q = q.Where(p => p.IsFeatured == featured.Value);
        if (active.HasValue) q = q.Where(p => p.IsActive == active.Value);
        if (published.HasValue) q = q.Where(p => p.IsPublished == published.Value);
        var total = await q.CountAsync();
        var items = await q.OrderByDescending(p => p.CreatedAt)
            .Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();
        return (items, total);
    }

    public async Task<List<Project>> GetAllAsync(bool includeUnpublished) =>
        await _db.Projects.Where(p => !p.IsDeleted)
            .OrderBy(p => p.SortOrder).ToListAsync();

    public Task<bool> LiveSiteUrlExistsAsync(string url, Guid? excludeId = null)
    {
        var q = _db.Projects.Where(p => p.LiveSiteUrl == url && !p.IsDeleted);
        if (excludeId.HasValue) q = q.Where(p => p.Id != excludeId.Value);
        return q.AnyAsync();
    }

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
        await _db.TeamMembers.Where(m => m.IsActive && m.IsPublished).OrderBy(m => m.Name).ToListAsync();

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

    public Task<bool> ContactInfoExistsAsync(string contactInfo) =>
        _db.Leads.AnyAsync(l => l.ContactInfo == contactInfo);

    public Task<int> CountNewSinceAsync(DateTime since) =>
        _db.Leads.CountAsync(l => l.CreatedAt >= since);

    public Task UpdateAsync(Lead lead)
    {
        _db.Leads.Update(lead);
        return _db.SaveChangesAsync();
    }
}

public class NotificationRepository : INotificationRepository
{
    private readonly RALabsDbContext _db;
    public NotificationRepository(RALabsDbContext db) => _db = db;

    public async Task AddAsync(AdminNotification notification)
    {
        _db.AdminNotifications.Add(notification);
        await _db.SaveChangesAsync();
    }

    public Task<AdminNotification?> GetByIdAsync(Guid id) =>
        _db.AdminNotifications.FirstOrDefaultAsync(x => x.Id == id);

    public Task<List<AdminNotification>> ListAsync(bool? unread, int page, int pageSize)
    {
        var query = _db.AdminNotifications.AsQueryable();
        if (unread == true) query = query.Where(x => !x.IsRead);
        if (unread == false) query = query.Where(x => x.IsRead);
        return query.OrderByDescending(x => x.CreatedAt)
            .Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();
    }

    public Task<int> CountAsync(bool? unread)
    {
        var query = _db.AdminNotifications.AsQueryable();
        if (unread == true) query = query.Where(x => !x.IsRead);
        if (unread == false) query = query.Where(x => x.IsRead);
        return query.CountAsync();
    }

    public Task UpdateAsync(AdminNotification notification)
    {
        _db.AdminNotifications.Update(notification);
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

    public async Task<Dictionary<AgentTaskStatus, int>> CountByStatusAsync() =>
        await _db.AgentTasks.GroupBy(t => t.Status)
            .Select(g => new { g.Key, Count = g.Count() })
            .ToDictionaryAsync(g => g.Key, g => g.Count);
}

public class ContentDraftRepository : IContentDraftRepository
{
    private readonly RALabsDbContext _db;
    public ContentDraftRepository(RALabsDbContext db) => _db = db;
    public Task<ContentDraft?> GetByIdAsync(Guid id) => _db.ContentDrafts.FirstOrDefaultAsync(x => x.Id == id);
    public Task<List<ContentDraft>> ListAsync(string? status, int page, int pageSize)
    {
        var query = _db.ContentDrafts.AsQueryable();
        if (!string.IsNullOrWhiteSpace(status)) query = query.Where(x => x.Status == status);
        return query.OrderByDescending(x => x.CreatedAt).Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();
    }

    public Task<int> CountAsync(string? status)
    {
        var query = _db.ContentDrafts.AsQueryable();
        if (!string.IsNullOrWhiteSpace(status)) query = query.Where(x => x.Status == status);
        return query.CountAsync();
    }
    public async Task<Guid> AddAsync(ContentDraft draft) { _db.ContentDrafts.Add(draft); await _db.SaveChangesAsync(); return draft.Id; }
    public Task UpdateAsync(ContentDraft draft) { _db.ContentDrafts.Update(draft); return _db.SaveChangesAsync(); }
}

public class GithubRepositoryRepository : IGithubRepositoryRepository
{
    private readonly RALabsDbContext _db;
    public GithubRepositoryRepository(RALabsDbContext db) => _db = db;
    public Task<GithubRepository?> GetByFullNameAsync(string fullName) => _db.GithubRepositories.FirstOrDefaultAsync(x => x.FullName == fullName);
    public async Task UpsertAsync(GithubRepository repository)
    {
        var existing = await GetByFullNameAsync(repository.FullName);
        if (existing is null) _db.GithubRepositories.Add(repository);
        else
        {
            repository.Id = existing.Id;
            _db.Entry(existing).CurrentValues.SetValues(repository);
        }
        await _db.SaveChangesAsync();
    }

    public async Task<List<GithubRepository>> GetAllAsync(int page, int pageSize, string? technology)
    {
        var query = _db.GithubRepositories.AsQueryable();
        if (!string.IsNullOrWhiteSpace(technology))
            query = query.Where(x => x.TechnologiesJson.Contains(technology) || x.PrimaryLanguage == technology);
        return await query.OrderByDescending(x => x.PushedAt).ThenBy(x => x.FullName)
            .Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();
    }

    public Task<int> CountAsync(string? technology)
    {
        var query = _db.GithubRepositories.AsQueryable();
        if (!string.IsNullOrWhiteSpace(technology))
            query = query.Where(x => x.TechnologiesJson.Contains(technology) || x.PrimaryLanguage == technology);
        return query.CountAsync();
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

    public async Task DeleteBySourcePrefixAsync(string sourceType, string sourcePrefix)
    {
        var items = await _db.KnowledgeChunks
            .Where(k => k.SourceType.ToString() == sourceType && k.SourceId.StartsWith(sourcePrefix))
            .ToListAsync();
        if (items.Count == 0) return;
        _db.KnowledgeChunks.RemoveRange(items);
        await _db.SaveChangesAsync();
    }

    public async Task DeleteByProjectAsync(Guid customerProjectId)
    {
        var items = await _db.KnowledgeChunks.Where(k => k.CustomerProjectId == customerProjectId).ToListAsync();
        if (items.Count == 0) return;
        _db.KnowledgeChunks.RemoveRange(items);
        await _db.SaveChangesAsync();
    }

    public async Task<List<KnowledgeChunk>> GetPublicChunksAsync() =>
        await _db.KnowledgeChunks.Where(k => k.CustomerProjectId == null).ToListAsync();

    public async Task<List<KnowledgeChunk>> GetChunksByProjectAsync(Guid customerProjectId) =>
        await _db.KnowledgeChunks.Where(k => k.CustomerProjectId == customerProjectId).ToListAsync();

    public Task<int> CountAsync() => _db.KnowledgeChunks.CountAsync();
}

public class SettingRepository : ISettingRepository
{
    private readonly RALabsDbContext _db;
    public SettingRepository(RALabsDbContext db) => _db = db;

    public Task<List<SystemSetting>> GetAllAsync() =>
        _db.SystemSettings.ToListAsync();

    public Task<SystemSetting?> GetByKeyAsync(string key) =>
        _db.SystemSettings.FirstOrDefaultAsync(s => s.Key == key);

    public async Task UpsertAsync(string key, string value)
    {
        var existing = await GetByKeyAsync(key);
        if (existing is null)
        {
            _db.SystemSettings.Add(new SystemSetting { Key = key, Value = value, UpdatedAt = DateTime.UtcNow });
        }
        else
        {
            existing.Value = value;
            existing.UpdatedAt = DateTime.UtcNow;
        }
        await _db.SaveChangesAsync();
    }
}

public class AuditLogRepository : IAuditLogRepository
{
    private readonly RALabsDbContext _db;
    public AuditLogRepository(RALabsDbContext db) => _db = db;

    public async Task AddAsync(AuditLog entry)
    {
        _db.AuditLogs.Add(entry);
        await _db.SaveChangesAsync();
    }

    public async Task<List<AuditLog>> ListAsync(int page, int pageSize, string? action, string? actorName)
    {
        var q = _db.AuditLogs.AsQueryable();
        if (!string.IsNullOrWhiteSpace(action)) q = q.Where(a => a.Action == action);
        if (!string.IsNullOrWhiteSpace(actorName)) q = q.Where(a => a.ActorName != null && a.ActorName.Contains(actorName));
        return await q.OrderByDescending(a => a.CreatedAt).Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();
    }

    public async Task<int> CountAsync(string? action, string? actorName)
    {
        var q = _db.AuditLogs.AsQueryable();
        if (!string.IsNullOrWhiteSpace(action)) q = q.Where(a => a.Action == action);
        if (!string.IsNullOrWhiteSpace(actorName)) q = q.Where(a => a.ActorName != null && a.ActorName.Contains(actorName));
        return await q.CountAsync();
    }
}

public class CustomerRepository : ICustomerRepository
{
    private readonly RALabsDbContext _db;
    public CustomerRepository(RALabsDbContext db) => _db = db;

    public Task<Customer?> GetByIdAsync(Guid id) => _db.Customers.Include(c => c.Projects).FirstOrDefaultAsync(c => c.Id == id);
    public Task<Customer?> GetByEmailAsync(string email) => _db.Customers.FirstOrDefaultAsync(c => c.Email == email);
    public Task<Customer?> GetByRefreshTokenHashAsync(string hash) => _db.Customers.FirstOrDefaultAsync(c => c.RefreshTokenHash == hash);
    public Task<bool> EmailExistsAsync(string email, Guid? excludeId = null) =>
        _db.Customers.AnyAsync(c => c.Email == email && (!excludeId.HasValue || c.Id != excludeId.Value));

    public async Task<Guid> AddAsync(Customer customer)
    {
        _db.Customers.Add(customer);
        await _db.SaveChangesAsync();
        return customer.Id;
    }

    public Task UpdateAsync(Customer customer)
    {
        _db.Entry(customer).State = EntityState.Modified;
        return _db.SaveChangesAsync();
    }

    public Task DeleteAsync(Customer customer)
    {
        _db.Customers.Remove(customer);
        return _db.SaveChangesAsync();
    }

    public async Task<List<Customer>> GetAllAsync(int page, int pageSize, string? search = null, bool? isActive = null)
    {
        var query = CustomerAdminQuery(search, isActive);
        return await query.OrderByDescending(c => c.CreatedAt).ThenByDescending(c => c.Id)
            .Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();
    }

    public Task<int> CountAllAsync(string? search = null, bool? isActive = null) => CustomerAdminQuery(search, isActive).CountAsync();

    private IQueryable<Customer> CustomerAdminQuery(string? search, bool? isActive)
    {
        var query = _db.Customers.Include(c => c.Projects).AsQueryable();
        if (isActive.HasValue)
            query = query.Where(c => c.IsActive == isActive.Value);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLowerInvariant();
            query = query.Where(c => c.Name.ToLower().Contains(term) || c.Email.ToLower().Contains(term));
        }
        return query;
    }
}

public class CustomerProjectRepository : ICustomerProjectRepository
{
    private readonly RALabsDbContext _db;
    public CustomerProjectRepository(RALabsDbContext db) => _db = db;

    public Task<CustomerProject?> GetByIdAsync(Guid id) =>
        _db.CustomerProjects.FirstOrDefaultAsync(p => p.Id == id);

    public Task<CustomerProject?> GetByIdIncludingAsync(Guid id) =>
        _db.CustomerProjects
            .Include(p => p.Threads)
            .Include(p => p.Documents)
            .Include(p => p.ClientPrd)
            .Include(p => p.Demos)
            .Include(p => p.Invoices)
            .Include(p => p.Feedback)
            .FirstOrDefaultAsync(p => p.Id == id);

    public async Task<List<CustomerProject>> GetByCustomerAsync(Guid customerId, int page, int pageSize) =>
        await _db.CustomerProjects.Where(p => p.CustomerId == customerId)
            .OrderByDescending(p => p.CreatedAt)
            .Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();

    public Task<List<Guid>> GetIdsByCustomerAsync(Guid customerId) =>
        _db.CustomerProjects.Where(p => p.CustomerId == customerId).Select(p => p.Id).ToListAsync();

    public Task<int> CountByCustomerAsync(Guid customerId) =>
        _db.CustomerProjects.CountAsync(p => p.CustomerId == customerId);

    public async Task<List<CustomerProject>> GetAllAsync(int page, int pageSize) =>
        await _db.CustomerProjects.OrderByDescending(p => p.CreatedAt)
            .Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();

    public async Task<List<CustomerProject>> GetAllForAdminAsync(int page, int pageSize, CustomerProjectStatus? status, string? search, Guid? customerId)
    {
        var query = _db.CustomerProjects.AsQueryable();
        if (status.HasValue)
            query = query.Where(p => p.Status == status.Value);
        if (customerId.HasValue)
            query = query.Where(p => p.CustomerId == customerId.Value);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLowerInvariant();
            query = query.Where(p => p.Title.ToLower().Contains(term)
                || (p.Goal != null && p.Goal.ToLower().Contains(term))
                || (p.Audience != null && p.Audience.ToLower().Contains(term))
                || (p.Requirements != null && p.Requirements.ToLower().Contains(term))
                || (p.Timeline != null && p.Timeline.ToLower().Contains(term))
                || (p.BudgetOrConstraints != null && p.BudgetOrConstraints.ToLower().Contains(term))
                || (p.ReferenceLinks != null && p.ReferenceLinks.ToLower().Contains(term))
                || (p.AdminNotes != null && p.AdminNotes.ToLower().Contains(term)));
        }
        return await query.OrderByDescending(p => p.CreatedAt)
            .Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();
    }

    public Task<int> CountAllAsync() => _db.CustomerProjects.CountAsync();

    public async Task<Dictionary<CustomerProjectStatus, int>> CountByStatusAsync() =>
        await _db.CustomerProjects.GroupBy(p => p.Status)
            .Select(g => new { g.Key, Count = g.Count() })
            .ToDictionaryAsync(g => g.Key, g => g.Count);

    public async Task<Guid> AddAsync(CustomerProject project)
    {
        _db.CustomerProjects.Add(project);
        await _db.SaveChangesAsync();
        return project.Id;
    }

    public Task UpdateAsync(CustomerProject project)
    {
        _db.CustomerProjects.Update(project);
        return _db.SaveChangesAsync();
    }

    public async Task<Document> AddDocumentAsync(Document document)
    {
        _db.Documents.Add(document);
        await _db.SaveChangesAsync();
        return document;
    }

    public Task<Document?> GetDocumentAsync(Guid projectId, Guid documentId) =>
        _db.Documents.FirstOrDefaultAsync(d => d.CustomerProjectId == projectId && d.Id == documentId);

    public async Task<List<Document>> GetDocumentsAsync(Guid projectId) =>
        await _db.Documents.Where(d => d.CustomerProjectId == projectId).OrderByDescending(d => d.CreatedAt).ToListAsync();

    public Task<ClientPrd?> GetPrdAsync(Guid projectId) =>
        _db.ClientPrds.FirstOrDefaultAsync(p => p.CustomerProjectId == projectId);

    public async Task<ClientPrd> SavePrdAsync(ClientPrd prd)
    {
        var existing = await _db.ClientPrds.FirstOrDefaultAsync(p => p.Id == prd.Id);
        if (existing is null) _db.ClientPrds.Add(prd);
        else _db.ClientPrds.Update(prd);
        await _db.SaveChangesAsync();
        return existing ?? prd;
    }

    public async Task<Demo> AddDemoAsync(Demo demo)
    {
        _db.Demos.Add(demo);
        await _db.SaveChangesAsync();
        return demo;
    }

    public Task<Demo?> GetLatestDemoAsync(Guid projectId) =>
        _db.Demos.Where(d => d.CustomerProjectId == projectId).OrderByDescending(d => d.CreatedAt).FirstOrDefaultAsync();

    public async Task<Invoice> AddInvoiceAsync(Invoice invoice)
    {
        _db.Invoices.Add(invoice);
        await _db.SaveChangesAsync();
        return invoice;
    }

    public async Task<List<Invoice>> GetInvoicesAsync(Guid projectId) =>
        await _db.Invoices.Where(i => i.CustomerProjectId == projectId).OrderByDescending(i => i.CreatedAt).ToListAsync();

    public Task<Feedback?> GetFeedbackAsync(Guid projectId) =>
        _db.Feedbacks.FirstOrDefaultAsync(f => f.CustomerProjectId == projectId);

    public async Task<List<Feedback>> GetFeedbacksForAdminAsync(int page, int pageSize, string? search, bool? published)
    {
        var query = FeedbackAdminQuery(search, published);
        return await query
            .OrderByDescending(f => f.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();
    }

    public Task<int> CountFeedbacksForAdminAsync(string? search, bool? published) =>
        FeedbackAdminQuery(search, published).CountAsync();

    private IQueryable<Feedback> FeedbackAdminQuery(string? search, bool? published)
    {
        var query = _db.Feedbacks
            .Include(f => f.CustomerProject)
            .ThenInclude(p => p.Customer)
            .AsQueryable();
        if (published.HasValue)
            query = query.Where(f => f.IsPublished == published.Value);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            query = query.Where(f => f.Comment.Contains(term) ||
                f.CustomerProject.Title.Contains(term) ||
                f.CustomerProject.Customer.Name.Contains(term) ||
                f.CustomerProject.Customer.Email.Contains(term));
        }
        return query;
    }

    public async Task<Feedback> SaveFeedbackAsync(Feedback feedback)
    {
        var existing = await _db.Feedbacks.FirstOrDefaultAsync(f => f.CustomerProjectId == feedback.CustomerProjectId);
        if (existing is null) _db.Feedbacks.Add(feedback);
        else _db.Feedbacks.Update(feedback);
        await _db.SaveChangesAsync();
        return existing ?? feedback;
    }
}

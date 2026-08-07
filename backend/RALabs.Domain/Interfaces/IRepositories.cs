using RALabs.Domain.Entities;
using RALabs.Domain.Enums;

namespace RALabs.Domain.Interfaces;

public interface IProjectRepository
{
    Task<Project?> GetByIdAsync(Guid id);
    Task<Project?> GetBySlugAsync(string slug);
    Task<List<Project>> GetPublishedAsync(int page, int pageSize, string? tag);
    Task<int> CountPublishedAsync(string? tag);
    Task<List<Project>> GetAllAsync(bool includeUnpublished);
    Task<Guid> AddAsync(Project project);
    Task UpdateAsync(Project project);
    Task<bool> SlugExistsAsync(string slug, Guid? excludeId = null);
}

public interface ITeamRepository
{
    Task<TeamMember?> GetByIdAsync(Guid id);
    Task<TeamMember?> GetBySlugAsync(string slug);
    Task<List<TeamMember>> GetPublishedAsync();
    Task<List<TeamMember>> GetAllAsync();
    Task<Guid> AddAsync(TeamMember member);
    Task UpdateAsync(TeamMember member);
    Task<bool> SlugExistsAsync(string slug, Guid? excludeId = null);
    Task<TeamMember?> GetByAdminUserIdAsync(Guid adminUserId);
    Task<GithubSnapshot> AddSnapshotAsync(GithubSnapshot snapshot);
    Task<GithubSnapshot?> GetLatestSnapshotAsync(Guid teamMemberId);
}

public interface IContentRepository
{
    Task<List<PageContent>> GetByLocaleAsync(string locale);
    Task<List<PageContent>> GetAllAsync(string? locale);
    Task<PageContent?> GetByKeyAsync(string key, string locale);
    Task<Guid> AddAsync(PageContent content);
    Task UpdateAsync(PageContent content);
    Task<bool> ExistsAsync(string key, string locale);
    Task DeleteAsync(string key, string locale);
    Task<List<Locale>> GetLocalesAsync();
    Task<bool> LocaleExistsAsync(string code);
}

public interface ILeadRepository
{
    Task<Guid> AddAsync(Lead lead);
    Task<Lead?> GetByIdAsync(Guid id);
    Task<List<Lead>> GetAllAsync(LeadStatus? status, LeadSource? source, int page, int pageSize);
    Task<int> CountAsync(LeadStatus? status, LeadSource? source);
    Task UpdateAsync(Lead lead);
}

public interface IChatRepository
{
    Task<ChatThread?> GetThreadAsync(Guid id);
    Task<ChatThread> CreateThreadAsync(ChatThread thread);
    Task<Guid> AddMessageAsync(ChatMessage message);
    Task<List<ChatThread>> ListThreadsAsync(ChatThreadType? type, bool? needsManualIntervention, int page, int pageSize);
    Task<int> CountThreadsAsync(ChatThreadType? type, bool? needsManualIntervention);
    Task UpdateThreadAsync(ChatThread thread);
}

public interface IAgentTaskRepository
{
    Task<Guid> AddAsync(AgentTask task);
    Task UpdateAsync(AgentTask task);
    Task<List<AgentTask>> ListRecentAsync(string? type, int page, int pageSize);
}

public interface IAdminUserRepository
{
    Task<AdminUser?> GetByEmailAsync(string email);
    Task<AdminUser?> GetByIdAsync(Guid id);
    Task<Guid> AddAsync(AdminUser user);
    Task UpdateAsync(AdminUser user);
    Task<bool> EmailExistsAsync(string email);
    Task<List<AdminUser>> GetAllAsync();
}

public interface IKnowledgeChunkRepository
{
    Task AddAsync(KnowledgeChunk chunk);
    Task DeleteBySourceAsync(string sourceType, string sourceId);
    Task<List<KnowledgeChunk>> GetPublicChunksAsync();
    Task<List<KnowledgeChunk>> GetChunksByProjectAsync(Guid customerProjectId);
}

using RALabs.Domain.Entities;
using RALabs.Domain.Enums;

namespace RALabs.Domain.Interfaces;

public interface IProjectRepository
{
    Task<Project?> GetByIdAsync(Guid id);
    Task<Project?> GetBySlugAsync(string slug);
    Task<List<Project>> GetPublishedAsync(int page, int pageSize, string? tag);
    Task<int> CountPublishedAsync(string? tag);
    Task<List<Project>> GetFeaturedAsync(int page, int pageSize);
    Task<int> CountFeaturedAsync();
    Task<(List<Project> Items, int TotalCount)> ListAdminAsync(string? search, string? category, string? status, bool? featured, bool? active, bool? published, int page, int pageSize);
    Task<List<Project>> GetAllAsync(bool includeUnpublished);
    Task<Guid> AddAsync(Project project);
    Task UpdateAsync(Project project);
    Task<bool> SlugExistsAsync(string slug, Guid? excludeId = null);
    Task<bool> LiveSiteUrlExistsAsync(string url, Guid? excludeId = null);
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
    Task<Dictionary<Guid, GithubSnapshot>> GetLatestSnapshotsAsync(IEnumerable<Guid> teamMemberIds);
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
    Task<bool> ContactInfoExistsAsync(string contactInfo);
    Task<int> CountNewSinceAsync(DateTime since);
    Task UpdateAsync(Lead lead);
}

public interface INotificationRepository
{
    Task AddAsync(AdminNotification notification);
    Task<AdminNotification?> GetByIdAsync(Guid id);
    Task<List<AdminNotification>> ListAsync(bool? unread, int page, int pageSize);
    Task<int> CountAsync(bool? unread);
    Task UpdateAsync(AdminNotification notification);
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
    Task<Dictionary<AgentTaskStatus, int>> CountByStatusAsync();
}

public interface IContentDraftRepository
{
    Task<ContentDraft?> GetByIdAsync(Guid id);
    Task<List<ContentDraft>> ListAsync(string? status, int page, int pageSize);
    Task<int> CountAsync(string? status);
    Task<Guid> AddAsync(ContentDraft draft);
    Task UpdateAsync(ContentDraft draft);
}

public interface IGithubRepositoryRepository
{
    Task<GithubRepository?> GetByFullNameAsync(string fullName);
    Task UpsertAsync(GithubRepository repository);
    Task<List<GithubRepository>> GetAllAsync(int page, int pageSize, string? technology);
    Task<int> CountAsync(string? technology);
}

public interface IAdminUserRepository
{
    Task<AdminUser?> GetByEmailAsync(string email);
    Task<AdminUser?> GetByIdAsync(Guid id);
    Task<AdminUser?> GetByRefreshTokenHashAsync(string hash);
    Task<Guid> AddAsync(AdminUser user);
    Task UpdateAsync(AdminUser user);
    Task<bool> EmailExistsAsync(string email);
    Task<List<AdminUser>> GetAllAsync();
}

public interface IKnowledgeChunkRepository
{
    Task AddAsync(KnowledgeChunk chunk);
    Task DeleteBySourceAsync(string sourceType, string sourceId);
    Task DeleteBySourcePrefixAsync(string sourceType, string sourcePrefix);
    Task DeleteByProjectAsync(Guid customerProjectId);
    Task<List<KnowledgeChunk>> GetPublicChunksAsync();
    Task<List<KnowledgeChunk>> GetChunksByProjectAsync(Guid customerProjectId);
    Task<int> CountAsync();
}

public interface ISettingRepository
{
    Task<List<SystemSetting>> GetAllAsync();
    Task<SystemSetting?> GetByKeyAsync(string key);
    Task UpsertAsync(string key, string value);
}

public interface IAuditLogRepository
{
    Task AddAsync(AuditLog entry);
    Task<List<AuditLog>> ListAsync(int page, int pageSize, string? action, string? actorName);
    Task<int> CountAsync(string? action, string? actorName);
}

public interface IEmailSender
{
    Task SendAsync(string to, string toName, string subject, string htmlBody);
}

public interface ICustomerRepository
{
    Task<Customer?> GetByIdAsync(Guid id);
    Task<Customer?> GetByEmailAsync(string email);
    Task<Customer?> GetByRefreshTokenHashAsync(string hash);
    Task<bool> EmailExistsAsync(string email, Guid? excludeId = null);
    Task<Guid> AddAsync(Customer customer);
    Task UpdateAsync(Customer customer);
    Task DeleteAsync(Customer customer);
    Task<List<Customer>> GetAllAsync(int page, int pageSize, string? search = null, bool? isActive = null);
    Task<int> CountAllAsync(string? search = null, bool? isActive = null);
}

public interface ICustomerProjectRepository
{
    Task<CustomerProject?> GetByIdAsync(Guid id);
    Task<CustomerProject?> GetByIdIncludingAsync(Guid id);
    Task<List<CustomerProject>> GetByCustomerAsync(Guid customerId, int page, int pageSize);
    Task<List<Guid>> GetIdsByCustomerAsync(Guid customerId);
    Task<int> CountByCustomerAsync(Guid customerId);
    Task<List<CustomerProject>> GetAllAsync(int page, int pageSize);
    Task<List<CustomerProject>> GetAllForAdminAsync(int page, int pageSize, CustomerProjectStatus? status, string? search, Guid? customerId);
    Task<int> CountAllAsync();
    Task<Dictionary<CustomerProjectStatus, int>> CountByStatusAsync();
    Task<Guid> AddAsync(CustomerProject project);
    Task UpdateAsync(CustomerProject project);
    Task<Document> AddDocumentAsync(Document document);
    Task<Document?> GetDocumentAsync(Guid projectId, Guid documentId);
    Task<List<Document>> GetDocumentsAsync(Guid projectId);
    Task<ClientPrd?> GetPrdAsync(Guid projectId);
    Task<ClientPrd> SavePrdAsync(ClientPrd prd);
    Task<Demo> AddDemoAsync(Demo demo);
    Task<Demo?> GetLatestDemoAsync(Guid projectId);
    Task<Invoice> AddInvoiceAsync(Invoice invoice);
    Task<List<Invoice>> GetInvoicesAsync(Guid projectId);
    Task<Feedback?> GetFeedbackAsync(Guid projectId);
    Task<List<Feedback>> GetFeedbacksForAdminAsync(int page, int pageSize, string? search, bool? published);
    Task<int> CountFeedbacksForAdminAsync(string? search, bool? published);
    Task<Feedback> SaveFeedbackAsync(Feedback feedback);
}

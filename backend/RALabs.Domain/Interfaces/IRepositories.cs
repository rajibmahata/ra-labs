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
    Task<List<KnowledgeChunk>> GetPublicChunksAsync();
    Task<List<KnowledgeChunk>> GetChunksByProjectAsync(Guid customerProjectId);
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
    Task<bool> EmailExistsAsync(string email);
    Task<Guid> AddAsync(Customer customer);
    Task UpdateAsync(Customer customer);
    Task<List<Customer>> GetAllAsync(int page, int pageSize);
    Task<int> CountAllAsync();
}

public interface ICustomerProjectRepository
{
    Task<CustomerProject?> GetByIdAsync(Guid id);
    Task<CustomerProject?> GetByIdIncludingAsync(Guid id);
    Task<List<CustomerProject>> GetByCustomerAsync(Guid customerId, int page, int pageSize);
    Task<int> CountByCustomerAsync(Guid customerId);
    Task<List<CustomerProject>> GetAllAsync(int page, int pageSize);
    Task<int> CountAllAsync();
    Task<Guid> AddAsync(CustomerProject project);
    Task UpdateAsync(CustomerProject project);
    Task<Document> AddDocumentAsync(Document document);
    Task<List<Document>> GetDocumentsAsync(Guid projectId);
    Task<ClientPrd?> GetPrdAsync(Guid projectId);
    Task<ClientPrd> SavePrdAsync(ClientPrd prd);
    Task<Demo> AddDemoAsync(Demo demo);
    Task<Demo?> GetLatestDemoAsync(Guid projectId);
    Task<Invoice> AddInvoiceAsync(Invoice invoice);
    Task<List<Invoice>> GetInvoicesAsync(Guid projectId);
    Task<Feedback?> GetFeedbackAsync(Guid projectId);
    Task<Feedback> SaveFeedbackAsync(Feedback feedback);
}

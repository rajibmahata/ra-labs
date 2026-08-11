using RALabs.Domain.Entities;
using RALabs.Domain.Interfaces;

namespace RALabs.Application.Services;

public interface IAuditService
{
    Task LogAsync(Guid? actorId, string? actorName, string action, string? entityType = null, string? entityId = null, string? details = null, string? ipAddress = null);
    Task<List<AuditLog>> ListAsync(int page, int pageSize, string? action, string? actorName);
    Task<int> CountAsync(string? action, string? actorName);
}

public sealed class AuditService : IAuditService
{
    private readonly IAuditLogRepository _logs;

    public AuditService(IAuditLogRepository logs) => _logs = logs;

    public Task LogAsync(Guid? actorId, string? actorName, string action, string? entityType = null, string? entityId = null, string? details = null, string? ipAddress = null) =>
        _logs.AddAsync(new AuditLog
        {
            ActorId = actorId,
            ActorName = actorName,
            Action = action,
            EntityType = entityType,
            EntityId = entityId,
            Details = details,
            IpAddress = ipAddress,
            CreatedAt = DateTime.UtcNow,
        });

    public Task<List<AuditLog>> ListAsync(int page, int pageSize, string? action, string? actorName) =>
        _logs.ListAsync(page, pageSize, action, actorName);

    public Task<int> CountAsync(string? action, string? actorName) =>
        _logs.CountAsync(action, actorName);
}

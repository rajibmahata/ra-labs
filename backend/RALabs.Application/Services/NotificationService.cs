using RALabs.Application.Common;
using RALabs.Domain.Entities;
using RALabs.Domain.Interfaces;

namespace RALabs.Application.Services;

public interface INotificationService
{
    Task CreateAsync(string type, string title, string message, Guid? leadId = null, Guid? threadId = null,
        Guid? customerId = null, Guid? customerProjectId = null);
    Task<PaginatedResult<AdminNotificationDto>> ListAsync(bool? unread, int? page, int? pageSize);
    Task MarkReadAsync(Guid id);
}

public record AdminNotificationDto(
    Guid Id, string Type, string Title, string Message, Guid? RelatedLeadId,
    Guid? RelatedThreadId, Guid? RelatedCustomerId, Guid? RelatedCustomerProjectId,
    bool IsRead, DateTime CreatedAt, DateTime? ReadAt);

public class NotificationService : INotificationService
{
    private readonly INotificationRepository _repo;

    public NotificationService(INotificationRepository repo) => _repo = repo;

    public async Task CreateAsync(string type, string title, string message, Guid? leadId = null, Guid? threadId = null,
        Guid? customerId = null, Guid? customerProjectId = null)
    {
        await _repo.AddAsync(new AdminNotification
        {
            Id = Guid.NewGuid(),
            Type = type,
            Title = title,
            Message = message,
            RelatedLeadId = leadId,
            RelatedThreadId = threadId,
            RelatedCustomerId = customerId,
            RelatedCustomerProjectId = customerProjectId,
            CreatedAt = DateTime.UtcNow
        });
    }

    public async Task<PaginatedResult<AdminNotificationDto>> ListAsync(bool? unread, int? page, int? pageSize)
    {
        var (p, ps) = PageRequest.Normalize(page, pageSize);
        var items = await _repo.ListAsync(unread, p, ps);
        return new PaginatedResult<AdminNotificationDto>
        {
            Items = items.Select(ToDto).ToList(),
            Page = p,
            PageSize = ps,
            TotalCount = await _repo.CountAsync(unread)
        };
    }

    public async Task MarkReadAsync(Guid id)
    {
        var notification = await _repo.GetByIdAsync(id)
            ?? throw new Exceptions.NotFoundException("Notification not found.");
        if (!notification.IsRead)
        {
            notification.IsRead = true;
            notification.ReadAt = DateTime.UtcNow;
            await _repo.UpdateAsync(notification);
        }
    }

    private static AdminNotificationDto ToDto(AdminNotification n) => new(
        n.Id, n.Type, n.Title, n.Message, n.RelatedLeadId, n.RelatedThreadId,
        n.RelatedCustomerId, n.RelatedCustomerProjectId, n.IsRead, n.CreatedAt, n.ReadAt);
}

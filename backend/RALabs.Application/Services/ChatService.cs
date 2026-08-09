using RALabs.Application.Common;
using RALabs.Application.DTOs;
using RALabs.Domain.Entities;
using RALabs.Domain.Enums;
using RALabs.Domain.Interfaces;

namespace RALabs.Application.Services;

public interface IChatService
{
    Task<ChatThreadDto> GetThreadAsync(Guid threadId, bool isCustomerThread, bool isAdmin);
    Task<ChatThreadSummaryDto> SendMessageAsync(Guid threadId, SendMessageRequest request, string senderType, string? senderName);
    Task<PaginatedResult<ChatThreadSummaryDto>> ListThreadsAsync(string? type, bool? needsManualIntervention, int? page, int? pageSize);
    Task<ChatThreadSummaryDto> UpdateThreadAsync(Guid threadId, UpdateThreadRequest request);
    Task<ChatThread> CreateThreadAsync(ChatThreadType type, Guid? customerProjectId);
}

public class ChatService : IChatService
{
    private readonly IChatRepository _repo;
    private readonly IChatbotService _chatbot;
    private readonly ILeadRepository _leads;
    private readonly INotificationService? _notifications;

    public ChatService(IChatRepository repo, IChatbotService chatbot, ILeadRepository leads, INotificationService? notifications = null)
    {
        _repo = repo;
        _chatbot = chatbot;
        _leads = leads;
        _notifications = notifications;
    }

    public async Task<ChatThreadDto> GetThreadAsync(Guid threadId, bool isCustomerThread, bool isAdmin)
    {
        var thread = await _repo.GetThreadAsync(threadId)
            ?? throw new Exceptions.NotFoundException("Thread not found.");
        if (isCustomerThread && !isAdmin && thread.Type != ChatThreadType.Lead)
            throw new Exceptions.ForbiddenAccessException("You do not have access to this thread.");

        return ToDto(thread, includeMessages: true);
    }

    public async Task<ChatThreadSummaryDto> SendMessageAsync(Guid threadId, SendMessageRequest request, string senderType, string? senderName)
    {
        Guard.Reset();
        Guard.Required(request.Content, "content", 5000);
        Guard.Url(request.AttachmentUrl, "attachmentUrl");
        Guard.ThrowIfAny("message");

        var thread = await _repo.GetThreadAsync(threadId)
            ?? throw new Exceptions.NotFoundException("Thread not found.");

        var message = new ChatMessage
        {
            Id = Guid.NewGuid(),
            ThreadId = threadId,
            SenderType = ParseSender(senderType),
            SenderName = senderName,
            Content = request.Content.Trim(),
            AttachmentUrl = request.AttachmentUrl,
            CreatedAt = DateTime.UtcNow
        };
        var id = await _repo.AddMessageAsync(message);
        message.Id = id;

        // Visitor messages get a chatbot reply appended (agent). Transactional
        // asks flag the thread for manual intervention (BR-002).
        var parsedSender = ParseSender(senderType);
        if (parsedSender == ChatSenderType.Visitor
            || (parsedSender == ChatSenderType.Customer && thread.Type == ChatThreadType.CustomerProject))
        {
            var prior = thread.Messages
                .Where(m => m.SenderType != ChatSenderType.Agent)
                .OrderByDescending(m => m.CreatedAt)
                .Take(3)
                .Select(m => m.Content)
                .ToList();
            var reply = await _chatbot.AnswerAsync(request.Content, locale: null, prior);
            await _repo.AddMessageAsync(new ChatMessage
            {
                Id = Guid.NewGuid(),
                ThreadId = threadId,
                SenderType = ChatSenderType.Agent,
                SenderName = "R&A Assistant",
                Content = reply.Content,
                CreatedAt = DateTime.UtcNow.AddSeconds(1)
            });
            if (reply.NeedsManualIntervention && !thread.NeedsManualIntervention)
            {
                thread.NeedsManualIntervention = true;
                await _repo.UpdateThreadAsync(thread);
                if (_notifications is not null)
                {
                    var isCustomer = parsedSender == ChatSenderType.Customer;
                    await _notifications.CreateAsync(
                        "chat_escalation",
                        isCustomer ? "Customer needs help" : "Chat needs team help",
                        isCustomer
                            ? "A customer message in project chat needs a team response."
                            : "A visitor chat was escalated for a personal team response.",
                        threadId: thread.Id,
                        customerProjectId: thread.CustomerProjectId);
                }
            }
        }

        var updated = await _repo.GetThreadAsync(threadId)!;
        return ToSummary(updated!);
    }

    public async Task<PaginatedResult<ChatThreadSummaryDto>> ListThreadsAsync(string? type, bool? needsManualIntervention, int? page, int? pageSize)
    {
        var (p, ps) = PageRequest.Normalize(page, pageSize);
        ChatThreadType? typeFilter = null;
        if (!string.IsNullOrWhiteSpace(type))
        {
            Guard.Reset();
            Guard.EnumValue<ChatThreadType>(type, "type");
            Guard.ThrowIfAny("thread filter");
            typeFilter = Enum.Parse<ChatThreadType>(type, true);
        }
        var items = await _repo.ListThreadsAsync(typeFilter, needsManualIntervention, p, ps);
        var total = await _repo.CountThreadsAsync(typeFilter, needsManualIntervention);
        return new PaginatedResult<ChatThreadSummaryDto>
        {
            Items = items.Select(ToSummary).ToList(),
            Page = p,
            PageSize = ps,
            TotalCount = total
        };
    }

    public async Task<ChatThreadSummaryDto> UpdateThreadAsync(Guid threadId, UpdateThreadRequest request)
    {
        var thread = await _repo.GetThreadAsync(threadId)
            ?? throw new Exceptions.NotFoundException("Thread not found.");
        if (request.NeedsManualIntervention.HasValue)
            thread.NeedsManualIntervention = request.NeedsManualIntervention.Value;
        await _repo.UpdateThreadAsync(thread);
        return ToSummary(thread);
    }

    public async Task<ChatThread> CreateThreadAsync(ChatThreadType type, Guid? customerProjectId)
    {
        var thread = new ChatThread
        {
            Id = Guid.NewGuid(),
            Type = type,
            CustomerProjectId = customerProjectId,
            CreatedAt = DateTime.UtcNow
        };
        return await _repo.CreateThreadAsync(thread);
    }

    private static ChatSenderType ParseSender(string senderType) =>
        senderType?.ToLowerInvariant() switch
        {
            "customer" => ChatSenderType.Customer,
            "admin" => ChatSenderType.Admin,
            "agent" => ChatSenderType.Agent,
            _ => ChatSenderType.Visitor
        };

    private static ChatThreadDto ToDto(ChatThread t, bool includeMessages) => new(
        t.Id, t.Type.ToString().ToLowerInvariant(), t.NeedsManualIntervention, t.CustomerProjectId, t.CreatedAt,
        includeMessages ? t.Messages.OrderBy(m => m.CreatedAt)
            .Select(m => new ChatMessageDto(m.Id, m.ThreadId.ToString(), m.SenderType.ToString().ToLowerInvariant(),
                m.SenderName, m.Content, m.AttachmentUrl, m.CreatedAt)).ToList() : null);

    private static ChatThreadSummaryDto ToSummary(ChatThread t)
    {
        var last = t.Messages.OrderByDescending(m => m.CreatedAt).FirstOrDefault();
        return new ChatThreadSummaryDto(t.Id, t.Type.ToString().ToLowerInvariant(), t.NeedsManualIntervention,
            t.CustomerProjectId, last?.CreatedAt, t.Messages.Count, t.CreatedAt);
    }
}

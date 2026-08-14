using RALabs.Application.Common;
using RALabs.Application.DTOs;
using RALabs.Domain.Entities;
using RALabs.Domain.Enums;
using RALabs.Domain.Interfaces;

namespace RALabs.Application.Services;

public interface IChatService
{
    Task<ChatThreadDto> GetThreadAsync(Guid threadId, bool isCustomerThread, bool isAdmin, Guid? customerId = null);
    Task<ChatThreadSummaryDto> SendMessageAsync(Guid threadId, SendMessageRequest request, string senderType, string? senderName);
    Task<PaginatedResult<ChatThreadSummaryDto>> ListThreadsAsync(string? type, bool? needsManualIntervention, int? page, int? pageSize);
    Task<ChatThreadSummaryDto> UpdateThreadAsync(Guid threadId, UpdateThreadRequest request);
    Task<ChatThread> CreateThreadAsync(ChatThreadType type, Guid? customerProjectId);
    /// <summary>Binds an anonymous lead thread to a customer (agent handoff).
    /// Throws ForbiddenAccessException if already bound to another customer.</summary>
    Task<ChatThreadSummaryDto> ClaimThreadAsync(Guid threadId, Guid customerId);
    /// <summary>Persists only the user message (used by the streaming path, which
    /// appends the agent reply separately after the stream finishes).</summary>
    Task AppendUserMessageAsync(Guid threadId, string content, string? attachmentUrl, string senderType, string? senderName);
    /// <summary>Appends an agent reply message after a streamed response completes.</summary>
    Task AppendAgentMessageAsync(Guid threadId, string content, List<string>? suggestedActions);
}

public class ChatService : IChatService
{
    private readonly IChatRepository _repo;
    private readonly IChatbotService _chatbot;
    private readonly IAgentService? _agent;
    private readonly ILeadRepository _leads;
    private readonly INotificationService? _notifications;

    public ChatService(IChatRepository repo, IChatbotService chatbot, ILeadRepository leads,
        IAgentService? agent = null, INotificationService? notifications = null)
    {
        _repo = repo;
        _chatbot = chatbot;
        _agent = agent;
        _leads = leads;
        _notifications = notifications;
    }

    public async Task<ChatThreadDto> GetThreadAsync(Guid threadId, bool isCustomerThread, bool isAdmin, Guid? customerId = null)
    {
        var thread = await _repo.GetThreadAsync(threadId)
            ?? throw new Exceptions.NotFoundException("Thread not found.");
        if (isCustomerThread && !isAdmin && thread.Type != ChatThreadType.Lead)
            throw new Exceptions.ForbiddenAccessException("You do not have access to this thread.");
        if (customerId.HasValue && thread.CustomerId.HasValue && thread.CustomerId.Value != customerId.Value)
            throw new Exceptions.ForbiddenAccessException("This thread belongs to another customer.");

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
        // asks flag the thread for manual intervention (BR-002). Customers get
        // agent replies on their project threads and on claimed agent threads.
        var parsedSender = ParseSender(senderType);
        if (parsedSender == ChatSenderType.Visitor
            || (parsedSender == ChatSenderType.Customer && (thread.Type == ChatThreadType.CustomerProject || thread.CustomerId.HasValue)))
        {
            var prior = thread.Messages
                .Where(m => m.SenderType != ChatSenderType.Agent)
                .OrderByDescending(m => m.CreatedAt)
                .Take(3)
                .Select(m => m.Content)
                .ToList();

            AgentReply reply;
            if (_agent is not null)
            {
                var isCustomer = parsedSender == ChatSenderType.Customer;
                reply = await _agent.AnswerAsync(request.Content, request.AttachmentUrl, thread.AgentContext,
                    isCustomer, isCustomer ? thread.CustomerId : null, locale: null, prior);
                var needsFlag = reply.NeedsManualIntervention || reply.PendingBrief || reply.ProjectCreated;
                if (reply.AgentContextJson is not null || needsFlag)
                {
                    if (reply.AgentContextJson is not null)
                        thread.AgentContext = reply.AgentContextJson;
                    var wasFlagged = thread.NeedsManualIntervention;
                    if (needsFlag)
                        thread.NeedsManualIntervention = true;
                    await _repo.UpdateThreadAsync(thread);
                    if (needsFlag && !wasFlagged && _notifications is not null)
                    {
                        var fromCustomer = parsedSender == ChatSenderType.Customer;
                        var (notifType, notifTitle, notifBody) = (reply.PendingBrief, reply.ProjectCreated) switch
                        {
                            (true, _) => ("chat_pending_brief", "Visitor project brief awaiting follow-up",
                                "A visitor submitted a project brief through the chat agent and needs follow-up."),
                            (_, true) => ("project_created_via_chat", "Project created via chat",
                                "A customer submitted a new project through the chat agent."),
                            _ => ("chat_escalation", fromCustomer ? "Customer needs help" : "Chat needs team help",
                                fromCustomer
                                    ? "A customer message in project chat needs a team response."
                                    : "A visitor chat was escalated for a personal team response.")
                        };
                        if (notifType == "project_created_via_chat")
                        {
                            var ctx = ParseAgentContext(thread.AgentContext);
                            var brief = ctx?.CompletedBrief ?? ctx?.Brief; // QA-001: read snapshot first
                            var customerId = ctx?.CreatedCustomerId ?? thread.CustomerId;
                            var createdByName = brief?.Name;
                            notifTitle = createdByName is { Length: > 0 }
                                ? $"Project \"{brief?.Title}\" created via chat"
                                : "Project created via chat";
                            notifBody = $"A new project request came through the chat agent:\n" +
                                $"• Project: {brief?.Title}\n" +
                                $"• Name: {createdByName ?? "(not provided)"}\n" +
                                $"• Email: {brief?.Email ?? "(not provided)"}\n" +
                                $"• Phone: {brief?.Phone ?? "(not provided)"}\n" +
                                $"• Problem: {Shorten(brief?.Goal)}\n" +
                                $"• Timeline: {Shorten(brief?.Timeline)}\n" +
                                $"• Budget: {Shorten(brief?.Budget)}";
                            await _notifications.CreateAsync(notifType, notifTitle, notifBody,
                                threadId: thread.Id, customerId: customerId, customerProjectId: ctx?.CreatedProjectId ?? thread.CustomerProjectId);
                        }
                        else
                        {
                            await _notifications.CreateAsync(notifType, notifTitle, notifBody,
                                threadId: thread.Id, customerProjectId: thread.CustomerProjectId);
                        }
                    }
                }
            }
            else
            {
                var fallback = await _chatbot.AnswerAsync(request.Content, locale: null, prior);
                reply = new AgentReply(fallback.Content, fallback.NeedsManualIntervention,
                    new List<string>(), AgentContextJson: null);
            }

            var agentMessage = new ChatMessage
            {
                Id = Guid.NewGuid(),
                ThreadId = threadId,
                SenderType = ChatSenderType.Agent,
                SenderName = "R&A Assistant",
                Content = reply.Content,
                SuggestedActions = reply.SuggestedActions.Count > 0 ? System.Text.Json.JsonSerializer.Serialize(reply.SuggestedActions) : null,
                CreatedAt = DateTime.UtcNow.AddSeconds(1)
            };
            await _repo.AddMessageAsync(agentMessage);

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

    public async Task<ChatThreadSummaryDto> ClaimThreadAsync(Guid threadId, Guid customerId)
    {
        var thread = await _repo.GetThreadAsync(threadId)
            ?? throw new Exceptions.NotFoundException("Thread not found.");
        if (thread.CustomerId.HasValue && thread.CustomerId.Value != customerId)
            throw new Exceptions.ForbiddenAccessException("This thread belongs to another customer.");
        if (!thread.CustomerId.HasValue)
        {
            thread.CustomerId = customerId;
            await _repo.UpdateThreadAsync(thread);
        }
        return ToSummary(thread);
    }

    public async Task AppendUserMessageAsync(Guid threadId, string content, string? attachmentUrl, string senderType, string? senderName)
    {
        Guard.Reset();
        Guard.Required(content, "content", 5000);
        Guard.Url(attachmentUrl, "attachmentUrl");
        Guard.ThrowIfAny("message");
        var message = new ChatMessage
        {
            Id = Guid.NewGuid(),
            ThreadId = threadId,
            SenderType = ParseSender(senderType),
            SenderName = senderName,
            Content = content.Trim(),
            AttachmentUrl = attachmentUrl,
            CreatedAt = DateTime.UtcNow
        };
        await _repo.AddMessageAsync(message);
    }

    public async Task AppendAgentMessageAsync(Guid threadId, string content, List<string>? suggestedActions)
    {
        var message = new ChatMessage
        {
            Id = Guid.NewGuid(),
            ThreadId = threadId,
            SenderType = ChatSenderType.Agent,
            SenderName = "R&A Assistant",
            Content = content,
            SuggestedActions = suggestedActions is { Count: > 0 } ? System.Text.Json.JsonSerializer.Serialize(suggestedActions) : null,
            CreatedAt = DateTime.UtcNow.AddSeconds(1)
        };
        await _repo.AddMessageAsync(message);
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
                m.SenderName, m.Content, m.AttachmentUrl, m.CreatedAt, ParseActions(m.SuggestedActions))).ToList() : null);

    private static AgentContext? ParseAgentContext(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return null;
        try { return System.Text.Json.JsonSerializer.Deserialize<AgentContext>(json); }
        catch (System.Text.Json.JsonException) { return null; }
    }

    private static string? Shorten(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : (value.Length > 140 ? value[..140] + "…" : value);

    private static List<string>? ParseActions(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return null;
        try
        {
            return System.Text.Json.JsonSerializer.Deserialize<List<string>>(json);
        }
        catch (System.Text.Json.JsonException)
        {
            return null;
        }
    }

    private static ChatThreadSummaryDto ToSummary(ChatThread t)
    {
        var last = t.Messages.OrderByDescending(m => m.CreatedAt).FirstOrDefault();
        return new ChatThreadSummaryDto(t.Id, t.Type.ToString().ToLowerInvariant(), t.NeedsManualIntervention,
            t.CustomerProjectId, last?.CreatedAt, t.Messages.Count, t.CreatedAt);
    }
}

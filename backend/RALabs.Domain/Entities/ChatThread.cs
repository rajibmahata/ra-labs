using RALabs.Domain.Enums;

namespace RALabs.Domain.Entities;

public class ChatThread
{
    public Guid Id { get; set; }
    public ChatThreadType Type { get; set; }
    public bool NeedsManualIntervention { get; set; }
    public Guid? CustomerProjectId { get; set; }
    public Guid? LeadId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public List<ChatMessage> Messages { get; set; } = new();
}

public class ChatMessage
{
    public Guid Id { get; set; }
    public Guid ThreadId { get; set; }
    public ChatThread Thread { get; set; } = null!;
    public ChatSenderType SenderType { get; set; }
    public string? SenderName { get; set; }
    public string Content { get; set; } = string.Empty;
    public string? AttachmentUrl { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

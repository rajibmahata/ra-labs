using RALabs.Domain.Enums;

namespace RALabs.Domain.Entities;

public class AgentTask
{
    public Guid Id { get; set; }
    public string Type { get; set; } = string.Empty;
    public AgentTaskStatus Status { get; set; } = AgentTaskStatus.Pending;
    public string? Payload { get; set; }
    public string? Result { get; set; }
    public string? Error { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? CompletedAt { get; set; }
}

public class KnowledgeChunk
{
    public Guid Id { get; set; }
    public KnowledgeSourceType SourceType { get; set; }
    public string SourceId { get; set; } = string.Empty;
    public Guid? CustomerProjectId { get; set; }
    public string? Locale { get; set; }
    public string ChunkText { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

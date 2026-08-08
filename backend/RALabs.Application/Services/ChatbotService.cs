using RALabs.Application.DTOs;
using RALabs.Application.Exceptions;
using RALabs.Domain.Entities;
using RALabs.Domain.Enums;
using RALabs.Domain.Interfaces;

namespace RALabs.Application.Services;

public interface IChatbotService
{
    /// <summary>
    /// Answers a visitor/customer message using RAG retrieval over published
    /// public content. Never invents transactional facts — if a quote/timeline
    /// question cannot be answered from retrieval, flags manual intervention
    /// (BR-002).
    /// </summary>
    Task<ChatbotReply> AnswerAsync(string message, string? locale);
}

public record ChatbotReply(string Content, bool NeedsManualIntervention);

public class ChatbotService : IChatbotService
{
    private readonly IKnowledgeChunkRepository _chunks;
    private static readonly string[] TransactionalTriggers =
    {
        "quote", "price", "cost", "pricing", "estimate", "budget", "timeline",
        "how long", "deadline", "schedule", "milestone", "contract", "invoice", "pay"
    };

    public ChatbotService(IKnowledgeChunkRepository chunks) => _chunks = chunks;

    public async Task<ChatbotReply> AnswerAsync(string message, string? locale)
    {
        var lower = message.ToLowerInvariant();

        // Deterministic layer (BR-002): transactional asks never answered by retrieval alone.
        if (TransactionalTriggers.Any(t => lower.Contains(t)))
        {
            return new ChatbotReply(
                "I'd love to help with a quote or timeline — but those need a real conversation with the team. "
                + "Tell me a bit about your project below and an engineer will get back to you with specifics.",
                NeedsManualIntervention: true);
        }

        // Greeting/small talk fallback before retrieval.
        if (lower.Trim() is "hi" or "hello" or "hey" or "namaste" or "নমস্কার" or "नमस्ते")
        {
            return new ChatbotReply(
                "Hello! I'm the R&A Labs assistant. Ask me about our projects, team, or how we work — or tell me about your project and we'll get back to you.",
                NeedsManualIntervention: false);
        }

        // RAG over public content (KnowledgeChunk with CustomerProjectId == null).
        var chunks = await _chunks.GetPublicChunksAsync();
        var text = string.Join("\n\n", chunks.Select(c => c.ChunkText));
        if (string.IsNullOrWhiteSpace(text))
        {
            return new ChatbotReply(
                "I don't have enough information on that yet. Tell me about your project and our team will follow up.",
                NeedsManualIntervention: true);
        }

        var keywords = lower.Split(new[] { ' ', ',', '.', '?', '!' }, StringSplitOptions.RemoveEmptyEntries)
            .Where(k => k.Length > 3)
            .Take(12)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        var matches = chunks
            .Select(c => new { Chunk = c, Score = KeywordScore(c.ChunkText, keywords) })
            .Where(x => x.Score > 0)
            .OrderByDescending(x => x.Score)
            .Take(3)
            .Select(x => x.Chunk.ChunkText)
            .ToList();

        if (matches.Count == 0)
        {
            return new ChatbotReply(
                "I don't have information on that yet. Share a few details about your project and our team will follow up personally.",
                NeedsManualIntervention: true);
        }

        var answer = $"Here's what I found:\n\n- {string.Join("\n- ", matches.Select(m => Truncate(m, 280)))}";
        return new ChatbotReply(answer, NeedsManualIntervention: false);
    }

    private static int KeywordScore(string chunkText, ISet<string> keywords)
    {
        var words = chunkText.Split(new[] { ' ', ',', '.', '?', '!', '\n' }, StringSplitOptions.RemoveEmptyEntries)
            .Where(w => w.Length > 3);
        return words.Count(words => keywords.Contains(words, StringComparer.OrdinalIgnoreCase));
    }

    private static string Truncate(string s, int max)
        => s.Length <= max ? s : s[..max].TrimEnd() + "…";
}

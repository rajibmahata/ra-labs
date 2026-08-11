using RALabs.Application.DTOs;
using RALabs.Application.Exceptions;
using RALabs.Domain.Entities;
using RALabs.Domain.Enums;
using RALabs.Domain.Interfaces;
using System.Globalization;
using System.Text.RegularExpressions;

namespace RALabs.Application.Services;

public interface IChatbotService
{
    /// <summary>
    /// Answers a visitor/customer message using RAG retrieval over published
    /// public content. Never invents transactional facts — if a quote/timeline
    /// question cannot be answered from retrieval, flags manual intervention
    /// (BR-002). Never exposes customer/project/admin data (public-only scope).
    /// </summary>
    Task<ChatbotReply> AnswerAsync(string message, string? locale, IReadOnlyList<string>? priorMessages = null);
}

public record ChatbotReply(string Content, bool NeedsManualIntervention);

public class ChatbotService : IChatbotService
{
    private readonly IKnowledgeChunkRepository _chunks;

    private static readonly string[] TransactionalTriggers =
    {
        "quote", "price", "pricing", "cost", "estimate", "budget", "invoice",
        "pay", "payment", "contract", "milestone", "deadline"
    };

    private static readonly Regex ProjectIntentPattern = new(
        @"\b(i|we|my|our)\b.*\b(project|app|application|website|platform|system|product|tool|idea)\b",
        RegexOptions.Compiled | RegexOptions.IgnoreCase);

    private static readonly HashSet<string> StopWords = new(StringComparer.OrdinalIgnoreCase)
    {
        "the", "a", "an", "and", "or", "but", "for", "nor", "on", "at", "to",
        "from", "by", "with", "about", "into", "over", "after", "before",
        "between", "of", "in", "is", "are", "was", "were", "be", "been", "being",
        "have", "has", "had", "do", "does", "did", "will", "would", "can", "could",
        "should", "may", "might", "must", "shall", "what", "which", "who", "whom",
        "how", "why", "where", "when", "this", "that", "these", "those", "it",
        "its", "i", "you", "we", "they", "he", "she", "your", "our", "their",
        "my", "yourself", "me", "us", "them", "not", "no", "yes", "please", "tell",
        "want", "need", "like", "give", "get", "make", "know", "see", "let", "use"
    };

    // Lemmatization-light: strip common English suffixes so "build" matches
    // "building", "built"; "develop" matches "development".
    private static readonly (string Suffix, string Root)[] StemRules =
    {
        ("ologies", "ology"), ("ologists", "ologist"), ("ological", "ology"),
        ("ing", ""), ("ings", ""), ("ed", ""), ("es", ""), ("ies", "y"),
        ("s", ""), ("ly", ""), ("ment", ""), ("ments", ""), ("ion", ""),
        ("ions", ""), ("tion", "te"), ("tions", "te")
    };

    public ChatbotService(IKnowledgeChunkRepository chunks) => _chunks = chunks;

    public async Task<ChatbotReply> AnswerAsync(string message, string? locale, IReadOnlyList<string>? priorMessages = null)
    {
        var normalized = Normalize(message);

        // Deterministic layer (BR-002): transactional asks never answered by retrieval alone.
        if (TransactionalTriggers.Any(t => normalized.Contains(t)))
        {
            return new ChatbotReply(
                "I'd love to help with a quote, timeline, or budget — but those need a real conversation with the team. "
                + "Tell me a bit about your project below and an engineer will get back to you with specifics.",
                NeedsManualIntervention: true);
        }

        // Greeting / small talk.
        var greeting = message.Trim().TrimEnd('?', '!', '.');
        if (greeting.Equals("hi", StringComparison.OrdinalIgnoreCase)
            || greeting.Equals("hello", StringComparison.OrdinalIgnoreCase)
            || greeting.Equals("hey", StringComparison.OrdinalIgnoreCase)
            || greeting.Equals("namaste", StringComparison.OrdinalIgnoreCase)
            || greeting.Equals("নমস্কার", StringComparison.OrdinalIgnoreCase)
            || greeting.Equals("नमस्ते", StringComparison.OrdinalIgnoreCase)
            || greeting.Equals("bonjour", StringComparison.OrdinalIgnoreCase))
        {
            return new ChatbotReply(
                "Hello! I'm the R&A Labs AI agent. Ask me about our projects, team, or how we work — or tell me about your project and I'll collect a brief for the team.",
                NeedsManualIntervention: false);
        }

            // Turn a vague project request into a useful next question instead of
            // sending it through the knowledge fallback.
            if (ProjectIntentPattern.IsMatch(normalized))
            {
                return new ChatbotReply(
                "Absolutely — we'd love to explore it with you. What are you hoping to build, who is it for, and what should it help them do? A rough idea is enough to start. When you are ready, create a private workspace so we can keep your brief and project conversation together.",
                NeedsManualIntervention: false);
            }

        // RAG over public content only (CustomerProjectId == null) — no-leak guarantee.
        var chunks = await _chunks.GetPublicChunksAsync();
        if (chunks.Count == 0)
        {
            return new ChatbotReply(
                "Oops, this time I’m not able to answer that fully. Share your details and our admin will contact you so the team can help fulfil your requirement. Brainstorming is free — this is a space to share ideas and shape an innovative product or business.",
                NeedsManualIntervention: true);
        }

        var queryTerms = Tokenize(normalized);

        // Combine current message with recent prior context for continuity.
        var contextTerms = new HashSet<string>(queryTerms, StringComparer.OrdinalIgnoreCase);
        if (priorMessages is not null)
        {
            foreach (var prior in priorMessages.TakeLast(2))
                foreach (var t in Tokenize(Normalize(prior)))
                    contextTerms.Add(t);
        }

        var scored = chunks
            .Select(c => new { Chunk = c, Score = ScoreChunk(c.ChunkText, queryTerms, contextTerms) })
            .Where(x => x.Score > 0)
            .OrderByDescending(x => x.Score)
            .Take(3)
            .ToList();

        // Require a meaningful overlap to avoid false positives.
        if (scored.Count == 0 || scored[0].Score < 2)
        {
            return new ChatbotReply(
                "Oops, this time I’m not able to answer that fully. Share your details and our admin will contact you so the team can help fulfil your requirement. Brainstorming is free — this is a space to share ideas and shape an innovative product or business.",
                NeedsManualIntervention: true);
        }

        var answer = "Here's what I found:\n\n- " + string.Join("\n- ", scored.Select(x => Truncate(x.Chunk.ChunkText, 300)));
        return new ChatbotReply(answer, NeedsManualIntervention: false);
    }

    /// <summary>Normalize: lowercase, strip punctuation, collapse whitespace.</summary>
    private static string Normalize(string text)
    {
        var lower = text.ToLowerInvariant();
        lower = Regex.Replace(lower, @"[^\p{L}\p{N}\s']", " ");
        return Regex.Replace(lower, @"\s+", " ").Trim();
    }

    /// <summary>Tokenize, filter stop-words/short words, apply lemmatization-light stemming.</summary>
    private static List<string> Tokenize(string normalized)
    {
        var tokens = new List<string>();
        foreach (var raw in normalized.Split(' '))
        {
            if (raw.Length < 4) continue;
            if (StopWords.Contains(raw)) continue;
            var stem = Stem(raw);
            if (stem.Length < 4) continue;
            if (!tokens.Contains(stem, StringComparer.OrdinalIgnoreCase))
                tokens.Add(stem);
        }
        return tokens;
    }

    private static string Stem(string word)
    {
        foreach (var (suffix, root) in StemRules)
        {
            if (word.Length > suffix.Length + 2 && word.EndsWith(suffix, StringComparison.Ordinal))
                return word[..^suffix.Length] + root;
        }
        return word;
    }

    private static int ScoreChunk(string chunkText, IReadOnlyCollection<string> queryTerms, ISet<string> contextTerms)
    {
        var words = chunkText.ToLowerInvariant()
            .Split(new[] { ' ', ',', '.', '?', '!', ':', ';', '(', ')', '\n', '\r', '-', '—' }, StringSplitOptions.RemoveEmptyEntries)
            .Select(Stem)
            .Where(w => w.Length >= 4 && !StopWords.Contains(w))
            .ToList();

        var score = 0;
        foreach (var term in queryTerms)
        {
            var count = words.Count(w => w == term);
            if (count > 0) score += 2 + count; // query-term match weighted higher
        }
        // Context terms contribute weakly (continuity only).
        foreach (var term in contextTerms)
        {
            if (words.Contains(term, StringComparer.OrdinalIgnoreCase))
                score += 1;
        }
        return score;
    }

    private static string Truncate(string s, int max)
        => s.Length <= max ? s : s[..max].TrimEnd() + "…";
}

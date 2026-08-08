using RALabs.Application.Services;
using RALabs.Domain.Entities;
using RALabs.Domain.Enums;
using RALabs.Domain.Interfaces;

namespace RALabs.Tests;

/// <summary>BR-002: the chatbot must never present transactional facts (quotes,
/// timelines) as confirmed — it flags manual intervention instead.</summary>
public class ChatbotServiceTests
{
    [Fact]
    public async Task TransactionalQuestion_FlagsManualIntervention()
    {
        var chunks = new FakeKnowledgeChunkRepository(new()
        {
            new KnowledgeChunk
            {
                Id = Guid.NewGuid(),
                SourceType = KnowledgeSourceType.PublicContent,
                SourceId = "project:x",
                ChunkText = "LexVault project cost estimate is $15,000 with a 6 week timeline.",
                CreatedAt = DateTime.UtcNow
            }
        });
        var svc = new ChatbotService(chunks);

        var reply = await svc.AnswerAsync("Can you give me a price quote for LexVault?", null);

        // Must NOT present $15,000 as a confirmed quote; must flag intervention.
        Assert.True(reply.NeedsManualIntervention);
        Assert.DoesNotContain("$15,000", reply.Content);
        Assert.DoesNotContain("confirmed", reply.Content, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task TimelineQuestion_FlagsManualIntervention()
    {
        var svc = new ChatbotService(new FakeKnowledgeChunkRepository(new()));
        var reply = await svc.AnswerAsync("How long would this project take?", null);
        Assert.True(reply.NeedsManualIntervention);
    }

    [Fact]
    public async Task GenericQuestion_UsesRetrieval()
    {
        var chunks = new FakeKnowledgeChunkRepository(new()
        {
            new KnowledgeChunk
            {
                Id = Guid.NewGuid(),
                SourceType = KnowledgeSourceType.PublicContent,
                SourceId = "project:lexvault",
                ChunkText = "LexVault is a legal document RAG platform using Qdrant and hybrid search.",
                CreatedAt = DateTime.UtcNow
            }
        });
        var svc = new ChatbotService(chunks);
        var reply = await svc.AnswerAsync("Tell me about LexVault", null);
        Assert.Contains("LexVault", reply.Content, StringComparison.OrdinalIgnoreCase);
    }
}

internal sealed class FakeKnowledgeChunkRepository : IKnowledgeChunkRepository
{
    private readonly List<KnowledgeChunk> _chunks;
    public FakeKnowledgeChunkRepository(List<KnowledgeChunk> chunks) => _chunks = chunks;

    public Task AddAsync(KnowledgeChunk chunk) { _chunks.Add(chunk); return Task.CompletedTask; }
    public Task DeleteBySourceAsync(string sourceType, string sourceId)
    {
        _chunks.RemoveAll(c => c.SourceType.ToString() == sourceType && c.SourceId == sourceId);
        return Task.CompletedTask;
    }
    public Task<List<KnowledgeChunk>> GetPublicChunksAsync() => Task.FromResult(_chunks.Where(c => c.CustomerProjectId == null).ToList());
    public Task<List<KnowledgeChunk>> GetChunksByProjectAsync(Guid customerProjectId) =>
        Task.FromResult(_chunks.Where(c => c.CustomerProjectId == customerProjectId).ToList());
}

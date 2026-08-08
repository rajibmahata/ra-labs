using RALabs.Application.Services;
using RALabs.Domain.Entities;
using RALabs.Domain.Enums;
using RALabs.Domain.Interfaces;

namespace RALabs.Tests;

/// <summary>Chatbot retrieval matrix — the required studio questions plus
/// unrelated-question safety and the BR-002 transactional guardrail.</summary>
public class ChatbotRetrievalTests
{
    private static ChatbotService CreateService()
    {
        var chunks = new FakeKnowledgeChunkRepository(new()
        {
            new KnowledgeChunk
            {
                Id = Guid.NewGuid(),
                SourceType = KnowledgeSourceType.PublicContent,
                SourceId = "content:studio",
                ChunkText =
                    "R&A Labs is an engineering studio founded by Rajib Mahata and Abhishek Burnwal. " +
                    "The studio builds software for businesses: SaaS products, web applications, enterprise systems, AI applications and RAG systems. " +
                    "Core services: backend architecture with .NET and Azure, SaaS product development, AI and LLM integration, and cloud engineering. " +
                    "Technology stack: .NET, C#, ASP.NET Core, React, TypeScript, Python, Azure, SQL Server, PostgreSQL, Docker, GitHub. " +
                    "Development process: five steps — discuss, sketch, architect, build, refine. " +
                    "Rajib Mahata is a Senior .NET and Azure Engineer with 12+ years of experience. " +
                    "You can contact the team through the contact form on the website. " +
                    "Projects include SaaS products, AI applications, enterprise systems, and web platforms built for businesses.",
                CreatedAt = DateTime.UtcNow
            }
        });
        return new ChatbotService(chunks);
    }

    [Theory]
    [InlineData("What does R&A Labs build?")]
    [InlineData("How do you develop applications?")]
    [InlineData("What technologies do you use?")]
    [InlineData("How does your development process work?")]
    [InlineData("Can you build an AI application?")]
    [InlineData("Who is Rajib?")]
    [InlineData("What projects have you built?")]
    [InlineData("How can I contact you?")]
    [InlineData("What is your development process?")]
    public async Task RequiredQuestions_AreAnswered(string question)
    {
        var svc = CreateService();
        var reply = await svc.AnswerAsync(question, null);
        Assert.False(string.IsNullOrWhiteSpace(reply.Content));
        Assert.DoesNotContain("I don't have information", reply.Content);
    }

    [Theory]
    [InlineData("Tell me about the stock market today")]
    [InlineData("What is the capital of France?")]
    [InlineData("Recommend a good pizza place nearby")]
    public async Task UnrelatedQuestions_NoFalsePositive(string question)
    {
        var svc = CreateService();
        var reply = await svc.AnswerAsync(question, null);
        // Must not fabricate an answer about the studio from an unrelated question.
        Assert.Contains("Share your details", reply.Content);
        Assert.DoesNotContain("I don't have information", reply.Content);
        Assert.True(reply.NeedsManualIntervention);
    }

    [Theory]
    [InlineData("Can you give me a price quote?")]
    [InlineData("What is your timeline for delivery?")]
    [InlineData("How much does it cost to build an app?")]
    public async Task TransactionalQuestions_FlagManualIntervention(string question)
    {
        var svc = CreateService();
        var reply = await svc.AnswerAsync(question, null);
        Assert.True(reply.NeedsManualIntervention);
        Assert.DoesNotContain("$", reply.Content);
    }

    [Fact]
    public async Task PunctuationAndCase_Normalized()
    {
        var svc = CreateService();
        var reply = await svc.AnswerAsync("WHO IS RAJIB??", null);
        Assert.False(reply.NeedsManualIntervention);
        Assert.Contains("Rajib", reply.Content);
    }

    [Fact]
    public async Task Stemming_Technologies_MatchesTechnology()
    {
        var svc = CreateService();
        var reply = await svc.AnswerAsync("What technologies do you use?", null);
        Assert.False(reply.NeedsManualIntervention);
        Assert.Contains(".NET", reply.Content, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task PublicOnly_NoCustomerData()
    {
        var svc = CreateService();
        var reply = await svc.AnswerAsync("Tell me about customer project X requirements", null);
        // No customer/project private data in the response; either honest answer or intervention.
        Assert.DoesNotContain("confidential", reply.Content);
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

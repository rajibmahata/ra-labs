using RALabs.Domain.Entities;
using RALabs.Domain.Enums;
using RALabs.Domain.Interfaces;

namespace RALabs.Application.Services;

public interface IRagIngestionService
{
    Task<int> IngestPublicContentAsync(CancellationToken ct);
}

/// <summary>
/// Ingests published public content (portfolio summaries + case studies,
/// team bios) into KnowledgeChunk rows so the chatbot can retrieve it.
/// Customer-scoped ingestion (M2+) must always set CustomerProjectId and be
/// filtered by it at the query layer (BR-001).
/// </summary>
public class RagIngestionService : IRagIngestionService
{
    private readonly IProjectRepository _projects;
    private readonly ITeamRepository _team;
    private readonly IContentRepository _content;
    private readonly IKnowledgeChunkRepository _chunks;

    public RagIngestionService(IProjectRepository projects, ITeamRepository team, IContentRepository content, IKnowledgeChunkRepository chunks)
    {
        _projects = projects;
        _team = team;
        _content = content;
        _chunks = chunks;
    }

    public async Task<int> IngestPublicContentAsync(CancellationToken ct)
    {
        var count = 0;

        // Studio knowledge — a rich, static-grounded chunk so the chatbot can
        // answer broad questions about what the studio builds, how it works,
        // its technology, services, team, and process (source: this project).
        var studioText =
            "R&A Labs is an engineering studio founded by Rajib Mahata and Abhishek Burnwal. " +
            "The studio builds software for businesses: SaaS products, web applications, enterprise systems, AI applications and RAG systems. " +
            "Core services: backend architecture with .NET and Azure, SaaS product development, AI and LLM integration, and cloud engineering. " +
            "Technology stack: .NET, C#, ASP.NET Core, React, TypeScript, Python, Azure, SQL Server, PostgreSQL, Docker, GitHub. " +
            "Development process: five steps — discuss, sketch, architect, build, refine. " +
            "The team can build AI applications, chatbots, document systems, and full web platforms. " +
            "Contact via the contact form on the website. " +
            "Rajib Mahata is a Senior .NET and Azure Engineer with 12+ years of experience. " +
            "Abhishek Burnwal is an engineering leader and co-founder.";
        await _chunks.DeleteBySourceAsync(nameof(KnowledgeSourceType.PublicContent), "content:studio");
        await _chunks.AddAsync(new KnowledgeChunk
        {
            Id = Guid.NewGuid(),
            SourceType = KnowledgeSourceType.PublicContent,
            SourceId = "content:studio",
            CustomerProjectId = null,
            ChunkText = studioText,
            CreatedAt = DateTime.UtcNow
        });
        count++;

        // Studio copy (English) appended as a second public chunk.
        var studioContent = await _content.GetByLocaleAsync("en");
        if (studioContent.Count > 0)
        {
            var joined = string.Join(" ", studioContent.Select(kv => $"{kv.Key}: {kv.Value}"));
            await _chunks.DeleteBySourceAsync(nameof(KnowledgeSourceType.PublicContent), "content:copy");
            await _chunks.AddAsync(new KnowledgeChunk
            {
                Id = Guid.NewGuid(),
                SourceType = KnowledgeSourceType.PublicContent,
                SourceId = "content:copy",
                CustomerProjectId = null,
                ChunkText = joined,
                CreatedAt = DateTime.UtcNow
            });
            count++;
        }

        var published = await _projects.GetPublishedAsync(1, 1000, null);

        foreach (var p in published)
        {
            var text = $"{p.Title}. {p.Summary}." + (string.IsNullOrWhiteSpace(p.CaseStudyBody)
                ? ""
                : " " + string.Join(" ", p.CaseStudyBody.Split('\n').Take(8)));
            await _chunks.DeleteBySourceAsync(nameof(KnowledgeSourceType.PublicContent), $"project:{p.Id}");
            if (!string.IsNullOrWhiteSpace(text) && text.Length > 20)
            {
                await _chunks.AddAsync(new KnowledgeChunk
                {
                    Id = Guid.NewGuid(),
                    SourceType = KnowledgeSourceType.PublicContent,
                    SourceId = $"project:{p.Id}",
                    CustomerProjectId = null,
                    ChunkText = text,
                    CreatedAt = DateTime.UtcNow
                });
                count++;
            }
        }

        var members = await _team.GetPublishedAsync();
        foreach (var m in members)
        {
            var text = $"{m.Name} — {m.Role}. {m.Bio}";
            await _chunks.DeleteBySourceAsync(nameof(KnowledgeSourceType.PublicContent), $"team:{m.Id}");
            if (text.Length > 20)
            {
                await _chunks.AddAsync(new KnowledgeChunk
                {
                    Id = Guid.NewGuid(),
                    SourceType = KnowledgeSourceType.PublicContent,
                    SourceId = $"team:{m.Id}",
                    CustomerProjectId = null,
                    ChunkText = text,
                    CreatedAt = DateTime.UtcNow
                });
                count++;
            }
        }

        return count;
    }
}

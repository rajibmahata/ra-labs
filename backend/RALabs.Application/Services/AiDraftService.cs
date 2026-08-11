using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using RALabs.Domain.Entities;
using RALabs.Domain.Interfaces;

namespace RALabs.Application.Services;

public interface IAiDraftService
{
    Task<ContentDraft> GenerateProjectDraftAsync(string sourceUrl, string sourceText, CancellationToken ct);
    Task<ContentDraft> GenerateProjectRefreshAsync(Guid projectId, IProjectRepository projects, CancellationToken ct);
    Task<List<ContentDraft>> ListAsync(string? status, int page, int pageSize);
    Task<ContentDraft> ReviewAsync(Guid id, string decision, string? note, IProjectRepository projects, IRagIngestionService rag);
}

public sealed class AiDraftService : IAiDraftService
{
    private readonly IContentDraftRepository _drafts;
    private readonly IHttpClientFactory _httpFactory;
    private readonly string? _apiKey;
    private readonly string _model;

    public AiDraftService(IContentDraftRepository drafts, IHttpClientFactory httpFactory, string? apiKey, string model)
    {
        _drafts = drafts;
        _httpFactory = httpFactory;
        _apiKey = apiKey;
        _model = model;
    }

    public async Task<ContentDraft> GenerateProjectDraftAsync(string sourceUrl, string sourceText, CancellationToken ct)
    {
        var prompt = "Create a concise portfolio project draft from this repository information. Return JSON with title, summary, body. Do not invent metrics, clients, or technologies not present in the source.\n\n" + sourceText;
        var draft = await GenerateAsync("project", prompt, sourceUrl, sourceText, ct);
        await _drafts.AddAsync(draft);
        return draft;
    }

    public Task<List<ContentDraft>> ListAsync(string? status, int page, int pageSize) => _drafts.ListAsync(status, page, pageSize);

    public async Task<ContentDraft> GenerateProjectRefreshAsync(Guid projectId, IProjectRepository projects, CancellationToken ct)
    {
        var project = await projects.GetByIdAsync(projectId) ?? throw new KeyNotFoundException("Project not found.");
        if (string.IsNullOrWhiteSpace(_apiKey))
            throw new InvalidOperationException("OpenAI:ApiKey is not configured on the server.");

        var source = string.Join("\n",
            $"Title: {project.Title}",
            $"Summary: {project.Summary}",
            $"Stack: {string.Join(", ", project.StackTags)}",
            $"Status: {project.Status}",
            $"GithubUrl: {project.GithubUrl}",
            $"CaseStudyBody: {project.CaseStudyBody}");
        var prompt = "Improve the portfolio case study for this verified project. Return JSON with title, summary, body. " +
                     "Only use facts present in the source. Do not invent metrics, clients, dates, or technologies. Keep the title short and the summary under 280 characters.\n\n" + source;

        var draft = await GenerateAsync(project.Slug + "-refresh", prompt, sourceUrl: project.GithubUrl, sourceText: source, ct);
        draft.ProjectDraftId = project.Id;
        await _drafts.UpdateAsync(draft);
        return draft;
    }

    public async Task<ContentDraft> ReviewAsync(Guid id, string decision, string? note, IProjectRepository projects, IRagIngestionService rag)
    {
        var draft = await _drafts.GetByIdAsync(id) ?? throw new KeyNotFoundException("Draft not found.");
        if (decision is not ("approve" or "reject")) throw new ArgumentException("Decision must be approve or reject.");
        draft.Status = decision == "approve" ? "approved" : "rejected";
        draft.ReviewNote = note;
        draft.ReviewedAt = DateTime.UtcNow;
        if (decision == "approve")
        {
            if (draft.ProjectDraftId.HasValue)
            {
                // Refresh draft: apply to the existing project without auto-publishing.
                var project = await projects.GetByIdAsync(draft.ProjectDraftId.Value)
                    ?? throw new KeyNotFoundException("Target project not found.");
                if (!string.IsNullOrWhiteSpace(draft.Title)) project.Title = draft.Title;
                if (!string.IsNullOrWhiteSpace(draft.Summary)) project.Summary = draft.Summary;
                if (!string.IsNullOrWhiteSpace(draft.Body)) project.CaseStudyBody = draft.Body;
                await projects.UpdateAsync(project);
                draft.ApprovedProjectId = project.Id;
                await rag.SyncProjectAsync(project.Id, CancellationToken.None);
            }
            else
            {
                var slug = Slugify(draft.Title);
                if (await projects.SlugExistsAsync(slug)) slug += "-" + draft.Id.ToString("N")[..8];
                var project = new Project
                {
                    Id = Guid.NewGuid(), Title = draft.Title, Slug = slug,
                    Summary = draft.Summary, CaseStudyBody = draft.Body,
                    GithubUrl = draft.SourceUrl, IsPublished = false,
                    CreatedAt = DateTime.UtcNow
                };
                await projects.AddAsync(project);
                draft.ApprovedProjectId = project.Id;
            }
        }
        await _drafts.UpdateAsync(draft);
        return draft;
    }

    private async Task<ContentDraft> GenerateAsync(string titleHint, string prompt, string? sourceUrl, string sourceText, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(_apiKey))
            throw new InvalidOperationException("OpenAI:ApiKey is not configured on the server.");

        using var client = _httpFactory.CreateClient("openai");
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", _apiKey);
        using var response = await client.PostAsJsonAsync("https://api.openai.com/v1/chat/completions", new
        {
            model = _model,
            temperature = 0.2,
            response_format = new { type = "json_object" },
            messages = new[]
            {
                new { role = "system", content = "You write factual, reviewable portfolio copy." },
                new { role = "user", content = prompt }
            }
        }, ct);
        response.EnsureSuccessStatusCode();
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync(ct));
        var content = document.RootElement.GetProperty("choices")[0].GetProperty("message").GetProperty("content").GetString() ?? "{}";
        using var generated = JsonDocument.Parse(content);
        var root = generated.RootElement;
        return new ContentDraft
        {
            Id = Guid.NewGuid(),
            Title = Read(root, "title", titleHint),
            Summary = Read(root, "summary", "Review required."),
            Body = ReadNullable(root, "body"),
            SourceUrl = sourceUrl,
            SourceSnapshot = sourceText.Length > 12000 ? sourceText[..12000] : sourceText,
            Status = "pending"
        };
    }

    private static string Read(JsonElement root, string name, string fallback) =>
        root.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.String && !string.IsNullOrWhiteSpace(value.GetString())
            ? value.GetString()! : fallback;

    private static string? ReadNullable(JsonElement root, string name) =>
        root.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.String ? value.GetString() : null;

    private static string Slugify(string value) => string.Join('-', value.ToLowerInvariant().Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)).Replace("/", "-");
}
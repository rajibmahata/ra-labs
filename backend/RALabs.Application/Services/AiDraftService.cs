using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using RALabs.Domain.Entities;
using RALabs.Domain.Interfaces;

namespace RALabs.Application.Services;

public interface IAiDraftService
{
    Task<ContentDraft> GenerateProjectDraftAsync(string sourceUrl, string sourceText, CancellationToken ct);
    Task<List<ContentDraft>> ListAsync(string? status, int page, int pageSize);
    Task<ContentDraft> ReviewAsync(Guid id, string decision, string? note, IProjectRepository projects);
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
        if (string.IsNullOrWhiteSpace(_apiKey))
            throw new InvalidOperationException("OpenAI:ApiKey is not configured on the server.");

        var prompt = "Create a concise portfolio project draft from this repository information. Return JSON with title, summary, body. Do not invent metrics, clients, or technologies not present in the source.\n\n" + sourceText;
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
        var draft = new ContentDraft
        {
            Id = Guid.NewGuid(),
            Title = Read(root, "title", "Untitled project"),
            Summary = Read(root, "summary", "Review required."),
            Body = ReadNullable(root, "body"),
            SourceUrl = sourceUrl,
            SourceSnapshot = sourceText.Length > 12000 ? sourceText[..12000] : sourceText,
            Status = "pending"
        };
        await _drafts.AddAsync(draft);
        return draft;
    }

    public Task<List<ContentDraft>> ListAsync(string? status, int page, int pageSize) => _drafts.ListAsync(status, page, pageSize);

    public async Task<ContentDraft> ReviewAsync(Guid id, string decision, string? note, IProjectRepository projects)
    {
        var draft = await _drafts.GetByIdAsync(id) ?? throw new KeyNotFoundException("Draft not found.");
        if (decision is not ("approve" or "reject")) throw new ArgumentException("Decision must be approve or reject.");
        draft.Status = decision == "approve" ? "approved" : "rejected";
        draft.ReviewNote = note;
        draft.ReviewedAt = DateTime.UtcNow;
        if (decision == "approve")
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
        await _drafts.UpdateAsync(draft);
        return draft;
    }

    private static string Read(JsonElement root, string name, string fallback) =>
        root.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.String && !string.IsNullOrWhiteSpace(value.GetString())
            ? value.GetString()! : fallback;

    private static string? ReadNullable(JsonElement root, string name) =>
        root.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.String ? value.GetString() : null;

    private static string Slugify(string value) => string.Join('-', value.ToLowerInvariant().Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)).Replace("/", "-");
}
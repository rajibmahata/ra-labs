using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Caching.Memory;
using RALabs.Domain.Entities;
using RALabs.Domain.Interfaces;

namespace RALabs.Application.Services;

/// <summary>Visual variables that drive the animated 3D hero banner on the
/// public site. The LLM picks the scene composition, colors, and orbital
/// labels from grounded studio content; headline and CTA copy remain
/// i18n-key based in the frontend.</summary>
public sealed record HeroScenario(
    string Theme,
    string Accent,
    string Secondary,
    string Tertiary,
    int OrbitCount,
    string OrbitSpeed,
    IReadOnlyList<string> Labels,
    string ProjectFocus,
    string GeneratedAt);

public interface IHeroScenarioService
{
    /// <summary>Returns a validated hero scenario. The result is cached for one
    /// hour so the public homepage never triggers repeated model calls.</summary>
    Task<HeroScenario> GetScenarioAsync(CancellationToken ct);
}

/// <summary>LLM-backed hero scenario generator with a deterministic, data-driven
/// fallback when OpenAI is not configured or the call fails. Scenarios are
/// validated and cached via <see cref="IMemoryCache"/>.</summary>
public sealed class HeroScenarioService : IHeroScenarioService
{
    private const string CacheKey = "hero-scenario:v1";
    private static readonly TimeSpan CacheTtl = TimeSpan.FromHours(1);
    private static readonly string[] AllowedThemes = { "layers", "orbit", "grid" };
    private static readonly string[] AllowedSpeeds = { "slow", "medium", "fast" };
    private static readonly string[] FallbackLabels = { "Backend Systems", "AI & RAG", "SaaS Products" };

    private readonly IKnowledgeChunkRepository _knowledgeRepo;
    private readonly IProjectRepository _projectRepo;
    private readonly IHttpClientFactory _httpFactory;
    private readonly IMemoryCache _cache;
    private readonly string? _apiKey;
    private readonly string _model;

    public HeroScenarioService(
        IKnowledgeChunkRepository knowledgeRepo,
        IProjectRepository projectRepo,
        IHttpClientFactory httpFactory,
        IMemoryCache cache,
        string? apiKey,
        string model)
    {
        _knowledgeRepo = knowledgeRepo;
        _projectRepo = projectRepo;
        _httpFactory = httpFactory;
        _cache = cache;
        _apiKey = apiKey;
        _model = model;
    }

    public async Task<HeroScenario> GetScenarioAsync(CancellationToken ct)
    {
        if (_cache.TryGetValue(CacheKey, out HeroScenario? cached) && cached is not null)
            return cached;

        var scenario = await GenerateAsync(ct);
        _cache.Set(CacheKey, scenario, CacheTtl);
        return scenario;
    }

    private async Task<HeroScenario> GenerateAsync(CancellationToken ct)
    {
        if (!string.IsNullOrWhiteSpace(_apiKey))
        {
            try
            {
                var scenario = await GenerateFromModelAsync(ct);
                if (scenario is not null)
                    return scenario;
            }
            catch
            {
                // Fall back to the deterministic scenario when the model is unavailable.
            }
        }
        return await BuildFallbackAsync(ct);
    }

    /// <summary>Deterministic, data-driven fallback: derived from the studio's
    /// public knowledge chunks and published projects, never random.</summary>
    private async Task<HeroScenario> BuildFallbackAsync(CancellationToken ct)
    {
        var labels = new List<string>(FallbackLabels);
        string focus = "AI Product Engineering";
        try
        {
            var projects = await _projectRepo.GetPublishedAsync(1, 20, null);
            var tags = projects
                .Where(p => p.StackTags is not null)
                .SelectMany(p => p.StackTags)
                .Where(t => !string.IsNullOrWhiteSpace(t))
                .Distinct()
                .Take(4)
                .ToList();
            if (tags.Count > 0)
                labels = tags.Take(4).ToList();
            if (projects.Count > 0 && !string.IsNullOrWhiteSpace(projects[0].Title))
                focus = projects[0].Title.Length > 60 ? projects[0].Title[..60] : projects[0].Title;
        }
        catch
        {
            // Keep the static fallback values.
        }

        return new HeroScenario(
            Theme: "layers",
            Accent: "#6366f1",
            Secondary: "#22d3ee",
            Tertiary: "#f59e0b",
            OrbitCount: 3,
            OrbitSpeed: "medium",
            Labels: labels,
            ProjectFocus: focus,
            GeneratedAt: DateTime.UtcNow.ToString("O"));
    }

    private async Task<HeroScenario?> GenerateFromModelAsync(CancellationToken ct)
    {
        var grounding = await BuildGroundingAsync(ct);
        var prompt =
            "You are the creative director for R&A Labs, an AI product engineering studio. " +
            "Design the visual variables for an animated 3D hero banner. " +
            "Return a JSON object with exactly these fields:\n" +
            "- \"theme\": one of \"layers\", \"orbit\", \"grid\"\n" +
            "- \"accent\", \"secondary\", \"tertiary\": hex color strings like \"#6366f1\"\n" +
            "- \"orbitCount\": integer between 2 and 6\n" +
            "- \"orbitSpeed\": one of \"slow\", \"medium\", \"fast\"\n" +
            "- \"labels\": array of 3 to 6 short labels (max 24 characters each) describing what the studio builds\n" +
            "- \"projectFocus\": a short phrase (max 60 characters) naming the flagship focus\n" +
            "Stay true to the studio facts below. Output JSON only.\n\n" +
            grounding;

        using var client = _httpFactory.CreateClient("openai");
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", _apiKey);
        using var response = await client.PostAsJsonAsync("https://api.openai.com/v1/chat/completions", new
        {
            model = _model,
            temperature = 0.6,
            response_format = new { type = "json_object" },
            messages = new[]
            {
                new { role = "system", content = "You output JSON only." },
                new { role = "user", content = prompt }
            }
        }, ct);
        response.EnsureSuccessStatusCode();
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync(ct));
        var content = document.RootElement.GetProperty("choices")[0].GetProperty("message").GetProperty("content").GetString();
        if (string.IsNullOrWhiteSpace(content))
            return null;

        using var generated = JsonDocument.Parse(content);
        return ParseScenario(generated.RootElement);
    }

    private HeroScenario? ParseScenario(JsonElement root)
    {
        try
        {
            if (root.ValueKind != JsonValueKind.Object)
                return null;

            var theme = root.TryGetProperty("theme", out var t) ? t.GetString() : null;
            var accent = root.TryGetProperty("accent", out var a) ? a.GetString() : null;
            var secondary = root.TryGetProperty("secondary", out var s) ? s.GetString() : null;
            var tertiary = root.TryGetProperty("tertiary", out var te) ? te.GetString() : null;
            var orbitCount = root.TryGetProperty("orbitCount", out var oc) && oc.TryGetInt32(out var oci) ? oci : 0;
            var orbitSpeed = root.TryGetProperty("orbitSpeed", out var os) ? os.GetString() : null;
            var labels = root.TryGetProperty("labels", out var ls) && ls.ValueKind == JsonValueKind.Array
                ? ls.EnumerateArray().Select(e => e.GetString() ?? string.Empty).ToList()
                : new List<string>();
            var focus = root.TryGetProperty("projectFocus", out var pf) ? pf.GetString() : null;

            if (!AllowedThemes.Contains(theme ?? string.Empty))
                return null;
            if (!AllowedSpeeds.Contains(orbitSpeed ?? string.Empty))
                return null;
            if (orbitCount < 2 || orbitCount > 6)
                return null;
            foreach (var color in new[] { accent, secondary, tertiary })
            {
                if (string.IsNullOrWhiteSpace(color) || !IsHexColor(color))
                    return null;
            }
            labels = labels
                .Where(l => !string.IsNullOrWhiteSpace(l))
                .Select(l => l.Trim().Length > 24 ? l.Trim()[..24] : l.Trim())
                .Take(6)
                .ToList();
            if (labels.Count < 3)
                return null;

            return new HeroScenario(
                Theme: theme!,
                Accent: accent!,
                Secondary: secondary!,
                Tertiary: tertiary!,
                OrbitCount: orbitCount,
                OrbitSpeed: orbitSpeed!,
                Labels: labels,
                ProjectFocus: string.IsNullOrWhiteSpace(focus) ? "AI Product Engineering" : (focus.Length > 60 ? focus[..60] : focus),
                GeneratedAt: DateTime.UtcNow.ToString("O"));
        }
        catch
        {
            return null;
        }
    }

    private static bool IsHexColor(string value) =>
        value.Length == 7 && value[0] == '#' && value[1..].All(Uri.IsHexDigit);

    private async Task<string> BuildGroundingAsync(CancellationToken ct)
    {
        var parts = new List<string>();
        try
        {
            var chunks = await _knowledgeRepo.GetPublicChunksAsync();
            parts.AddRange(chunks.Select(c => c.ChunkText));
        }
        catch
        {
            // Grounding is best-effort; proceed without knowledge chunks.
        }
        try
        {
            var projects = await _projectRepo.GetPublishedAsync(1, 20, null);
            parts.AddRange(projects.Select(p =>
                $"Project: {p.Title}. Tags: {string.Join(", ", p.StackTags ?? new List<string>())}"));
        }
        catch
        {
            // Grounding is best-effort; proceed without projects.
        }

        var text = string.Join("\n", parts.Where(p => !string.IsNullOrWhiteSpace(p)));
        return text.Length > 4000 ? text[..4000] : text;
    }
}

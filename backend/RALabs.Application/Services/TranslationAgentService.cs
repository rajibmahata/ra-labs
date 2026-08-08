using System.Collections.Concurrent;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using RALabs.Domain.Entities;
using RALabs.Domain.Interfaces;

namespace RALabs.Application.Services;

public interface ITranslationAgentService
{
    Task EnsureTranslatedAsync(string locale, CancellationToken ct);
}

/// <summary>
/// LLM-backed translation agent. On a language change, translates the English
/// content keys for the requested locale on demand and persists them as
/// <see cref="PageContent"/> rows, so subsequent requests are served from the
/// database without another model call. Runs only when OpenAI is configured;
/// callers fall back to English values when translations are unavailable.
/// </summary>
public sealed class TranslationAgentService : ITranslationAgentService
{
    private const string SourceLocale = "en";
    private static readonly Dictionary<string, string> LocaleNames = new()
    {
        ["en"] = "English", ["hi"] = "Hindi", ["bn"] = "Bengali", ["fr"] = "French",
        ["es"] = "Spanish", ["ar"] = "Arabic", ["zh"] = "Chinese", ["pt"] = "Portuguese",
        ["de"] = "German", ["ja"] = "Japanese", ["ru"] = "Russian"
    };
    private static readonly ConcurrentDictionary<string, SemaphoreSlim> Locks = new();

    private readonly IContentRepository _repo;
    private readonly IHttpClientFactory _httpFactory;
    private readonly string? _apiKey;
    private readonly string _model;

    public TranslationAgentService(IContentRepository repo, IHttpClientFactory httpFactory, string? apiKey, string model)
    {
        _repo = repo;
        _httpFactory = httpFactory;
        _apiKey = apiKey;
        _model = model;
    }

    public async Task EnsureTranslatedAsync(string locale, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(_apiKey) || locale == SourceLocale)
            return;

        var gate = Locks.GetOrAdd(locale, _ => new SemaphoreSlim(1, 1));
        await gate.WaitAsync(ct);
        try
        {
            var target = (await _repo.GetByLocaleAsync(locale)).ToDictionary(x => x.Key, x => x.Value);
            var source = (await _repo.GetByLocaleAsync(SourceLocale)).ToDictionary(x => x.Key, x => x.Value);
            var missing = source.Keys.Where(k => !target.ContainsKey(k)).ToList();
            if (missing.Count == 0)
                return;

            var translated = await TranslateAsync(source, missing, locale, ct);
            foreach (var key in missing)
            {
                if (translated.TryGetValue(key, out var value) && !string.IsNullOrWhiteSpace(value))
                {
                    await _repo.AddAsync(new PageContent
                    {
                        Id = Guid.NewGuid(),
                        Key = key,
                        Locale = locale,
                        Value = value.Trim()
                    });
                }
            }
        }
        finally
        {
            gate.Release();
        }
    }

    private async Task<Dictionary<string, string>> TranslateAsync(
        Dictionary<string, string> source, List<string> keys, string locale, CancellationToken ct)
    {
        try
        {
            var payload = new Dictionary<string, string>();
            foreach (var key in keys)
                payload[key] = source[key];

            var language = LocaleNames.TryGetValue(locale, out var name) ? name : locale;
            var prompt =
                $"Translate the following JSON object from English into {language}. " +
                "Return a JSON object with the exact same keys and the translated string values. " +
                "Keep brand names, product names, and markup like {placeholders} unchanged. " +
                "Use natural, professional copy — do not add anything not in the source.\n\n" +
                JsonSerializer.Serialize(payload);

            using var client = _httpFactory.CreateClient("openai");
            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", _apiKey);
            using var response = await client.PostAsJsonAsync("https://api.openai.com/v1/chat/completions", new
            {
                model = _model,
                temperature = 0.2,
                response_format = new { type = "json_object" },
                messages = new[]
                {
                    new { role = "system", content = "You are a professional website translator. You output JSON only." },
                    new { role = "user", content = prompt }
                }
            }, ct);
            response.EnsureSuccessStatusCode();
            using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync(ct));
            var content = document.RootElement.GetProperty("choices")[0].GetProperty("message").GetProperty("content").GetString() ?? "{}";
            using var generated = JsonDocument.Parse(content);
            var result = new Dictionary<string, string>();
            foreach (var property in generated.RootElement.EnumerateObject())
            {
                if (property.Value.ValueKind == JsonValueKind.String)
                    result[property.Name] = property.Value.GetString() ?? string.Empty;
            }
            return result;
        }
        catch
        {
            return new Dictionary<string, string>();
        }
    }
}

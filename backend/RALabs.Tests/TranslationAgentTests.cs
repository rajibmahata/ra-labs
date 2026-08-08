using System.Net;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using RALabs.Application.Services;
using RALabs.Domain.Entities;
using RALabs.Infrastructure.Data;

namespace RALabs.Tests;

/// <summary>LLM translation agent + content fallback: a language change is
/// translated by the agent on demand, persisted, and never leaves the UI with
/// raw content keys when the model is unavailable.</summary>
public class TranslationAgentTests : IDisposable
{
    private readonly RALabsDbContext _db;
    private readonly ContentRepository _repo;
    private readonly StubHttpClientFactory _http;

    public TranslationAgentTests()
    {
        _db = new RALabsDbContext(new DbContextOptionsBuilder<RALabsDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        _repo = new ContentRepository(_db);
        _http = new StubHttpClientFactory();
    }

    public void Dispose() => _db.Dispose();

    private async Task SeedEnglishAsync()
    {
        var content = new Dictionary<string, string>
        {
            ["hero.headline"] = "We build software that ships.",
            ["hero.subheadline"] = "A two-founder engineering studio.",
            ["nav.work"] = "Work",
            ["nav.team"] = "Team",
            ["contact.submit"] = "Send message"
        };
        foreach (var (key, value) in content)
            _db.PageContents.Add(new PageContent { Id = Guid.NewGuid(), Key = key, Locale = "en", Value = value });
        await _db.SaveChangesAsync();
    }

    private ContentService CreateService(bool withApiKey) =>
        new(_repo, new TranslationAgentService(_repo, _http, withApiKey ? "test-key" : null, "gpt-4o-mini"));

    [Fact]
    public async Task English_ReturnsAsIs_NoTranslationCall()
    {
        await SeedEnglishAsync();
        var service = CreateService(withApiKey: true);

        var result = await service.GetByLocaleAsync("en");

        Assert.Equal("en", result.Locale);
        Assert.Equal(5, result.Content.Count);
        Assert.Equal("Work", result.Content["nav.work"]);
        Assert.Equal(0, _http.CallCount);
    }

    [Fact]
    public async Task MissingLocale_NoApiKey_ReturnsEnglishFallback_NoRawKeys()
    {
        await SeedEnglishAsync();
        var service = CreateService(withApiKey: false);

        var result = await service.GetByLocaleAsync("hi");

        Assert.Equal(5, result.Content.Count);
        Assert.Equal("We build software that ships.", result.Content["hero.headline"]);
        Assert.DoesNotContain(result.Content.Values, v => v.StartsWith("hero.") || v.StartsWith("nav."));
        Assert.Empty(await _repo.GetByLocaleAsync("hi"));
    }

    [Fact]
    public async Task MissingLocale_WithApiKey_PersistsTranslations_SingleModelCall()
    {
        await SeedEnglishAsync();
        _http.SetResponse(TranslatedPayload());
        var service = CreateService(withApiKey: true);

        var first = await service.GetByLocaleAsync("hi");

        Assert.Equal("हम ऐसा सॉफ़्टवेयर बनाते हैं जो शिप होता है।", first.Content["hero.headline"]);
        var persisted = await _repo.GetByLocaleAsync("hi");
        Assert.Equal(5, persisted.Count);
        Assert.Equal(1, _http.CallCount);

        var second = await service.GetByLocaleAsync("hi");
        Assert.Equal("हम ऐसा सॉफ़्टवेयर बनाते हैं जो शिप होता है।", second.Content["hero.headline"]);
        Assert.Equal(1, _http.CallCount);
    }

    [Fact]
    public async Task ConcurrentRequests_SameLocale_TranslateOnce()
    {
        await SeedEnglishAsync();
        _http.SetResponse(TranslatedPayload());
        var service = CreateService(withApiKey: true);

        var calls = Enumerable.Range(0, 8)
            .Select(_ => service.GetByLocaleAsync("hi"))
            .ToArray();
        await Task.WhenAll(calls);

        Assert.Equal(1, _http.CallCount);
        Assert.Equal(5, (await _repo.GetByLocaleAsync("hi")).Count);
    }

    [Fact]
    public async Task ModelFailure_FallsBackToEnglish()
    {
        await SeedEnglishAsync();
        _http.SetResponse("not-json");
        var service = CreateService(withApiKey: true);

        var result = await service.GetByLocaleAsync("hi");

        Assert.Equal(5, result.Content.Count);
        Assert.Equal("Team", result.Content["nav.team"]);
        Assert.Empty(await _repo.GetByLocaleAsync("hi"));
    }

    private static string TranslatedPayload() =>
        JsonSerializer.Serialize(new
        {
            choices = new[]
            {
                new
                {
                    message = new
                    {
                        content = JsonSerializer.Serialize(new Dictionary<string, string>
                        {
                            ["hero.headline"] = "हम ऐसा सॉफ़्टवेयर बनाते हैं जो शिप होता है।",
                            ["hero.subheadline"] = "एक दो-संस्थापक इंजीनियरिंग स्टूडियो।",
                            ["nav.work"] = "कार्य",
                            ["nav.team"] = "टीम",
                            ["contact.submit"] = "संदेश भेजें"
                        })
                    }
                }
            }
        });

    private sealed class StubHttpClientFactory : IHttpClientFactory
    {
        private int _callCount;
        private string _responseBody = "{}";

        public int CallCount => _callCount;

        public void SetResponse(string body) => _responseBody = body;

        public HttpClient CreateClient(string name)
        {
            return new HttpClient(new StubHandler(this)) { BaseAddress = new Uri("https://api.openai.com/") };
        }

        private sealed class StubHandler : HttpMessageHandler
        {
            private readonly StubHttpClientFactory _factory;
            public StubHandler(StubHttpClientFactory factory) => _factory = factory;

            protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
            {
                Interlocked.Increment(ref _factory._callCount);
                var response = new HttpResponseMessage(HttpStatusCode.OK)
                {
                    Content = new StringContent(_factory._responseBody, Encoding.UTF8, "application/json")
                };
                return Task.FromResult(response);
            }
        }
    }
}

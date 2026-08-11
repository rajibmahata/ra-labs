using System.Net;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Caching.Memory;
using RALabs.Application.Services;
using RALabs.Domain.Entities;
using RALabs.Domain.Enums;
using RALabs.Domain.Interfaces;

namespace RALabs.Tests;

/// <summary>Hero scenario generation: deterministic no-key fallback derived
/// from published projects, LLM-generated scenarios when configured, strict
/// validation of model output, and one-hour caching (single model call).</summary>
public class HeroScenarioTests
{
    private static HeroScenarioService CreateService(
        FakeKnowledgeChunkRepository? chunks = null,
        FakeProjectRepository? projects = null,
        StubHttpClientFactory? http = null,
        bool withApiKey = true)
    {
        chunks ??= new FakeKnowledgeChunkRepository(new List<KnowledgeChunk>());
        projects ??= new FakeProjectRepository(new List<Project>());
        http ??= new StubHttpClientFactory();
        return new HeroScenarioService(
            chunks,
            projects,
            http,
            new MemoryCache(new MemoryCacheOptions()),
            withApiKey ? "test-key" : null,
            "gpt-4o-mini");
    }

    private static string ValidPayload() =>
        JsonSerializer.Serialize(new
        {
            choices = new[]
            {
                new
                {
                    message = new
                    {
                        content = JsonSerializer.Serialize(new
                        {
                            theme = "orbit",
                            accent = "#6366f1",
                            secondary = "#22d3ee",
                            tertiary = "#f59e0b",
                            orbitCount = 4,
                            orbitSpeed = "fast",
                            labels = new[] { "Backend Systems", "AI & RAG", "SaaS Products", "Cloud Engineering" },
                            projectFocus = "AI Product Engineering"
                        })
                    }
                }
            }
        });

    [Fact]
    public async Task NoApiKey_ReturnsDeterministicFallback_DerivedFromProjects()
    {
        var projects = new FakeProjectRepository(new List<Project>
        {
            new()
            {
                Id = Guid.NewGuid(),
                Title = "AI Sales Assistant",
                Slug = "ai-sales-assistant",
                Summary = "Test",
                StackTags = new List<string> { "AI", ".NET", "React" },
                Status = ProjectStatus.Live,
                IsPublished = true,
                CreatedAt = DateTime.UtcNow
            },
            new()
            {
                Id = Guid.NewGuid(),
                Title = "Inventory Platform",
                Slug = "inventory-platform",
                Summary = "Test",
                StackTags = new List<string> { "React", "Azure" },
                Status = ProjectStatus.InBuild,
                IsPublished = true,
                CreatedAt = DateTime.UtcNow
            }
        });
        var service = CreateService(projects: projects, withApiKey: false);

        var scenario = await service.GetScenarioAsync(CancellationToken.None);

        Assert.Equal("layers", scenario.Theme);
        Assert.Equal(3, scenario.OrbitCount);
        Assert.Equal("medium", scenario.OrbitSpeed);
        Assert.Contains("AI", scenario.Labels);
        Assert.Contains("React", scenario.Labels);
        Assert.DoesNotContain(scenario.Labels, l => string.IsNullOrWhiteSpace(l));
        Assert.Equal("AI Sales Assistant", scenario.ProjectFocus);
    }

    [Fact]
    public async Task NoApiKey_NoProjects_UsesStaticFallbackLabels()
    {
        var service = CreateService(withApiKey: false);

        var scenario = await service.GetScenarioAsync(CancellationToken.None);

        Assert.Equal("layers", scenario.Theme);
        Assert.Contains("Backend Systems", scenario.Labels);
        Assert.Contains("AI & RAG", scenario.Labels);
        Assert.Contains("SaaS Products", scenario.Labels);
        Assert.Equal(3, scenario.Labels.Count);
    }

    [Fact]
    public async Task WithApiKey_ReturnsModelScenario_SingleModelCallWhenCached()
    {
        var http = new StubHttpClientFactory();
        http.SetResponse(ValidPayload());
        var service = CreateService(http: http, withApiKey: true);

        var first = await service.GetScenarioAsync(CancellationToken.None);
        var second = await service.GetScenarioAsync(CancellationToken.None);

        Assert.Equal("orbit", first.Theme);
        Assert.Equal(4, first.OrbitCount);
        Assert.Equal("fast", first.OrbitSpeed);
        Assert.Equal(4, first.Labels.Count);
        Assert.Equal("#22d3ee", first.Secondary);
        Assert.Same(first, second);
        Assert.Equal(1, http.CallCount);
    }

    [Fact]
    public async Task WithApiKey_InvalidPayload_FallsBackToDeterministic()
    {
        var http = new StubHttpClientFactory();
        http.SetResponse(JsonSerializer.Serialize(new { choices = new[] { new { message = new { content = "not-json" } } } }));
        var service = CreateService(http: http, withApiKey: true);

        var scenario = await service.GetScenarioAsync(CancellationToken.None);

        Assert.Equal("layers", scenario.Theme);
        Assert.Equal(3, scenario.OrbitCount);
        Assert.Contains("Backend Systems", scenario.Labels);
    }

    [Fact]
    public async Task WithApiKey_OutOfRangeTheme_RejectedByValidation()
    {
        var http = new StubHttpClientFactory();
        var bad = JsonSerializer.Serialize(new
        {
            theme = "explode",
            accent = "#6366f1",
            secondary = "#22d3ee",
            tertiary = "#f59e0b",
            orbitCount = 4,
            orbitSpeed = "fast",
            labels = new[] { "Backend Systems", "AI & RAG", "SaaS Products" },
            projectFocus = "AI Product Engineering"
        });
        http.SetResponse(JsonSerializer.Serialize(new { choices = new[] { new { message = new { content = bad } } } }));
        var service = CreateService(http: http, withApiKey: true);

        var scenario = await service.GetScenarioAsync(CancellationToken.None);

        Assert.Equal("layers", scenario.Theme);
    }

    [Fact]
    public async Task WithApiKey_TooFewLabels_RejectedByValidation()
    {
        var http = new StubHttpClientFactory();
        var bad = JsonSerializer.Serialize(new
        {
            theme = "grid",
            accent = "#6366f1",
            secondary = "#22d3ee",
            tertiary = "#f59e0b",
            orbitCount = 2,
            orbitSpeed = "slow",
            labels = new[] { "Only One" },
            projectFocus = "AI Product Engineering"
        });
        http.SetResponse(JsonSerializer.Serialize(new { choices = new[] { new { message = new { content = bad } } } }));
        var service = CreateService(http: http, withApiKey: true);

        var scenario = await service.GetScenarioAsync(CancellationToken.None);

        Assert.Equal("layers", scenario.Theme);
        Assert.Equal(3, scenario.OrbitCount);
    }

    private sealed class FakeKnowledgeChunkRepository : IKnowledgeChunkRepository
    {
        private readonly List<KnowledgeChunk> _chunks;
        public FakeKnowledgeChunkRepository(List<KnowledgeChunk> chunks) => _chunks = chunks;

        public Task AddAsync(KnowledgeChunk chunk) => Task.CompletedTask;
        public Task DeleteBySourceAsync(string sourceType, string sourceId) => Task.CompletedTask;
        public Task DeleteBySourcePrefixAsync(string sourceType, string sourcePrefix) => Task.CompletedTask;
        public Task DeleteByProjectAsync(Guid customerProjectId) => Task.CompletedTask;
        public Task<List<KnowledgeChunk>> GetPublicChunksAsync() => Task.FromResult(_chunks);
        public Task<List<KnowledgeChunk>> GetChunksByProjectAsync(Guid customerProjectId) => Task.FromResult(_chunks);
        public Task<int> CountAsync() => Task.FromResult(_chunks.Count);
    }

    private sealed class FakeProjectRepository : IProjectRepository
    {
        private readonly List<Project> _projects;
        public FakeProjectRepository(List<Project> projects) => _projects = projects;

        public Task<Project?> GetByIdAsync(Guid id) => Task.FromResult(_projects.FirstOrDefault(p => p.Id == id));
        public Task<Project?> GetBySlugAsync(string slug) => Task.FromResult(_projects.FirstOrDefault(p => p.Slug == slug));
        public Task<List<Project>> GetPublishedAsync(int page, int pageSize, string? tag) =>
            Task.FromResult(_projects.Where(p => p.IsPublished).Skip((page - 1) * pageSize).Take(pageSize).ToList());
        public Task<int> CountPublishedAsync(string? tag) =>
            Task.FromResult(_projects.Count(p => p.IsPublished));
        public Task<List<Project>> GetAllAsync(bool includeUnpublished) => Task.FromResult(_projects);
        public Task<List<Project>> GetFeaturedAsync(int page, int pageSize) =>
            Task.FromResult(_projects.Where(p => p.IsPublished && p.IsActive && p.IsFeatured).Skip((page - 1) * pageSize).Take(pageSize).ToList());
        public Task<int> CountFeaturedAsync() => Task.FromResult(_projects.Count(p => p.IsPublished && p.IsActive && p.IsFeatured));
        public Task<(List<Project> Items, int TotalCount)> ListAdminAsync(string? search, string? category, string? status, bool? featured, bool? active, bool? published, int page, int pageSize) =>
            Task.FromResult((_projects, _projects.Count));
        public Task<Guid> AddAsync(Project project) { _projects.Add(project); return Task.FromResult(project.Id); }
        public Task UpdateAsync(Project project) => Task.CompletedTask;
        public Task<bool> SlugExistsAsync(string slug, Guid? excludeId = null) =>
            Task.FromResult(_projects.Any(p => p.Slug == slug && p.Id != excludeId));
        public Task<bool> LiveSiteUrlExistsAsync(string url, Guid? excludeId = null) =>
            Task.FromResult(_projects.Any(p => p.LiveSiteUrl == url && p.Id != excludeId));
    }

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

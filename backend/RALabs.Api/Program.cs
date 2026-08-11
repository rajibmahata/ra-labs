using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using RALabs.Application;
using RALabs.Application.DTOs;
using RALabs.Application.Exceptions;
using RALabs.Application.Services;
using RALabs.Domain.Interfaces;
using RALabs.Infrastructure;
using RALabs.Infrastructure.Data;
using RALabs.Api.Mcp;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Threading.RateLimiting;

var builder = WebApplication.CreateBuilder(args);

static Guid GetActorId(HttpContext ctx) =>
    Guid.TryParse(ctx.User.FindFirst(JwtRegisteredClaimNames.Sub)?.Value, out var id) ? id : Guid.Empty;

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddApplication(builder.Configuration);
builder.Services.AddInfrastructure(builder.Configuration);
builder.Services.AddDataProtection();
builder.Services.AddAuthorization();
builder.Services.AddHttpContextAccessor();
builder.Services.AddMemoryCache();

builder.Services.AddRateLimiter(o =>
{
    o.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    o.AddPolicy("contact", ctx => RateLimitPartition.GetFixedWindowLimiter(
        ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 5, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
    o.AddPolicy("chat", ctx => RateLimitPartition.GetFixedWindowLimiter(
        ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 10, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
    o.AddPolicy("auth", ctx => RateLimitPartition.GetFixedWindowLimiter(
        ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 10, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
    o.AddPolicy("login", ctx => RateLimitPartition.GetFixedWindowLimiter(
        ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 5, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
});

builder.Services.Configure<RALabs.Api.Jobs.GithubSyncOptions>(builder.Configuration.GetSection(RALabs.Api.Jobs.GithubSyncOptions.SectionName));
builder.Services.AddHostedService<RALabs.Api.Jobs.GithubSyncHostedService>();
builder.Services.AddSingleton<McpToolRegistry>();

builder.Services.ConfigureHttpJsonOptions(o =>
    o.SerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase);

var app = builder.Build();

// Apply migrations + seed
var seedDemo = app.Configuration.GetValue<bool>("Seed:DemoOnStartup");
await DbInitializer.InitializeAsync(app.Services, seedDemo);

app.UseMiddleware<RALabs.Api.Middleware.ExceptionHandlingMiddleware>();
app.UseMiddleware<RALabs.Api.Middleware.SecurityHeadersMiddleware>();
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();
app.Use(async (ctx, next) =>
{
    await next();
    if (ctx.Request.Method is "GET" or "HEAD" || ctx.Response.StatusCode >= 400)
        return;

    var path = ctx.Request.Path;
    var isPublicKnowledgeMutation = path.StartsWithSegments("/api/v1/admin/projects")
        || path.StartsWithSegments("/api/v1/admin/team")
        || path.StartsWithSegments("/api/v1/admin/content")
        || path.StartsWithSegments("/api/v1/admin/reviews")
        || path.Value?.EndsWith("/feedback/approve", StringComparison.OrdinalIgnoreCase) == true;
    if (!isPublicKnowledgeMutation) return;

    try
    {
        var rag = ctx.RequestServices.GetRequiredService<IRagIngestionService>();
        await rag.IngestPublicContentAsync(CancellationToken.None);
    }
    catch (Exception ex)
    {
        var logger = ctx.RequestServices.GetRequiredService<ILoggerFactory>().CreateLogger("PublicRagSync");
        logger.LogError(ex, "Public RAG synchronization failed after {Method} {Path}", ctx.Request.Method, ctx.Request.Path);
    }
});

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

// ── Health ──
app.MapGet("/health", () => Results.Ok(new { status = "healthy", timestamp = DateTime.UtcNow }))
   .WithOpenApi();

// ── Seed (one-time; reruns are idempotent) ──
app.MapPost("/seed/full", async (IServiceProvider sp) =>
{
    await DbInitializer.InitializeAsync(sp, seedDemoContent: true);
    return Results.Ok(new { status = "seeded", timestamp = DateTime.UtcNow });
}).WithOpenApi();

// ── Public: Portfolio ──
app.MapGet("/api/v1/projects", async (int? page, int? pageSize, string? tag, IProjectService svc) =>
{
    var result = await svc.GetPublishedAsync(page, pageSize, tag);
    return Results.Ok(new { data = result.Items, pagination = new { result.Page, result.PageSize, result.TotalCount, result.TotalPages } });
}).WithOpenApi();

app.MapGet("/api/v1/projects/{slug}", async (string slug, IProjectService svc) =>
    Results.Ok(new { data = await svc.GetBySlugAsync(slug) })).WithOpenApi();

app.MapGet("/api/v1/projects/featured", async (int? page, int? pageSize, IProjectService svc) =>
{
    var result = await svc.GetFeaturedAsync(page, pageSize);
    return Results.Ok(new { data = result.Items, pagination = new { result.Page, result.PageSize, result.TotalCount, result.TotalPages } });
}).WithOpenApi();

app.MapGet("/api/v1/github/repositories", async (int? page, int? pageSize, string? technology, IGithubRepositoryRepository repo) =>
{
    var (p, ps) = RALabs.Application.Common.PageRequest.Normalize(page, pageSize);
    var repositories = await repo.GetAllAsync(p, ps, technology);
    var total = await repo.CountAsync(technology);
    return Results.Ok(new
    {
        data = repositories.Select(x => new GithubRepositoryDto(
            x.Id, x.Owner, x.Name, x.FullName, x.HtmlUrl, x.Description, x.PrimaryLanguage,
            System.Text.Json.JsonSerializer.Deserialize<List<string>>(x.TechnologiesJson) ?? new(),
            x.PushedAt, x.SyncedAt)).ToList(),
        pagination = new { page = p, pageSize = ps, totalCount = total }
    });
}).WithOpenApi();

// ── Public: Team ──
app.MapGet("/api/v1/team", async (ITeamService svc) =>
    Results.Ok(new { data = await svc.GetPublishedAsync() })).WithOpenApi();

app.MapGet("/api/v1/team/{slug}", async (string slug, ITeamService svc) =>
    Results.Ok(new { data = await svc.GetBySlugAsync(slug) })).WithOpenApi();

// ── Public: Content ──
app.MapGet("/api/v1/content", async (string locale, IContentService svc) =>
    Results.Ok(new { data = await svc.GetByLocaleAsync(locale) })).WithOpenApi();

app.MapGet("/api/v1/locales", async (IContentService svc) =>
    Results.Ok(new { data = await svc.GetLocalesAsync() })).WithOpenApi();

// ── Public: Hero scenarios ──
app.MapGet("/api/v1/hero-scenarios", async (IHeroScenarioService svc, CancellationToken ct) =>
    Results.Ok(new { data = await svc.GetScenarioAsync(ct) })).WithOpenApi();

// ── Public: Leads (rate limited) ──
app.MapPost("/api/v1/leads", async (CreateLeadRequest req, ILeadService svc) =>
    Results.Created("/api/v1/leads", new { data = await svc.CreateAsync(req) }))
   .RequireRateLimiting("contact").WithOpenApi();

// ── Public: Chat (rate limited) ──
app.MapPost("/api/v1/chat/threads", async (IChatService svc, RALabs.Domain.Enums.ChatThreadType? type) =>
{
    var result = await svc.CreateThreadAsync(type ?? RALabs.Domain.Enums.ChatThreadType.Lead, null);
    return Results.Created($"/api/v1/chat/{result.Id}", new { data = new { id = result.Id, type = result.Type.ToString().ToLowerInvariant() } });
}).WithOpenApi();

app.MapPost("/api/v1/chat/{threadId}/messages", async (Guid threadId, SendMessageRequest req, IChatService svc, HttpContext ctx) =>
{
    var role = ctx.User.FindFirst(ClaimTypes.Role)?.Value;
    if (role == "customer")
        return Results.Forbid();
    var isAdmin = role == "admin";
    if (!isAdmin)
        await svc.GetThreadAsync(threadId, isCustomerThread: true, isAdmin: false);
    var sender = isAdmin ? "admin" : "visitor";
    var senderName = isAdmin ? ctx.User.FindFirst(ClaimTypes.Name)?.Value : null;
    var result = await svc.SendMessageAsync(threadId, req, sender, senderName);
    return Results.Created($"/api/v1/chat/{threadId}", new { data = result });
}).RequireRateLimiting("chat").WithOpenApi();

app.MapGet("/api/v1/chat/{threadId}", async (Guid threadId, IChatService svc, HttpContext ctx) =>
{
    var role = ctx.User.FindFirst(ClaimTypes.Role)?.Value;
    var isAdmin = role == "admin";
    return Results.Ok(new { data = await svc.GetThreadAsync(threadId, isCustomerThread: true, isAdmin) });
}).WithOpenApi();

// ── Public: chat streaming (SSE, only when an AI provider is configured) ──
app.MapPost("/api/v1/chat/{threadId}/messages/stream", async (Guid threadId, SendMessageRequest req, IChatStreamingService stream, IChatService chat, ISettingService settings, IChatbotService chatbot, HttpContext ctx, CancellationToken ct) =>
{
    var role = ctx.User.FindFirst(ClaimTypes.Role)?.Value;
    if (role == "customer")
        return Results.Forbid();

    if (!stream.CanStream || !await settings.GetBoolAsync("ai.streaming.enabled", false))
        return Results.Json(new { error = new { code = "STREAMING_DISABLED", message = "Streaming is not available. Send the message via the standard endpoint." } }, statusCode: 409);

    try
    {
        await chat.GetThreadAsync(threadId, isCustomerThread: true, isAdmin: role == "admin");
    }
    catch (RALabs.Application.Exceptions.NotFoundException)
    {
        return Results.NotFound(new { error = new { code = "NOT_FOUND", message = "Thread not found." } });
    }
    catch (RALabs.Application.Exceptions.ForbiddenAccessException)
    {
        return Results.Json(new { error = new { code = "FORBIDDEN", message = "You do not have access to this thread." } }, statusCode: 403);
    }

    var sender = role == "admin" ? "admin" : "visitor";
    var senderName = role == "admin" ? ctx.User.FindFirst(ClaimTypes.Name)?.Value : null;
    await chat.AppendUserMessageAsync(threadId, req.Content, req.AttachmentUrl, sender, senderName);

    var accumulated = new System.Text.StringBuilder();
    ctx.Response.ContentType = "text/event-stream";
    ctx.Response.Headers.CacheControl = "no-cache";
    ctx.Response.Headers.Connection = "keep-alive";
    await ctx.Response.WriteAsync("event: start\n", ct);
    await ctx.Response.WriteAsync("data: {}\n\n", ct);
    try
    {
        await foreach (var delta in stream.StreamReplyAsync(req.Content, null, ct))
        {
            accumulated.Append(delta);
            var payload = System.Text.Json.JsonSerializer.Serialize(new { delta });
            await ctx.Response.WriteAsync($"data: {payload}\n\n", ct);
            await ctx.Response.Body.FlushAsync(ct);
        }
    }
    catch (Exception ex) when (ex is HttpRequestException or OperationCanceledException or System.Text.Json.JsonException or IOException)
    {
        // Provider failed mid-stream: fall back to the deterministic reply so the
        // user still gets an answer and the message is persisted.
    }
    var final = accumulated.ToString();
    if (string.IsNullOrWhiteSpace(final))
    {
        // Provider configured but returned nothing: honest fallback.
        var fallback = await chatbot.AnswerAsync(req.Content, null, null);
        final = fallback.Content;
    }
    await chat.AppendAgentMessageAsync(threadId, final, null);
    await ctx.Response.WriteAsync($"data: {{\"done\":true,\"message\":{System.Text.Json.JsonSerializer.Serialize(final)}}}\n\n", ct);
    return Results.Empty;
}).RequireRateLimiting("chat").WithOpenApi();
app.MapGet("/api/v1/config", async (ISettingService settings, IConfiguration config) =>
{
    var items = await settings.GetPublicAsync();
    var dict = items.ToDictionary(i => i.Key, i => i.Value);
    return Results.Ok(new
    {
        data = new
        {
            voiceEnabled = bool.TryParse(dict.GetValueOrDefault("ai.voice.enabled"), out var v) && v,
            voiceResponse = bool.TryParse(dict.GetValueOrDefault("ai.voice.response"), out var vr) && vr,
            streamingEnabled = bool.TryParse(dict.GetValueOrDefault("ai.streaming.enabled"), out var s) && s,
            chatModel = dict.GetValueOrDefault("ai.chat.model"),
            sttProvider = dict.GetValueOrDefault("ai.stt.provider"),
            ttsProvider = dict.GetValueOrDefault("ai.tts.provider"),
            maxAudioDuration = int.TryParse(dict.GetValueOrDefault("ai.max.audio.duration"), out var d) ? d : 60,
            customerPortalUrl = config["App:CustomerPortalUrl"]
        }
    });
}).WithOpenApi();

// ── Public: chat attachments (rate limited, private storage) ──
app.MapPost("/api/v1/chat/attachments", async (IFormFile? file, IPrivateFileStorage storage) =>
{
    if (file is null || file.Length == 0)
        return Results.BadRequest(new { error = new { code = "VALIDATION_ERROR", message = "A file is required." } });
    if (file.Length > 10 * 1024 * 1024)
        return Results.BadRequest(new { error = new { code = "VALIDATION_ERROR", message = "File must be 10 MB or smaller." } });
    var allowed = new[] { "image/png", "image/jpeg", "image/gif", "image/webp", "application/pdf", "text/plain", "text/markdown", "application/json", "application/zip" };
    if (!allowed.Contains(file.ContentType.ToLowerInvariant()))
        return Results.BadRequest(new { error = new { code = "VALIDATION_ERROR", message = "Unsupported file type." } });
    var key = $"chat/{Guid.NewGuid():N}/{file.FileName}";
    await using var content = file.OpenReadStream();
    await storage.SaveAsync(key, content);
    return Results.Created($"/api/v1/chat/attachments/{key}", new { data = new { url = $"/api/v1/chat/attachments/{key}" } });
}).RequireRateLimiting("chat").WithOpenApi();

app.MapGet("/api/v1/chat/attachments/{**path}", async (string path, IPrivateFileStorage storage) =>
{
    try
    {
        var stream = await storage.OpenReadAsync(path);
        return Results.File(stream, "application/octet-stream");
    }
    catch (FileNotFoundException)
    {
        return Results.NotFound(new { error = new { code = "NOT_FOUND", message = "Attachment not found." } });
    }
}).WithOpenApi();

// ── Admin: Auth ──
app.MapPost("/api/v1/auth/login", async (LoginRequest req, IAuthService svc, IAuditService audit, HttpContext ctx) =>
{
    var result = await svc.LoginAsync(req);
    await audit.LogAsync(result.User.Id, result.User.Email, "auth.login", entityType: "AdminUser",
        entityId: result.User.Id.ToString(), ipAddress: ctx.Connection.RemoteIpAddress?.ToString());
    return Results.Ok(new { data = result });
})
   .RequireRateLimiting("login").WithOpenApi();

app.MapPost("/api/v1/auth/refresh", async (RefreshTokenRequest req, IAuthService svc) =>
    Results.Ok(new { data = await svc.RefreshAsync(req) }))
   .RequireRateLimiting("auth").WithOpenApi();

app.MapPost("/api/v1/auth/forgot-password", async (ForgotPasswordRequest req, IAuthService svc) =>
{
    await svc.ForgotPasswordAsync(req);
    return Results.Ok(new { message = "If this email is registered, a reset code has been sent." });
}).RequireRateLimiting("auth").WithOpenApi();

app.MapPost("/api/v1/auth/reset-password", async (ResetPasswordRequest req, IAuthService svc) =>
{
    await svc.ResetPasswordAsync(req);
    return Results.Ok(new { message = "Password has been reset. You can now log in." });
}).RequireRateLimiting("auth").WithOpenApi();

// ── Customer: Auth ──
app.MapPost("/api/v1/customer/auth/register", async (CustomerRegisterRequest req, ICustomerAuthService svc) =>
    Results.Created("/api/v1/customer/auth/login", new { data = await svc.RegisterAsync(req) }))
   .RequireRateLimiting("auth").WithOpenApi();

app.MapPost("/api/v1/customer/auth/login", async (LoginRequest req, ICustomerAuthService svc) =>
    Results.Ok(new { data = await svc.LoginAsync(req) }))
   .RequireRateLimiting("login").WithOpenApi();

app.MapPost("/api/v1/customer/auth/refresh", async (RefreshTokenRequest req, ICustomerAuthService svc) =>
    Results.Ok(new { data = await svc.RefreshAsync(req) }))
   .RequireRateLimiting("auth").WithOpenApi();

app.MapPost("/api/v1/customer/auth/forgot-password", async (ForgotPasswordRequest req, ICustomerAuthService svc) =>
{
    await svc.ForgotPasswordAsync(req);
    return Results.Ok(new { message = "If this email is registered, a reset code has been sent." });
}).RequireRateLimiting("auth").WithOpenApi();

app.MapPost("/api/v1/customer/auth/reset-password", async (ResetPasswordRequest req, ICustomerAuthService svc) =>
{
    await svc.ResetPasswordAsync(req);
    return Results.Ok(new { message = "Password has been reset. You can now log in." });
}).RequireRateLimiting("auth").WithOpenApi();

// ── Customer group (JWT role: customer) ──
var customer = app.MapGroup("/api/v1/customer").RequireAuthorization(policy => policy.RequireRole("customer"));

customer.MapGet("/me", async (HttpContext ctx, ICustomerRepository repo) =>
{
    var id = Guid.Parse(ctx.User.FindFirst(JwtRegisteredClaimNames.Sub)?.Value ?? Guid.Empty.ToString());
    var c = await repo.GetByIdAsync(id) ?? throw new RALabs.Application.Exceptions.NotFoundException("Customer not found.");
    return Results.Ok(new { data = new CustomerDto(c.Id, c.Name, c.Email) });
}).WithOpenApi();

customer.MapGet("/projects", async (int? page, int? pageSize, HttpContext ctx, ICustomerProjectService svc) =>
{
    var id = Guid.Parse(ctx.User.FindFirst(JwtRegisteredClaimNames.Sub)?.Value ?? Guid.Empty.ToString());
    var items = await svc.GetMyProjectsAsync(id, page, pageSize);
    return Results.Ok(new { data = items });
}).WithOpenApi();

customer.MapPost("/projects", async (CreateCustomerProjectRequest req, HttpContext ctx, ICustomerProjectService svc) =>
{
    var id = Guid.Parse(ctx.User.FindFirst(JwtRegisteredClaimNames.Sub)?.Value ?? Guid.Empty.ToString());
    var project = await svc.CreateAsync(id, req);
    return Results.Created($"/api/v1/customer/projects/{project.Id}", new { data = project });
}).WithOpenApi();

customer.MapGet("/projects/{id}", async (Guid id, HttpContext ctx, ICustomerProjectService svc) =>
{
    var customerId = Guid.Parse(ctx.User.FindFirst(JwtRegisteredClaimNames.Sub)?.Value ?? Guid.Empty.ToString());
    return Results.Ok(new { data = await svc.GetMyProjectAsync(customerId, id) });
}).WithOpenApi();

customer.MapGet("/projects/{id}/chat", async (Guid id, HttpContext ctx, ICustomerProjectService projects, IChatService chat) =>
{
    var customerId = Guid.Parse(ctx.User.FindFirst(JwtRegisteredClaimNames.Sub)?.Value ?? Guid.Empty.ToString());
    var project = await projects.GetMyProjectAsync(customerId, id);
    return Results.Ok(new { data = await chat.GetThreadAsync(project.ChatThreadId, isCustomerThread: false, isAdmin: false) });
}).WithOpenApi();

customer.MapPost("/projects/{id}/chat/messages", async (Guid id, SendMessageRequest req, HttpContext ctx, ICustomerProjectService projects, IChatService chat) =>
{
    var customerId = Guid.Parse(ctx.User.FindFirst(JwtRegisteredClaimNames.Sub)?.Value ?? Guid.Empty.ToString());
    var project = await projects.GetMyProjectAsync(customerId, id);
    var senderName = ctx.User.FindFirst(ClaimTypes.Name)?.Value;
    var result = await chat.SendMessageAsync(project.ChatThreadId, req, "customer", senderName);
    return Results.Created($"/api/v1/customer/projects/{id}/chat", new { data = result });
}).RequireRateLimiting("chat").WithOpenApi();

// ── Customer: agent chat (registration handoff: threads started anonymously) ──
customer.MapPost("/agent/thread", async (HttpContext ctx, IChatService chat) =>
{
    var customerId = Guid.Parse(ctx.User.FindFirst(JwtRegisteredClaimNames.Sub)?.Value ?? Guid.Empty.ToString());
    var thread = await chat.CreateThreadAsync(RALabs.Domain.Enums.ChatThreadType.Lead, null);
    await chat.ClaimThreadAsync(thread.Id, customerId);
    return Results.Created($"/api/v1/customer/agent/thread/{thread.Id}", new { data = new { id = thread.Id } });
}).WithOpenApi();

customer.MapGet("/agent/thread/{threadId:guid}", async (Guid threadId, HttpContext ctx, IChatService chat) =>
{
    var customerId = Guid.Parse(ctx.User.FindFirst(JwtRegisteredClaimNames.Sub)?.Value ?? Guid.Empty.ToString());
    return Results.Ok(new { data = await chat.GetThreadAsync(threadId, isCustomerThread: true, isAdmin: false, customerId: customerId) });
}).WithOpenApi();

customer.MapPost("/agent/thread/{threadId:guid}/messages", async (Guid threadId, SendMessageRequest req, HttpContext ctx, IChatService chat) =>
{
    var customerId = Guid.Parse(ctx.User.FindFirst(JwtRegisteredClaimNames.Sub)?.Value ?? Guid.Empty.ToString());
    await chat.ClaimThreadAsync(threadId, customerId);
    var senderName = ctx.User.FindFirst(ClaimTypes.Name)?.Value;
    var result = await chat.SendMessageAsync(threadId, req, "customer", senderName);
    return Results.Created($"/api/v1/customer/agent/thread/{threadId}", new { data = result });
}).RequireRateLimiting("chat").WithOpenApi();

customer.MapPost("/agent/thread/{threadId:guid}/claim", async (Guid threadId, HttpContext ctx, IChatService chat) =>
{
    var customerId = Guid.Parse(ctx.User.FindFirst(JwtRegisteredClaimNames.Sub)?.Value ?? Guid.Empty.ToString());
    return Results.Ok(new { data = await chat.ClaimThreadAsync(threadId, customerId) });
}).WithOpenApi();

customer.MapGet("/projects/{id}/documents", async (Guid id, HttpContext ctx, ICustomerProjectService svc) =>
{
    var customerId = Guid.Parse(ctx.User.FindFirst(JwtRegisteredClaimNames.Sub)?.Value ?? Guid.Empty.ToString());
    return Results.Ok(new { data = await svc.GetMyDocumentsAsync(customerId, id) });
}).WithOpenApi();

customer.MapPost("/projects/{id}/documents", async (Guid id, HttpContext ctx, ICustomerProjectService svc, IFormFile file) =>
{
    var customerId = Guid.Parse(ctx.User.FindFirst(JwtRegisteredClaimNames.Sub)?.Value ?? Guid.Empty.ToString());
    if (file is null || file.Length == 0)
        return Results.BadRequest(new { error = new { code = "VALIDATION_ERROR", message = "A file is required." } });
    await using var content = file.OpenReadStream();
    var doc = await svc.UploadDocumentAsync(customerId, id, file.FileName, content, file.ContentType, file.Length, "uploaded via portal");
    return Results.Created($"/api/v1/customer/projects/{id}/documents", new { data = doc });
}).DisableAntiforgery().WithOpenApi();

customer.MapGet("/projects/{projectId}/documents/{documentId}/download", async (Guid projectId, Guid documentId, HttpContext ctx, ICustomerProjectService svc) =>
{
    var customerId = Guid.Parse(ctx.User.FindFirst(JwtRegisteredClaimNames.Sub)?.Value ?? Guid.Empty.ToString());
    var download = await svc.DownloadDocumentAsync(customerId, projectId, documentId);
    return Results.File(download.Content, download.ContentType, download.FileName);
}).WithOpenApi();

customer.MapGet("/projects/{id}/prd", async (Guid id, HttpContext ctx, ICustomerProjectService svc) =>
{
    var customerId = Guid.Parse(ctx.User.FindFirst(JwtRegisteredClaimNames.Sub)?.Value ?? Guid.Empty.ToString());
    return Results.Ok(new { data = await svc.GetMyPrdAsync(customerId, id) });
}).WithOpenApi();

customer.MapPost("/projects/{id}/prd/sign", async (Guid id, SignPrdRequest req, HttpContext ctx, ICustomerProjectService svc) =>
{
    var customerId = Guid.Parse(ctx.User.FindFirst(JwtRegisteredClaimNames.Sub)?.Value ?? Guid.Empty.ToString());
    return Results.Ok(new { data = await svc.SignPrdAsync(customerId, id, req) });
}).WithOpenApi();

customer.MapGet("/projects/{id}/demo", async (Guid id, HttpContext ctx, ICustomerProjectService svc) =>
{
    var customerId = Guid.Parse(ctx.User.FindFirst(JwtRegisteredClaimNames.Sub)?.Value ?? Guid.Empty.ToString());
    return Results.Ok(new { data = await svc.GetMyDemoAsync(customerId, id) });
}).WithOpenApi();

customer.MapGet("/projects/{id}/invoice", async (Guid id, HttpContext ctx, ICustomerProjectService svc) =>
{
    var customerId = Guid.Parse(ctx.User.FindFirst(JwtRegisteredClaimNames.Sub)?.Value ?? Guid.Empty.ToString());
    return Results.Ok(new { data = await svc.GetMyInvoicesAsync(customerId, id) });
}).WithOpenApi();

customer.MapPost("/projects/{id}/feedback", async (Guid id, SubmitFeedbackRequest req, HttpContext ctx, ICustomerProjectService svc) =>
{
    var customerId = Guid.Parse(ctx.User.FindFirst(JwtRegisteredClaimNames.Sub)?.Value ?? Guid.Empty.ToString());
    return Results.Created($"/api/v1/customer/projects/{id}/feedback", new { data = await svc.SubmitFeedbackAsync(customerId, id, req) });
}).WithOpenApi();

// ── Admin: customer projects ──
var admin = app.MapGroup("/api/v1/admin").RequireAuthorization(policy => policy.RequireRole("admin", "super_admin"));

// ── Admin: notifications ──
admin.MapGet("/notifications", async (bool? unread, int? page, int? pageSize, INotificationService svc) =>
{
    var result = await svc.ListAsync(unread, page, pageSize);
    return Results.Ok(new
    {
        data = result.Items,
        pagination = new { result.Page, result.PageSize, result.TotalCount, result.TotalPages }
    });
}).WithOpenApi();

admin.MapPost("/notifications/{id}/read", async (Guid id, INotificationService svc) =>
{
    await svc.MarkReadAsync(id);
    return Results.NoContent();
}).WithOpenApi();

// ── Admin: customers ──
admin.MapGet("/customers", async (int? page, int? pageSize, string? search, bool? isActive, ICustomerManagementService svc) =>
{
    var result = await svc.ListAsync(page, pageSize, search, isActive);
    return Results.Ok(new { data = result.Items,
        pagination = new { result.Page, result.PageSize, result.TotalCount, result.TotalPages } });
}).WithOpenApi();

admin.MapGet("/customers/{id}", async (Guid id, ICustomerManagementService svc) =>
    Results.Ok(new { data = await svc.GetAsync(id) })).WithOpenApi();

admin.MapPost("/customers", async (CreateCustomerByAdminRequest req, ICustomerAuthService svc) =>
    Results.Created("/api/v1/admin/customers", new { data = await svc.CreateByAdminAsync(req) })).WithOpenApi();

admin.MapPut("/customers/{id}", async (Guid id, UpdateCustomerByAdminRequest req, ICustomerManagementService svc) =>
    Results.Ok(new { data = await svc.UpdateAsync(id, req) })).WithOpenApi();

admin.MapPatch("/customers/{id}/status", async (Guid id, UpdateCustomerStatusRequest req, ICustomerManagementService svc, HttpContext ctx, IAuditService audit) =>
{
    var result = await svc.SetStatusAsync(id, req.IsActive);
    await audit.LogAsync(GetActorId(ctx), ctx.User.FindFirst(ClaimTypes.Name)?.Value, "customer.status",
        entityType: "Customer", entityId: id.ToString(), details: $"active: {req.IsActive}", ipAddress: ctx.Connection.RemoteIpAddress?.ToString());
    return Results.Ok(new { data = result });
}).WithOpenApi();

admin.MapDelete("/customers/{id}", async (Guid id, ICustomerManagementService svc) =>
{
    await svc.DeleteAsync(id);
    return Results.NoContent();
}).WithOpenApi();

admin.MapPost("/customers/bulk-delete", async (Guid[] ids, ICustomerManagementService svc) =>
{
    await svc.DeleteManyAsync(ids);
    return Results.NoContent();
}).WithOpenApi();

admin.MapPost("/customers/import", async (HttpRequest request, ICustomerManagementService svc) =>
{
    if (!request.HasFormContentType) throw new ValidationException("A CSV multipart file is required.");
    var form = await request.ReadFormAsync();
    var file = form.Files.GetFile("file") ?? throw new ValidationException("A CSV file is required.");
    await using var stream = file.OpenReadStream();
    return Results.Ok(new { data = await svc.ImportAsync(stream) });
}).WithOpenApi();

admin.MapGet("/customers/export", async (string? ids, string? search, bool? isActive, ICustomerManagementService svc) =>
{
    var selectedIds = string.IsNullOrWhiteSpace(ids)
        ? null
        : ids.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Where(value => Guid.TryParse(value, out _)).Select(Guid.Parse).ToArray();
    var content = await svc.ExportAsync(selectedIds, search, isActive);
    return Results.File(content, "text/csv", "customers.csv");
}).WithOpenApi();

// ── Admin: customer projects ──
admin.MapGet("/customer-projects", async (int? page, int? pageSize, string? status, string? search, Guid? customerId, ICustomerProjectService svc) =>
{
    var items = await svc.GetAllForAdminAsync(page, pageSize, status, search, customerId);
    return Results.Ok(new { data = items });
}).WithOpenApi();

admin.MapGet("/customer-projects/{id}", async (Guid id, ICustomerProjectService svc) =>
    Results.Ok(new { data = await svc.GetForAdminAsync(id) })).WithOpenApi();

admin.MapPost("/customer-projects", async (CreateCustomerProjectByAdminRequest req, ICustomerProjectService svc) =>
{
    var project = await svc.CreateAsync(req.CustomerId, new CreateCustomerProjectRequest(
        req.Title, req.Goal, req.Audience, req.Requirements, req.Timeline,
        req.BudgetOrConstraints, req.ReferenceLinks));
    return Results.Created($"/api/v1/admin/customer-projects/{project.Id}", new { data = project });
}).WithOpenApi();

admin.MapPatch("/customer-projects/{id}", async (Guid id, UpdateCustomerProjectRequest req, ICustomerProjectService svc) =>
    Results.Ok(new { data = await svc.UpdateStatusAsync(id, req) })).WithOpenApi();

admin.MapGet("/customer-projects/{id}/documents", async (Guid id, ICustomerProjectService svc) =>
    Results.Ok(new { data = await svc.GetDocumentsAsync(id) })).WithOpenApi();

admin.MapPut("/customer-projects/{id}/prd", async (Guid id, SavePrdRequest req, ICustomerProjectService svc) =>
    Results.Ok(new { data = await svc.SavePrdAsync(id, req) })).WithOpenApi();

admin.MapGet("/customer-projects/{id}/prd", async (Guid id, ICustomerProjectService svc) =>
    Results.Ok(new { data = await svc.GetPrdAsync(id) })).WithOpenApi();

admin.MapPost("/customer-projects/{id}/prd/sign", async (Guid id, HttpContext ctx, ICustomerProjectService svc) =>
{
    var adminName = ctx.User.FindFirst(ClaimTypes.Name)?.Value ?? "Admin";
    return Results.Ok(new { data = await svc.AdminSignPrdAsync(id, adminName) });
}).WithOpenApi();

admin.MapPost("/customer-projects/{id}/demo", async (Guid id, AddDemoRequest req, ICustomerProjectService svc) =>
    Results.Created($"/api/v1/admin/customer-projects/{id}/demo", new { data = await svc.AddDemoAsync(id, req) })).WithOpenApi();

admin.MapGet("/customer-projects/{id}/demo", async (Guid id, ICustomerProjectService svc) =>
    Results.Ok(new { data = await svc.GetDemoAsync(id) })).WithOpenApi();

admin.MapGet("/customer-projects/{id}/invoice", async (Guid id, ICustomerProjectService svc) =>
    Results.Ok(new { data = await svc.GetInvoicesAsync(id) })).WithOpenApi();

admin.MapPost("/customer-projects/{id}/invoice", async (Guid id, CreateInvoiceRequest req, ICustomerProjectService svc) =>
    Results.Created($"/api/v1/admin/customer-projects/{id}/invoice", new { data = await svc.CreateInvoiceAsync(id, req) })).WithOpenApi();

admin.MapGet("/customer-projects/{id}/feedback", async (Guid id, ICustomerProjectService svc) =>
    Results.Ok(new { data = await svc.GetFeedbackAsync(id) })).WithOpenApi();

admin.MapPost("/customer-projects/{id}/feedback/approve", async (Guid id, ICustomerProjectService svc) =>
    Results.Ok(new { data = await svc.ApproveFeedbackAsync(id) })).WithOpenApi();

admin.MapGet("/reviews", async (int? page, int? pageSize, string? search, bool? published, ICustomerProjectService svc) =>
{
    var result = await svc.GetFeedbacksForAdminAsync(page, pageSize, search, published);
    return Results.Ok(new { data = result.Items, pagination = new { result.Page, result.PageSize, result.TotalCount, result.TotalPages } });
}).WithOpenApi();

admin.MapPost("/reviews/{id}/moderate", async (Guid id, ModerateFeedbackRequest req, ICustomerProjectService svc) =>
    Results.Ok(new { data = await svc.ModerateFeedbackAsync(id, req.Approved) })).WithOpenApi();

admin.MapGet("/projects", async (string? search, string? category, string? status, bool? featured, bool? active, bool? published, int? page, int? pageSize, IProjectService svc) =>
{
    var result = await svc.ListAdminAsync(search, category, status, featured, active, published, page, pageSize);
    return Results.Ok(new { data = result.Items, pagination = new { result.Page, result.PageSize, result.TotalCount, result.TotalPages } });
}).WithOpenApi();

admin.MapGet("/projects/{id:guid}", async (Guid id, IProjectService svc) =>
    Results.Ok(new { data = await svc.GetAdminByIdAsync(id) })).WithOpenApi();

admin.MapPost("/projects", async (CreateProjectRequest req, IProjectService svc, HttpContext ctx, IAuditService audit) =>
{
    var created = await svc.CreateAsync(req);
    await audit.LogAsync(GetActorId(ctx), ctx.User.FindFirst(ClaimTypes.Name)?.Value, "project.create",
        entityType: "Project", entityId: created.Id.ToString(), details: created.Title, ipAddress: ctx.Connection.RemoteIpAddress?.ToString());
    return Results.Created("/api/v1/admin/projects", new { data = created });
}).WithOpenApi();

admin.MapPut("/projects/{id}", async (Guid id, UpdateProjectRequest req, IProjectService svc, HttpContext ctx, IAuditService audit) =>
{
    var updated = await svc.UpdateAsync(id, req);
    await audit.LogAsync(GetActorId(ctx), ctx.User.FindFirst(ClaimTypes.Name)?.Value, "project.update",
        entityType: "Project", entityId: id.ToString(), ipAddress: ctx.Connection.RemoteIpAddress?.ToString());
    return Results.Ok(new { data = updated });
}).WithOpenApi();

admin.MapPatch("/projects/{id}/published", async (Guid id, SetPublishedRequest req, IProjectService svc, HttpContext ctx, IAuditService audit) =>
{
    var updated = await svc.SetPublishedAsync(id, req.IsPublished);
    await audit.LogAsync(GetActorId(ctx), ctx.User.FindFirst(ClaimTypes.Name)?.Value, "project.publish",
        entityType: "Project", entityId: id.ToString(), details: $"published: {req.IsPublished}", ipAddress: ctx.Connection.RemoteIpAddress?.ToString());
    return Results.Ok(new { data = updated });
}).WithOpenApi();

admin.MapPatch("/projects/{id}/active", async (Guid id, SetActiveRequest req, IProjectService svc, HttpContext ctx, IAuditService audit) =>
{
    var updated = await svc.SetActiveAsync(id, req.IsActive);
    await audit.LogAsync(GetActorId(ctx), ctx.User.FindFirst(ClaimTypes.Name)?.Value, "project.activate",
        entityType: "Project", entityId: id.ToString(), details: $"active: {req.IsActive}", ipAddress: ctx.Connection.RemoteIpAddress?.ToString());
    return Results.Ok(new { data = updated });
}).WithOpenApi();

admin.MapPatch("/projects/{id}/featured", async (Guid id, SetFeaturedRequest req, IProjectService svc, HttpContext ctx, IAuditService audit) =>
{
    var updated = await svc.SetFeaturedAsync(id, req.IsFeatured);
    await audit.LogAsync(GetActorId(ctx), ctx.User.FindFirst(ClaimTypes.Name)?.Value, "project.featured",
        entityType: "Project", entityId: id.ToString(), details: $"featured: {req.IsFeatured}", ipAddress: ctx.Connection.RemoteIpAddress?.ToString());
    return Results.Ok(new { data = updated });
}).WithOpenApi();

admin.MapDelete("/projects/{id}", async (Guid id, IProjectService svc, HttpContext ctx, IAuditService audit) =>
{
    await svc.DeleteAsync(id);
    await audit.LogAsync(GetActorId(ctx), ctx.User.FindFirst(ClaimTypes.Name)?.Value, "project.delete",
        entityType: "Project", entityId: id.ToString(), ipAddress: ctx.Connection.RemoteIpAddress?.ToString());
    return Results.NoContent();
}).WithOpenApi();

admin.MapPost("/projects/import", async (HttpRequest request, IProjectService svc) =>
{
    if (!request.HasFormContentType) throw new ValidationException("A CSV multipart file is required.");
    var form = await request.ReadFormAsync();
    var file = form.Files.GetFile("file") ?? throw new ValidationException("A CSV file is required.");
    await using var stream = file.OpenReadStream();
    return Results.Ok(new { data = await svc.ImportAsync(stream) });
}).WithOpenApi();

admin.MapGet("/projects/export", async (string? ids, string? search, string? category, bool? featured, bool? active, IProjectService svc) =>
{
    var selectedIds = string.IsNullOrWhiteSpace(ids)
        ? null
        : ids.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Where(value => Guid.TryParse(value, out _)).Select(Guid.Parse).ToArray();
    var content = await svc.ExportAsync(selectedIds, search, category, featured, active);
    return Results.File(content, "text/csv", "portfolio.csv");
}).WithOpenApi();

admin.MapGet("/team", async (ITeamRepository repo) =>
    Results.Ok(new { data = await repo.GetAllAsync() })).WithOpenApi();

admin.MapPost("/team", async (CreateTeamRequest req, ITeamService svc, HttpContext ctx, IAuditService audit) =>
{
    var created = await svc.CreateAsync(req);
    await audit.LogAsync(GetActorId(ctx), ctx.User.FindFirst(ClaimTypes.Name)?.Value, "team.create",
        entityType: "TeamMember", entityId: created.Id.ToString(), details: created.Name, ipAddress: ctx.Connection.RemoteIpAddress?.ToString());
    return Results.Created("/api/v1/admin/team", new { data = created });
}).WithOpenApi();

admin.MapPut("/team/{id}", async (Guid id, UpdateTeamRequest req, ITeamService svc, HttpContext ctx, IAuditService audit) =>
{
    var updated = await svc.UpdateAsync(id, req);
    await audit.LogAsync(GetActorId(ctx), ctx.User.FindFirst(ClaimTypes.Name)?.Value, "team.update",
        entityType: "TeamMember", entityId: id.ToString(), ipAddress: ctx.Connection.RemoteIpAddress?.ToString());
    return Results.Ok(new { data = updated });
}).WithOpenApi();

admin.MapDelete("/team/{id}", async (Guid id, ITeamService svc, HttpContext ctx, IAuditService audit) =>
{
    await svc.DeleteAsync(id);
    await audit.LogAsync(GetActorId(ctx), ctx.User.FindFirst(ClaimTypes.Name)?.Value, "team.delete",
        entityType: "TeamMember", entityId: id.ToString(), ipAddress: ctx.Connection.RemoteIpAddress?.ToString());
    return Results.NoContent();
}).WithOpenApi();

admin.MapPatch("/team/{id}/status", async (Guid id, UpdateCustomerStatusRequest req, HttpContext ctx, ITeamService svc) =>
{
    if (!ctx.User.IsInRole("super_admin"))
        return Results.Forbid();
    return Results.Ok(new { data = await svc.SetActiveAsync(id, req.IsActive) });
}).WithOpenApi();

admin.MapPost("/team/import", async (HttpRequest request, ITeamService svc, HttpContext ctx, IAuditService audit) =>
{
    if (!request.HasFormContentType) throw new ValidationException("A CSV multipart file is required.");
    var form = await request.ReadFormAsync();
    var file = form.Files.GetFile("file") ?? throw new ValidationException("A CSV file is required.");
    await using var stream = file.OpenReadStream();
    var result = await svc.ImportAsync(stream);
    await audit.LogAsync(GetActorId(ctx), ctx.User.FindFirst(ClaimTypes.Name)?.Value, "team.import",
        entityType: "TeamMember", details: $"{result.Created} created, {result.Skipped} skipped", ipAddress: ctx.Connection.RemoteIpAddress?.ToString());
    return Results.Ok(new { data = result });
}).WithOpenApi();

admin.MapGet("/team/export", async (ITeamService svc) =>
    Results.File(await svc.ExportAsync(), "text/csv", "team.csv")).WithOpenApi();

// ── Admin: team member self-edit (any logged-in team member updates own profile) ──
admin.MapGet("/team/me", async (HttpContext ctx, ITeamService svc) =>
{
    var userId = Guid.Parse(ctx.User.FindFirst(JwtRegisteredClaimNames.Sub)?.Value ?? Guid.Empty.ToString());
    var member = await svc.GetByAdminUserIdAsync(userId);
    return member is null ? Results.NotFound(new { error = new { code = "NOT_FOUND", message = "No team profile linked to this account." } })
        : Results.Ok(new { data = member });
}).WithOpenApi();

admin.MapPut("/team/me", async (UpdateTeamRequest req, HttpContext ctx, ITeamService svc) =>
{
    var userId = Guid.Parse(ctx.User.FindFirst(JwtRegisteredClaimNames.Sub)?.Value ?? Guid.Empty.ToString());
    return Results.Ok(new { data = await svc.UpdateProfileAsync(userId, req) });
}).WithOpenApi();

admin.MapGet("/content", async (string? locale, IContentService svc) =>
    Results.Ok(new { data = await svc.GetAllAsync(locale) })).WithOpenApi();

admin.MapGet("/content/export", async (string? locale, IContentService svc) =>
    Results.File(await svc.ExportAsync(locale), "text/csv", "content.csv")).WithOpenApi();

admin.MapPost("/content", async (CreateContentRequest req, IContentService svc) =>
    Results.Created("/api/v1/admin/content", new { data = await svc.CreateAsync(req) })).WithOpenApi();

admin.MapPut("/content/{key}", async (string key, UpdateContentRequest req, IContentService svc) =>
    Results.Ok(new { data = await svc.UpsertAsync(key, req) })).WithOpenApi();

admin.MapDelete("/content/{key}", async (string key, string locale, IContentService svc) =>
{
    await svc.DeleteAsync(key, locale);
    return Results.NoContent();
}).WithOpenApi();

admin.MapGet("/leads", async (string? status, string? source, int? page, int? pageSize, ILeadService svc) =>
{
    var result = await svc.GetAllAsync(status, source, page, pageSize);
    return Results.Ok(new { data = result.Items, pagination = new { result.Page, result.PageSize, result.TotalCount, result.TotalPages } });
}).WithOpenApi();

admin.MapPost("/leads/import", async (HttpRequest request, ILeadService svc) =>
{
    if (!request.HasFormContentType) throw new ValidationException("A CSV multipart file is required.");
    var form = await request.ReadFormAsync();
    var file = form.Files.GetFile("file") ?? throw new ValidationException("A CSV file is required.");
    await using var stream = file.OpenReadStream();
    return Results.Ok(new { data = await svc.ImportAsync(stream) });
}).WithOpenApi();

admin.MapGet("/leads/export", async (string? status, string? source, ILeadService svc) =>
    Results.File(await svc.ExportAsync(status, source), "text/csv", "leads.csv")).WithOpenApi();

admin.MapPatch("/leads/{id}", async (Guid id, UpdateLeadRequest req, ILeadService svc) =>
    Results.Ok(new { data = await svc.UpdateAsync(id, req) })).WithOpenApi();

admin.MapGet("/reviews/export", async (string? search, bool? published, ICustomerProjectService svc) =>
    Results.File(await svc.ExportFeedbacksAsync(search, published), "text/csv", "reviews.csv")).WithOpenApi();

admin.MapGet("/chat", async (string? type, bool? needsManualIntervention, int? page, int? pageSize, IChatService svc) =>
{
    var result = await svc.ListThreadsAsync(type, needsManualIntervention, page, pageSize);
    return Results.Ok(new { data = result.Items, pagination = new { result.Page, result.PageSize, result.TotalCount, result.TotalPages } });
}).WithOpenApi();

admin.MapPatch("/chat/{threadId}", async (Guid threadId, UpdateThreadRequest req, IChatService svc) =>
    Results.Ok(new { data = await svc.UpdateThreadAsync(threadId, req) })).WithOpenApi();

admin.MapPost("/chat/{threadId}/messages", async (Guid threadId, SendMessageRequest req, IChatService svc, HttpContext ctx) =>
{
    var senderName = ctx.User.FindFirst(ClaimTypes.Name)?.Value;
    var result = await svc.SendMessageAsync(threadId, req, "admin", senderName);
    return Results.Created($"/api/v1/admin/chat/{threadId}", new { data = result });
}).WithOpenApi();

// ── Admin: operational triggers (AI layer) ──
admin.MapPost("/github/sync", async (IGithubSyncService svc, HttpContext ctx, IAuditService audit) =>
{
    var result = await svc.SyncAllAsync(CancellationToken.None);
    await audit.LogAsync(GetActorId(ctx), ctx.User.FindFirst(ClaimTypes.Name)?.Value, "github.sync",
        entityType: "GithubSnapshot", details: $"{result.ChangedRepositories} changed repositories", ipAddress: ctx.Connection.RemoteIpAddress?.ToString());
    return Results.Ok(new { data = result });
}).WithOpenApi();

admin.MapGet("/github/repositories", async (int? page, int? pageSize, string? technology, IGithubRepositoryRepository repo) =>
{
    var (p, ps) = RALabs.Application.Common.PageRequest.Normalize(page, pageSize);
    var repositories = await repo.GetAllAsync(p, ps, technology);
    var total = await repo.CountAsync(technology);
    return Results.Ok(new
    {
        data = repositories.Select(x => new GithubRepositoryDto(
            x.Id, x.Owner, x.Name, x.FullName, x.HtmlUrl, x.Description, x.PrimaryLanguage,
            System.Text.Json.JsonSerializer.Deserialize<List<string>>(x.TechnologiesJson) ?? new(),
            x.PushedAt, x.SyncedAt)).ToList(),
        pagination = new { page = p, pageSize = ps, totalCount = total }
    });
}).WithOpenApi();

admin.MapGet("/content-drafts", async (string? status, int? page, int? pageSize, IAiDraftService svc) =>
{
    var (p, ps) = RALabs.Application.Common.PageRequest.Normalize(page, pageSize);
    return Results.Ok(new { data = await svc.ListAsync(status, p, ps) });
}).WithOpenApi();

admin.MapPost("/content-drafts/generate", async (GenerateDraftRequest req, IAiDraftService svc, CancellationToken ct) =>
    Results.Created("/api/v1/admin/content-drafts", new { data = await svc.GenerateProjectDraftAsync(req.SourceUrl, req.SourceText, ct) })).WithOpenApi();

admin.MapPost("/content-drafts/generate-for-project/{projectId:guid}", async (Guid projectId, IAiDraftService svc, IProjectRepository projects, CancellationToken ct) =>
    Results.Created("/api/v1/admin/content-drafts", new { data = await svc.GenerateProjectRefreshAsync(projectId, projects, ct) })).WithOpenApi();

admin.MapPost("/content-drafts/{id}/review", async (Guid id, ReviewDraftRequest req, IAiDraftService svc, IProjectRepository projects, IRagIngestionService rag, HttpContext ctx, IAuditService audit) =>
{
    var result = await svc.ReviewAsync(id, req.Decision.Trim().ToLowerInvariant(), req.Note, projects, rag);
    await audit.LogAsync(GetActorId(ctx), ctx.User.FindFirst(ClaimTypes.Name)?.Value, "draft.review",
        entityType: "ContentDraft", entityId: id.ToString(), details: req.Decision, ipAddress: ctx.Connection.RemoteIpAddress?.ToString());
    return Results.Ok(new { data = result });
}).WithOpenApi();

admin.MapPost("/rag/ingest", async (IRagIngestionService svc, HttpContext ctx, IAuditService audit) =>
{
    var count = await svc.IngestPublicContentAsync(CancellationToken.None);
    await audit.LogAsync(GetActorId(ctx), ctx.User.FindFirst(ClaimTypes.Name)?.Value, "rag.ingest",
        entityType: "KnowledgeChunk", details: $"{count} chunks", ipAddress: ctx.Connection.RemoteIpAddress?.ToString());
    return Results.Ok(new { data = new { ingestedChunks = count } });
}).WithOpenApi();

app.MapGet("/api/v1/rag/query", async (string query, Guid? customerProjectId, IRagIngestionService svc, HttpContext ctx, CancellationToken ct) =>
{
    if (customerProjectId.HasValue && !ctx.User.IsInRole("admin") && !ctx.User.IsInRole("super_admin"))
        return Results.Forbid();
    return Results.Ok(new { data = await svc.QueryAsync(query, customerProjectId, ct) });
}).WithOpenApi();

admin.MapGet("/admins", async (IAuthService svc) =>
    Results.Ok(new { data = await svc.GetAdminsAsync() })).WithOpenApi();

admin.MapPost("/admins", async (CreateAdminRequest req, HttpContext ctx, IAuthService svc, IAuditService audit) =>
{
    if (!ctx.User.IsInRole("super_admin"))
        return Results.Forbid();
    var actorId = Guid.Parse(ctx.User.FindFirst(JwtRegisteredClaimNames.Sub)?.Value ?? Guid.Empty.ToString());
    var created = await svc.CreateAdminAsync(req, actorId);
    await audit.LogAsync(actorId, ctx.User.FindFirst(ClaimTypes.Name)?.Value, "admin.create",
        entityType: "AdminUser", entityId: created?.Id.ToString(),
        details: $"Created admin {req.Email} (role: {req.Role})", ipAddress: ctx.Connection.RemoteIpAddress?.ToString());
    return Results.Created("/api/v1/admin/admins", new { data = created });
}).WithOpenApi();

admin.MapPatch("/admins/{id}/status", async (Guid id, UpdateCustomerStatusRequest req, HttpContext ctx, IAuthService svc) =>
{
    if (!ctx.User.IsInRole("super_admin"))
        return Results.Forbid();
    var actorId = Guid.Parse(ctx.User.FindFirst(JwtRegisteredClaimNames.Sub)?.Value ?? Guid.Empty.ToString());
    return Results.Ok(new { data = await svc.SetActiveAsync(id, req.IsActive, actorId) });
}).WithOpenApi();

// ── Admin: dashboard aggregate stats (GAP-011) + RAG/GitHub observability (GAP-012) ──
admin.MapGet("/dashboard/stats", async (IDashboardStatsService stats) =>
    Results.Ok(new { data = await stats.GetAsync() })).WithOpenApi();

// ── Admin: system settings (AI & voice) ──
admin.MapGet("/settings", async (ISettingService settings) =>
    Results.Ok(new { data = await settings.GetAllAsync() })).WithOpenApi();

admin.MapPut("/settings", async (Dictionary<string, string> req, HttpContext ctx, ISettingService settings, IAuditService audit) =>
{
    if (!ctx.User.IsInRole("super_admin"))
        return Results.Forbid();
    var allowed = new HashSet<string>
    {
        "ai.voice.enabled", "ai.voice.response", "ai.streaming.enabled", "ai.chat.model",
        "ai.stt.provider", "ai.tts.provider", "ai.max.audio.duration"
    };
    var clean = req.Where(kv => allowed.Contains(kv.Key) && !string.IsNullOrWhiteSpace(kv.Value))
        .ToDictionary(kv => kv.Key, kv => kv.Value.Trim());
    await settings.SetManyAsync(clean);
    var actorId = Guid.Parse(ctx.User.FindFirst(JwtRegisteredClaimNames.Sub)?.Value ?? Guid.Empty.ToString());
    var actorName = ctx.User.FindFirst(ClaimTypes.Name)?.Value;
    await audit.LogAsync(actorId, actorName, "settings.update", entityType: "SystemSetting",
        details: "Updated: " + string.Join(", ", clean.Keys), ipAddress: ctx.Connection.RemoteIpAddress?.ToString());
    return Results.Ok(new { data = await settings.GetAllAsync() });
}).WithOpenApi();

// ── Admin: audit log (super admin only) ──
admin.MapGet("/audit-logs", async (string? action, string? actorName, int? page, int? pageSize, HttpContext ctx, IAuditService audit) =>
{
    if (!ctx.User.IsInRole("super_admin"))
        return Results.Forbid();
    var (p, ps) = RALabs.Application.Common.PageRequest.Normalize(page, pageSize);
    var items = await audit.ListAsync(p, ps, action, actorName);
    var total = await audit.CountAsync(action, actorName);
    return Results.Ok(new { data = items, pagination = new { page = p, pageSize = ps, totalCount = total, totalPages = (int)Math.Ceiling(total / (double)ps) } });
}).WithOpenApi();

// ── MCP server (thin tool layer over Application services — ADR-002) ──
app.MapGet("/mcp/tools", (McpToolRegistry registry) =>
    Results.Ok(new { data = registry.Definitions.Select(d => new { d.Name, d.Description, d.Parameters, d.RequiredRole }) })).WithOpenApi();

app.MapPost("/mcp/call", async (McpCallRequest req, McpToolRegistry registry, HttpContext ctx) =>
{
    var role = ctx.User.FindFirst(ClaimTypes.Role)?.Value;
    Guid? callerId = null;
    if (role is "admin" or "super_admin" or "customer")
    {
        var sub = ctx.User.FindFirst(JwtRegisteredClaimNames.Sub)?.Value;
        if (Guid.TryParse(sub, out var uid)) callerId = uid;
    }

    try
    {
        var result = await registry.DispatchAsync(req.Tool, req.Arguments ?? new Dictionary<string, object?>(), role, callerId);
        return Results.Ok(new { data = new { tool = req.Tool, result } });
    }
    catch (ForbiddenMcpException ex)
    {
        return Results.Json(new { error = new { code = "FORBIDDEN", message = ex.Message } }, statusCode: StatusCodes.Status403Forbidden);
    }
    catch (RALabs.Application.Exceptions.AppException ex)
    {
        return Results.Json(new { error = new { code = ex.Code.ToString(), message = ex.Message, details = ex.Details } }, statusCode: (int)ex.Code);
    }
    catch (ArgumentException ex)
    {
        // MCP argument-shape errors are client errors (400), not server faults.
        return Results.Json(new { error = new { code = "VALIDATION_ERROR", message = ex.Message } }, statusCode: StatusCodes.Status400BadRequest);
    }
    catch (Exception ex)
    {
        app.Logger.LogError(ex, "Unhandled MCP error on tool {Tool}", req.Tool);
        return Results.Json(new { error = new { code = "INTERNAL_ERROR", message = "An unexpected error occurred." } }, statusCode: StatusCodes.Status500InternalServerError);
    }
}).WithOpenApi();

app.Run();

public record McpCallRequest(string Tool, Dictionary<string, object?>? Arguments);

namespace RALabs.Api.Middleware
{
    public class SecurityHeadersMiddleware
    {
        private readonly RequestDelegate _next;
        public SecurityHeadersMiddleware(RequestDelegate next) => _next = next;

        public Task InvokeAsync(HttpContext context)
        {
            var h = context.Response.Headers;
            h["X-Content-Type-Options"] = "nosniff";
            h["X-Frame-Options"] = "SAMEORIGIN";
            h["Referrer-Policy"] = "strict-origin-when-cross-origin";
            h["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()";
            h["Content-Security-Policy"] =
                "default-src 'self'; script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://www.google-analytics.com; " +
                "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
                "font-src 'self' https://fonts.gstatic.com data:; " +
                "img-src 'self' data: https:; connect-src 'self' https://api.github.com https://www.google-analytics.com; " +
                "frame-ancestors 'self'; base-uri 'self'; form-action 'self'";
            return _next(context);
        }
    }

    public class ExceptionHandlingMiddleware
    {
        private readonly RequestDelegate _next;
        private readonly ILogger<ExceptionHandlingMiddleware> _logger;
        private readonly IHostEnvironment _env;

        public ExceptionHandlingMiddleware(RequestDelegate next, ILogger<ExceptionHandlingMiddleware> logger, IHostEnvironment env)
        {
            _next = next;
            _logger = logger;
            _env = env;
        }

        public async Task InvokeAsync(HttpContext context)
        {
            try
            {
                await _next(context);
            }
            catch (RALabs.Application.Exceptions.AppException ex)
            {
                context.Response.StatusCode = (int)ex.Code;
                await context.Response.WriteAsJsonAsync(new
                {
                    error = new
                    {
                        code = ex.Code.ToString(),
                        message = ex.Message,
                        details = ex.Details
                    }
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Unhandled exception on {Path}", context.Request.Path);
                context.Response.StatusCode = StatusCodes.Status500InternalServerError;
                await context.Response.WriteAsJsonAsync(new
                {
                    error = new
                    {
                        code = "INTERNAL_ERROR",
                        message = "An unexpected error occurred.",
                        details = _env.IsDevelopment() ? ex.Message : (string?)null
                    }
                });
            }
        }
    }
}

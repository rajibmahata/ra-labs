using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using RALabs.Application;
using RALabs.Application.DTOs;
using RALabs.Application.Services;
using RALabs.Domain.Interfaces;
using RALabs.Infrastructure;
using RALabs.Infrastructure.Data;
using RALabs.Api.Mcp;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Threading.RateLimiting;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddApplication(builder.Configuration);
builder.Services.AddInfrastructure(builder.Configuration);
builder.Services.AddDataProtection();
builder.Services.AddAuthorization();
builder.Services.AddHttpContextAccessor();

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
    var isAdmin = role == "admin";
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

// ── Admin: Auth ──
app.MapPost("/api/v1/auth/login", async (LoginRequest req, IAuthService svc) =>
    Results.Ok(new { data = await svc.LoginAsync(req) }))
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
var admin = app.MapGroup("/api/v1/admin").RequireAuthorization(policy => policy.RequireRole("admin"));

// ── Admin: customers ──
admin.MapGet("/customers", async (int? page, int? pageSize, ICustomerRepository repo) =>
{
    var (p, ps) = RALabs.Application.Common.PageRequest.Normalize(page, pageSize);
    var items = await repo.GetAllAsync(p, ps);
    var total = await repo.CountAllAsync();
    return Results.Ok(new { data = items.Select(c => new { c.Id, c.Name, c.Email, c.CreatedAt, projectCount = c.Projects.Count }),
        pagination = new { page = p, pageSize = ps, totalCount = total } });
}).WithOpenApi();

// ── Admin: customer projects ──
admin.MapGet("/customer-projects", async (int? page, int? pageSize, string? status, ICustomerProjectService svc) =>
{
    var items = await svc.GetAllForAdminAsync(page, pageSize, status);
    return Results.Ok(new { data = items });
}).WithOpenApi();

admin.MapGet("/customer-projects/{id}", async (Guid id, ICustomerProjectService svc) =>
    Results.Ok(new { data = await svc.GetForAdminAsync(id) })).WithOpenApi();

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

admin.MapGet("/projects", async (bool? includeUnpublished, int? page, int? pageSize, IProjectRepository repo) =>
{
    var (p, ps) = RALabs.Application.Common.PageRequest.Normalize(page, pageSize);
    var all = await repo.GetAllAsync(includeUnpublished ?? true);
    var total = all.Count;
    var items = all.OrderBy(x => x.SortOrder).Skip((p - 1) * ps).Take(ps);
    return Results.Ok(new { data = items.Select(x => new ProjectDto(x.Id, x.Slug, x.Title, x.Summary, x.StackTags,
        x.Status.ToString().ToLowerInvariant(), x.GithubUrl, x.CaseStudyBody, x.CoverImageUrl,
        x.SortOrder, x.IsPublished, x.CreatedAt, x.UpdatedAt)).ToList(),
        pagination = new { page = p, pageSize = ps, totalCount = total } });
}).WithOpenApi();

admin.MapPost("/projects", async (CreateProjectRequest req, IProjectService svc) =>
    Results.Created("/api/v1/admin/projects", new { data = await svc.CreateAsync(req) })).WithOpenApi();

admin.MapPut("/projects/{id}", async (Guid id, UpdateProjectRequest req, IProjectService svc) =>
    Results.Ok(new { data = await svc.UpdateAsync(id, req) })).WithOpenApi();

admin.MapDelete("/projects/{id}", async (Guid id, IProjectService svc) =>
{
    await svc.DeleteAsync(id);
    return Results.NoContent();
}).WithOpenApi();

admin.MapGet("/team", async (ITeamRepository repo) =>
    Results.Ok(new { data = await repo.GetAllAsync() })).WithOpenApi();

admin.MapPost("/team", async (CreateTeamRequest req, ITeamService svc) =>
    Results.Created("/api/v1/admin/team", new { data = await svc.CreateAsync(req) })).WithOpenApi();

admin.MapPut("/team/{id}", async (Guid id, UpdateTeamRequest req, ITeamService svc) =>
    Results.Ok(new { data = await svc.UpdateAsync(id, req) })).WithOpenApi();

admin.MapDelete("/team/{id}", async (Guid id, ITeamService svc) =>
{
    await svc.DeleteAsync(id);
    return Results.NoContent();
}).WithOpenApi();

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

admin.MapPatch("/leads/{id}", async (Guid id, UpdateLeadRequest req, ILeadService svc) =>
    Results.Ok(new { data = await svc.UpdateAsync(id, req) })).WithOpenApi();

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
admin.MapPost("/github/sync", async (IGithubSyncService svc) =>
{
    var result = await svc.SyncAllAsync(CancellationToken.None);
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

admin.MapPost("/content-drafts/{id}/review", async (Guid id, ReviewDraftRequest req, IAiDraftService svc, IProjectRepository projects) =>
    Results.Ok(new { data = await svc.ReviewAsync(id, req.Decision.Trim().ToLowerInvariant(), req.Note, projects) })).WithOpenApi();

admin.MapPost("/rag/ingest", async (IRagIngestionService svc) =>
{
    var count = await svc.IngestPublicContentAsync(CancellationToken.None);
    return Results.Ok(new { data = new { ingestedChunks = count } });
}).WithOpenApi();

app.MapGet("/api/v1/rag/query", async (string query, Guid? customerProjectId, IRagIngestionService svc, HttpContext ctx, CancellationToken ct) =>
{
    if (customerProjectId.HasValue && !ctx.User.IsInRole("admin"))
        return Results.Forbid();
    return Results.Ok(new { data = await svc.QueryAsync(query, customerProjectId, ct) });
}).WithOpenApi();

admin.MapGet("/admins", async (IAuthService svc) =>
    Results.Ok(new { data = await svc.GetAdminsAsync() })).WithOpenApi();

admin.MapPost("/admins", async (CreateAdminRequest req, HttpContext ctx, IAuthService svc) =>
{
    var actorId = Guid.Parse(ctx.User.FindFirst(JwtRegisteredClaimNames.Sub)?.Value ?? Guid.Empty.ToString());
    return Results.Created("/api/v1/admin/admins", new { data = await svc.CreateAdminAsync(req, actorId) });
}).WithOpenApi();

// ── MCP server (thin tool layer over Application services — ADR-002) ──
app.MapGet("/mcp/tools", (McpToolRegistry registry) =>
    Results.Ok(new { data = registry.Definitions.Select(d => new { d.Name, d.Description, d.Parameters, d.RequiredRole }) })).WithOpenApi();

app.MapPost("/mcp/call", async (McpCallRequest req, McpToolRegistry registry, HttpContext ctx) =>
{
    var role = ctx.User.FindFirst(ClaimTypes.Role)?.Value;
    Guid? callerId = null;
    if (role is "admin" or "customer")
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

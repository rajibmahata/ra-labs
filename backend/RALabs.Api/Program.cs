using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using RALabs.Application;
using RALabs.Application.DTOs;
using RALabs.Application.Services;
using RALabs.Domain.Interfaces;
using RALabs.Infrastructure;
using RALabs.Infrastructure.Data;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Threading.RateLimiting;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddApplication();
builder.Services.AddInfrastructure(builder.Configuration);
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
});

builder.Services.ConfigureHttpJsonOptions(o =>
    o.SerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase);

var app = builder.Build();

// Apply migrations + seed
var seedDemo = app.Configuration.GetValue<bool>("Seed:DemoOnStartup");
await DbInitializer.InitializeAsync(app.Services, seedDemo);

app.UseMiddleware<RALabs.Api.Middleware.ExceptionHandlingMiddleware>();
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
   .RequireRateLimiting("auth").WithOpenApi();

// ── Admin group ──
var admin = app.MapGroup("/api/v1/admin").RequireAuthorization();

admin.MapGet("/projects", async (bool? includeUnpublished, IProjectRepository repo) =>
{
    var items = await repo.GetAllAsync(includeUnpublished ?? true);
    return Results.Ok(new { data = items.Select(p => new ProjectDto(p.Id, p.Slug, p.Title, p.Summary, p.StackTags,
        p.Status.ToString().ToLowerInvariant(), p.GithubUrl, p.CaseStudyBody, p.CoverImageUrl,
        p.SortOrder, p.IsPublished, p.CreatedAt, p.UpdatedAt)).ToList() });
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

admin.MapGet("/admins", async (IAuthService svc) =>
    Results.Ok(new { data = await svc.GetAdminsAsync() })).WithOpenApi();

admin.MapPost("/admins", async (CreateAdminRequest req, HttpContext ctx, IAuthService svc) =>
{
    var actorId = Guid.Parse(ctx.User.FindFirst(JwtRegisteredClaimNames.Sub)?.Value ?? Guid.Empty.ToString());
    return Results.Created("/api/v1/admin/admins", new { data = await svc.CreateAdminAsync(req, actorId) });
}).WithOpenApi();

app.Run();

namespace RALabs.Api.Middleware
{
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

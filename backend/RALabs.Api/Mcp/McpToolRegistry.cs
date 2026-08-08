using RALabs.Application.DTOs;
using RALabs.Application.Services;

namespace RALabs.Api.Mcp;

/// <summary>
/// Thin tool-definition layer over the Application services (ADR-002).
/// Every tool delegates to the same service method the REST controller calls
/// — no duplicated business logic. Auth mirrors REST: callers pass a
/// role-scoped JWT; admin-only tools refuse customer/anonymous tokens.
/// </summary>
public class McpToolRegistry
{
    private readonly IServiceProvider _sp;

    public McpToolRegistry(IServiceProvider sp) => _sp = sp;

    public List<McpToolDef> Definitions { get; } = new()
    {
        new McpToolDef("list_projects", "List published portfolio projects, paginated and optionally filtered by stack tag.", new()
        {
            ["page"] = "int?",
            ["pageSize"] = "int?",
            ["tag"] = "string?"
        }, "anonymous"),
        new McpToolDef("get_project", "Get a single published project by slug.", new() { ["slug"] = "string" }, "anonymous"),
        new McpToolDef("list_team_members", "List published team members with their GitHub snapshots.", new(), "anonymous"),
        new McpToolDef("get_team_member", "Get a single published team member by slug.", new() { ["slug"] = "string" }, "anonymous"),
        new McpToolDef("get_content", "Get all page content for a locale.", new() { ["locale"] = "string" }, "anonymous"),
        new McpToolDef("submit_lead", "Submit a lead from the contact form or chatbot.", new()
        {
            ["name"] = "string",
            ["contactInfo"] = "string",
            ["message"] = "string",
            ["source"] = "string"
        }, "anonymous"),
        new McpToolDef("get_thread", "Get a chat thread with its messages.", new() { ["threadId"] = "string" }, "anonymous"),
        new McpToolDef("send_message", "Send a message into a chat thread.", new()
        {
            ["threadId"] = "string",
            ["content"] = "string",
            ["attachmentUrl"] = "string?"
        }, "anonymous"),
        new McpToolDef("create_chat_thread", "Create a new chat thread.", new() { ["type"] = "string?" }, "anonymous"),
        new McpToolDef("login", "Authenticate an admin and return an access token.", new()
        {
            ["email"] = "string",
            ["password"] = "string"
        }, "anonymous"),
        // Admin tools
        new McpToolDef("create_project", "Create a portfolio project (admin).", new()
        {
            ["title"] = "string", ["slug"] = "string?", ["summary"] = "string", ["stackTags"] = "string[]",
            ["status"] = "string?", ["githubUrl"] = "string?", ["caseStudyBody"] = "string?",
            ["coverImageUrl"] = "string?", ["sortOrder"] = "int?", ["isPublished"] = "bool?"
        }, "admin"),
        new McpToolDef("update_project", "Update a portfolio project (admin).", new() { ["id"] = "string" }, "admin"),
        new McpToolDef("delete_project", "Soft-delete a portfolio project (admin).", new() { ["id"] = "string" }, "admin"),
        new McpToolDef("create_team_member", "Create a team member (admin).", new()
        {
            ["name"] = "string", ["slug"] = "string?", ["role"] = "string", ["bio"] = "string",
            ["githubUsername"] = "string?", ["avatarUrl"] = "string?", ["email"] = "string?",
            ["linkedinUrl"] = "string?", ["location"] = "string?", ["isPublished"] = "bool?"
        }, "admin"),
        new McpToolDef("update_team_member", "Update a team member (admin).", new() { ["id"] = "string" }, "admin"),
        new McpToolDef("delete_team_member", "Unpublish a team member (admin).", new() { ["id"] = "string" }, "admin"),
        new McpToolDef("get_my_team_profile", "Get the authenticated admin's linked team profile.", new(), "admin"),
        new McpToolDef("update_my_team_profile", "Self-edit the authenticated admin's team profile (shown on public site).", new()
        {
            ["name"] = "string?", ["role"] = "string?", ["bio"] = "string?", ["githubUsername"] = "string?",
            ["avatarUrl"] = "string?", ["email"] = "string?", ["linkedinUrl"] = "string?", ["location"] = "string?",
            ["isPublished"] = "bool?"
        }, "admin"),
        new McpToolDef("create_content", "Create a content entry for a key+locale (admin).", new()
        {
            ["key"] = "string", ["locale"] = "string", ["value"] = "string"
        }, "admin"),
        new McpToolDef("update_content", "Upsert a content entry (admin).", new()
        {
            ["key"] = "string", ["locale"] = "string", ["value"] = "string"
        }, "admin"),
        new McpToolDef("list_unpublished_leads", "List leads, filterable by status/source (admin).", new()
        {
            ["status"] = "string?", ["source"] = "string?", ["page"] = "int?", ["pageSize"] = "int?"
        }, "admin"),
        new McpToolDef("update_lead", "Update lead status or notes (admin).", new()
        {
            ["id"] = "string", ["status"] = "string?", ["notes"] = "string?"
        }, "admin"),
        new McpToolDef("list_threads", "List chat threads, filterable by type/intervention flag (admin).", new()
        {
            ["type"] = "string?", ["needsManualIntervention"] = "bool?", ["page"] = "int?", ["pageSize"] = "int?"
        }, "admin"),
        new McpToolDef("update_thread", "Update thread metadata, e.g. clear needsManualIntervention (admin).", new()
        {
            ["threadId"] = "string", ["needsManualIntervention"] = "bool?"
        }, "admin"),
        new McpToolDef("admin_send_message", "Post a message to a thread as admin (admin).", new()
        {
            ["threadId"] = "string", ["content"] = "string"
        }, "admin"),
        new McpToolDef("list_admins", "List admin accounts (admin).", new(), "admin"),
        new McpToolDef("create_admin", "Create an admin account (admin).", new()
        {
            ["name"] = "string", ["email"] = "string", ["password"] = "string", ["teamMemberId"] = "string?"
        }, "admin"),
        new McpToolDef("github_sync", "Run the GitHub sync for all team members (admin).", new(), "admin"),
        new McpToolDef("rag_ingest", "Ingest public content into the RAG knowledge base (admin).", new(), "admin")
    };

    /// <summary>Dispatch a tool call; returns an ApiResult-shaped object or throws.</summary>
    public async Task<object?> DispatchAsync(string tool, IDictionary<string, object?> args, string? role, Guid? adminUserId)
    {
        using var scope = _sp.CreateScope();
        var prj = scope.ServiceProvider.GetRequiredService<IProjectService>();
        var team = scope.ServiceProvider.GetRequiredService<ITeamService>();
        var content = scope.ServiceProvider.GetRequiredService<IContentService>();
        var leads = scope.ServiceProvider.GetRequiredService<ILeadService>();
        var chat = scope.ServiceProvider.GetRequiredService<IChatService>();
        var auth = scope.ServiceProvider.GetRequiredService<IAuthService>();
        var github = scope.ServiceProvider.GetRequiredService<IGithubSyncService>();
        var rag = scope.ServiceProvider.GetRequiredService<IRagIngestionService>();

        return tool switch
        {
            "list_projects" => await prj.GetPublishedAsync(GetInt(args, "page"), GetInt(args, "pageSize"), GetStr(args, "tag")),
            "get_project" => await prj.GetBySlugAsync(RequireStr(args, "slug")),
            "list_team_members" => await team.GetPublishedAsync(),
            "get_team_member" => await team.GetBySlugAsync(RequireStr(args, "slug")),
            "get_content" => await content.GetByLocaleAsync(RequireStr(args, "locale")),
            "submit_lead" => await leads.CreateAsync(new CreateLeadRequest(
                RequireStr(args, "name"), RequireStr(args, "contactInfo"), RequireStr(args, "message"), RequireStr(args, "source"))),
            "get_thread" => await chat.GetThreadAsync(ParseGuid(RequireStr(args, "threadId")), isCustomerThread: true, isAdmin: false),
            "send_message" => await chat.SendMessageAsync(ParseGuid(RequireStr(args, "threadId")),
                new SendMessageRequest(RequireStr(args, "content"), GetStr(args, "attachmentUrl")), "visitor", null),
            "create_chat_thread" => await chat.CreateThreadAsync(
                Enum.TryParse<RALabs.Domain.Enums.ChatThreadType>(GetStr(args, "type") ?? "lead", true, out var t) ? t : RALabs.Domain.Enums.ChatThreadType.Lead, null),
            "login" => await auth.LoginAsync(new LoginRequest(RequireStr(args, "email"), RequireStr(args, "password"))),

            // Admin-only tools
            "create_project" => EnsureAdmin(role, await prj.CreateAsync(new CreateProjectRequest(
                RequireStr(args, "title"), GetStr(args, "slug"), RequireStr(args, "summary"),
                GetList(args, "stackTags"), GetStr(args, "status"), GetStr(args, "githubUrl"),
                GetStr(args, "caseStudyBody"), GetStr(args, "coverImageUrl"), GetInt(args, "sortOrder"), GetBool(args, "isPublished")))),
            "update_project" => EnsureAdmin(role, await prj.UpdateAsync(ParseGuid(RequireStr(args, "id")),
                new UpdateProjectRequest(RequireStr(args, "title"), GetStr(args, "slug"), RequireStr(args, "summary"),
                    GetList(args, "stackTags"), GetStr(args, "status"), GetStr(args, "githubUrl"),
                    GetStr(args, "caseStudyBody"), GetStr(args, "coverImageUrl"), GetInt(args, "sortOrder"), GetBool(args, "isPublished")))),
            "delete_project" => await DeleteProjectAsync(role, args, prj),
            "create_team_member" => EnsureAdmin(role, await team.CreateAsync(new CreateTeamRequest(
                RequireStr(args, "name"), GetStr(args, "slug"), RequireStr(args, "role"), RequireStr(args, "bio"),
                GetStr(args, "githubUsername"), GetStr(args, "avatarUrl"), GetStr(args, "email"),
                GetStr(args, "linkedinUrl"), GetStr(args, "location"), GetBool(args, "isPublished")))),
            "update_team_member" => EnsureAdmin(role, await team.UpdateAsync(ParseGuid(RequireStr(args, "id")),
                new UpdateTeamRequest(RequireStr(args, "name"), GetStr(args, "slug"), RequireStr(args, "role"), RequireStr(args, "bio"),
                    GetStr(args, "githubUsername"), GetStr(args, "avatarUrl"), GetStr(args, "email"),
                    GetStr(args, "linkedinUrl"), GetStr(args, "location"), GetBool(args, "isPublished")))),
            "delete_team_member" => await DeleteTeamMemberAsync(role, args, team),
            "get_my_team_profile" => EnsureAdmin(role, await team.GetByAdminUserIdAsync(adminUserId!.Value)),
            "update_my_team_profile" => EnsureAdmin(role, await team.UpdateProfileAsync(adminUserId!.Value,
                new UpdateTeamRequest(GetStr(args, "name") ?? "", null, GetStr(args, "role") ?? "", GetStr(args, "bio") ?? "",
                    GetStr(args, "githubUsername"), GetStr(args, "avatarUrl"), GetStr(args, "email"),
                    GetStr(args, "linkedinUrl"), GetStr(args, "location"), GetBool(args, "isPublished")))),
            "create_content" => EnsureAdmin(role, await content.CreateAsync(new CreateContentRequest(
                RequireStr(args, "key"), RequireStr(args, "locale"), RequireStr(args, "value")))),
            "update_content" => EnsureAdmin(role, await content.UpsertAsync(RequireStr(args, "key"),
                new UpdateContentRequest(RequireStr(args, "locale"), RequireStr(args, "value")))),
            "list_unpublished_leads" => EnsureAdmin(role, await leads.GetAllAsync(GetStr(args, "status"), GetStr(args, "source"), GetInt(args, "page"), GetInt(args, "pageSize"))),
            "update_lead" => EnsureAdmin(role, await leads.UpdateAsync(ParseGuid(RequireStr(args, "id")),
                new UpdateLeadRequest(GetStr(args, "status"), GetStr(args, "notes")))),
            "list_threads" => EnsureAdmin(role, await chat.ListThreadsAsync(GetStr(args, "type"), GetBool(args, "needsManualIntervention"), GetInt(args, "page"), GetInt(args, "pageSize"))),
            "update_thread" => EnsureAdmin(role, await chat.UpdateThreadAsync(ParseGuid(RequireStr(args, "threadId")),
                new UpdateThreadRequest(GetBool(args, "needsManualIntervention")))),
            "admin_send_message" => EnsureAdmin(role, await chat.SendMessageAsync(ParseGuid(RequireStr(args, "threadId")),
                new SendMessageRequest(RequireStr(args, "content"), null), "admin", adminUserId.ToString())),
            "list_admins" => EnsureAdmin(role, await auth.GetAdminsAsync()),
            "create_admin" => EnsureAdmin(role, await auth.CreateAdminAsync(new RALabs.Application.Services.CreateAdminRequest(
                RequireStr(args, "name"), RequireStr(args, "email"), RequireStr(args, "password"),
                GetGuid(args, "teamMemberId")), adminUserId!.Value)),
            "github_sync" => EnsureAdmin(role, await github.SyncAllAsync(CancellationToken.None)),
            "rag_ingest" => EnsureAdmin(role, await rag.IngestPublicContentAsync(CancellationToken.None)),
            _ => throw new ArgumentException($"Unknown MCP tool: {tool}")
        };
    }

    private static string RequireStr(IDictionary<string, object?> args, string key)
    {
        if (!args.TryGetValue(key, out var v) || v is null || string.IsNullOrWhiteSpace(v.ToString()))
            throw new ArgumentException($"Missing required parameter '{key}'.");
        return v.ToString()!;
    }

    private static string? GetStr(IDictionary<string, object?> args, string key)
        => args.TryGetValue(key, out var v) ? v?.ToString() : null;

    private static int? GetInt(IDictionary<string, object?> args, string key)
        => args.TryGetValue(key, out var v) && v is not null && int.TryParse(v.ToString(), out var i) ? i : null;

    private static bool? GetBool(IDictionary<string, object?> args, string key)
        => args.TryGetValue(key, out var v) && v is not null && bool.TryParse(v.ToString(), out var b) ? b : null;

    private static List<string>? GetList(IDictionary<string, object?> args, string key)
        => args.TryGetValue(key, out var v) && v is IEnumerable<string> list ? list.ToList() : null;

    private static Guid? GetGuid(IDictionary<string, object?> args, string key)
        => args.TryGetValue(key, out var v) && v is not null && Guid.TryParse(v.ToString(), out var g) ? g : null;

    private static Guid ParseGuid(string s)
        => Guid.TryParse(s, out var g) ? g : throw new ArgumentException($"Invalid GUID: {s}");

    private static T EnsureAdmin<T>(string? role, T result)
        => role == "admin" ? result : throw new ForbiddenMcpException("This MCP tool requires the admin role.");

    private static async Task<object?> DeleteProjectAsync(string? role, IDictionary<string, object?> args, IProjectService prj)
    {
        EnsureAdmin(role, (object?)null);
        await prj.DeleteAsync(ParseGuid(RequireStr(args, "id")));
        return null;
    }

    private static async Task<object?> DeleteTeamMemberAsync(string? role, IDictionary<string, object?> args, ITeamService team)
    {
        EnsureAdmin(role, (object?)null);
        await team.DeleteAsync(ParseGuid(RequireStr(args, "id")));
        return null;
    }
}

public record McpToolDef(string Name, string Description, Dictionary<string, string> Parameters, string RequiredRole);

public sealed class ForbiddenMcpException : Exception
{
    public ForbiddenMcpException(string message) : base(message) { }
}

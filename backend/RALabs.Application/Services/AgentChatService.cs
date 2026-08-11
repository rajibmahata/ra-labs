using System.Net.Http.Json;
using System.Text.Json;
using RALabs.Application.Common;
using RALabs.Domain.Interfaces;

namespace RALabs.Application.Services;

/// <summary>
/// State persisted on the chat thread between turns (JSON on ChatThread.AgentContext).
/// Kept compact; never stores secrets or PII beyond what the user typed.
/// </summary>
public class AgentContext
{
    public string? Flow { get; set; }
    public int Step { get; set; }
    public AgentBrief Brief { get; set; } = new();
    public bool PendingBrief { get; set; }
    public bool ProjectCreated { get; set; }
    public Guid? CreatedCustomerId { get; set; }
    public Guid? CreatedProjectId { get; set; }
}

public class AgentBrief
{
    public string? Title { get; set; }
    public string? Goal { get; set; }
    public string? Audience { get; set; }
    public string? Requirements { get; set; }
    public string? Timeline { get; set; }
    public string? Budget { get; set; }
    public string? References { get; set; }
    public string? Name { get; set; }
    public string? Email { get; set; }
    public string? Phone { get; set; }
}

public record AgentReply(
    string Content,
    bool NeedsManualIntervention,
    List<string> SuggestedActions,
    string? AgentContextJson,
    bool ProjectCreated = false,
    bool PendingBrief = false);

public interface IAgentService
{
    /// <summary>Returns the agent's reply; AgentContextJson is null when the context is unchanged.</summary>
    Task<AgentReply> AnswerAsync(string content, string? attachmentUrl, string? contextJson,
        bool isCustomer, Guid? customerId, string? locale, IReadOnlyList<string>? priorMessages);
    AgentContext? ParseContext(string? contextJson);
    string? SerializeContext(AgentContext context);
}

/// <summary>Streams a grounded LLM reply (chat-completions SSE). Only available
/// when an AI provider key is configured AND the ai.streaming.enabled setting
/// is on; otherwise the caller must fall back to the deterministic reply path.</summary>
public interface IChatStreamingService
{
    bool CanStream { get; }
    IAsyncEnumerable<string> StreamReplyAsync(string content, string? contextJson, CancellationToken ct);
}

public sealed class AgentChatService : IAgentService, IChatStreamingService
{
    /// <summary>The LLM system prompt for the streamed one-turn replies. The agent
    /// is the front door of the studio: warm and concise, grounded in what it knows,
    /// never inventing facts, and always pointing to the next real step.</summary>
    public const string SystemPrompt =
        "You are the R&A Labs AI agent — the front door of the studio and the first " +
        "step for every new project conversation on the website. Be warm, concise, " +
        "and useful in a single reply. Help visitors with three things:\n" +
        "1. Questions about RA Labs: our work, services, process, and team. Ground " +
        "your answers in what you know; never invent projects, metrics, clients, " +
        "prices, or availability.\n" +
        "2. Collecting a project brief: when someone describes what they want to " +
        "build, keep the conversation moving with the next useful question (goal, " +
        "users, features, timeline, budget, references). The guided flow handles " +
        "the full intake when they ask to create a project.\n" +
        "3. Next steps: point people to the customer portal for a private workspace, " +
        "or to the contact form when a real conversation with the team is needed.\n" +
        "If you don't know, say so and suggest contacting the team. Reply in the " +
        "language the visitor uses.";

    private readonly IChatbotService _chatbot;
    private readonly ICustomerProjectService? _projects;
    private readonly ISettingService? _settings;
    private readonly IHttpClientFactory? _httpFactory;
    private readonly ICustomerRepository? _customers;
    private readonly IEmailSender? _email;
    private readonly string? _portalUrl;
    private readonly string? _openAiKey;
    private readonly string _openAiModel;
    private bool _canStream;

    public AgentChatService(IChatbotService chatbot, ICustomerProjectService? projects = null,
        ISettingService? settings = null, IHttpClientFactory? httpFactory = null,
        ICustomerRepository? customers = null, IEmailSender? email = null, string? portalUrl = null,
        string? openAiKey = null, string? openAiModel = "gpt-4o-mini")
    {
        _chatbot = chatbot;
        _projects = projects;
        _settings = settings;
        _httpFactory = httpFactory;
        _customers = customers;
        _email = email;
        _portalUrl = portalUrl;
        _openAiKey = openAiKey;
        _openAiModel = openAiModel;
        _canStream = !string.IsNullOrWhiteSpace(_openAiKey) && _httpFactory is not null;
    }

    public bool CanStream => _canStream;

    public async IAsyncEnumerable<string> StreamReplyAsync(string content, string? contextJson, [System.Runtime.CompilerServices.EnumeratorCancellation] CancellationToken ct)
    {
        if (!_canStream || _settings is null || _httpFactory is null)
            yield break;

        if (!await _settings.GetBoolAsync("ai.streaming.enabled", false))
            yield break;

        var context = ParseContext(contextJson);
        if (context?.Flow == "create-project" || context is { PendingBrief: true })
            yield break; // guided flows stream through the deterministic path only.

        var system = SystemPrompt;
        var user = content;

        using var client = _httpFactory.CreateClient("openai");
        client.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", _openAiKey);
        using var request = new HttpRequestMessage(HttpMethod.Post, "https://api.openai.com/v1/chat/completions")
        {
            Content = JsonContent.Create(new
            {
                model = _openAiModel,
                stream = true,
                messages = new[]
                {
                    new { role = "system", content = system },
                    new { role = "user", content = user }
                }
            })
        };
        using var response = await client.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, ct);
        response.EnsureSuccessStatusCode();
        await using var body = await response.Content.ReadAsStreamAsync(ct);
        using var reader = new StreamReader(body);
        while (!reader.EndOfStream)
        {
            ct.ThrowIfCancellationRequested();
            var line = await reader.ReadLineAsync(ct);
            if (string.IsNullOrWhiteSpace(line) || !line.StartsWith("data: ", StringComparison.Ordinal))
                continue;
            var payload = line[6..];
            if (payload == "[DONE]") break;
            var delta = TryGetDelta(payload);
            if (!string.IsNullOrWhiteSpace(delta))
                yield return delta;
        }
    }

    private static string? TryGetDelta(string payload)
    {
        try
        {
            using var doc = JsonDocument.Parse(payload);
            return doc.RootElement.GetProperty("choices")[0].GetProperty("delta")
                .GetProperty("content").GetString();
        }
        catch (JsonException)
        {
            // Malformed chunk — skip.
            return null;
        }
    }

    public AgentContext? ParseContext(string? contextJson)
    {
        if (string.IsNullOrWhiteSpace(contextJson)) return null;
        try { return JsonSerializer.Deserialize<AgentContext>(contextJson); }
        catch (JsonException) { return null; }
    }

    public string? SerializeContext(AgentContext context) =>
        context is null || (context.Flow is null && !context.PendingBrief && !context.ProjectCreated
            && !context.CreatedCustomerId.HasValue && !context.CreatedProjectId.HasValue)
            ? null
            : JsonSerializer.Serialize(context);

    public async Task<AgentReply> AnswerAsync(string content, string? attachmentUrl, string? contextJson,
        bool isCustomer, Guid? customerId, string? locale, IReadOnlyList<string>? priorMessages)
    {
        var context = ParseContext(contextJson);
        var text = (content ?? string.Empty).Trim();
        var lower = text.ToLowerInvariant();

        // Attachment-bearing messages keep the current flow or start a QA answer.
        if (!string.IsNullOrWhiteSpace(attachmentUrl))
            return await QaReplyAsync(text, context, locale, priorMessages, "Thanks for attaching the file — I've noted it.");

        // ── Active guided flow ──
        if (context?.Flow == "create-project")
            return await HandleIntakeAsync(context, text, lower, isCustomer, customerId, locale, priorMessages);

        // ── Resume a finished intake ──
        if (context is { PendingBrief: true })
        {
            if (lower is "cancel" or "start over" or "discard" or "forget it")
            {
                context.PendingBrief = false;
                return Reply("No problem — I've discarded the draft brief. Anything else I can help with?", context, QuickActions());
            }
            return Reply(
                "I've still got your project brief on file and the RA Labs team has been notified. " +
                "If you're a customer, sign in and say \"create project\" to turn it into a project right here. " +
                "Anything else I can help with?",
                context, QuickActions());
        }

        // ── Start a new guided flow ──
        if (IsStartIntention(lower))
        {
            var ctx = new AgentContext { Flow = "create-project", Step = 0 };
            return Reply(IntakePrompt(ctx), ctx, new List<string> { "Skip", "Start over" });
        }

        // ── Everything else: RAG QA ──
        return await QaReplyAsync(text, null, locale, priorMessages, null);
    }

    // ── Guided create-project intake ──
    // Steps 0-6: project brief. Anonymous visitors additionally give contact
    // details (7 name, 8 email, 9 phone); customers jump straight to review.
    private async Task<AgentReply> HandleIntakeAsync(AgentContext ctx, string text, string lower,
        bool isCustomer, Guid? customerId, string? locale, IReadOnlyList<string>? priorMessages)
    {
        if (lower is "cancel" or "start over" or "stop" or "never mind")
        {
            ctx.Flow = null;
            ctx.Step = 0;
            ctx.Brief = new AgentBrief();
            return Reply("No problem — I've cancelled the project setup. Ask me anything about RA Labs, or say \"create project\" to start again.", ctx, QuickActions());
        }

        var reviewStep = isCustomer ? 7 : 10;

        // Contact collection for anonymous visitors (steps 7-9).
        if (!isCustomer && ctx.Step is >= 7 and <= 9)
            return await HandleContactStepAsync(ctx, text, lower, reviewStep);

        if (ctx.Step < reviewStep)
        {
            var skip = lower == "skip";
            var value = skip ? null : text;
            ApplyStep(ctx, value);
            ctx.Step++;
            if (ctx.Step < reviewStep)
                return Reply(IntakePrompt(ctx, isCustomer), ctx, new List<string> { isCustomer && ctx.Step == 7 ? "Confirm" : "Skip", "Start over" });

            // All fields collected → review.
            ctx.Step = reviewStep;
            return Reply(ReviewPrompt(ctx), ctx, new List<string> { "Confirm", "Start over" });
        }

        // Review step: confirm → create; otherwise edit or re-confirm.
        if (lower is "confirm" or "yes" or "submit" or "done" or "create it" or "create project" or "looks good" or "go ahead")
            return await ConfirmIntakeAsync(ctx, isCustomer, customerId);

        if (lower is "edit" or "change")
            return Reply("Which part would you like to change? Tell me the step name (title, goal, users, features, timeline, budget, extras, name, email, phone) or say \"start over\".", ctx, new List<string> { "Start over" });

        return Reply(ReviewPrompt(ctx), ctx, new List<string> { "Confirm", "Start over" });
    }

    private async Task<AgentReply> HandleContactStepAsync(AgentContext ctx, string text, string lower, int reviewStep)
    {
        var value = lower == "skip" ? null : text.Trim();
        switch (ctx.Step)
        {
            case 7: // Name
                ctx.Brief.Name = value;
                ctx.Step++;
                return Reply(IntakePrompt(ctx, false), ctx, new List<string> { "Skip", "Start over" });
            case 8: // Email — required and validated
                if (string.IsNullOrWhiteSpace(value) || !IsValidEmail(value))
                    return Reply(
                        "I need a valid email so the team can confirm your request (e.g. name@company.com). What email should we use?",
                        ctx, new List<string> { "Start over" });
                ctx.Brief.Email = value.ToLowerInvariant();
                ctx.Step++;
                return Reply(IntakePrompt(ctx, false), ctx, new List<string> { "Skip", "Start over" });
            default: // 9 Phone — optional but validated when provided
                if (!string.IsNullOrWhiteSpace(value) && !IsValidPhone(value))
                    return Reply(
                        "That phone number doesn't look right. Please share a number with country code (e.g. +1 555 123 4567) or say \"skip\".",
                        ctx, new List<string> { "Skip", "Start over" });
                ctx.Brief.Phone = value;
                ctx.Step = reviewStep;
                return Reply(ReviewPrompt(ctx), ctx, new List<string> { "Confirm", "Start over" });
        }
    }

    private async Task<AgentReply> ConfirmIntakeAsync(AgentContext ctx, bool isCustomer, Guid? customerId)
    {
        if (isCustomer && customerId.HasValue)
        {
            if (_projects is null)
                return Reply("I can't create the project right now — please use the project form in your portal.", ctx, QuickActions());
            Guard.Reset();
            var project = await _projects.CreateAsync(customerId.Value, ToRequest(ctx.Brief));
            ctx.Flow = null;
            ctx.Step = 0;
            ctx.Brief = new AgentBrief();
            ctx.ProjectCreated = true;
            ctx.CreatedProjectId = project.Id;
            return Reply(
                $"Done — your project \"{project.Title}\" is in our system (status: intake). " +
                "Our team has been notified and will get back to you. You can track it anytime in your portal projects list.",
                ctx, new List<string> { "Start another project" });
        }

        // Anonymous visitor: create the customer (or reuse the existing record),
        // create the project request, notify the team and email the customer.
        if (_projects is null || _customers is null)
            return Reply("I can't create the project request right now — please use the contact form.", ctx, QuickActions());

        var email = ctx.Brief.Email?.Trim().ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(email) || !IsValidEmail(email))
            return Reply(
                "Almost there — I still need a valid email address so we can send you the confirmation. What email should we use?",
                ctx, new List<string> { "Start over" });

        var name = string.IsNullOrWhiteSpace(ctx.Brief.Name) ? "Guest" : ctx.Brief.Name.Trim();
        var phone = string.IsNullOrWhiteSpace(ctx.Brief.Phone) ? null : ctx.Brief.Phone.Trim();
        if (phone is not null && !IsValidPhone(phone))
            return Reply(
                "That phone number doesn't look right. Please share a number with country code (e.g. +1 555 123 4567) or skip it.",
                ctx, new List<string> { "Start over" });

        // Match-or-create: never duplicate a customer record for the same email.
        var customer = await _customers.GetByEmailAsync(email);
        var createdCustomer = false;
        if (customer is null)
        {
            customer = new Customer
            {
                Id = Guid.NewGuid(),
                Name = name,
                Email = email,
                Phone = phone,
                // Random unguessable credential; the customer sets their own
                // password later via "forgot password" in the portal.
                PasswordHash = RandomCredentialHash(),
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            };
            var cid = await _customers.AddAsync(customer);
            customer.Id = cid;
            createdCustomer = true;
        }
        else if (string.IsNullOrWhiteSpace(customer.Phone) && phone is not null)
        {
            customer.Phone = phone;
            await _customers.UpdateAsync(customer);
        }

        Guard.Reset();
        var project = await _projects.CreateAsync(customer.Id, ToRequest(ctx.Brief));
        ctx.Flow = null;
        ctx.Step = 0;
        ctx.Brief = new AgentBrief();
        ctx.ProjectCreated = true;
        ctx.CreatedCustomerId = customer.Id;
        ctx.CreatedProjectId = project.Id;

        // Confirmation email — only after the request is persisted. Failures are
        // logged by the sender; a mail outage must not break the conversation.
        try
        {
            await SendConfirmationEmailAsync(customer, project);
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Confirmation email failed: {ex.Message}");
        }

        return Reply(
            $"Done, {name} — your project request \"{project.Title}\" has been sent to the RA Labs team. " +
            (createdCustomer
                ? "We've set up a customer account for you and emailed a confirmation to " + email + " — use \"forgot password\" in the customer portal to set your own password and track this request."
                : "We've emailed a confirmation to " + email + ". You can track this request in the customer portal."),
            ctx, new List<string> { "Start another project" });
    }

    private async Task SendConfirmationEmailAsync(Customer customer, CustomerProjectDto project)
    {
        if (_email is null) return;
        var reference = $"PJ-{project.Id.ToString("N")[..6].ToUpperInvariant()}";
        var portal = string.IsNullOrWhiteSpace(_portalUrl) ? null : _portalUrl.TrimEnd('/');
        var summary = string.IsNullOrWhiteSpace(project.Goal) ? project.Title : project.Goal;
        var body =
            $"<p>Hi {System.Net.WebUtility.HtmlEncode(customer.Name)},</p>" +
            $"<p>Thank you — we received your RA Labs project request <strong>{System.Net.WebUtility.HtmlEncode(project.Title)}</strong>.</p>" +
            $"<p><strong>Summary:</strong> {System.Net.WebUtility.HtmlEncode(summary)}</p>" +
            $"<p><strong>Reference:</strong> {reference}</p>" +
            "<p><strong>What happens next:</strong> one of our engineers will review your request and reply within one business day. " +
            "You can reply to this email with anything we should know — sketches and documents are welcome.</p>" +
            (portal is null
                ? string.Empty
                : $"<p>You can track this request and manage your projects in the <a href=\"{portal}\">RA Labs customer portal</a>.</p>") +
            "<p>— RA Labs team<br>Engineering studio · AI product engineering<br>Replies within one business day</p>";
        await _email.SendAsync(customer.Email, customer.Name, "We received your RA Labs project request", body);
    }

    private static string RandomCredentialHash() =>
        Convert.ToBase64String(System.Security.Cryptography.SHA256.HashData(System.Security.Cryptography.RandomNumberGenerator.GetBytes(32)));

    private static bool IsValidEmail(string email)
    {
        try
        {
            var addr = new System.Net.Mail.MailAddress(email);
            return addr.Address == email.Trim();
        }
        catch (FormatException)
        {
            return false;
        }
    }

    private static bool IsValidPhone(string phone)
    {
        var digits = new string(phone.Where(char.IsDigit).ToArray());
        return digits.Length is >= 7 and <= 15;
    }

    private static void ApplyStep(AgentContext ctx, string? value)
    {
        var b = ctx.Brief;
        switch (ctx.Step)
        {
            case 0: b.Title = value; break;
            case 1: b.Goal = value; break;
            case 2: b.Audience = value; break;
            case 3: b.Requirements = value; break;
            case 4: b.Timeline = value; break;
            case 5: b.Budget = value; break;
            case 6: b.References = value; break;
        }
    }

    private static string IntakePrompt(AgentContext ctx, bool isCustomer) => ctx.Step switch
    {
        0 => "Great — let's set up your project. What would you like to call it?",
        1 => "What problem are you trying to solve?",
        2 => "Who is it for? (target users or customers)",
        3 => "What key features or tech preferences should it have?",
        4 => "What's your timeline? (e.g. \"2 months\", \"ASAP\", \"by December\")",
        5 => "Do you have a budget range or any constraints?",
        6 when isCustomer => "Anything else? Add reference links, extra notes — or send \"skip\".",
        6 => "Anything else? Add reference links, extra notes — or send \"skip\".",
        7 => "Thanks! Now, what is your name?",
        8 => "What email should we send the confirmation to?",
        _ => "And a phone number we can reach you at? (optional — say \"skip\" if you prefer)"
    };

    private static string ReviewPrompt(AgentContext ctx)
    {
        var b = ctx.Brief;
        var contact = !string.IsNullOrWhiteSpace(b.Name) || !string.IsNullOrWhiteSpace(b.Email) || !string.IsNullOrWhiteSpace(b.Phone)
            ? $"\n• Name: {OrSkipped(b.Name)}\n• Email: {OrSkipped(b.Email)}\n• Phone: {OrSkipped(b.Phone)}"
            : string.Empty;
        return "Here's what I understood:\n" +
               $"• Project: {b.Title}\n" +
               $"• Problem: {OrSkipped(b.Goal)}\n" +
               $"• For: {OrSkipped(b.Audience)}\n" +
               $"• Features/Tech: {OrSkipped(b.Requirements)}\n" +
               $"• Timeline: {OrSkipped(b.Timeline)}\n" +
               $"• Budget/Constraints: {OrSkipped(b.Budget)}\n" +
               $"• Extras: {OrSkipped(b.References)}" +
               contact + "\n" +
               "Would you like me to send this request to the RA Labs team? Send \"confirm\" to submit, \"start over\" to redo it, or tell me what to change.";
    }

    private static string OrSkipped(string? value) => string.IsNullOrWhiteSpace(value) ? "(skipped)" : value.Trim();

    private static CreateCustomerProjectRequest ToRequest(AgentBrief b) => new(
        Title: (b.Title ?? "Untitled project").Trim(),
        Goal: b.Goal,
        Audience: b.Audience,
        Requirements: b.Requirements,
        Timeline: b.Timeline,
        BudgetOrConstraints: b.Budget,
        ReferenceLinks: b.References);

    private static bool IsStartIntention(string lower)
    {
        return lower.Contains("create") || lower.Contains("start") || lower.Contains("build") ||
               lower.Contains("develop") || lower.Contains("new project") || lower.Contains("project idea") ||
               lower.Contains("submit project") || lower.Contains("hire") || lower.Contains("get started") ||
               lower.Contains("i want to") || lower.Contains("i want a") || lower.Contains("i need") ||
               lower.Contains("make a") || lower.Contains("make an") || lower.Contains("request a") ||
               lower.Contains("need a website") || lower.Contains("need an app") || lower.Contains("need a platform");
    }

    // ── QA fallback ──
    private async Task<AgentReply> QaReplyAsync(string text, AgentContext? context, string? locale,
        IReadOnlyList<string>? priorMessages, string? attachmentPrefix)
    {
        var reply = await _chatbot.AnswerAsync(text, locale, priorMessages);
        var content = attachmentPrefix is null
            ? reply.Content
            : $"{attachmentPrefix}\n\n{reply.Content}";
        return Reply(content, context, QuickActions(), reply.NeedsManualIntervention);
    }

    private static AgentReply Reply(string content, AgentContext? context, List<string> actions, bool escalate = false)
    {
        var ctx = context is null ? null : new AgentContext
        {
            Flow = context.Flow,
            Step = context.Step,
            Brief = context.Brief,
            PendingBrief = context.PendingBrief,
            ProjectCreated = context.ProjectCreated,
            CreatedCustomerId = context.CreatedCustomerId,
            CreatedProjectId = context.CreatedProjectId
        };
        return new AgentReply(content, escalate, actions,
            ctx is null ? null : JsonSerializer.Serialize(ctx),
            ProjectCreated: context?.ProjectCreated ?? false,
            PendingBrief: context?.PendingBrief ?? false);
    }

    private static List<string> QuickActions() => new()
    {
        "Create a project",
        "Tell me about RA Labs",
        "Explore projects",
        "Contact us"
    };
}

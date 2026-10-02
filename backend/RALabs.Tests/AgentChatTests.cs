using RALabs.Application.DTOs;
using RALabs.Application.Services;
using RALabs.Infrastructure.Data;
using RALabs.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;

namespace RALabs.Tests;

/// <summary>Agent orchestrator: guided create-project intake, anonymous brief
/// preservation, customer handoff to CustomerProjectService, QA fallback.</summary>
public class AgentChatTests : IDisposable
{
    private readonly RALabsDbContext _db;
    private readonly AgentChatService _agent;
    private readonly ChatService _chat;
    private readonly CustomerAuthService _customerAuth;
    private readonly CustomerProjectService _projects;
    private readonly FakeEmailSender _email = new();
    private readonly string _storageRoot = Path.Combine(Path.GetTempPath(), "ralabs-agent-tests", Guid.NewGuid().ToString("N"));

    public AgentChatTests()
    {
        _db = new RALabsDbContext(new DbContextOptionsBuilder<RALabsDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        var chatbot = new ChatbotService(new KnowledgeChunkRepository(_db));
        var chatRepo = new ChatRepository(_db);
        var projectRepo = new CustomerProjectRepository(_db);
        var customers = new CustomerRepository(_db);
        var hasher = new PasswordHasher();
        _customerAuth = new CustomerAuthService(customers, hasher,
            new JwtService("RALabs_Test_Secret_Key_2026_MinLength32!", "RALabs", "RALabs"), new FakeEmailSender());
        _projects = new CustomerProjectService(projectRepo, customers, chatRepo, new LocalPrivateFileStorage(_storageRoot), null);
        _agent = new AgentChatService(chatbot, _projects, customers: customers, email: _email);
        _chat = new ChatService(chatRepo, chatbot, new LeadRepository(_db), _agent);
    }

    public void Dispose()
    {
        _db.Dispose();
        if (Directory.Exists(_storageRoot)) Directory.Delete(_storageRoot, recursive: true);
    }

    [Fact]
    public async Task CreateProject_GuidedFlow_CollectsContactAndCreatesCustomerProject_WhenAnonymous()
    {
        var thread = await _chat.CreateThreadAsync(RALabs.Domain.Enums.ChatThreadType.Lead, null);

        var reply = await _chat.SendMessageAsync(thread.Id, new SendMessageRequest("I want to create a project", null), "visitor", null);
        var threadDto = await _chat.GetThreadAsync(thread.Id, isCustomerThread: true, isAdmin: false);
        var lastAgent = threadDto.Messages!.Last(m => m.SenderType == "agent");
        Assert.Contains("call it", lastAgent.Content);

        await _chat.SendMessageAsync(thread.Id, new SendMessageRequest("Customer portal", null), "visitor", null);
        await _chat.SendMessageAsync(thread.Id, new SendMessageRequest("Ordering takes too long", null), "visitor", null);
        await _chat.SendMessageAsync(thread.Id, new SendMessageRequest("Restaurant owners", null), "visitor", null);
        await _chat.SendMessageAsync(thread.Id, new SendMessageRequest("Orders, payments, analytics", null), "visitor", null);
        await _chat.SendMessageAsync(thread.Id, new SendMessageRequest("2 months", null), "visitor", null);
        await _chat.SendMessageAsync(thread.Id, new SendMessageRequest("10k USD", null), "visitor", null);
        await _chat.SendMessageAsync(thread.Id, new SendMessageRequest("skip", null), "visitor", null);
        // Contact steps: name, email, phone.
        await _chat.SendMessageAsync(thread.Id, new SendMessageRequest("Riya Sharma", null), "visitor", null);
        await _chat.SendMessageAsync(thread.Id, new SendMessageRequest("riya@example.com", null), "visitor", null);
        await _chat.SendMessageAsync(thread.Id, new SendMessageRequest("+91 98765 43210", null), "visitor", null);
        var confirm = await _chat.SendMessageAsync(thread.Id, new SendMessageRequest("confirm", null), "visitor", null);

        // Customer was matched-or-created and the project was created under them.
        var customer = await new CustomerRepository(_db).GetByEmailAsync("riya@example.com");
        Assert.NotNull(customer);
        Assert.Equal("Riya Sharma", customer!.Name);
        Assert.Equal("+91 98765 43210", customer.Phone);
        var projects = await _projects.GetMyProjectsAsync(customer.Id, 1, 10);
        Assert.Single(projects);
        Assert.Equal("Customer portal", projects[0].Title);
        Assert.True(customer.PasswordHash.Length >= 32, "Agent-created customers need an unguessable credential placeholder.");

        // Confirmation email was sent after persistence.
        Assert.Contains(_email.Sent, e => e.StartsWith("riya@example.com|We received your RA Labs project request"));

        // Thread flagged for the team with the project created.
        threadDto = await _chat.GetThreadAsync(thread.Id, isCustomerThread: true, isAdmin: false);
        Assert.True(threadDto.NeedsManualIntervention, "Anonymous confirmed request must flag the thread for the team.");
    }

    [Fact]
    public async Task CreateProject_AnonymousReusesExistingCustomer_WhenEmailAlreadyRegistered()
    {
        // Pre-register a customer with the same email the visitor will submit.
        var registered = await _customerAuth.RegisterAsync(new CustomerRegisterRequest("Amit", "amit@example.com", "Customer@123"));

        var thread = await _chat.CreateThreadAsync(RALabs.Domain.Enums.ChatThreadType.Lead, null);
        await _chat.SendMessageAsync(thread.Id, new SendMessageRequest("I want to create a project", null), "visitor", null);
        await _chat.SendMessageAsync(thread.Id, new SendMessageRequest("Analytics dashboard", null), "visitor", null);
        await _chat.SendMessageAsync(thread.Id, new SendMessageRequest("Spreadsheets are messy", null), "visitor", null);
        await _chat.SendMessageAsync(thread.Id, new SendMessageRequest("Founders", null), "visitor", null);
        await _chat.SendMessageAsync(thread.Id, new SendMessageRequest("Charts, alerts", null), "visitor", null);
        await _chat.SendMessageAsync(thread.Id, new SendMessageRequest("6 weeks", null), "visitor", null);
        await _chat.SendMessageAsync(thread.Id, new SendMessageRequest("skip", null), "visitor", null);
        await _chat.SendMessageAsync(thread.Id, new SendMessageRequest("skip", null), "visitor", null);
        await _chat.SendMessageAsync(thread.Id, new SendMessageRequest("Amit", null), "visitor", null);
        await _chat.SendMessageAsync(thread.Id, new SendMessageRequest("amit@example.com", null), "visitor", null);
        await _chat.SendMessageAsync(thread.Id, new SendMessageRequest("skip", null), "visitor", null);
        await _chat.SendMessageAsync(thread.Id, new SendMessageRequest("confirm", null), "visitor", null);

        // The existing registered customer is reused — no duplicate record.
        var customers = new CustomerRepository(_db);
        var matches = (await customers.GetAllAsync(1, 100)).Where(c => c.Email == "amit@example.com").ToList();
        Assert.Single(matches);
        Assert.Equal(registered.User.Id, matches[0].Id);
        var projects = await _projects.GetMyProjectsAsync(matches[0].Id, 1, 10);
        Assert.Single(projects);
        Assert.Contains(_email.Sent, e => e.StartsWith("amit@example.com|"));
    }

    [Fact]
    public async Task CreateProject_InvalidEmail_IsRejected()
    {
        var thread = await _chat.CreateThreadAsync(RALabs.Domain.Enums.ChatThreadType.Lead, null);
        await _chat.SendMessageAsync(thread.Id, new SendMessageRequest("create project", null), "visitor", null);
        await _chat.SendMessageAsync(thread.Id, new SendMessageRequest("Loyalty app", null), "visitor", null);
        await _chat.SendMessageAsync(thread.Id, new SendMessageRequest("skip", null), "visitor", null);
        await _chat.SendMessageAsync(thread.Id, new SendMessageRequest("skip", null), "visitor", null);
        await _chat.SendMessageAsync(thread.Id, new SendMessageRequest("skip", null), "visitor", null);
        await _chat.SendMessageAsync(thread.Id, new SendMessageRequest("skip", null), "visitor", null);
        await _chat.SendMessageAsync(thread.Id, new SendMessageRequest("skip", null), "visitor", null);
        await _chat.SendMessageAsync(thread.Id, new SendMessageRequest("skip", null), "visitor", null);
        await _chat.SendMessageAsync(thread.Id, new SendMessageRequest("skip", null), "visitor", null);
        await _chat.SendMessageAsync(thread.Id, new SendMessageRequest("Not an email", null), "visitor", null);

        var threadDto = await _chat.GetThreadAsync(thread.Id, isCustomerThread: true, isAdmin: false);
        var lastAgent = threadDto.Messages!.Last(m => m.SenderType == "agent");
        Assert.Contains("valid email", lastAgent.Content, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task CreateProject_ConfirmedByCustomer_CreatesCustomerProject()
    {
        var register = await _customerAuth.RegisterAsync(new CustomerRegisterRequest("Amit", "amit@example.com", "Customer@123"));
        var thread = await _chat.CreateThreadAsync(RALabs.Domain.Enums.ChatThreadType.Lead, null);
        await _chat.ClaimThreadAsync(thread.Id, register.User.Id);

        await _chat.SendMessageAsync(thread.Id, new SendMessageRequest("create project", null), "customer", "Amit");
        await _chat.SendMessageAsync(thread.Id, new SendMessageRequest("Mobile app", null), "customer", "Amit");
        await _chat.SendMessageAsync(thread.Id, new SendMessageRequest("Doctors waste time", null), "customer", "Amit");
        await _chat.SendMessageAsync(thread.Id, new SendMessageRequest("Clinics", null), "customer", "Amit");
        await _chat.SendMessageAsync(thread.Id, new SendMessageRequest("Scheduling, reminders", null), "customer", "Amit");
        await _chat.SendMessageAsync(thread.Id, new SendMessageRequest("3 months", null), "customer", "Amit");
        await _chat.SendMessageAsync(thread.Id, new SendMessageRequest("20k", null), "customer", "Amit");
        await _chat.SendMessageAsync(thread.Id, new SendMessageRequest("skip", null), "customer", "Amit");
        var confirm = await _chat.SendMessageAsync(thread.Id, new SendMessageRequest("confirm", null), "customer", "Amit");

        var projects = await _projects.GetMyProjectsAsync(register.User.Id, 1, 10);
        Assert.Single(projects);
        Assert.Equal("Mobile app", projects[0].Title);

        var threadDto = await _chat.GetThreadAsync(thread.Id, isCustomerThread: true, isAdmin: false, customerId: register.User.Id);
        var lastAgent = threadDto.Messages!.Last(m => m.SenderType == "agent");
        Assert.Contains("in our system", lastAgent.Content);
    }

    [Fact]
    public async Task Qa_FallsBackToRetrieval_WhenNoFlowActive()
    {
        var thread = await _chat.CreateThreadAsync(RALabs.Domain.Enums.ChatThreadType.Lead, null);
        var reply = await _chat.SendMessageAsync(thread.Id, new SendMessageRequest("Who is Rajib?", null), "visitor", null);
        var threadDto = await _chat.GetThreadAsync(thread.Id, isCustomerThread: true, isAdmin: false);
        Assert.NotNull(threadDto.Messages!.Last(m => m.SenderType == "agent").Content);
    }

    [Fact]
    public async Task CreateProject_GuidedFlow_EmailRequired_RejectsSkipAndStaysOnEmailStep()
    {
        var thread = await _chat.CreateThreadAsync(RALabs.Domain.Enums.ChatThreadType.Lead, null);

        await _chat.SendMessageAsync(thread.Id, new SendMessageRequest("I want to create a project", null), "visitor", null);
        // Brief steps 0-6.
        await _chat.SendMessageAsync(thread.Id, new SendMessageRequest("Mobile app", null), "visitor", null);
        await _chat.SendMessageAsync(thread.Id, new SendMessageRequest("skip", null), "visitor", null);
        await _chat.SendMessageAsync(thread.Id, new SendMessageRequest("skip", null), "visitor", null);
        await _chat.SendMessageAsync(thread.Id, new SendMessageRequest("skip", null), "visitor", null);
        await _chat.SendMessageAsync(thread.Id, new SendMessageRequest("skip", null), "visitor", null);
        await _chat.SendMessageAsync(thread.Id, new SendMessageRequest("skip", null), "visitor", null);
        await _chat.SendMessageAsync(thread.Id, new SendMessageRequest("skip", null), "visitor", null);
        // Step 7: Name.
        await _chat.SendMessageAsync(thread.Id, new SendMessageRequest("Kavya", null), "visitor", null);
        // Step 8: Email — send "skip". Must re-prompt and NOT advance.
        await _chat.SendMessageAsync(thread.Id, new SendMessageRequest("skip", null), "visitor", null);

        var threadDto = await _chat.GetThreadAsync(thread.Id, isCustomerThread: true, isAdmin: false);
        var lastAgent = threadDto.Messages!.Last(m => m.SenderType == "agent");
        Assert.Contains("valid email", lastAgent.Content, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("phone number", lastAgent.Content, StringComparison.OrdinalIgnoreCase);

        // Valid email now advances to phone step.
        await _chat.SendMessageAsync(thread.Id, new SendMessageRequest("kavya@example.com", null), "visitor", null);
        threadDto = await _chat.GetThreadAsync(thread.Id, isCustomerThread: true, isAdmin: false);
        lastAgent = threadDto.Messages!.Last(m => m.SenderType == "agent");
        Assert.Contains("phone number", lastAgent.Content, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task CreateProject_GuidedFlow_InvalidPhone_RejectedAndThenAcceptsValid()
    {
        var thread = await _chat.CreateThreadAsync(RALabs.Domain.Enums.ChatThreadType.Lead, null);

        await _chat.SendMessageAsync(thread.Id, new SendMessageRequest("I want to create a project", null), "visitor", null);
        await _chat.SendMessageAsync(thread.Id, new SendMessageRequest("Loyalty app", null), "visitor", null);
        await _chat.SendMessageAsync(thread.Id, new SendMessageRequest("skip", null), "visitor", null);
        await _chat.SendMessageAsync(thread.Id, new SendMessageRequest("skip", null), "visitor", null);
        await _chat.SendMessageAsync(thread.Id, new SendMessageRequest("skip", null), "visitor", null);
        await _chat.SendMessageAsync(thread.Id, new SendMessageRequest("skip", null), "visitor", null);
        await _chat.SendMessageAsync(thread.Id, new SendMessageRequest("skip", null), "visitor", null);
        await _chat.SendMessageAsync(thread.Id, new SendMessageRequest("skip", null), "visitor", null);
        await _chat.SendMessageAsync(thread.Id, new SendMessageRequest("Vikram", null), "visitor", null);
        await _chat.SendMessageAsync(thread.Id, new SendMessageRequest("vikram@example.com", null), "visitor", null);
        // Step 9: Phone — send invalid value.
        await _chat.SendMessageAsync(thread.Id, new SendMessageRequest("abc", null), "visitor", null);

        var threadDto = await _chat.GetThreadAsync(thread.Id, isCustomerThread: true, isAdmin: false);
        var lastAgent = threadDto.Messages!.Last(m => m.SenderType == "agent");
        Assert.Contains("phone", lastAgent.Content, StringComparison.OrdinalIgnoreCase);

        // Still on phone step — valid phone advances to review.
        await _chat.SendMessageAsync(thread.Id, new SendMessageRequest("+1 555 123 4567", null), "visitor", null);
        threadDto = await _chat.GetThreadAsync(thread.Id, isCustomerThread: true, isAdmin: false);
        lastAgent = threadDto.Messages!.Last(m => m.SenderType == "agent");
        Assert.Contains("Here's what I understood", lastAgent.Content);
    }

    [Fact]
    public async Task CreateProject_GuidedFlow_PhoneStoredOnExistingCustomer_WhenPreviouslyNull()
    {
        // Register a customer with no phone.
        var registered = await _customerAuth.RegisterAsync(
            new CustomerRegisterRequest("Priya", "priya@example.com", "Customer@123"));

        var thread = await _chat.CreateThreadAsync(RALabs.Domain.Enums.ChatThreadType.Lead, null);
        await _chat.SendMessageAsync(thread.Id, new SendMessageRequest("I want to create a project", null), "visitor", null);
        await _chat.SendMessageAsync(thread.Id, new SendMessageRequest("Wellness tracker", null), "visitor", null);
        await _chat.SendMessageAsync(thread.Id, new SendMessageRequest("skip", null), "visitor", null);
        await _chat.SendMessageAsync(thread.Id, new SendMessageRequest("skip", null), "visitor", null);
        await _chat.SendMessageAsync(thread.Id, new SendMessageRequest("skip", null), "visitor", null);
        await _chat.SendMessageAsync(thread.Id, new SendMessageRequest("skip", null), "visitor", null);
        await _chat.SendMessageAsync(thread.Id, new SendMessageRequest("skip", null), "visitor", null);
        await _chat.SendMessageAsync(thread.Id, new SendMessageRequest("skip", null), "visitor", null);
        await _chat.SendMessageAsync(thread.Id, new SendMessageRequest("Priya", null), "visitor", null);
        await _chat.SendMessageAsync(thread.Id, new SendMessageRequest("priya@example.com", null), "visitor", null);
        await _chat.SendMessageAsync(thread.Id, new SendMessageRequest("+1 555 999 8888", null), "visitor", null);
        await _chat.SendMessageAsync(thread.Id, new SendMessageRequest("confirm", null), "visitor", null);

        // Existing customer's Phone must be updated to the new value.
        var customer = await new CustomerRepository(_db).GetByEmailAsync("priya@example.com");
        Assert.NotNull(customer);
        Assert.Equal("+1 555 999 8888", customer!.Phone);
        Assert.Equal(registered.User.Id, customer.Id);
    }

    [Fact]
    public async Task ConfirmationEmail_ContainsProjectReferenceAndTitle()
    {
        var thread = await _chat.CreateThreadAsync(RALabs.Domain.Enums.ChatThreadType.Lead, null);

        await _chat.SendMessageAsync(thread.Id, new SendMessageRequest("I want to create a project", null), "visitor", null);
        await _chat.SendMessageAsync(thread.Id, new SendMessageRequest("AI Dashboard", null), "visitor", null);
        await _chat.SendMessageAsync(thread.Id, new SendMessageRequest("skip", null), "visitor", null);
        await _chat.SendMessageAsync(thread.Id, new SendMessageRequest("skip", null), "visitor", null);
        await _chat.SendMessageAsync(thread.Id, new SendMessageRequest("skip", null), "visitor", null);
        await _chat.SendMessageAsync(thread.Id, new SendMessageRequest("skip", null), "visitor", null);
        await _chat.SendMessageAsync(thread.Id, new SendMessageRequest("skip", null), "visitor", null);
        await _chat.SendMessageAsync(thread.Id, new SendMessageRequest("skip", null), "visitor", null);
        await _chat.SendMessageAsync(thread.Id, new SendMessageRequest("Raj", null), "visitor", null);
        await _chat.SendMessageAsync(thread.Id, new SendMessageRequest("raj@example.com", null), "visitor", null);
        await _chat.SendMessageAsync(thread.Id, new SendMessageRequest("skip", null), "visitor", null);
        await _chat.SendMessageAsync(thread.Id, new SendMessageRequest("confirm", null), "visitor", null);

        // Confirmation email body must contain the PJ- reference and the project title.
        var emailEntry = _email.Sent.FirstOrDefault(e => e.StartsWith("raj@example.com|"));
        Assert.NotNull(emailEntry);
        Assert.Contains("PJ-", emailEntry);
        Assert.Contains("AI Dashboard", emailEntry);
    }

    [Fact]
    public async Task CreateProject_GuidedFlow_SkippingName_ProducesGuestCustomer()
    {
        var thread = await _chat.CreateThreadAsync(RALabs.Domain.Enums.ChatThreadType.Lead, null);

        await _chat.SendMessageAsync(thread.Id, new SendMessageRequest("I want to create a project", null), "visitor", null);
        await _chat.SendMessageAsync(thread.Id, new SendMessageRequest("Guest portal", null), "visitor", null);
        await _chat.SendMessageAsync(thread.Id, new SendMessageRequest("skip", null), "visitor", null);
        await _chat.SendMessageAsync(thread.Id, new SendMessageRequest("skip", null), "visitor", null);
        await _chat.SendMessageAsync(thread.Id, new SendMessageRequest("skip", null), "visitor", null);
        await _chat.SendMessageAsync(thread.Id, new SendMessageRequest("skip", null), "visitor", null);
        await _chat.SendMessageAsync(thread.Id, new SendMessageRequest("skip", null), "visitor", null);
        await _chat.SendMessageAsync(thread.Id, new SendMessageRequest("skip", null), "visitor", null);
        // Step 7: Name — skip.
        await _chat.SendMessageAsync(thread.Id, new SendMessageRequest("skip", null), "visitor", null);
        await _chat.SendMessageAsync(thread.Id, new SendMessageRequest("guest@example.com", null), "visitor", null);
        await _chat.SendMessageAsync(thread.Id, new SendMessageRequest("skip", null), "visitor", null);
        await _chat.SendMessageAsync(thread.Id, new SendMessageRequest("confirm", null), "visitor", null);

        var customer = await new CustomerRepository(_db).GetByEmailAsync("guest@example.com");
        Assert.NotNull(customer);
        Assert.Equal("Guest", customer!.Name);
    }

    [Fact]
    public async Task CreateProject_GuidedFlow_FiresAdminNotification_AfterAnonymousConfirm()
    {
        // Build a ChatService wired with INotificationService so the notification path fires.
        var chatRepo = new ChatRepository(_db);
        var chatbot = new ChatbotService(new KnowledgeChunkRepository(_db));
        var notifications = new NotificationService(new NotificationRepository(_db));
        var chatWithNotif = new ChatService(chatRepo, chatbot, new LeadRepository(_db), _agent, notifications);

        var thread = await chatWithNotif.CreateThreadAsync(RALabs.Domain.Enums.ChatThreadType.Lead, null);

        await chatWithNotif.SendMessageAsync(thread.Id, new SendMessageRequest("I want to create a project", null), "visitor", null);
        await chatWithNotif.SendMessageAsync(thread.Id, new SendMessageRequest("Notification test", null), "visitor", null);
        await chatWithNotif.SendMessageAsync(thread.Id, new SendMessageRequest("skip", null), "visitor", null);
        await chatWithNotif.SendMessageAsync(thread.Id, new SendMessageRequest("skip", null), "visitor", null);
        await chatWithNotif.SendMessageAsync(thread.Id, new SendMessageRequest("skip", null), "visitor", null);
        await chatWithNotif.SendMessageAsync(thread.Id, new SendMessageRequest("skip", null), "visitor", null);
        await chatWithNotif.SendMessageAsync(thread.Id, new SendMessageRequest("skip", null), "visitor", null);
        await chatWithNotif.SendMessageAsync(thread.Id, new SendMessageRequest("skip", null), "visitor", null);
        await chatWithNotif.SendMessageAsync(thread.Id, new SendMessageRequest("Dev", null), "visitor", null);
        await chatWithNotif.SendMessageAsync(thread.Id, new SendMessageRequest("dev@example.com", null), "visitor", null);
        await chatWithNotif.SendMessageAsync(thread.Id, new SendMessageRequest("+1 555 111 2222", null), "visitor", null);
        await chatWithNotif.SendMessageAsync(thread.Id, new SendMessageRequest("confirm", null), "visitor", null);

        // A notification of type project_created_via_chat must have been created.
        var all = await notifications.ListAsync(null, 1, 50);
        var projectNotif = all.Items.FirstOrDefault(n => n.Type == "project_created_via_chat");
        Assert.NotNull(projectNotif);

        // BUG (QA-001): The notification title and body do NOT contain the project title
        // or visitor email because AgentChatService.ConfirmIntakeAsync clears ctx.Brief
        // (line ~314: ctx.Brief = new AgentBrief()) BEFORE serializing the context.
        // ChatService reads the cleared brief for notification building (line ~124-138).
        // FIX: AgentContext.CompletedBrief snapshot preserves the brief across the reset.
        Assert.Contains("Notification test", projectNotif.Title, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("dev@example.com", projectNotif.Message, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("Dev", projectNotif.Message, StringComparison.Ordinal);
        Assert.DoesNotContain("(not provided)", projectNotif.Message, StringComparison.Ordinal);

        // Verify at least the notification type was created and the notification links
        // the correct thread and customer project.
        Assert.Contains("project", projectNotif.Title, StringComparison.OrdinalIgnoreCase);
        Assert.NotNull(projectNotif.RelatedThreadId);
        Assert.NotNull(projectNotif.RelatedCustomerProjectId);
    }

    [Fact]
    public async Task CreateProject_GuidedFlow_DoesNotResumeIntakeAfterAnonymousConfirm()
    {
        // Regression QA-001: after a completed anonymous flow, a subsequent message
        // must NOT resume the guided intake (Flow is null, CompletedBrief is a snapshot).
        var thread = await _chat.CreateThreadAsync(RALabs.Domain.Enums.ChatThreadType.Lead, null);

        await _chat.SendMessageAsync(thread.Id, new SendMessageRequest("I want to create a project", null), "visitor", null);
        await _chat.SendMessageAsync(thread.Id, new SendMessageRequest("Reg test app", null), "visitor", null);
        await _chat.SendMessageAsync(thread.Id, new SendMessageRequest("skip", null), "visitor", null);
        await _chat.SendMessageAsync(thread.Id, new SendMessageRequest("skip", null), "visitor", null);
        await _chat.SendMessageAsync(thread.Id, new SendMessageRequest("skip", null), "visitor", null);
        await _chat.SendMessageAsync(thread.Id, new SendMessageRequest("skip", null), "visitor", null);
        await _chat.SendMessageAsync(thread.Id, new SendMessageRequest("skip", null), "visitor", null);
        await _chat.SendMessageAsync(thread.Id, new SendMessageRequest("skip", null), "visitor", null);
        await _chat.SendMessageAsync(thread.Id, new SendMessageRequest("Reg", null), "visitor", null);
        await _chat.SendMessageAsync(thread.Id, new SendMessageRequest("reg@example.com", null), "visitor", null);
        await _chat.SendMessageAsync(thread.Id, new SendMessageRequest("skip", null), "visitor", null);
        await _chat.SendMessageAsync(thread.Id, new SendMessageRequest("confirm", null), "visitor", null);

        // After confirm, the flow ends. A new message must NOT re-enter the intake.
        var reply = await _chat.SendMessageAsync(thread.Id, new SendMessageRequest("hello, how are you?", null), "visitor", null);
        var threadDto = await _chat.GetThreadAsync(thread.Id, isCustomerThread: true, isAdmin: false);
        var lastAgent = threadDto.Messages!.Last(m => m.SenderType == "agent");
        // Must be a QA/general reply, NOT an intake prompt.
        Assert.DoesNotContain("call it", lastAgent.Content, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("set up your project", lastAgent.Content, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void SystemPrompt_CoversAgentFirstExperience_AndHonestyGuarantees()
    {
        var prompt = AgentChatService.SystemPrompt;

        // The agent is the front door of the studio and the first step for projects.
        Assert.Contains("front door", prompt, StringComparison.OrdinalIgnoreCase);

        // Never invent facts about the studio.
        Assert.Contains("never invent", prompt, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("projects", prompt, StringComparison.OrdinalIgnoreCase);

        // Honest fallback when it does not know.
        Assert.Contains("say so", prompt, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("contacting the team", prompt, StringComparison.OrdinalIgnoreCase);

        // The brief intake is part of the experience.
        Assert.Contains("brief", prompt, StringComparison.OrdinalIgnoreCase);

        // Visitors are pointed to the next real step (portal / contact form).
        Assert.Contains("customer portal", prompt, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("contact form", prompt, StringComparison.OrdinalIgnoreCase);
    }
}

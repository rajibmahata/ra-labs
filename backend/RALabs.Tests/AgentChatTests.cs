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
        _agent = new AgentChatService(chatbot, _projects);
        _chat = new ChatService(chatRepo, chatbot, new LeadRepository(_db), _agent);
    }

    public void Dispose()
    {
        _db.Dispose();
        if (Directory.Exists(_storageRoot)) Directory.Delete(_storageRoot, recursive: true);
    }

    [Fact]
    public async Task CreateProject_GuidedFlow_CollectsBrief_ThenFlagsForTeam_WhenAnonymous()
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
        var confirm = await _chat.SendMessageAsync(thread.Id, new SendMessageRequest("confirm", null), "visitor", null);

        threadDto = await _chat.GetThreadAsync(thread.Id, isCustomerThread: true, isAdmin: false);
        var brief = threadDto.Messages!.Last(m => m.SenderType == "agent");
        Assert.Contains("brief", brief.Content);
        Assert.Contains("notified", brief.Content);
        Assert.True(threadDto.NeedsManualIntervention, "Anonymous confirmed brief must flag the thread for the team.");
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

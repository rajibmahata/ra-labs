using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using RALabs.Application.Services;

namespace RALabs.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services, IConfiguration? config = null)
    {
        services.AddScoped<IProjectService, ProjectService>();
        services.AddScoped<ITeamService, TeamService>();
        services.AddScoped<IContentService, ContentService>();
        services.AddScoped<ILeadService, LeadService>();
        services.AddScoped<INotificationService, NotificationService>();
        services.AddScoped<IChatService, ChatService>();
        services.AddScoped<IAgentService, AgentChatService>();
        services.AddScoped<IChatStreamingService>(sp =>
            new AgentChatService(
                chatbot: sp.GetRequiredService<IChatbotService>(),
                projects: sp.GetRequiredService<ICustomerProjectService>(),
                settings: sp.GetRequiredService<ISettingService>(),
                httpFactory: sp.GetRequiredService<IHttpClientFactory>(),
                customers: sp.GetRequiredService<Domain.Interfaces.ICustomerRepository>(),
                email: sp.GetRequiredService<Domain.Interfaces.IEmailSender>(),
                portalUrl: config?["App:CustomerPortalUrl"],
                openAiKey: config?["OpenAI:ApiKey"],
                openAiModel: config?["OpenAI:Model"] ?? "gpt-4o-mini"));
        services.AddScoped<ISettingService, SettingService>();
        services.AddScoped<IAuditService, AuditService>();
        services.AddScoped<IDashboardStatsService, DashboardStatsService>();
        services.AddScoped<IAuthService, AuthService>();
        services.AddScoped<ICustomerAuthService, CustomerAuthService>();
        services.AddScoped<ICustomerManagementService, CustomerManagementService>();
        services.AddScoped<ICustomerProjectService, CustomerProjectService>();
        services.AddScoped<IChatbotService, ChatbotService>();
        services.AddScoped<IGithubSyncService>(sp =>
            new GithubSyncService(
                sp.GetRequiredService<Domain.Interfaces.ITeamRepository>(),
                sp.GetRequiredService<Domain.Interfaces.IAgentTaskRepository>(),
                sp.GetRequiredService<Domain.Interfaces.IGithubRepositoryRepository>(),
                sp.GetRequiredService<IHttpClientFactory>(),
                config?["Github:Token"],
                sp.GetRequiredService<Microsoft.AspNetCore.DataProtection.IDataProtectionProvider>()));
        services.AddScoped<IRagIngestionService, RagIngestionService>();
        services.AddHttpClient("openai", c => c.Timeout = TimeSpan.FromSeconds(60));
        services.AddScoped<IAiDraftService>(sp => new AiDraftService(
            sp.GetRequiredService<Domain.Interfaces.IContentDraftRepository>(),
            sp.GetRequiredService<IHttpClientFactory>(),
            config?["OpenAI:ApiKey"], config?["OpenAI:Model"] ?? "gpt-4o-mini"));
        services.AddScoped<ITranslationAgentService>(sp => new TranslationAgentService(
            sp.GetRequiredService<Domain.Interfaces.IContentRepository>(),
            sp.GetRequiredService<IHttpClientFactory>(),
            config?["OpenAI:ApiKey"], config?["OpenAI:Model"] ?? "gpt-4o-mini"));
        services.AddScoped<IHeroScenarioService>(sp => new HeroScenarioService(
            sp.GetRequiredService<Domain.Interfaces.IKnowledgeChunkRepository>(),
            sp.GetRequiredService<Domain.Interfaces.IProjectRepository>(),
            sp.GetRequiredService<IHttpClientFactory>(),
            sp.GetRequiredService<Microsoft.Extensions.Caching.Memory.IMemoryCache>(),
            config?["OpenAI:ApiKey"], config?["OpenAI:Model"] ?? "gpt-4o-mini"));
        services.AddHttpClient("github", c =>
        {
            c.Timeout = TimeSpan.FromSeconds(30);
            c.DefaultRequestHeaders.Accept.Add(new System.Net.Http.Headers.MediaTypeWithQualityHeaderValue("application/vnd.github+json"));
        });
        return services;
    }
}

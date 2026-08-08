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
        services.AddScoped<IChatService, ChatService>();
        services.AddScoped<IAuthService, AuthService>();
        services.AddScoped<IChatbotService, ChatbotService>();
        services.AddScoped<IGithubSyncService>(sp =>
            new GithubSyncService(
                sp.GetRequiredService<Domain.Interfaces.ITeamRepository>(),
                sp.GetRequiredService<Domain.Interfaces.IAgentTaskRepository>(),
                sp.GetRequiredService<IHttpClientFactory>(),
                config?["Github:Token"]));
        services.AddScoped<IRagIngestionService, RagIngestionService>();
        services.AddHttpClient("github", c =>
        {
            c.Timeout = TimeSpan.FromSeconds(30);
            c.DefaultRequestHeaders.Accept.Add(new System.Net.Http.Headers.MediaTypeWithQualityHeaderValue("application/vnd.github+json"));
        });
        return services;
    }
}

using Microsoft.Extensions.DependencyInjection;
using RALabs.Application.Services;

namespace RALabs.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.AddScoped<IProjectService, ProjectService>();
        services.AddScoped<ITeamService, TeamService>();
        services.AddScoped<IContentService, ContentService>();
        services.AddScoped<ILeadService, LeadService>();
        services.AddScoped<IChatService, ChatService>();
        services.AddScoped<IAuthService, AuthService>();
        return services;
    }
}

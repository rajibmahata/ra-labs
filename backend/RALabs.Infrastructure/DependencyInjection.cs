using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Tokens;
using RALabs.Application.Services;
using RALabs.Domain.Interfaces;
using RALabs.Infrastructure.Data;
using RALabs.Infrastructure.Services;
using System.Text;

namespace RALabs.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration config)
    {
        var conn = config.GetConnectionString("DefaultConnection");
        if (!string.IsNullOrWhiteSpace(conn))
        {
            services.AddDbContext<RALabsDbContext>(o => o.UseSqlServer(conn));
        }
        else
        {
            services.AddDbContext<RALabsDbContext>(o => o.UseInMemoryDatabase("RALabsDev"));
        }

        var jwtSecret = config["Jwt:Secret"];
        if (string.IsNullOrWhiteSpace(jwtSecret) || jwtSecret.Length < 32)
            throw new InvalidOperationException("Jwt:Secret must be configured with at least 32 characters.");
        var issuer = config["Jwt:Issuer"] ?? "RALabs";
        var audience = config["Jwt:Audience"] ?? "RALabs";

        services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
            .AddJwtBearer(o =>
            {
                o.MapInboundClaims = false;
                o.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidateIssuer = true,
                    ValidateAudience = true,
                    ValidateLifetime = true,
                    ValidateIssuerSigningKey = true,
                    ValidIssuer = issuer,
                    ValidAudience = audience,
                    IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret))
                };
            });

        services.AddScoped<IProjectRepository, ProjectRepository>();
        services.AddScoped<ITeamRepository, TeamRepository>();
        services.AddScoped<IContentRepository, ContentRepository>();
        services.AddScoped<ILeadRepository, LeadRepository>();
        services.AddScoped<IChatRepository, ChatRepository>();
        services.AddScoped<IAgentTaskRepository, AgentTaskRepository>();
        services.AddScoped<IAdminUserRepository, AdminUserRepository>();
        services.AddScoped<IKnowledgeChunkRepository, KnowledgeChunkRepository>();

        services.AddScoped<IPasswordHasher, PasswordHasher>();
        services.AddScoped<IJwtService>(_ => new JwtService(jwtSecret, issuer, audience));
        services.AddScoped<IEmailSender, EmailSender>();

        return services;
    }
}

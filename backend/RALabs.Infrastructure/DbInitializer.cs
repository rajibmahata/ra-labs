using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using RALabs.Application.Services;
using RALabs.Domain.Entities;
using RALabs.Domain.Enums;
using RALabs.Infrastructure.Data;

namespace RALabs.Infrastructure;

public static class DbInitializer
{
    /// <summary>Seed locales, admin accounts, team members, portfolio, and content keys.</summary>
    public static async Task InitializeAsync(IServiceProvider services, bool seedDemoContent)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<RALabsDbContext>();
        var logger = scope.ServiceProvider.GetRequiredService<ILoggerFactory>().CreateLogger("DbInitializer");
        var hasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher>();

        if (db.Database.IsRelational())
        {
            await db.Database.MigrateAsync();
        }
        else
        {
            await db.Database.EnsureCreatedAsync();
        }

        // ── Locales ──
        if (!await db.Locales.AnyAsync())
        {
            var locales = new[]
            {
                ("en", "English"), ("hi", "Hindi"), ("bn", "Bengali"), ("fr", "French"),
                ("es", "Spanish"), ("ar", "Arabic"), ("zh", "Chinese"), ("pt", "Portuguese"),
                ("de", "German"), ("ja", "Japanese"), ("ru", "Russian")
            };
            foreach (var (code, label) in locales)
                db.Locales.Add(new Locale { Code = code, Label = label });
            await db.SaveChangesAsync();
            logger.LogInformation("Seeded {Count} locales.", locales.Length);
        }

        // ── Admin accounts (Rajib + Abhishek) ──
        if (!await db.AdminUsers.AnyAsync())
        {
            var rajib = new TeamMember
            {
                Id = Guid.NewGuid(),
                Name = "Rajib Mahata",
                Slug = "rajib-mahata",
                Role = "Co-Founder & Senior .NET / Azure Engineer",
                Bio = "Independent software architect with 12+ years building production systems for Fortune 500 and enterprise clients. Specialises in .NET, Azure cloud, and AI/LLM integrations — delivering measurable impact: 30% faster processing, 40% fewer errors, 25% higher satisfaction on a national pharmacy platform that ran during the COVID-19 vaccine rollout.",
                GithubUsername = "rajibmahata",
                Email = "rajibmahata143@gmail.com",
                LinkedinUrl = "https://linkedin.com/in/rajib-mahata",
                Location = "Kolkata, India · Remote-first",
                IsPublished = true,
                CreatedAt = DateTime.UtcNow
            };
            var abhishek = new TeamMember
            {
                Id = Guid.NewGuid(),
                Name = "Abhishek Burnwal",
                Slug = "abhishek-burnwal",
                Role = "Co-Founder & Engineering Leader",
                Bio = "Engineering leader with ~10 years of experience across the Microsoft stack. Currently Associate Vice President at Tata Consultancy Services. Microsoft Certified: Azure AI Engineer Associate (AI-102). Passionate about .NET, cloud architecture, and building systems that ship.",
                GithubUsername = "abhishekburnwal",
                Email = null,
                LinkedinUrl = "https://www.linkedin.com/in/abhishek-burnwal-5b713751/",
                Location = "Asansol, West Bengal, India",
                IsPublished = true,
                CreatedAt = DateTime.UtcNow
            };
            db.TeamMembers.AddRange(rajib, abhishek);

            db.AdminUsers.AddRange(
                new AdminUser
                {
                    Id = Guid.NewGuid(),
                    Name = "Rajib Mahata",
                    Email = "rajib@ralabs.dev",
                    PasswordHash = hasher.Hash("Admin@1234"),
                    Role = "super_admin",
                    TeamMemberId = rajib.Id,
                    CreatedAt = DateTime.UtcNow
                },
                new AdminUser
                {
                    Id = Guid.NewGuid(),
                    Name = "Abhishek Burnwal",
                    Email = "abhishek@ralabs.dev",
                    PasswordHash = hasher.Hash("Admin@1234"),
                    Role = "admin",
                    TeamMemberId = abhishek.Id,
                    CreatedAt = DateTime.UtcNow
                });
            await db.SaveChangesAsync();
            logger.LogInformation("Seeded 2 team members + 2 admin accounts.");
        }

        // ── Portfolio ──
        if (!await db.Projects.AnyAsync())
        {
            var projects = new[]
            {
                ("LexVault", "lexvault", "Legal document intelligence — zero-LLM scoring, hybrid dense+sparse BM42 retrieval on Qdrant, on-prem Windows Server deployment.", new[]{"dotnet", "qdrant", "rag", "azure-openai", "hybrid-search"}, "wip", "https://github.com/rajibmahata/Legal-Document-RAG-System-LEXVAULT", "Legal document intelligence platform combining hybrid vector + BM42 search on Qdrant with a zero-LLM deterministic scoring layer."),
                ("DocSignerHub", "docsignerhub", "Enterprise electronic signature SaaS — multi-signer sequential & parallel workflows, HMAC-SHA256 token auth, AI clause analysis, full audit trail, white-label API.", new[]{"dotnet", "blazor", "azure", "sql-server", "stripe", "openai"}, "live", "https://github.com/rajibmahata/DocumentSigningPlatform", "Enterprise e-signature platform with 140+ REST endpoints, multi-signer workflows, and AI-powered clause analysis."),
                ("AI Student Tutor", "ai-student-tutor", "12 specialised AI agents, voice-first tutoring in 4 languages, Nursery to Class 12 curriculum.", new[]{"fastapi", "langgraph", "nextjs", "postgresql", "qdrant", "openai"}, "wip", "https://github.com/rajibmahata/Math-tutor-AI-Agent", "Voice-first AI tutoring platform with 12 specialised agents supporting 4 languages from Nursery to Class 12."),
                ("ARIA Platform", "aria-platform", "Enterprise AI knowledge platform — RAG architecture with no-code multi-agent pipeline builder. Hybrid vector + BM25 search, deployable on-premise with zero vendor lock-in.", new[]{"python", "fastapi", "rag", "chromadb", "langchain", "react"}, "wip", "https://github.com/rajibmahata/AI-Avatar-RAG-Platform", "Enterprise AI knowledge platform with no-code multi-agent pipeline builder and hybrid retrieval."),
                ("FoodFleet", "foodfleet", "Multi-branch restaurant delivery platform with location-aware menus and radius-validated delivery addresses.", new[]{"dotnet", "react", "azure", "sql-server", "typescript"}, "live", "https://github.com/rajibmahata/FoodFleet", "Reference architecture for multi-tenant restaurant platforms with branch radius validation."),
                ("MedRemind", "medremind", "AI-powered medication reminder app — two-stage OCR pipeline (Azure Document Intelligence + GPT-4o-mini) supporting 10 languages including full RTL.", new[]{"react-native", "fastapi", "azure", "gpt-4o-mini", "ocr"}, "live", "https://github.com/rajibmahata/MedRemind", "AI medication reminder with a two-stage OCR pipeline achieving higher accuracy than single-model OCR."),
                ("ArtForge", "artforge", "Agentic drawing portfolio with multi-agent validation — Duplicate Detector, Quality Validator, Originality Scorer.", new[]{"react", "fastapi", "claude", "chromadb", "rag"}, "live", "https://github.com/rajibmahata/ArtForge", "Agentic portfolio with multi-agent quality assurance at scale."),
                ("AI Resume Reviewer", "ai-resume-reviewer", "Seven-agent pipeline — ATS Scanner, Keyword Gap, Achievement Phrasing, Formatting, Industry Calibration, Role Matching, Rewrite — with RAG.", new[]{"dotnet", "react", "fastapi", "rag", "gpt-4o"}, "live", "https://github.com/rajibmahata/AIResumeReviewer", "Seven-agent resume review pipeline combining RAG with specialised review agents."),
                ("RajibLabs Platform", "rajiblabs-platform", "AI-powered portfolio and software lab — auto-populated from GitHub activity, managed by an agent workforce.", new[]{"react", "typescript", "tailwind", "dotnet", "openclaw"}, "live", "https://github.com/rajibmahata/rajiblabs-platform", "AI-managed portfolio platform that tracks live GitHub activity and runs the lab."),
                ("AgentTube (SahajSeva)", "agenttube-sahajseva", "Annapurna Yojana welfare form assistant in Bengali/Hindi/English for low-digital-literacy citizens.", new[]{"react", "pwa", "gpt-4o", "deepseek", "dotnet"}, "wip", "https://github.com/rajibmahata/AgentTube", "Government welfare accessibility assistant for low-digital-literacy citizens.")
            };
            foreach (var (title, slug, summary, tags, status, githubUrl, body) in projects)
            {
                db.Projects.Add(new Project
                {
                    Id = Guid.NewGuid(),
                    Title = title,
                    Slug = slug,
                    Summary = summary,
                    StackTags = tags.ToList(),
                    Status = status == "live" ? ProjectStatus.Live : ProjectStatus.InBuild,
                    GithubUrl = githubUrl,
                    CaseStudyBody = body,
                    IsPublished = true,
                    CreatedAt = DateTime.UtcNow
                });
            }
            await db.SaveChangesAsync();
            logger.LogInformation("Seeded {Count} portfolio projects.", projects.Length);
        }

        // ── Content keys (English only seeded by default; admins fill other locales in CMS) ──
        if (!await db.PageContents.AnyAsync())
        {
            var content = new Dictionary<string, string>
            {
                ["hero.headline"] = "We build backend systems and SaaS products that scale, perform, and ship.",
                ["hero.subheadline"] = "A two-founder engineering studio. 12+ years of production experience across Fortune 500 healthcare, enterprise telecom, and AI products.",
                ["hero.cta.primary"] = "Start a project",
                ["hero.cta.secondary"] = "See the work",
                ["process.step1.title"] = "Discuss",
                ["process.step1.body"] = "We listen to what you need and ask the right architecture questions upfront.",
                ["process.step2.title"] = "Sketch",
                ["process.step2.body"] = "We map the solution, scope, and timeline together.",
                ["process.step3.title"] = "Architect",
                ["process.step3.body"] = "Clean architecture from day one — SOLID, event-driven where it makes sense.",
                ["process.step4.title"] = "Build",
                ["process.step4.body"] = "Production-ready code with regular check-ins — you're never in the dark.",
                ["process.step5.title"] = "Refine",
                ["process.step5.body"] = "Delivery, documentation, and knowledge transfer. We don't disappear.",
                ["portfolio.title"] = "Selected work",
                ["team.title"] = "Meet the team",
                ["contact.title"] = "Have a project in mind? Let's talk.",
                ["contact.subtitle"] = "SaaS founders, agencies, and enterprises who need senior-level architecture and development.",
                ["contact.name"] = "Name",
                ["contact.email"] = "Email",
                ["contact.message"] = "Tell us about your project",
                ["contact.submit"] = "Send message",
                ["footer.tagline"] = "Ready to build something great?",
                ["nav.work"] = "Work",
                ["nav.process"] = "Process",
                ["nav.team"] = "Team",
                ["nav.contact"] = "Contact"
            };
            foreach (var (key, value) in content)
                db.PageContents.Add(new PageContent { Id = Guid.NewGuid(), Key = key, Locale = "en", Value = value });
            await db.SaveChangesAsync();
            logger.LogInformation("Seeded {Count} content keys.", content.Count);
        }
    }
}

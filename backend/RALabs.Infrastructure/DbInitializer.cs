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
                ["hero.eyebrow"] = "AI agent · engineering studio",
                ["hero.headline"] = "Describe the problem once. Our AI agent turns it into",
                ["hero.headlineHighlight"] = "a plan",
                ["hero.subheadline"] = "A two-founder engineering studio pairing senior engineering with an AI agent workforce. The agent answers questions about our work and collects your project brief for the team.",
                ["hero.cta.primary"] = "Ask the agent",
                ["hero.cta.secondary"] = "See the work",
                ["hero.cta.note"] = "Your conversation stays in this browser session until you create a private workspace.",
                ["cap.eyebrow"] = "The assistant",
                ["cap.title"] = "What the agent can do",
                ["cap.answers.title"] = "Answers about our work",
                ["cap.answers.body"] = "Portfolio, services, process and team — grounded in our indexed content and knowledge base.",
                ["cap.brief.title"] = "Collects your project brief",
                ["cap.brief.body"] = "A guided step-by-step intake; the finished brief goes to the team and can follow you into the portal.",
                ["cap.grounded.title"] = "Grounded, not invented",
                ["cap.grounded.body"] = "Retrieval-augmented answers. The agent says so when it does not know — no made-up facts.",
                ["cap.private.title"] = "Private by default",
                ["cap.private.body"] = "The conversation lives in a session-scoped thread. No ads, no tracking, no sharing.",
                ["pipeline.eyebrow"] = "How it works",
                ["pipeline.title"] = "From first question to working plan",
                ["pipeline.ask.title"] = "Ask",
                ["pipeline.ask.body"] = "Type any question about our work, or describe the project you want to build.",
                ["pipeline.grounded.title"] = "Grounded reply",
                ["pipeline.grounded.body"] = "The agent answers from our indexed portfolio and knowledge — never invented.",
                ["pipeline.brief.title"] = "Brief collection",
                ["pipeline.brief.body"] = "Say \"create a project\" and the agent walks you through goal, users, features, timeline and budget.",
                ["pipeline.handoff.title"] = "Handoff",
                ["pipeline.handoff.body"] = "The brief reaches the team. Continue privately in a customer workspace when you are ready.",
                ["pipeline.bridge.eyebrow"] = "Your first brief",
                ["pipeline.bridge.body"] = "Bring a goal, the people it serves, the capabilities you need, a target timeline, and any constraints or references. The agent will help you shape the rest.",
                ["privacy.eyebrow"] = "Conversation privacy",
                ["privacy.title"] = "A private workspace, not a public comment box",
                ["privacy.body"] = "Your conversation is kept in a session-scoped thread that only the RA Labs team can read. When you register, the thread moves into your project workspace so the brief and the conversation stay together.",
                ["privacy.check.thread"] = "Session-scoped thread, no public history",
                ["privacy.check.attachments"] = "Attachments stored privately, never published",
                ["privacy.check.team"] = "Only the studio team can read your conversation",
                ["privacy.check.portal"] = "Continue securely in the customer portal",
                ["agent.welcome"] = "Hi! I'm the R&A Labs assistant. Ask about our work, services and process — or tell me about your project and I'll collect a brief for the team.",
                ["agent.status.online"] = "Online — replies in seconds",
                ["agent.status.offline"] = "Temporarily offline",
                ["agent.composer.placeholder"] = "Ask the agent or describe your project…",
                ["agent.draft.label"] = "Draft",
                ["agent.draft.final"] = "Sent",
                ["agent.draft.finalized"] = "Finalized",
                ["agent.draft.finalizing"] = "Finalizing…",
                ["agent.typing"] = "Agent is responding",
                ["agent.copy"] = "Copy",
                ["agent.copied"] = "Copied",
                ["agent.loadFailed"] = "Could not reach the assistant right now. Please try again later.",
                ["agent.sessionExpired"] = "Session expired. Send your message again and a new conversation will start.",
                ["agent.rateLimited"] = "You are sending messages too quickly. Please wait a moment.",
                ["agent.sendFailed"] = "Failed to send the message. Please try again.",
                ["agent.uploadFailed"] = "Could not upload the file.",
                ["agent.copyFailed"] = "Could not copy the message.",
                ["agent.handoff.body"] = "Want to track this request? Continue in the customer portal.",
                ["agent.handoff.cta"] = "Open customer portal",
                ["agent.starters.label"] = "Conversation starters",
                ["agent.starters.create"] = "Create a project",
                ["agent.starters.about"] = "Tell me about RA Labs",
                ["agent.starters.work"] = "Explore projects",
                ["agent.starters.contact"] = "Contact us",
                ["agent.page.subtitle"] = "Ask about our work, services and process — or let the agent collect your project brief.",
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

        // ── System settings (AI & voice defaults) ──
        if (!await db.SystemSettings.AnyAsync())
        {
            var defaults = new Dictionary<string, string>
            {
                ["ai.voice.enabled"] = "false",
                ["ai.voice.response"] = "false",
                ["ai.streaming.enabled"] = "false",
                ["ai.chat.model"] = "gpt-4o-mini",
                ["ai.stt.provider"] = "",
                ["ai.tts.provider"] = "",
                ["ai.max.audio.duration"] = "60"
            };
            foreach (var (key, value) in defaults)
                db.SystemSettings.Add(new SystemSetting { Id = Guid.NewGuid(), Key = key, Value = value, UpdatedAt = DateTime.UtcNow });
            await db.SaveChangesAsync();
            logger.LogInformation("Seeded {Count} system settings.", defaults.Count);
        }
    }
}

using Microsoft.EntityFrameworkCore;
using RALabs.Domain.Entities;
using RALabs.Domain.Enums;

namespace RALabs.Infrastructure.Data;

public class RALabsDbContext : DbContext
{
    public RALabsDbContext(DbContextOptions<RALabsDbContext> options) : base(options) { }

    public DbSet<AdminUser> AdminUsers => Set<AdminUser>();
    public DbSet<Project> Projects => Set<Project>();
    public DbSet<TeamMember> TeamMembers => Set<TeamMember>();
    public DbSet<GithubSnapshot> GithubSnapshots => Set<GithubSnapshot>();
    public DbSet<Locale> Locales => Set<Locale>();
    public DbSet<PageContent> PageContents => Set<PageContent>();
    public DbSet<Lead> Leads => Set<Lead>();
    public DbSet<AdminNotification> AdminNotifications => Set<AdminNotification>();
    public DbSet<ChatThread> ChatThreads => Set<ChatThread>();
    public DbSet<ChatMessage> ChatMessages => Set<ChatMessage>();
    public DbSet<AgentTask> AgentTasks => Set<AgentTask>();
    public DbSet<KnowledgeChunk> KnowledgeChunks => Set<KnowledgeChunk>();
    public DbSet<Customer> Customers => Set<Customer>();
    public DbSet<CustomerProject> CustomerProjects => Set<CustomerProject>();
    public DbSet<Document> Documents => Set<Document>();
    public DbSet<ClientPrd> ClientPrds => Set<ClientPrd>();
    public DbSet<Demo> Demos => Set<Demo>();
    public DbSet<Invoice> Invoices => Set<Invoice>();
    public DbSet<Feedback> Feedbacks => Set<Feedback>();
    public DbSet<ContentDraft> ContentDrafts => Set<ContentDraft>();
    public DbSet<GithubRepository> GithubRepositories => Set<GithubRepository>();
    public DbSet<SystemSetting> SystemSettings => Set<SystemSetting>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        // AdminUser
        b.Entity<AdminUser>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.Name).HasMaxLength(100).IsRequired();
            e.Property(x => x.Email).HasMaxLength(200).IsRequired();
            e.Property(x => x.Role).HasMaxLength(30).IsRequired();
            e.HasIndex(x => x.Email).IsUnique();
            e.Property(x => x.PasswordHash).IsRequired();
            e.Property(x => x.RefreshTokenHash).HasMaxLength(500);
            e.Property(x => x.PasswordResetToken).HasMaxLength(100);
            e.HasOne(x => x.TeamMember).WithOne().HasForeignKey<AdminUser>(x => x.TeamMemberId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        // Project
        b.Entity<Project>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.Title).HasMaxLength(200).IsRequired();
            e.Property(x => x.Slug).HasMaxLength(100).IsRequired();
            e.HasIndex(x => x.Slug).IsUnique();
            e.Property(x => x.Summary).HasMaxLength(500).IsRequired();
            e.Property(x => x.StackTags).HasColumnType("nvarchar(max)");
            e.Property(x => x.Status).HasConversion<string>().HasMaxLength(20);
            e.Property(x => x.GithubUrl).HasMaxLength(500);
            e.Property(x => x.LiveSiteUrl).HasMaxLength(500);
            e.Property(x => x.Category).HasMaxLength(100);
            e.Property(x => x.BusinessPurpose).HasColumnType("nvarchar(max)");
            e.Property(x => x.ProblemSolved).HasColumnType("nvarchar(max)");
            e.Property(x => x.Solution).HasColumnType("nvarchar(max)");
            e.Property(x => x.KeyFeatures).HasColumnType("nvarchar(max)");
            e.Property(x => x.CaseStudyBody).HasColumnType("nvarchar(max)");
            e.Property(x => x.CoverImageUrl).HasMaxLength(500);
            e.Property(x => x.Screenshots).HasColumnType("nvarchar(max)");
            e.Property(x => x.Duration).HasMaxLength(100);
            e.Property(x => x.TeamMemberIds).HasColumnType("nvarchar(max)");
            e.Property(x => x.CustomerReference).HasMaxLength(200);
        });

        b.Entity<ContentDraft>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.Kind).HasMaxLength(30).IsRequired();
            e.Property(x => x.Title).HasMaxLength(200).IsRequired();
            e.Property(x => x.Summary).HasMaxLength(500).IsRequired();
            e.Property(x => x.Status).HasMaxLength(20).IsRequired();
            e.Property(x => x.SourceUrl).HasMaxLength(500);
            e.HasIndex(x => new { x.Status, x.CreatedAt });
        });

        b.Entity<GithubRepository>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.Owner).HasMaxLength(100).IsRequired();
            e.Property(x => x.Name).HasMaxLength(200).IsRequired();
            e.Property(x => x.FullName).HasMaxLength(300).IsRequired();
            e.Property(x => x.HtmlUrl).HasMaxLength(500).IsRequired();
            e.Property(x => x.PrimaryLanguage).HasMaxLength(100);
            e.HasIndex(x => x.FullName).IsUnique();
        });

        b.Entity<SystemSetting>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.Key).HasMaxLength(100).IsRequired();
            e.Property(x => x.Value).HasMaxLength(2000).IsRequired();
            e.HasIndex(x => x.Key).IsUnique();
        });

        b.Entity<AuditLog>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.ActorName).HasMaxLength(200);
            e.Property(x => x.Action).HasMaxLength(100).IsRequired();
            e.Property(x => x.EntityType).HasMaxLength(100);
            e.Property(x => x.EntityId).HasMaxLength(100);
            e.Property(x => x.Details).HasMaxLength(4000);
            e.Property(x => x.IpAddress).HasMaxLength(64);
            e.HasIndex(x => new { x.CreatedAt });
        });

        // TeamMember
        b.Entity<TeamMember>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.Name).HasMaxLength(100).IsRequired();
            e.Property(x => x.Slug).HasMaxLength(100).IsRequired();
            e.HasIndex(x => x.Slug).IsUnique();
            e.Property(x => x.Role).HasMaxLength(100).IsRequired();
            e.Property(x => x.GithubUsername).HasMaxLength(100);
            e.Property(x => x.GithubAccountUrl).HasMaxLength(500);
            e.Property(x => x.GithubTokenEncrypted).HasMaxLength(4000);
            e.Property(x => x.AvatarUrl).HasMaxLength(500);
            e.Property(x => x.Email).HasMaxLength(200);
            e.Property(x => x.LinkedinUrl).HasMaxLength(500);
            e.HasMany(x => x.GithubSnapshots).WithOne(s => s.TeamMember)
                .HasForeignKey(s => s.TeamMemberId).OnDelete(DeleteBehavior.Cascade);
        });

        // GithubSnapshot
        b.Entity<GithubSnapshot>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasIndex(x => new { x.TeamMemberId, x.CapturedAt });
        });

        // Locale
        b.Entity<Locale>(e =>
        {
            e.HasKey(x => x.Code);
            e.Property(x => x.Code).HasMaxLength(10);
            e.Property(x => x.Label).HasMaxLength(50);
        });

        // PageContent
        b.Entity<PageContent>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.Key).HasMaxLength(200).IsRequired();
            e.Property(x => x.Locale).HasMaxLength(10).IsRequired();
            e.HasIndex(x => new { x.Key, x.Locale }).IsUnique();
        });

        // Lead
        b.Entity<Lead>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.Name).HasMaxLength(100).IsRequired();
            e.Property(x => x.ContactInfo).HasMaxLength(200).IsRequired();
            e.Property(x => x.Message).HasMaxLength(2000).IsRequired();
            e.Property(x => x.Status).HasConversion<string>().HasMaxLength(20);
            e.Property(x => x.Source).HasConversion<string>().HasMaxLength(20);
            e.HasIndex(x => x.Status);
            e.HasOne(x => x.ChatThread).WithOne().HasForeignKey<Lead>(x => x.ChatThreadId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        // Admin notifications
        b.Entity<AdminNotification>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.Type).HasMaxLength(40).IsRequired();
            e.Property(x => x.Title).HasMaxLength(200).IsRequired();
            e.Property(x => x.Message).HasMaxLength(1000).IsRequired();
            e.HasIndex(x => new { x.IsRead, x.CreatedAt });
        });

        // ChatThread / ChatMessage
        b.Entity<ChatThread>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.Type).HasConversion<string>().HasMaxLength(20);
        });
        b.Entity<ChatMessage>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.SenderType).HasConversion<string>().HasMaxLength(20);
            e.Property(x => x.Content).HasMaxLength(5000).IsRequired();
            e.Property(x => x.AttachmentUrl).HasMaxLength(500);
            e.HasIndex(x => new { x.ThreadId, x.CreatedAt });
            e.HasOne(x => x.Thread).WithMany(t => t.Messages)
                .HasForeignKey(x => x.ThreadId).OnDelete(DeleteBehavior.Cascade);
        });

        // AgentTask
        b.Entity<AgentTask>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.Type).HasMaxLength(50).IsRequired();
            e.Property(x => x.Status).HasConversion<string>().HasMaxLength(20);
            e.HasIndex(x => new { x.Type, x.Status, x.CreatedAt });
        });

        // KnowledgeChunk
        b.Entity<KnowledgeChunk>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.SourceType).HasConversion<string>().HasMaxLength(30);
            e.Property(x => x.SourceId).HasMaxLength(100);
            e.Property(x => x.Locale).HasMaxLength(10);
            e.HasIndex(x => new { x.CustomerProjectId, x.SourceType });
        });

        // Customer
        b.Entity<Customer>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.Email).HasMaxLength(200).IsRequired();
            e.HasIndex(x => x.Email).IsUnique();
            e.Property(x => x.Name).HasMaxLength(100).IsRequired();
            e.Property(x => x.RefreshTokenHash).HasMaxLength(500);
            e.Property(x => x.PasswordResetToken).HasMaxLength(100);
            e.HasIndex(x => x.LeadId);
            e.HasOne<Lead>().WithOne().HasForeignKey<Customer>(x => x.LeadId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        // CustomerProject
        b.Entity<CustomerProject>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.Title).HasMaxLength(200).IsRequired();
            e.Property(x => x.Goal).HasMaxLength(5000);
            e.Property(x => x.Audience).HasMaxLength(1000);
            e.Property(x => x.Requirements).HasMaxLength(10000);
            e.Property(x => x.Timeline).HasMaxLength(500);
            e.Property(x => x.BudgetOrConstraints).HasMaxLength(1000);
            e.Property(x => x.ReferenceLinks).HasMaxLength(3000);
            e.Property(x => x.Status).HasConversion<string>().HasMaxLength(20);
            e.HasOne(x => x.Customer).WithMany(c => c.Projects)
                .HasForeignKey(x => x.CustomerId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.ClientPrd).WithOne(p => p.CustomerProject)
                .HasForeignKey<ClientPrd>(p => p.CustomerProjectId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.Feedback).WithOne(f => f.CustomerProject)
                .HasForeignKey<Feedback>(f => f.CustomerProjectId).OnDelete(DeleteBehavior.Cascade);
        });

        // Document
        b.Entity<Document>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.FileName).HasMaxLength(255).IsRequired();
            e.Property(x => x.FileUrl).HasMaxLength(1000).IsRequired();
            e.Property(x => x.StorageKey).HasMaxLength(500).IsRequired();
            e.Property(x => x.ContentType).HasMaxLength(100).IsRequired();
            e.HasOne(x => x.CustomerProject).WithMany(p => p.Documents)
                .HasForeignKey(x => x.CustomerProjectId).OnDelete(DeleteBehavior.Cascade);
        });

        // ClientPrd
        b.Entity<ClientPrd>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.Status).HasConversion<string>().HasMaxLength(20);
            e.Property(x => x.SignerNameCustomer).HasMaxLength(100);
            e.Property(x => x.SignerNameAdmin).HasMaxLength(100);
        });

        // Demo
        b.Entity<Demo>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.Type).HasMaxLength(20).IsRequired();
            e.Property(x => x.UrlOrAsset).HasMaxLength(500).IsRequired();
            e.HasOne(x => x.CustomerProject).WithMany(p => p.Demos)
                .HasForeignKey(x => x.CustomerProjectId).OnDelete(DeleteBehavior.Cascade);
        });

        // Invoice
        b.Entity<Invoice>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.Currency).HasMaxLength(3).IsRequired();
            e.Property(x => x.Status).HasConversion<string>().HasMaxLength(20);
            e.Property(x => x.Amount).HasPrecision(18, 2);
            e.HasOne(x => x.CustomerProject).WithMany(p => p.Invoices)
                .HasForeignKey(x => x.CustomerProjectId).OnDelete(DeleteBehavior.Cascade);
        });

        // Feedback
        b.Entity<Feedback>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.Comment).HasMaxLength(2000).IsRequired();
            e.HasIndex(x => new { x.CustomerProjectId, x.IsPublished });
        });
    }
}

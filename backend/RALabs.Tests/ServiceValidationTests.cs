using Microsoft.EntityFrameworkCore;
using RALabs.Application.DTOs;
using RALabs.Application.Exceptions;
using RALabs.Application.Services;
using RALabs.Domain.Enums;
using RALabs.Infrastructure.Data;
using RALabs.Infrastructure.Services;

namespace RALabs.Tests;

/// <summary>Service-layer validation via an in-memory EF context (provider-agnostic,
/// no SQL Express required in CI).</summary>
public class ServiceValidationTests : IDisposable
{
    private readonly RALabsDbContext _db;
    private readonly IPasswordHasher _hasher = new PasswordHasher();

    public ServiceValidationTests()
    {
        var options = new DbContextOptionsBuilder<RALabsDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        _db = new RALabsDbContext(options);
    }

    public void Dispose() => _db.Dispose();

    private async Task SeedBaselineAsync()
    {
        _db.AdminUsers.Add(new Domain.Entities.AdminUser
        {
            Id = Guid.NewGuid(),
            Name = "Rajib Mahata",
            Email = "rajib@ralabs.dev",
            PasswordHash = _hasher.Hash("Admin@1234"),
            CreatedAt = DateTime.UtcNow
        });
        await _db.SaveChangesAsync();
    }

    [Fact]
    public async Task ProjectService_Create_MissingTitle_ThrowsValidation()
    {
        var svc = new ProjectService(new ProjectRepository(_db));
        await Assert.ThrowsAsync<ValidationException>(() =>
            svc.CreateAsync(new CreateProjectRequest("", null, "summary", null, null, null, null, null, null, null)));
    }

    [Fact]
    public async Task ProjectService_Create_DuplicateSlug_ThrowsConflict()
    {
        await _db.Projects.AddAsync(new Domain.Entities.Project
        {
            Id = Guid.NewGuid(), Title = "LexVault", Slug = "lexvault", Summary = "x", IsPublished = true
        });
        await _db.SaveChangesAsync();

        var svc = new ProjectService(new ProjectRepository(_db));
        await Assert.ThrowsAsync<ConflictException>(() =>
            svc.CreateAsync(new CreateProjectRequest("LexVault Again", "lexvault", "summary", null, null, null, null, null, null, null)));
    }

    [Fact]
    public async Task ProjectService_GetUnpublishedSlug_ThrowsNotFound()
    {
        await _db.Projects.AddAsync(new Domain.Entities.Project
        {
            Id = Guid.NewGuid(), Title = "Draft", Slug = "draft", Summary = "x", IsPublished = false
        });
        await _db.SaveChangesAsync();

        var svc = new ProjectService(new ProjectRepository(_db));
        await Assert.ThrowsAsync<NotFoundException>(() => svc.GetBySlugAsync("draft"));
    }

    [Fact]
    public async Task LeadService_InvalidContact_ThrowsValidation()
    {
        var svc = new LeadService(new LeadRepository(_db));
        await Assert.ThrowsAsync<ValidationException>(() =>
            svc.CreateAsync(new CreateLeadRequest("Jane", "not-a-contact", "message", "form")));
    }

    [Fact]
    public async Task LeadService_ValidContact_Creates()
    {
        var svc = new LeadService(new LeadRepository(_db));
        var lead = await svc.CreateAsync(new CreateLeadRequest("Jane", "+91 98765 43210", "message", "form"));
        Assert.Equal("new", lead.Status);
        Assert.Equal("form", lead.Source);
    }

    [Fact]
    public async Task AuthService_Login_InvalidPassword_ThrowsUnauthorized()
    {
        await SeedBaselineAsync();
        var admins = new AdminUserRepository(_db);
        var svc = new AuthService(admins, _hasher, new JwtService("RALabs_Test_Secret_Key_2026_MinLength32!", "RALabs", "RALabs"));
        await Assert.ThrowsAsync<RALabs.Application.Exceptions.UnauthorizedAccessException>(() =>
            svc.LoginAsync(new LoginRequest("rajib@ralabs.dev", "wrong-password")));
    }

    [Fact]
    public async Task AuthService_Login_Valid_ReturnsToken()
    {
        await SeedBaselineAsync();
        var svc = new AuthService(new AdminUserRepository(_db), _hasher,
            new JwtService("RALabs_Test_Secret_Key_2026_MinLength32!", "RALabs", "RALabs"));
        var result = await svc.LoginAsync(new LoginRequest("rajib@ralabs.dev", "Admin@1234"));
        Assert.False(string.IsNullOrWhiteSpace(result.AccessToken));
        Assert.Equal("admin", result.User.Role);
    }

    [Fact]
    public async Task AuthService_CreateAdmin_DuplicateEmail_ThrowsConflict()
    {
        await SeedBaselineAsync();
        var svc = new AuthService(new AdminUserRepository(_db), _hasher,
            new JwtService("RALabs_Test_Secret_Key_2026_MinLength32!", "RALabs", "RALabs"));
        await Assert.ThrowsAsync<ConflictException>(() =>
            svc.CreateAdminAsync(new CreateAdminRequest("X", "rajib@ralabs.dev", "Password123!", null), Guid.NewGuid()));
    }

    [Fact]
    public async Task ChatService_SendMessage_EmptyContent_ThrowsValidation()
    {
        var svc = new ChatService(new ChatRepository(_db), new ChatbotService(new KnowledgeChunkRepository(_db)), new LeadRepository(_db));
        await Assert.ThrowsAsync<ValidationException>(() =>
            svc.SendMessageAsync(Guid.NewGuid(), new SendMessageRequest("", null), "visitor", null));
    }

    [Fact]
    public async Task ChatService_SendMessage_UnknownThread_ThrowsNotFound()
    {
        var svc = new ChatService(new ChatRepository(_db), new ChatbotService(new KnowledgeChunkRepository(_db)), new LeadRepository(_db));
        await Assert.ThrowsAsync<NotFoundException>(() =>
            svc.SendMessageAsync(Guid.NewGuid(), new SendMessageRequest("hello", null), "visitor", null));
    }

    [Fact]
    public async Task ChatService_VisitorTransactional_FlagsThread()
    {
        var chatRepo = new ChatRepository(_db);
        var thread = await chatRepo.CreateThreadAsync(new Domain.Entities.ChatThread
        {
            Id = Guid.NewGuid(), Type = ChatThreadType.Lead, CreatedAt = DateTime.UtcNow
        });
        var svc = new ChatService(chatRepo, new ChatbotService(new KnowledgeChunkRepository(_db)), new LeadRepository(_db));

        var result = await svc.SendMessageAsync(thread.Id, new SendMessageRequest("What is the price?", null), "visitor", null);
        Assert.True(result.NeedsManualIntervention);
    }
}

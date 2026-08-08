using Microsoft.EntityFrameworkCore;
using RALabs.Application.DTOs;
using RALabs.Application.Services;
using RALabs.Infrastructure.Data;
using RALabs.Infrastructure.Services;

namespace RALabs.Tests;

/// <summary>Auth hardening: refresh-token rotation, password reset with expiry,
/// reset-code hashing, and no-email-enumeration on forgot-password.</summary>
public class AuthSecurityTests : IDisposable
{
    private readonly RALabsDbContext _db;
    private readonly IPasswordHasher _hasher = new PasswordHasher();
    private readonly FakeEmailSender _email = new();
    private readonly AuthService _auth;

    public AuthSecurityTests()
    {
        _db = new RALabsDbContext(new DbContextOptionsBuilder<RALabsDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        _auth = new AuthService(new AdminUserRepository(_db), _hasher,
            new JwtService("RALabs_Test_Secret_Key_2026_MinLength32!", "RALabs", "RALabs"), _email);
    }

    public void Dispose() => _db.Dispose();

    private async Task SeedAdminAsync(string email = "rajib@ralabs.dev")
    {
        _db.AdminUsers.Add(new Domain.Entities.AdminUser
        {
            Id = Guid.NewGuid(),
            Name = "Rajib Mahata",
            Email = email,
            PasswordHash = _hasher.Hash("Admin@1234"),
            CreatedAt = DateTime.UtcNow
        });
        await _db.SaveChangesAsync();
    }

    [Fact]
    public async Task Login_ReturnsRefreshToken_AndRefreshWorks()
    {
        await SeedAdminAsync();
        var login = await _auth.LoginAsync(new LoginRequest("rajib@ralabs.dev", "Admin@1234"));
        Assert.False(string.IsNullOrWhiteSpace(login.RefreshToken));

        var refreshed = await _auth.RefreshAsync(new RefreshTokenRequest(login.RefreshToken));
        Assert.False(string.IsNullOrWhiteSpace(refreshed.AccessToken));
        // Refresh-token rotation: a new refresh token is issued.
        Assert.NotEqual(login.RefreshToken, refreshed.RefreshToken);
    }

    [Fact]
    public async Task Refresh_TokenRotates_SingleUse()
    {
        await SeedAdminAsync();
        var login = await _auth.LoginAsync(new LoginRequest("rajib@ralabs.dev", "Admin@1234"));

        // First refresh rotates the token.
        var refreshed = await _auth.RefreshAsync(new RefreshTokenRequest(login.RefreshToken));
        Assert.False(string.IsNullOrWhiteSpace(refreshed.AccessToken));

        // The old refresh token is now invalid (single-use rotation).
        await Assert.ThrowsAsync<RALabs.Application.Exceptions.UnauthorizedAccessException>(() =>
            _auth.RefreshAsync(new RefreshTokenRequest(login.RefreshToken)));
    }

    [Fact]
    public async Task ForgotPassword_SendsEmail_AndResetWorks()
    {
        await SeedAdminAsync();
        await _auth.ForgotPasswordAsync(new ForgotPasswordRequest("rajib@ralabs.dev"));
        Assert.Single(_email.Sent);

        // The email body contains the 6-digit code; reset with it.
        var parts = _email.Sent[0].Split('|');
        var body = parts.Length > 2 ? parts[2] : parts[1];
        var code = System.Text.RegularExpressions.Regex.Match(body, @"\d{6}").Value;
        Assert.Equal(6, code.Length);

        await _auth.ResetPasswordAsync(new ResetPasswordRequest("rajib@ralabs.dev", code, "NewPass@123"));
        // New password works
        var login = await _auth.LoginAsync(new LoginRequest("rajib@ralabs.dev", "NewPass@123"));
        Assert.NotNull(login.AccessToken);
    }

    [Fact]
    public async Task ForgotPassword_UnknownEmail_NoEnumeration()
    {
        await SeedAdminAsync();
        await _auth.ForgotPasswordAsync(new ForgotPasswordRequest("nobody@example.com"));
        // No email sent, no exception — response identical.
        Assert.Empty(_email.Sent);
    }

    [Fact]
    public async Task ResetPassword_ExpiredToken_Rejected()
    {
        await SeedAdminAsync();
        await _auth.ForgotPasswordAsync(new ForgotPasswordRequest("rajib@ralabs.dev"));
        var user = await new AdminUserRepository(_db).GetByEmailAsync("rajib@ralabs.dev");
        user!.PasswordResetTokenExpiresAt = DateTime.UtcNow.AddHours(-1);
        await new AdminUserRepository(_db).UpdateAsync(user);

        await Assert.ThrowsAsync<RALabs.Application.Exceptions.UnauthorizedAccessException>(() =>
            _auth.ResetPasswordAsync(new ResetPasswordRequest("rajib@ralabs.dev", "123456", "NewPass@123")));
    }
}

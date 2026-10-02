using RALabs.Application.Common;
using RALabs.Application.DTOs;
using RALabs.Application.Exceptions;
using RALabs.Domain.Entities;
using RALabs.Domain.Interfaces;
using System.Security.Cryptography;

namespace RALabs.Application.Services;

public interface IPasswordHasher
{
    string Hash(string password);
    bool Verify(string password, string hash);
}

public interface IJwtService
{
    string GenerateToken(AdminUser user, string role);
    string GenerateToken(Guid userId, string name, string email, string role);
    string GenerateRefreshToken();
}

public interface IAuthService
{
    Task<LoginResponse> LoginAsync(LoginRequest request);
    Task<LoginResponse> RefreshAsync(RefreshTokenRequest request);
    Task ForgotPasswordAsync(ForgotPasswordRequest request);
    Task ResetPasswordAsync(ResetPasswordRequest request);
    Task<AdminUserDto> CreateAdminAsync(CreateAdminRequest request, Guid actorId);
    Task<List<AdminUserDto>> GetAdminsAsync();
    Task<AdminUserDto> SetActiveAsync(Guid id, bool isActive, Guid actorId);
}

public record CreateAdminRequest(string Name, string Email, string Password, Guid? TeamMemberId, string? Role = null);

public class AuthService : IAuthService
{
    private readonly IAdminUserRepository _admins;
    private readonly IPasswordHasher _hasher;
    private readonly IJwtService _jwt;
    private readonly IEmailSender _email;

    public AuthService(IAdminUserRepository admins, IPasswordHasher hasher, IJwtService jwt, IEmailSender email)
    {
        _admins = admins;
        _hasher = hasher;
        _jwt = jwt;
        _email = email;
    }

    public async Task<LoginResponse> LoginAsync(LoginRequest request)
    {
        Guard.Reset();
        Guard.Email(request.Email, "email");
        Guard.Required(request.Password, "password", 100);
        Guard.ThrowIfAny("login");

        var user = await _admins.GetByEmailAsync(request.Email.Trim().ToLowerInvariant());
        if (user is null || !_hasher.Verify(request.Password, user.PasswordHash))
            throw new Exceptions.UnauthorizedAccessException("Invalid email or password.");
        if (!user.IsActive)
            throw new Exceptions.ForbiddenAccessException("This account has been disabled.");

        return await IssueTokensAsync(user);
    }

    public async Task<LoginResponse> RefreshAsync(RefreshTokenRequest request)
    {
        Guard.Reset();
        Guard.Required(request.RefreshToken, "refreshToken", 500);
        Guard.ThrowIfAny("refresh");

        // Find the account that holds this (hashed) refresh token.
        var hash = HashToken(request.RefreshToken);
        var user = await _admins.GetByRefreshTokenHashAsync(hash)
            ?? throw new Exceptions.UnauthorizedAccessException("Invalid refresh token.");

        if (!user.IsActive)
            throw new Exceptions.ForbiddenAccessException("This account has been disabled.");
        if (user.RefreshTokenExpiresAt is null || DateTime.UtcNow > user.RefreshTokenExpiresAt.Value)
            throw new Exceptions.UnauthorizedAccessException("Refresh token has expired. Please log in again.");

        // Rotate: issue a fresh token set, invalidating the old refresh token.
        return await IssueTokensAsync(user);
    }

    public async Task ForgotPasswordAsync(ForgotPasswordRequest request)
    {
        Guard.Reset();
        Guard.Email(request.Email, "email", 200);
        Guard.ThrowIfAny("password reset");

        var user = await _admins.GetByEmailAsync(request.Email.Trim().ToLowerInvariant());
        // Always return success (no email enumeration).
        if (user is null) return;

        var token = Random.Shared.Next(100000, 999999).ToString();
        user.PasswordResetToken = HashToken(token);
        user.PasswordResetTokenExpiresAt = DateTime.UtcNow.AddHours(1);
        await _admins.UpdateAsync(user);

        try
        {
            await _email.SendAsync(user.Email, user.Name, "Reset your R&A Labs password",
                BuildResetEmail(token, user.Name));
        }
        catch
        {
            user.PasswordResetToken = null;
            user.PasswordResetTokenExpiresAt = null;
            await _admins.UpdateAsync(user);
            throw;
        }
    }

    public async Task ResetPasswordAsync(ResetPasswordRequest request)
    {
        Guard.Reset();
        Guard.Email(request.Email, "email", 200);
        Guard.Required(request.Token, "token", 20);
        Guard.Password(request.NewPassword);
        Guard.ThrowIfAny("password reset");

        var user = await _admins.GetByEmailAsync(request.Email.Trim().ToLowerInvariant())
            ?? throw new Exceptions.UnauthorizedAccessException("Invalid reset request.");

        if (user.PasswordResetToken is null
            || !CryptographicOperations.FixedTimeEquals(
                System.Text.Encoding.UTF8.GetBytes(user.PasswordResetToken),
                System.Text.Encoding.UTF8.GetBytes(HashToken(request.Token))))
            throw new Exceptions.UnauthorizedAccessException("Invalid or expired reset token.");

        if (user.PasswordResetTokenExpiresAt is null || DateTime.UtcNow > user.PasswordResetTokenExpiresAt.Value)
            throw new Exceptions.UnauthorizedAccessException("Reset token has expired. Please request a new one.");

        user.PasswordHash = _hasher.Hash(request.NewPassword);
        user.PasswordResetToken = null;
        user.PasswordResetTokenExpiresAt = null;
        await _admins.UpdateAsync(user);
    }

    public async Task<AdminUserDto> CreateAdminAsync(CreateAdminRequest request, Guid actorId)
    {
        Guard.Reset();
        Guard.Required(request.Name, "name", 100);
        Guard.Email(request.Email, "email", 200);
        Guard.Password(request.Password);
        Guard.ThrowIfAny("admin account");

        // Role enforcement: super_admin is granted only by an existing super_admin
        // (checked at the route level); the service hard-defaults to "admin".
        var role = string.IsNullOrWhiteSpace(request.Role) ? "admin" : request.Role.Trim().ToLowerInvariant();
        if (role is not ("admin" or "super_admin"))
            throw new Exceptions.ValidationException("Role must be \"admin\" or \"super_admin\".");

        var actor = await _admins.GetByIdAsync(actorId);
        if (role == "super_admin" && actor?.Role != "super_admin")
            throw new Exceptions.ForbiddenAccessException("Only a super admin can grant the super_admin role.");

        var email = request.Email.Trim().ToLowerInvariant();
        if (await _admins.EmailExistsAsync(email))
            throw new Exceptions.ConflictException("An account with this email already exists.");

        var user = new AdminUser
        {
            Id = Guid.NewGuid(),
            Name = request.Name.Trim(),
            Email = email,
            Role = role,
            PasswordHash = _hasher.Hash(request.Password),
            TeamMemberId = request.TeamMemberId,
            CreatedAt = DateTime.UtcNow
        };
        var id = await _admins.AddAsync(user);
        user.Id = id;
        return ToDto(user);
    }

    public async Task<List<AdminUserDto>> GetAdminsAsync()
    {
        var admins = await _admins.GetAllAsync();
        return admins.Select(ToDto).ToList();
    }

    public async Task<AdminUserDto> SetActiveAsync(Guid id, bool isActive, Guid actorId)
    {
        if (id == actorId)
            throw new Exceptions.ForbiddenAccessException("You cannot deactivate your own account.");

        var user = await _admins.GetByIdAsync(id)
            ?? throw new Exceptions.NotFoundException("Admin account not found.");
        user.IsActive = isActive;
        if (!isActive)
        {
            user.RefreshTokenHash = null;
            user.RefreshTokenExpiresAt = null;
        }
        user.UpdatedAt = DateTime.UtcNow;
        await _admins.UpdateAsync(user);
        return ToDto(user);
    }

    private async Task<LoginResponse> IssueTokensAsync(AdminUser user)
    {
        var token = _jwt.GenerateToken(user, user.Role);
        var refresh = _jwt.GenerateRefreshToken();

        user.RefreshTokenHash = HashToken(refresh);
        user.RefreshTokenExpiresAt = DateTime.UtcNow.AddDays(7);
        user.UpdatedAt = DateTime.UtcNow;
        await _admins.UpdateAsync(user);

        return new LoginResponse(token, refresh, DateTime.UtcNow.AddHours(24), ToDto(user));
    }

    private static string HashToken(string token) => Convert.ToBase64String(SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(token)));

    private static AdminUserDto ToDto(AdminUser u) =>
        new(u.Id, u.Name, u.Email, u.Role, u.IsActive, u.TeamMemberId);

    private static string BuildResetEmail(string token, string? userName)
    {
        var name = string.IsNullOrWhiteSpace(userName) ? "there" : userName;
        return $"""
            <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;border:1px solid #e7e0d2;border-radius:16px;">
              <h2 style="margin:0 0 12px;color:#1F5C46;">Reset your R&amp;A Labs password</h2>
              <p style="color:#20241F;font-size:14px;line-height:1.6;">Hi {name},</p>
              <p style="color:#20241F;font-size:14px;line-height:1.6;">Use the 6-digit code below to reset your password. It expires in <strong>1 hour</strong>.</p>
              <div style="margin:20px 0;padding:16px;background:#F3EEE3;border:1px dashed #B8863B;border-radius:8px;text-align:center;">
                <span style="font-family:monospace;font-size:32px;font-weight:700;letter-spacing:8px;color:#123A2C;">{token}</span>
              </div>
              <p style="color:#6B6A5E;font-size:12px;">If you didn't request this, you can safely ignore this email.</p>
            </div>
            """;
    }
}

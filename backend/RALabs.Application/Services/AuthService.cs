using RALabs.Application.Common;
using RALabs.Application.DTOs;
using RALabs.Domain.Entities;
using RALabs.Domain.Interfaces;

namespace RALabs.Application.Services;

public interface IPasswordHasher
{
    string Hash(string password);
    bool Verify(string password, string hash);
}

public interface IJwtService
{
    string GenerateToken(AdminUser user, string role);
    string GenerateRefreshToken();
}

public interface IAuthService
{
    Task<LoginResponse> LoginAsync(LoginRequest request);
    Task<AdminUserDto> CreateAdminAsync(CreateAdminRequest request, Guid actorId);
    Task<List<AdminUserDto>> GetAdminsAsync();
}

public record CreateAdminRequest(string Name, string Email, string Password, Guid? TeamMemberId);

public class AuthService : IAuthService
{
    private readonly IAdminUserRepository _admins;
    private readonly IPasswordHasher _hasher;
    private readonly IJwtService _jwt;

    public AuthService(IAdminUserRepository admins, IPasswordHasher hasher, IJwtService jwt)
    {
        _admins = admins;
        _hasher = hasher;
        _jwt = jwt;
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

        var token = _jwt.GenerateToken(user, "admin");
        var refresh = _jwt.GenerateRefreshToken();
        return new LoginResponse(token, refresh, DateTime.UtcNow.AddHours(24), ToDto(user));
    }

    public async Task<AdminUserDto> CreateAdminAsync(CreateAdminRequest request, Guid actorId)
    {
        Guard.Reset();
        Guard.Required(request.Name, "name", 100);
        Guard.Email(request.Email, "email", 200);
        Guard.Password(request.Password);
        Guard.ThrowIfAny("admin account");

        var email = request.Email.Trim().ToLowerInvariant();
        if (await _admins.EmailExistsAsync(email))
            throw new Exceptions.ConflictException("An account with this email already exists.");

        var user = new AdminUser
        {
            Id = Guid.NewGuid(),
            Name = request.Name.Trim(),
            Email = email,
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

    private static AdminUserDto ToDto(AdminUser u) =>
        new(u.Id, u.Name, u.Email, "admin", u.TeamMemberId);
}

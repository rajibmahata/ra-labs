using RALabs.Application.Common;
using RALabs.Application.DTOs;
using RALabs.Domain.Entities;
using RALabs.Domain.Interfaces;
using Microsoft.AspNetCore.DataProtection;

namespace RALabs.Application.Services;

public interface ITeamService
{
    Task<List<TeamMemberDto>> GetPublishedAsync();
    Task<TeamMemberDto> GetBySlugAsync(string slug);
    Task<TeamMemberDto> CreateAsync(CreateTeamRequest request);
    Task<TeamMemberDto> UpdateAsync(Guid id, UpdateTeamRequest request);
    Task DeleteAsync(Guid id);
    Task<TeamMemberDto?> GetByAdminUserIdAsync(Guid adminUserId);
    Task<TeamMemberDto> UpdateProfileAsync(Guid adminUserId, UpdateTeamRequest request);
}

public class TeamService : ITeamService
{
    private readonly ITeamRepository _repo;
    private readonly IDataProtector _githubProtector;

    public TeamService(ITeamRepository repo, IDataProtectionProvider protectionProvider)
    {
        _repo = repo;
        _githubProtector = protectionProvider.CreateProtector("RALabs.TeamMember.GithubToken.v1");
    }

    public async Task<List<TeamMemberDto>> GetPublishedAsync()
    {
        var members = (await _repo.GetPublishedAsync()).OrderBy(x => x.Name).ToList();
        var snapshots = await _repo.GetLatestSnapshotsAsync(members.Select(m => m.Id));
        return members.Select(m => ToDto(m, snapshots.GetValueOrDefault(m.Id))).ToList();
    }

    public async Task<TeamMemberDto> GetBySlugAsync(string slug)
    {
        Guard.Reset();
        Guard.Slug(slug, "slug");
        Guard.ThrowIfAny("team request");
        var member = await _repo.GetBySlugAsync(slug);
        if (member is null || !member.IsPublished)
            throw new Exceptions.NotFoundException("Team member not found.");
        return await ToDto(member);
    }

    public async Task<TeamMemberDto> CreateAsync(CreateTeamRequest r)
    {
        Validate(r.Name, r.Role, r.Bio, r.Slug, r.GithubUsername, r.GithubAccountUrl, r.Email, r.LinkedinUrl, r.AvatarUrl);
        var slug = string.IsNullOrWhiteSpace(r.Slug) ? Guard.Slugify(r.Name) : r.Slug.Trim().ToLowerInvariant();
        if (await _repo.SlugExistsAsync(slug))
            throw new Exceptions.ConflictException($"A team member with slug '{slug}' already exists.");

        var member = new TeamMember
        {
            Id = Guid.NewGuid(),
            Name = r.Name.Trim(),
            Slug = slug,
            Role = r.Role.Trim(),
            Bio = r.Bio.Trim(),
            GithubUsername = r.GithubUsername,
            GithubAccountUrl = r.GithubAccountUrl,
            GithubTokenEncrypted = ProtectToken(r.GithubToken),
            AvatarUrl = r.AvatarUrl,
            Email = r.Email,
            LinkedinUrl = r.LinkedinUrl,
            Location = r.Location,
            IsPublished = r.IsPublished ?? false,
            CreatedAt = DateTime.UtcNow
        };
        var id = await _repo.AddAsync(member);
        member.Id = id;
        return await ToDto(member);
    }

    public async Task<TeamMemberDto> UpdateAsync(Guid id, UpdateTeamRequest r)
    {
        Guard.NotDefault(id, "id");
        Validate(r.Name, r.Role, r.Bio, r.Slug, r.GithubUsername, r.GithubAccountUrl, r.Email, r.LinkedinUrl, r.AvatarUrl);
        Guard.ThrowIfAny("team member update");

        var member = await _repo.GetByIdAsync(id)
            ?? throw new Exceptions.NotFoundException("Team member not found.");

        // Validation (Validate + ThrowIfAny) guarantees these are non-null.
        var name = r.Name!.Trim();
        var role = r.Role!.Trim();
        var bio = r.Bio!.Trim();
        var slug = string.IsNullOrWhiteSpace(r.Slug) ? Guard.Slugify(name) : r.Slug.Trim().ToLowerInvariant();
        if (await _repo.SlugExistsAsync(slug, id))
            throw new Exceptions.ConflictException($"A team member with slug '{slug}' already exists.");

        member.Name = name;
        member.Slug = slug;
        member.Role = role;
        member.Bio = bio;
        member.GithubUsername = r.GithubUsername;
        member.GithubAccountUrl = r.GithubAccountUrl;
        if (r.GithubToken is not null)
            member.GithubTokenEncrypted = ProtectToken(r.GithubToken);
        member.AvatarUrl = r.AvatarUrl;
        member.Email = r.Email;
        member.LinkedinUrl = r.LinkedinUrl;
        member.Location = r.Location;
        member.IsPublished = r.IsPublished ?? member.IsPublished;
        member.UpdatedAt = DateTime.UtcNow;

        await _repo.UpdateAsync(member);
        return await ToDto(member);
    }

    public async Task DeleteAsync(Guid id)
    {
        var member = await _repo.GetByIdAsync(id)
            ?? throw new Exceptions.NotFoundException("Team member not found.");
        member.IsPublished = false;
        member.UpdatedAt = DateTime.UtcNow;
        await _repo.UpdateAsync(member);
    }

    public async Task<TeamMemberDto?> GetByAdminUserIdAsync(Guid adminUserId)
    {
        var member = await _repo.GetByAdminUserIdAsync(adminUserId);
        return member is null ? null : await ToDto(member);
    }

    public async Task<TeamMemberDto> UpdateProfileAsync(Guid adminUserId, UpdateTeamRequest request)
    {
        var member = await _repo.GetByAdminUserIdAsync(adminUserId)
            ?? throw new Exceptions.NotFoundException("No team profile linked to this account.");

        Guard.Reset();
        if (request.Name is not null) { Guard.Required(request.Name, "name", 100); }
        if (request.Role is not null) { Guard.Required(request.Role, "role", 100); }
        if (request.Bio is not null) { Guard.Required(request.Bio, "bio", 5000); }
        if (request.GithubUsername is not null) Guard.MaxLength(request.GithubUsername, "githubUsername", 100);
        if (request.GithubAccountUrl is not null) Guard.Url(request.GithubAccountUrl, "githubAccountUrl");
        if (request.Email is not null) Guard.Email(request.Email, "email", 200);
        if (request.LinkedinUrl is not null) Guard.Url(request.LinkedinUrl, "linkedinUrl");
        if (request.AvatarUrl is not null) Guard.Url(request.AvatarUrl, "avatarUrl");
        if (request.Location is not null) Guard.MaxLength(request.Location, "location", 200);
        Guard.ThrowIfAny("team member profile");

        if (request.Name is not null) member.Name = request.Name.Trim();
        if (request.Role is not null) member.Role = request.Role.Trim();
        if (request.Bio is not null) member.Bio = request.Bio.Trim();
        if (request.GithubUsername is not null) member.GithubUsername = request.GithubUsername;
        if (request.GithubAccountUrl is not null) member.GithubAccountUrl = request.GithubAccountUrl;
        if (request.GithubToken is not null) member.GithubTokenEncrypted = ProtectToken(request.GithubToken);
        if (request.AvatarUrl is not null) member.AvatarUrl = request.AvatarUrl;
        if (request.Email is not null) member.Email = request.Email;
        if (request.LinkedinUrl is not null) member.LinkedinUrl = request.LinkedinUrl;
        if (request.Location is not null) member.Location = request.Location;
        if (request.IsPublished is not null) member.IsPublished = request.IsPublished.Value;
        member.UpdatedAt = DateTime.UtcNow;

        await _repo.UpdateAsync(member);
        return await ToDto(member);
    }

    private static void Validate(string? name, string? role, string? bio, string? slug, string? github, string? githubAccountUrl, string? email, string? linkedin, string? avatar)
    {
        Guard.Reset();
        Guard.Required(name, "name", 100);
        Guard.Required(role, "role", 100);
        Guard.Required(bio, "bio", 5000);
        if (!string.IsNullOrWhiteSpace(slug)) Guard.Slug(slug, "slug");
        Guard.MaxLength(github, "githubUsername", 100);
        Guard.Url(githubAccountUrl, "githubAccountUrl");
        if (!string.IsNullOrWhiteSpace(email)) Guard.Email(email, "email", 200);
        Guard.Url(linkedin, "linkedinUrl");
        Guard.Url(avatar, "avatarUrl");
        Guard.ThrowIfAny("team member");
    }

    private async Task<TeamMemberDto> ToDto(TeamMember m)
        => ToDto(m, await _repo.GetLatestSnapshotAsync(m.Id));

    private static TeamMemberDto ToDto(TeamMember m, GithubSnapshot? snap) =>
        new(m.Id, m.Slug, m.Name, m.Role, m.Bio, m.GithubUsername, m.GithubAccountUrl,
            !string.IsNullOrWhiteSpace(m.GithubTokenEncrypted), m.AvatarUrl, m.Email, m.LinkedinUrl, m.Location, m.IsPublished,
            snap is null ? null : new GithubSnapshotDto(snap.Commits90d, snap.ActiveRepos, snap.LastCommitAt, snap.CapturedAt));

    private string? ProtectToken(string? token) => string.IsNullOrWhiteSpace(token) ? null : _githubProtector.Protect(token.Trim());
}

using System.Globalization;
using System.Text;
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
    Task<TeamMemberDto> SetActiveAsync(Guid id, bool isActive);
    Task<TeamMemberDto?> GetByAdminUserIdAsync(Guid adminUserId);
    Task<TeamMemberDto> UpdateProfileAsync(Guid adminUserId, UpdateTeamRequest request);
    Task<TeamImportResultDto> ImportAsync(Stream csv);
    Task<byte[]> ExportAsync();
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
        if (member is null || !member.IsActive || !member.IsPublished)
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
            IsActive = true,
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

    public async Task<TeamMemberDto> SetActiveAsync(Guid id, bool isActive)
    {
        var member = await _repo.GetByIdAsync(id)
            ?? throw new Exceptions.NotFoundException("Team member not found.");
        member.IsActive = isActive;
        member.IsPublished = false;
        member.UpdatedAt = DateTime.UtcNow;
        await _repo.UpdateAsync(member);
        return await ToDto(member);
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

    public async Task<TeamImportResultDto> ImportAsync(Stream csv)
    {
        using var reader = new StreamReader(csv, Encoding.UTF8, leaveOpen: true);
        var rows = new List<string[]>();
        string? line;
        while ((line = await reader.ReadLineAsync()) is not null)
        {
            if (!string.IsNullOrWhiteSpace(line)) rows.Add(CsvHelper.ParseLine(line));
            if (rows.Count > ImportMaxRows + 1) break;
        }

        var errors = new List<ImportErrorDto>();
        if (rows.Count == 0)
            return new TeamImportResultDto(0, 0, new List<ImportErrorDto> { new(1, "The CSV file is empty.") });
        var header = new[] { "name", "role", "bio", "slug", "githubUsername", "githubAccountUrl", "email", "linkedinUrl", "avatarUrl", "location", "isPublished" };
        if (rows[0].Length != header.Length ||
            header.Where((expected, column) => !rows[0][column].Equals(expected, StringComparison.OrdinalIgnoreCase)).Any())
            return new TeamImportResultDto(0, 0, new List<ImportErrorDto> { new(1, "Headers must be: " + string.Join(',', header) + ".") });
        if (rows.Count - 1 > ImportMaxRows)
            return new TeamImportResultDto(0, 0, new List<ImportErrorDto> { new(2, $"Import cannot exceed {ImportMaxRows} rows.") });

        var created = 0;
        var skipped = 0;
        var seenSlugs = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var seenEmails = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var all = await _repo.GetAllAsync();
        var existingSlugs = new HashSet<string>(all.Select(m => m.Slug), StringComparer.OrdinalIgnoreCase);
        var existingEmails = new HashSet<string>(all.Select(m => m.Email).Where(e => !string.IsNullOrWhiteSpace(e))!, StringComparer.OrdinalIgnoreCase);

        for (var index = 1; index < rows.Count; index++)
        {
            var rowNumber = index + 1;
            var row = rows[index];
            if (row.Length != header.Length)
            {
                errors.Add(new(rowNumber, "Each row must contain all 11 columns."));
                continue;
            }
            var name = row[0].Trim();
            var role = row[1].Trim();
            var bio = row[2].Trim();
            var slug = string.IsNullOrWhiteSpace(row[3]) ? Guard.Slugify(name) : row[3].Trim().ToLowerInvariant();
            var githubUsername = string.IsNullOrWhiteSpace(row[4]) ? null : row[4].Trim();
            var githubAccountUrl = string.IsNullOrWhiteSpace(row[5]) ? null : row[5].Trim();
            var email = string.IsNullOrWhiteSpace(row[6]) ? null : row[6].Trim().ToLowerInvariant();
            var linkedinUrl = string.IsNullOrWhiteSpace(row[7]) ? null : row[7].Trim();
            var avatarUrl = string.IsNullOrWhiteSpace(row[8]) ? null : row[8].Trim();
            var location = string.IsNullOrWhiteSpace(row[9]) ? null : row[9].Trim();
            var isPublished = bool.TryParse(row[10].Trim(), out var parsed) && parsed;

            Guard.Reset();
            Guard.Required(name, "name", 100);
            Guard.Required(role, "role", 100);
            Guard.Required(bio, "bio", 5000);
            Guard.Slug(slug, "slug");
            Guard.MaxLength(githubUsername, "githubUsername", 100);
            Guard.Url(githubAccountUrl, "githubAccountUrl");
            if (!string.IsNullOrWhiteSpace(email)) Guard.Email(email, "email", 200);
            Guard.Url(linkedinUrl, "linkedinUrl");
            Guard.Url(avatarUrl, "avatarUrl");
            Guard.MaxLength(location, "location", 200);
            try { Guard.ThrowIfAny("team row"); }
            catch (Exceptions.ValidationException ex) { errors.Add(new(rowNumber, ex.Message)); continue; }

            if (!seenSlugs.Add(slug) || existingSlugs.Contains(slug))
            {
                skipped++;
                errors.Add(new(rowNumber, $"A team member with slug '{slug}' already exists."));
                continue;
            }
            if (!string.IsNullOrWhiteSpace(email) && (!seenEmails.Add(email) || existingEmails.Contains(email)))
            {
                skipped++;
                errors.Add(new(rowNumber, $"A team member with email '{email}' already exists."));
                continue;
            }

            await _repo.AddAsync(new TeamMember
            {
                Id = Guid.NewGuid(),
                Name = name,
                Role = role,
                Bio = bio,
                Slug = slug,
                GithubUsername = githubUsername,
                GithubAccountUrl = githubAccountUrl,
                Email = email,
                LinkedinUrl = linkedinUrl,
                AvatarUrl = avatarUrl,
                Location = location,
                IsActive = true,
                IsPublished = isPublished,
                CreatedAt = DateTime.UtcNow
            });
            created++;
        }
        return new TeamImportResultDto(created, skipped, errors);
    }

    public async Task<byte[]> ExportAsync()
    {
        var members = await _repo.GetAllAsync();
        var builder = new StringBuilder("id,name,slug,role,bio,githubUsername,githubAccountUrl,email,linkedinUrl,avatarUrl,location,isActive,isPublished,createdAt\r\n");
        foreach (var member in members)
        {
            builder.AppendLine(string.Join(',',
                member.Id,
                CsvHelper.Escape(member.Name),
                CsvHelper.Escape(member.Slug),
                CsvHelper.Escape(member.Role),
                CsvHelper.Escape(member.Bio),
                CsvHelper.Escape(member.GithubUsername ?? string.Empty),
                CsvHelper.Escape(member.GithubAccountUrl ?? string.Empty),
                CsvHelper.Escape(member.Email ?? string.Empty),
                CsvHelper.Escape(member.LinkedinUrl ?? string.Empty),
                CsvHelper.Escape(member.AvatarUrl ?? string.Empty),
                CsvHelper.Escape(member.Location ?? string.Empty),
                member.IsActive,
                member.IsPublished,
                member.CreatedAt.ToString("O", CultureInfo.InvariantCulture)));
        }
        return Encoding.UTF8.GetBytes(builder.ToString());
    }

    private const int ImportMaxRows = 500;

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
            !string.IsNullOrWhiteSpace(m.GithubTokenEncrypted), m.AvatarUrl, m.Email, m.LinkedinUrl, m.Location, m.IsActive, m.IsPublished,
            snap is null ? null : new GithubSnapshotDto(snap.Commits90d, snap.ActiveRepos, snap.LastCommitAt, snap.CapturedAt));

    private string? ProtectToken(string? token) => string.IsNullOrWhiteSpace(token) ? null : _githubProtector.Protect(token.Trim());
}

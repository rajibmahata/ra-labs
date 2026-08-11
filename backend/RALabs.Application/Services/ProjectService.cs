using System.Text;
using RALabs.Application.Common;
using RALabs.Application.DTOs;
using RALabs.Domain;
using RALabs.Domain.Entities;
using RALabs.Domain.Enums;
using RALabs.Domain.Interfaces;

namespace RALabs.Application.Services;

public interface IProjectService
{
    Task<PaginatedResult<ProjectDto>> GetPublishedAsync(int? page, int? pageSize, string? tag);
    Task<PaginatedResult<ProjectDto>> GetFeaturedAsync(int? page, int? pageSize);
    Task<ProjectDetailDto> GetBySlugAsync(string slug);
    Task<ProjectDto> GetAdminByIdAsync(Guid id);
    Task<PaginatedResult<ProjectDto>> ListAdminAsync(string? search, string? category, string? status, bool? featured, bool? active, bool? published, int? page, int? pageSize);
    Task<ProjectDto> CreateAsync(CreateProjectRequest request);
    Task<ProjectDto> UpdateAsync(Guid id, UpdateProjectRequest request);
    Task<ProjectDto> SetPublishedAsync(Guid id, bool isPublished);
    Task<ProjectDto> SetActiveAsync(Guid id, bool isActive);
    Task<ProjectDto> SetFeaturedAsync(Guid id, bool isFeatured);
    Task DeleteAsync(Guid id);
    Task<ProjectImportResultDto> ImportAsync(Stream csv);
    Task<byte[]> ExportAsync(IEnumerable<Guid>? ids, string? search, string? category, bool? featured, bool? active);
}

public class ProjectService : IProjectService
{
    private readonly IProjectRepository _repo;
    private readonly ITeamRepository _team;
    private readonly IRagIngestionService _rag;

    public ProjectService(IProjectRepository repo, ITeamRepository team, IRagIngestionService rag)
    {
        _repo = repo;
        _team = team;
        _rag = rag;
    }

    public async Task<PaginatedResult<ProjectDto>> GetPublishedAsync(int? page, int? pageSize, string? tag)
    {
        var (p, ps) = PageRequest.Normalize(page, pageSize);
        var items = await _repo.GetPublishedAsync(p, ps, tag);
        var total = await _repo.CountPublishedAsync(tag);
        return new PaginatedResult<ProjectDto>
        {
            Items = items.Select(ToDto).ToList(),
            Page = p,
            PageSize = ps,
            TotalCount = total
        };
    }

    public async Task<PaginatedResult<ProjectDto>> GetFeaturedAsync(int? page, int? pageSize)
    {
        var (p, ps) = PageRequest.Normalize(page, pageSize);
        var items = await _repo.GetFeaturedAsync(p, ps);
        var total = await _repo.CountFeaturedAsync();
        return new PaginatedResult<ProjectDto>
        {
            Items = items.Select(ToDto).ToList(),
            Page = p,
            PageSize = ps,
            TotalCount = total
        };
    }

    public async Task<ProjectDto> GetAdminByIdAsync(Guid id)
    {
        Guard.Reset();
        Guard.NotDefault(id, "id");
        Guard.ThrowIfAny("project request");
        var project = await _repo.GetByIdAsync(id)
            ?? throw new Exceptions.NotFoundException("Project not found.");
        return ToDto(project);
    }

    public async Task<PaginatedResult<ProjectDto>> ListAdminAsync(string? search, string? category, string? status, bool? featured, bool? active, bool? published, int? page, int? pageSize)
    {
        var (p, ps) = PageRequest.Normalize(page, pageSize);
        var (items, total) = await _repo.ListAdminAsync(search, category, status, featured, active, published, p, ps);
        return new PaginatedResult<ProjectDto>
        {
            Items = items.Select(ToDto).ToList(),
            Page = p,
            PageSize = ps,
            TotalCount = total
        };
    }

    public async Task<ProjectDetailDto> GetBySlugAsync(string slug)
    {
        Guard.Reset();
        Guard.Slug(slug, "slug");
        Guard.ThrowIfAny("project request");
        var project = await _repo.GetBySlugAsync(slug);
        if (project is null || !project.IsPublished || project.IsDeleted)
            throw new Exceptions.NotFoundException("Project not found.");
        var team = new List<TeamBriefDto>();
        if (project.TeamMemberIds.Count > 0)
        {
            var members = await _team.GetPublishedAsync();
            team = members
                .Where(m => project.TeamMemberIds.Contains(m.Id))
                .Select(m => new TeamBriefDto(m.Id, m.Name, m.Slug, m.Role, m.AvatarUrl))
                .ToList();
        }
        return new ProjectDetailDto(ToDto(project), team);
    }

    public async Task<ProjectDto> CreateAsync(CreateProjectRequest r)
    {
        Validate(r.Title, r.Summary, r.Slug, r.GithubUrl, r.LiveSiteUrl, r.CoverImageUrl, r.Status, r.Category);

        var slug = string.IsNullOrWhiteSpace(r.Slug) ? Guard.Slugify(r.Title) : r.Slug.Trim().ToLowerInvariant();
        if (await _repo.SlugExistsAsync(slug))
            throw new Exceptions.ConflictException($"A project with slug '{slug}' already exists.");

        var liveSiteUrl = NormalizeUrl(r.LiveSiteUrl);
        if (!string.IsNullOrWhiteSpace(liveSiteUrl) && await _repo.LiveSiteUrlExistsAsync(liveSiteUrl))
            throw new Exceptions.ConflictException("Another project already uses this live site URL.");

        var project = new Project
        {
            Id = Guid.NewGuid(),
            Title = r.Title.Trim(),
            Slug = slug,
            Summary = r.Summary.Trim(),
            StackTags = r.StackTags ?? new List<string>(),
            Status = ParseStatus(r.Status),
            GithubUrl = r.GithubUrl,
            LiveSiteUrl = liveSiteUrl,
            Category = r.Category?.Trim(),
            BusinessPurpose = r.BusinessPurpose,
            ProblemSolved = r.ProblemSolved,
            Solution = r.Solution,
            KeyFeatures = r.KeyFeatures ?? new List<string>(),
            CaseStudyBody = r.CaseStudyBody,
            CoverImageUrl = r.CoverImageUrl,
            Screenshots = r.Screenshots ?? new List<string>(),
            Duration = r.Duration,
            TeamMemberIds = r.TeamMemberIds ?? new List<Guid>(),
            CompletedAt = r.CompletedAt,
            CustomerReference = r.CustomerReference,
            ShowCustomerReference = r.ShowCustomerReference ?? false,
            SortOrder = r.SortOrder ?? 0,
            IsFeatured = r.IsFeatured ?? false,
            IsActive = r.IsActive ?? true,
            IsPublished = r.IsPublished ?? false,
            CreatedAt = DateTime.UtcNow
        };
        var id = await _repo.AddAsync(project);
        project.Id = id;
        await SyncRagAsync(project);
        return ToDto(project);
    }

    public async Task<ProjectDto> UpdateAsync(Guid id, UpdateProjectRequest r)
    {
        Guard.NotDefault(id, "id");
        Validate(r.Title, r.Summary, r.Slug, r.GithubUrl, r.LiveSiteUrl, r.CoverImageUrl, r.Status, r.Category);
        Guard.ThrowIfAny("project update");

        var project = await _repo.GetByIdAsync(id)
            ?? throw new Exceptions.NotFoundException("Project not found.");

        var slug = string.IsNullOrWhiteSpace(r.Slug) ? Guard.Slugify(r.Title) : r.Slug.Trim().ToLowerInvariant();
        if (await _repo.SlugExistsAsync(slug, id))
            throw new Exceptions.ConflictException($"A project with slug '{slug}' already exists.");

        var liveSiteUrl = NormalizeUrl(r.LiveSiteUrl);
        if (!string.IsNullOrWhiteSpace(liveSiteUrl) && await _repo.LiveSiteUrlExistsAsync(liveSiteUrl, id))
            throw new Exceptions.ConflictException("Another project already uses this live site URL.");

        project.Title = r.Title.Trim();
        project.Slug = slug;
        project.Summary = r.Summary.Trim();
        project.StackTags = r.StackTags ?? project.StackTags;
        project.Status = ParseStatus(r.Status);
        project.GithubUrl = r.GithubUrl;
        project.LiveSiteUrl = liveSiteUrl;
        project.Category = r.Category?.Trim() ?? project.Category;
        project.BusinessPurpose = r.BusinessPurpose ?? project.BusinessPurpose;
        project.ProblemSolved = r.ProblemSolved ?? project.ProblemSolved;
        project.Solution = r.Solution ?? project.Solution;
        project.KeyFeatures = r.KeyFeatures ?? project.KeyFeatures;
        project.CaseStudyBody = r.CaseStudyBody ?? project.CaseStudyBody;
        project.CoverImageUrl = r.CoverImageUrl ?? project.CoverImageUrl;
        project.Screenshots = r.Screenshots ?? project.Screenshots;
        project.Duration = r.Duration ?? project.Duration;
        project.TeamMemberIds = r.TeamMemberIds ?? project.TeamMemberIds;
        project.CompletedAt = r.CompletedAt ?? project.CompletedAt;
        project.CustomerReference = r.CustomerReference ?? project.CustomerReference;
        project.ShowCustomerReference = r.ShowCustomerReference ?? project.ShowCustomerReference;
        project.SortOrder = r.SortOrder ?? project.SortOrder;
        project.IsFeatured = r.IsFeatured ?? project.IsFeatured;
        project.IsActive = r.IsActive ?? project.IsActive;
        project.IsPublished = r.IsPublished ?? project.IsPublished;
        project.UpdatedAt = DateTime.UtcNow;

        await _repo.UpdateAsync(project);
        await SyncRagAsync(project);
        return ToDto(project);
    }

    public async Task DeleteAsync(Guid id)
    {
        var project = await _repo.GetByIdAsync(id)
            ?? throw new Exceptions.NotFoundException("Project not found.");
        project.IsDeleted = true;
        project.IsPublished = false;
        project.IsActive = false;
        project.IsFeatured = false;
        project.UpdatedAt = DateTime.UtcNow;
        await _repo.UpdateAsync(project);
        await _rag.SyncProjectAsync(id, CancellationToken.None);
    }

    public async Task<ProjectDto> SetPublishedAsync(Guid id, bool isPublished)
    {
        var project = await _repo.GetByIdAsync(id)
            ?? throw new Exceptions.NotFoundException("Project not found.");
        if (project.IsDeleted && isPublished)
            throw new Exceptions.ConflictException("A deleted project cannot be published.");
        project.IsPublished = isPublished;
        project.UpdatedAt = DateTime.UtcNow;
        await _repo.UpdateAsync(project);
        await SyncRagAsync(project);
        return ToDto(project);
    }

    public async Task<ProjectDto> SetActiveAsync(Guid id, bool isActive)
    {
        var project = await _repo.GetByIdAsync(id)
            ?? throw new Exceptions.NotFoundException("Project not found.");
        if (project.IsDeleted && isActive)
            throw new Exceptions.ConflictException("A deleted project cannot be activated.");
        project.IsActive = isActive;
        if (!isActive) project.IsFeatured = false;
        project.UpdatedAt = DateTime.UtcNow;
        await _repo.UpdateAsync(project);
        await SyncRagAsync(project);
        return ToDto(project);
    }

    public async Task<ProjectDto> SetFeaturedAsync(Guid id, bool isFeatured)
    {
        var project = await _repo.GetByIdAsync(id)
            ?? throw new Exceptions.NotFoundException("Project not found.");
        if (isFeatured && (project.IsDeleted || !project.IsActive))
            throw new Exceptions.ConflictException("Only active projects can be featured.");
        project.IsFeatured = isFeatured;
        project.UpdatedAt = DateTime.UtcNow;
        await _repo.UpdateAsync(project);
        return ToDto(project);
    }

    public async Task<ProjectImportResultDto> ImportAsync(Stream csv)
    {
        using var reader = new StreamReader(csv, Encoding.UTF8, leaveOpen: true);
        var rows = new List<string[]>();
        string? line;
        while ((line = await reader.ReadLineAsync()) is not null)
        {
            if (!string.IsNullOrWhiteSpace(line)) rows.Add(ParseCsvLine(line));
            if (rows.Count > MaxImportRows + 1) break;
        }

        var errors = new List<ProjectImportErrorDto>();
        if (rows.Count == 0)
            return new ProjectImportResultDto(0, 0, 0, new List<ProjectImportErrorDto> { new(1, "The CSV file is empty.") });
        var headers = rows[0].Select(h => h.Trim().ToLowerInvariant()).ToArray();
        var required = new[] { "title", "summary" };
        foreach (var column in required)
        {
            if (!headers.Contains(column))
                return new ProjectImportResultDto(0, 0, 0, new List<ProjectImportErrorDto> { new(1, $"Headers must include: {string.Join(", ", required)}.") });
        }
        if (rows.Count - 1 > MaxImportRows)
            return new ProjectImportResultDto(0, 0, 0, new List<ProjectImportErrorDto> { new(2, $"Import cannot exceed {MaxImportRows} rows.") });

        var created = 0;
        var updated = 0;
        var skipped = 0;
        var seenSlugs = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        for (var index = 1; index < rows.Count; index++)
        {
            var rowNumber = index + 1;
            var row = rows[index];
            if (row.Length != headers.Length)
            {
                errors.Add(new(rowNumber, "Row has a different number of columns than the header."));
                continue;
            }
            var value = headers.Zip(row, (h, v) => new { h, v = v.Trim() })
                .ToDictionary(x => x.h, x => x.v);

            var title = value.GetValueOrDefault("title");
            var summary = value.GetValueOrDefault("summary");
            if (string.IsNullOrWhiteSpace(title) || string.IsNullOrWhiteSpace(summary))
            {
                errors.Add(new(rowNumber, "title and summary are required."));
                continue;
            }

            var slug = value.GetValueOrDefault("slug") is { Length: > 0 } s ? s : Guard.Slugify(title);
            var liveSiteUrl = NormalizeUrl(value.GetValueOrDefault("liveSiteUrl"));
            var githubUrl = value.GetValueOrDefault("githubUrl");
            var category = value.GetValueOrDefault("category");
            var status = value.GetValueOrDefault("status");
            var parsedStatus = ParseStatus(string.IsNullOrWhiteSpace(status) ? null : status);
            var existing = await _repo.GetBySlugAsync(slug);
            if (existing is not null)
            {
                if (!seenSlugs.Add(slug))
                {
                    skipped++;
                    errors.Add(new(rowNumber, $"Duplicate slug '{slug}' within this file."));
                    continue;
                }
                existing.Title = title;
                existing.Summary = summary;
                existing.Slug = slug;
                existing.StackTags = SplitList(value.GetValueOrDefault("stackTags"));
                existing.Status = parsedStatus;
                existing.GithubUrl = NullIfEmpty(githubUrl);
                existing.LiveSiteUrl = NullIfEmpty(liveSiteUrl);
                existing.Category = NullIfEmpty(category);
                existing.KeyFeatures = SplitList(value.GetValueOrDefault("keyFeatures"));
                existing.CoverImageUrl = NullIfEmpty(value.GetValueOrDefault("coverImageUrl"));
                existing.Screenshots = SplitList(value.GetValueOrDefault("screenshots"));
                existing.Duration = NullIfEmpty(value.GetValueOrDefault("duration"));
                existing.CustomerReference = NullIfEmpty(value.GetValueOrDefault("customerReference"));
                existing.UpdatedAt = DateTime.UtcNow;
                await _repo.UpdateAsync(existing);
                await SyncRagAsync(existing);
                updated++;
                continue;
            }
            if (!seenSlugs.Add(slug))
            {
                skipped++;
                errors.Add(new(rowNumber, $"Duplicate slug '{slug}' within this file."));
                continue;
            }
            var project = new Project
            {
                Id = Guid.NewGuid(),
                Title = title,
                Slug = slug,
                Summary = summary,
                StackTags = SplitList(value.GetValueOrDefault("stackTags")),
                Status = parsedStatus,
                GithubUrl = NullIfEmpty(githubUrl),
                LiveSiteUrl = NullIfEmpty(liveSiteUrl),
                Category = NullIfEmpty(category),
                BusinessPurpose = NullIfEmpty(value.GetValueOrDefault("businessPurpose")),
                ProblemSolved = NullIfEmpty(value.GetValueOrDefault("problemSolved")),
                Solution = NullIfEmpty(value.GetValueOrDefault("solution")),
                KeyFeatures = SplitList(value.GetValueOrDefault("keyFeatures")),
                CoverImageUrl = NullIfEmpty(value.GetValueOrDefault("coverImageUrl")),
                Screenshots = SplitList(value.GetValueOrDefault("screenshots")),
                Duration = NullIfEmpty(value.GetValueOrDefault("duration")),
                CustomerReference = NullIfEmpty(value.GetValueOrDefault("customerReference")),
                IsActive = ParseBool(value.GetValueOrDefault("isActive"), true),
                IsFeatured = ParseBool(value.GetValueOrDefault("isFeatured"), false),
                IsPublished = ParseBool(value.GetValueOrDefault("isPublished"), false),
                CreatedAt = DateTime.UtcNow
            };
            await _repo.AddAsync(project);
            await SyncRagAsync(project);
            created++;
        }
        return new ProjectImportResultDto(created, updated, skipped, errors);
    }

    public async Task<byte[]> ExportAsync(IEnumerable<Guid>? ids, string? search, string? category, bool? featured, bool? active)
    {
        List<Project> rows;
        if (ids is not null)
        {
            var idSet = ids.ToHashSet();
            rows = (await _repo.GetAllAsync(true)).Where(p => idSet.Contains(p.Id)).ToList();
        }
        else
        {
            var (items, _) = await _repo.ListAdminAsync(search, category, null, featured, active, null, 1, MaxExportRows);
            rows = items;
        }
        var builder = new StringBuilder();
        builder.AppendLine("title,slug,summary,category,status,stackTags,githubUrl,liveSiteUrl,businessPurpose,problemSolved,solution,keyFeatures,coverImageUrl,screenshots,duration,completedAt,customerReference,isFeatured,isActive,isPublished");
        foreach (var p in rows)
        {
            builder.AppendLine(string.Join(",",
                Csv(p.Title), Csv(p.Slug), Csv(p.Summary), Csv(p.Category ?? ""), p.Status.ToString().ToLowerInvariant(),
                Csv(string.Join(";", p.StackTags)), Csv(p.GithubUrl ?? ""), Csv(p.LiveSiteUrl ?? ""),
                Csv(p.BusinessPurpose ?? ""), Csv(p.ProblemSolved ?? ""), Csv(p.Solution ?? ""),
                Csv(string.Join(";", p.KeyFeatures)), Csv(p.CoverImageUrl ?? ""), Csv(string.Join(";", p.Screenshots)),
                Csv(p.Duration ?? ""), Csv(p.CompletedAt?.ToString("yyyy-MM-dd") ?? ""), Csv(p.CustomerReference ?? ""),
                p.IsFeatured.ToString().ToLowerInvariant(), p.IsActive.ToString().ToLowerInvariant(), p.IsPublished.ToString().ToLowerInvariant()));
        }
        return Encoding.UTF8.GetBytes(builder.ToString());
    }

    private async Task SyncRagAsync(Project project) =>
        await _rag.SyncProjectAsync(project.Id, CancellationToken.None);

    private static void Validate(string title, string summary, string? slug, string? githubUrl, string? liveSiteUrl, string? coverImageUrl, string? status, string? category)
    {
        Guard.Reset();
        Guard.Required(title, "title", 200);
        Guard.Required(summary, "summary", 500);
        if (!string.IsNullOrWhiteSpace(slug)) Guard.Slug(slug, "slug");
        Guard.Url(githubUrl, "githubUrl");
        Guard.Url(liveSiteUrl, "liveSiteUrl");
        if (!string.IsNullOrWhiteSpace(liveSiteUrl))
            Guard.HttpsUrl(liveSiteUrl, "liveSiteUrl");
        Guard.Url(coverImageUrl, "coverImageUrl");
        if (status is not null) Guard.InSet(status, "status", new[] { "live", "in_build" });
        Guard.MaxLength(category, "category", 100);
        Guard.ThrowIfAny("project");
    }

    private static string NormalizeUrl(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return string.Empty;
        var trimmed = value.Trim().TrimEnd('/');
        return Uri.TryCreate(trimmed, UriKind.Absolute, out var uri) ? uri.AbsoluteUri.TrimEnd('/') : trimmed;
    }

    private static string? NullIfEmpty(string value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static List<string> SplitList(string value) =>
        string.IsNullOrWhiteSpace(value)
            ? new List<string>()
            : value.Split(';', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).ToList();

    private static bool ParseBool(string value, bool fallback) =>
        bool.TryParse(value, out var parsed) ? parsed : fallback;

    private static ProjectStatus ParseStatus(string? status) =>
        status?.ToLowerInvariant() switch
        {
            "live" => ProjectStatus.Live,
            _ => ProjectStatus.InBuild
        };

    private static ProjectDto ToDto(Project p) => new(
        p.Id, p.Slug, p.Title, p.Summary, p.StackTags,
        p.Status == ProjectStatus.Live ? "live" : "in_build",
        p.GithubUrl, p.LiveSiteUrl, p.Category, p.BusinessPurpose, p.ProblemSolved, p.Solution,
        p.KeyFeatures, p.CaseStudyBody, p.CoverImageUrl, p.Screenshots, p.Duration, p.TeamMemberIds,
        p.CompletedAt, p.CustomerReference, p.ShowCustomerReference,
        p.SortOrder, p.IsFeatured, p.IsActive, p.IsPublished, p.CreatedAt, p.UpdatedAt);

    private static string Csv(string value) => value.Contains(',') || value.Contains('"') || value.Contains('\n')
        ? $"\"{value.Replace("\"", "\"\"")}\""
        : value;

    private static string[] ParseCsvLine(string line)
    {
        var fields = new List<string>();
        var current = new StringBuilder();
        var inQuotes = false;
        for (var i = 0; i < line.Length; i++)
        {
            var c = line[i];
            if (inQuotes)
            {
                if (c == '"' && i + 1 < line.Length && line[i + 1] == '"')
                {
                    current.Append('"');
                    i++;
                }
                else if (c == '"') inQuotes = false;
                else current.Append(c);
            }
            else if (c == '"') inQuotes = true;
            else if (c == ',') { fields.Add(current.ToString()); current.Clear(); }
            else current.Append(c);
        }
        fields.Add(current.ToString());
        return fields.ToArray();
    }

    private const int MaxImportRows = 200;
    private const int MaxExportRows = 1000;
}
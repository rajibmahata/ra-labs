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
    Task<ProjectDto> GetBySlugAsync(string slug);
    Task<ProjectDto> CreateAsync(CreateProjectRequest request);
    Task<ProjectDto> UpdateAsync(Guid id, UpdateProjectRequest request);
    Task DeleteAsync(Guid id);
}

public class ProjectService : IProjectService
{
    private readonly IProjectRepository _repo;

    public ProjectService(IProjectRepository repo) => _repo = repo;

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

    public async Task<ProjectDto> GetBySlugAsync(string slug)
    {
        Guard.Reset();
        Guard.Slug(slug, "slug");
        Guard.ThrowIfAny("project request");
        var project = await _repo.GetBySlugAsync(slug);
        if (project is null || !project.IsPublished || project.IsDeleted)
            throw new Exceptions.NotFoundException("Project not found.");
        return ToDto(project);
    }

    public async Task<ProjectDto> CreateAsync(CreateProjectRequest r)
    {
        Validate(r.Title, r.Summary, r.Slug, r.GithubUrl, r.CoverImageUrl, r.Status);

        var slug = string.IsNullOrWhiteSpace(r.Slug) ? Guard.Slugify(r.Title) : r.Slug.Trim().ToLowerInvariant();
        if (await _repo.SlugExistsAsync(slug))
            throw new Exceptions.ConflictException($"A project with slug '{slug}' already exists.");

        var project = new Project
        {
            Id = Guid.NewGuid(),
            Title = r.Title.Trim(),
            Slug = slug,
            Summary = r.Summary.Trim(),
            StackTags = r.StackTags ?? new List<string>(),
            Status = ParseStatus(r.Status),
            GithubUrl = r.GithubUrl,
            CaseStudyBody = r.CaseStudyBody,
            CoverImageUrl = r.CoverImageUrl,
            SortOrder = r.SortOrder ?? 0,
            IsPublished = r.IsPublished ?? false,
            CreatedAt = DateTime.UtcNow
        };
        var id = await _repo.AddAsync(project);
        project.Id = id;
        return ToDto(project);
    }

    public async Task<ProjectDto> UpdateAsync(Guid id, UpdateProjectRequest r)
    {
        Guard.NotDefault(id, "id");
        Validate(r.Title, r.Summary, r.Slug, r.GithubUrl, r.CoverImageUrl, r.Status);
        Guard.ThrowIfAny("project update");

        var project = await _repo.GetByIdAsync(id)
            ?? throw new Exceptions.NotFoundException("Project not found.");

        var slug = string.IsNullOrWhiteSpace(r.Slug) ? Guard.Slugify(r.Title) : r.Slug.Trim().ToLowerInvariant();
        if (await _repo.SlugExistsAsync(slug, id))
            throw new Exceptions.ConflictException($"A project with slug '{slug}' already exists.");

        project.Title = r.Title.Trim();
        project.Slug = slug;
        project.Summary = r.Summary.Trim();
        project.StackTags = r.StackTags ?? project.StackTags;
        project.Status = ParseStatus(r.Status);
        project.GithubUrl = r.GithubUrl;
        project.CaseStudyBody = r.CaseStudyBody;
        project.CoverImageUrl = r.CoverImageUrl;
        project.SortOrder = r.SortOrder ?? project.SortOrder;
        project.IsPublished = r.IsPublished ?? project.IsPublished;
        project.UpdatedAt = DateTime.UtcNow;

        await _repo.UpdateAsync(project);
        return ToDto(project);
    }

    public async Task DeleteAsync(Guid id)
    {
        var project = await _repo.GetByIdAsync(id)
            ?? throw new Exceptions.NotFoundException("Project not found.");
        project.IsDeleted = true;
        project.IsPublished = false;
        project.UpdatedAt = DateTime.UtcNow;
        await _repo.UpdateAsync(project);
    }

    private static void Validate(string title, string summary, string? slug, string? githubUrl, string? coverImageUrl, string? status)
    {
        Guard.Reset();
        Guard.Required(title, "title", 200);
        Guard.Required(summary, "summary", 500);
        Guard.Slug(slug, "slug");
        Guard.Url(githubUrl, "githubUrl");
        Guard.Url(coverImageUrl, "coverImageUrl");
        if (status is not null) Guard.InSet(status, "status", new[] { "live", "in_build" });
        Guard.ThrowIfAny("project");
    }

    private static ProjectStatus ParseStatus(string? status) =>
        status?.ToLowerInvariant() switch
        {
            "live" => ProjectStatus.Live,
            _ => ProjectStatus.InBuild
        };

    private static ProjectDto ToDto(Project p) => new(
        p.Id, p.Slug, p.Title, p.Summary, p.StackTags,
        p.Status == ProjectStatus.Live ? "live" : "in_build",
        p.GithubUrl, p.CaseStudyBody, p.CoverImageUrl,
        p.SortOrder, p.IsPublished, p.CreatedAt, p.UpdatedAt);
}

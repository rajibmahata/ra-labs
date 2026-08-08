using RALabs.Application.Common;
using RALabs.Application.DTOs;
using RALabs.Domain.Entities;
using RALabs.Domain.Interfaces;

namespace RALabs.Application.Services;

public interface IContentService
{
    Task<ContentResponse> GetByLocaleAsync(string locale);
    Task<List<ContentDto>> GetAllAsync(string? locale);
    Task<ContentDto> CreateAsync(CreateContentRequest request);
    Task<ContentDto> UpsertAsync(string key, UpdateContentRequest request);
    Task DeleteAsync(string key, string locale);
    Task<List<LocaleDto>> GetLocalesAsync();
}

public class ContentService : IContentService
{
    private static readonly string[] SupportedLocales =
        { "en", "hi", "bn", "fr", "es", "ar", "zh", "pt", "de", "ja", "ru" };

    private readonly IContentRepository _repo;
    private readonly ITranslationAgentService _translations;

    public ContentService(IContentRepository repo, ITranslationAgentService translations)
    {
        _repo = repo;
        _translations = translations;
    }

    public async Task<ContentResponse> GetByLocaleAsync(string locale)
    {
        Guard.Reset();
        Guard.InSet(locale, "locale", SupportedLocales);
        Guard.ThrowIfAny("content request");
        locale = locale.ToLowerInvariant();

        if (locale == "en")
        {
            var english = await _repo.GetByLocaleAsync(locale);
            return new ContentResponse(locale, english.ToDictionary(x => x.Key, x => x.Value));
        }

        // Language change: the LLM translation agent fills the requested locale
        // on demand; keys it could not produce yet fall back to English so the
        // site never renders raw content keys.
        await _translations.EnsureTranslatedAsync(locale, CancellationToken.None);
        // Both queries use the same scoped EF DbContext, so they must not run concurrently.
        var translated = await _repo.GetByLocaleAsync(locale);
        var englishRows = await _repo.GetByLocaleAsync("en");
        var merged = translated.ToDictionary(x => x.Key, x => x.Value);
        foreach (var item in englishRows)
            merged.TryAdd(item.Key, item.Value);
        return new ContentResponse(locale, merged);
    }

    public async Task<List<ContentDto>> GetAllAsync(string? locale)
    {
        var items = await _repo.GetAllAsync(locale?.ToLowerInvariant());
        return items.Select(x => new ContentDto(x.Key, x.Locale, x.Value, x.UpdatedAt)).ToList();
    }

    public async Task<ContentDto> CreateAsync(CreateContentRequest r)
    {
        Guard.Reset();
        Guard.Required(r.Key, "key", 200);
        Guard.InSet(r.Locale, "locale", SupportedLocales);
        Guard.Required(r.Value, "value", 100000);
        Guard.ThrowIfAny("content");

        var locale = r.Locale.ToLowerInvariant();
        var key = r.Key.Trim();
        if (await _repo.ExistsAsync(key, locale))
            throw new Exceptions.ConflictException($"Content entry '{key}' for locale '{locale}' already exists.");

        var content = new PageContent { Id = Guid.NewGuid(), Key = key, Locale = locale, Value = r.Value.Trim() };
        await _repo.AddAsync(content);
        return new ContentDto(key, locale, content.Value, content.UpdatedAt);
    }

    public async Task<ContentDto> UpsertAsync(string key, UpdateContentRequest r)
    {
        Guard.Reset();
        Guard.Required(key, "key", 200);
        Guard.InSet(r.Locale, "locale", SupportedLocales);
        Guard.Required(r.Value, "value", 100000);
        Guard.ThrowIfAny("content");

        var locale = r.Locale.ToLowerInvariant();
        var existing = await _repo.GetByKeyAsync(key.Trim(), locale);
        if (existing is null)
            return await CreateAsync(new CreateContentRequest(key.Trim(), locale, r.Value));

        existing.Value = r.Value.Trim();
        existing.UpdatedAt = DateTime.UtcNow;
        await _repo.UpdateAsync(existing);
        return new ContentDto(existing.Key, existing.Locale, existing.Value, existing.UpdatedAt);
    }

    public async Task DeleteAsync(string key, string locale)
    {
        Guard.Reset();
        Guard.Required(key, "key", 200);
        Guard.InSet(locale, "locale", SupportedLocales);
        Guard.ThrowIfAny("content");
        var existing = await _repo.GetByKeyAsync(key.Trim(), locale.ToLowerInvariant())
            ?? throw new Exceptions.NotFoundException("Content entry not found.");
        await _repo.DeleteAsync(existing.Key, existing.Locale);
    }

    public async Task<List<LocaleDto>> GetLocalesAsync()
    {
        var locales = await _repo.GetLocalesAsync();
        return locales.Where(l => l.IsActive)
            .Select(l => new LocaleDto(l.Code, l.Label)).ToList();
    }
}

using RALabs.Domain.Interfaces;

namespace RALabs.Application.Services;

public class SettingDto
{
    public string Key { get; set; } = string.Empty;
    public string Value { get; set; } = string.Empty;
}

public interface ISettingService
{
    Task<string?> GetValueAsync(string key);
    Task<bool> GetBoolAsync(string key, bool fallback);
    Task<List<SettingDto>> GetPublicAsync();
    Task<Dictionary<string, string>> GetAllAsync();
    Task SetAsync(string key, string value);
    Task SetManyAsync(IReadOnlyDictionary<string, string> values);
}

public sealed class SettingService : ISettingService
{
    private readonly ISettingRepository _settings;

    public SettingService(ISettingRepository settings) => _settings = settings;

    public Task<string?> GetValueAsync(string key) => _settings.GetByKeyAsync(key).ContinueWith(t => t.Result?.Value);

    public async Task<bool> GetBoolAsync(string key, bool fallback)
    {
        var raw = await GetValueAsync(key);
        return raw is null ? fallback : bool.TryParse(raw, out var b) ? b : fallback;
    }

    public async Task<List<SettingDto>> GetPublicAsync()
    {
        var all = await _settings.GetAllAsync();
        return all
            .Where(s => PublicKeys.Contains(s.Key))
            .Select(s => new SettingDto { Key = s.Key, Value = s.Value })
            .ToList();
    }

    public async Task<Dictionary<string, string>> GetAllAsync() =>
        (await _settings.GetAllAsync()).ToDictionary(s => s.Key, s => s.Value);

    public Task SetAsync(string key, string value) => _settings.UpsertAsync(key, value);

    public async Task SetManyAsync(IReadOnlyDictionary<string, string> values)
    {
        foreach (var kv in values)
        {
            if (!string.IsNullOrWhiteSpace(kv.Value))
                await _settings.UpsertAsync(kv.Key, kv.Value.Trim());
        }
    }

    /// <summary>Keys safe to expose to unauthenticated callers. Never keys/secrets.</summary>
    private static readonly HashSet<string> PublicKeys = new()
    {
        "ai.agent.enabled",
        "ai.rag.enabled",
        "ai.voice.enabled",
        "ai.voice.response",
        "ai.streaming.enabled",
        "ai.chat.model",
        "ai.stt.provider",
        "ai.tts.provider",
        "ai.max.audio.duration",
    };
}

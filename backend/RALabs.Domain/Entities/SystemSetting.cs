namespace RALabs.Domain.Entities;

/// <summary>
/// Key/value platform settings (AI, voice, streaming, etc.).
/// Values are strings; consumers parse to the expected type. Secrets
/// (API keys) must never be stored here — those live in configuration only.
/// </summary>
public class SystemSetting
{
    public Guid Id { get; set; }
    public string Key { get; set; } = string.Empty;
    public string Value { get; set; } = string.Empty;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

namespace RALabs.Domain.Entities;

public class Locale
{
    public string Code { get; set; } = string.Empty;
    public string Label { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public List<PageContent> Contents { get; set; } = new();
}

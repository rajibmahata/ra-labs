using System.Text.RegularExpressions;

namespace RALabs.Application.Common;

/// <summary>
/// Field-level validation helper (PestFlow-pattern, formalized). Throws a
/// single ValidationException aggregating all field errors so the API
/// boundary returns one consistent 400 envelope.
/// </summary>
public static class Guard
{
    private static readonly Regex EmailRegex = new(
        @"^[^@\s]+@[^@\s]+\.[^@\s]+$",
        RegexOptions.Compiled | RegexOptions.IgnoreCase);

    private static readonly Regex SlugRegex = new(
        @"^[a-z0-9]+(?:-[a-z0-9]+)*$",
        RegexOptions.Compiled);

    private static readonly List<string> Errors = new();

    public static void Reset() => Errors.Clear();

    public static bool HasErrors => Errors.Count > 0;

    public static void ThrowIfAny(string context)
    {
        if (Errors.Count > 0)
        {
            var details = string.Join("; ", Errors);
            Errors.Clear();
            throw new Exceptions.ValidationException($"Invalid {context}: {details}", details);
        }
        Errors.Clear();
    }

    public static void Required(string? value, string field, int maxLength, string? minLengthMessage = null)
    {
        if (string.IsNullOrWhiteSpace(value))
            Errors.Add($"{field} is required.");
        else if (value.Length > maxLength)
            Errors.Add($"{field} must be at most {maxLength} characters.");
        else if (minLengthMessage != null && value.Length < 0)
            Errors.Add(minLengthMessage);
    }

    public static void MaxLength(string? value, string field, int maxLength)
    {
        if (!string.IsNullOrWhiteSpace(value) && value.Length > maxLength)
            Errors.Add($"{field} must be at most {maxLength} characters.");
    }

    public static void Email(string? value, string field, int maxLength = 200)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            Errors.Add($"{field} is required.");
            return;
        }
        if (value.Length > maxLength)
            Errors.Add($"{field} must be at most {maxLength} characters.");
        if (!EmailRegex.IsMatch(value))
            Errors.Add($"{field} must be a valid email address.");
    }

    public static void EmailOrPhone(string? value, string field, int maxLength = 200)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            Errors.Add($"{field} is required.");
            return;
        }
        if (value.Length > maxLength)
            Errors.Add($"{field} must be at most {maxLength} characters.");
        if (!EmailRegex.IsMatch(value) && !Regex.IsMatch(value, @"^[0-9+\-(). ]{7,20}$"))
            Errors.Add($"{field} must be a valid email or phone number.");
    }

    public static void Slug(string? value, string field, int maxLength = 100)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            Errors.Add($"{field} is required.");
            return;
        }
        if (value.Length > maxLength)
            Errors.Add($"{field} must be at most {maxLength} characters.");
        if (!SlugRegex.IsMatch(value))
            Errors.Add($"{field} must be lowercase letters, numbers, and hyphens only.");
    }

    public static void EnumValue<TEnum>(string? value, string field) where TEnum : struct, Enum
    {
        if (string.IsNullOrWhiteSpace(value) || !Enum.TryParse<TEnum>(value, true, out _))
            Errors.Add($"{field} must be one of: {string.Join(", ", Enum.GetNames<TEnum>())}.");
    }

    public static void InSet(string? value, string field, IEnumerable<string> allowed)
    {
        if (string.IsNullOrWhiteSpace(value) || !allowed.Contains(value, StringComparer.OrdinalIgnoreCase))
            Errors.Add($"{field} must be one of: {string.Join(", ", allowed)}.");
    }

    public static void Url(string? value, string field, int maxLength = 500)
    {
        if (string.IsNullOrWhiteSpace(value)) return;
        if (value.Length > maxLength)
            Errors.Add($"{field} must be at most {maxLength} characters.");
        if (!Uri.TryCreate(value, UriKind.Absolute, out var uri) ||
            (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps))
            Errors.Add($"{field} must be a valid http(s) URL.");
    }

    public static void Range(int value, string field, int min, int max)
    {
        if (value < min || value > max)
            Errors.Add($"{field} must be between {min} and {max}.");
    }

    public static void GreaterThan(decimal value, string field, decimal min, bool exclusive = true)
    {
        if (exclusive ? value <= min : value < min)
            Errors.Add($"{field} must be greater than {min}.");
    }

    public static void NotDefault(Guid value, string field)
    {
        if (value == Guid.Empty)
            Errors.Add($"{field} is required.");
    }

    public static void Password(string? value, string field = "password", int minLength = 8)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            Errors.Add($"{field} is required.");
            return;
        }
        if (value.Length < minLength)
            Errors.Add($"{field} must be at least {minLength} characters.");
        if (value.Length > 100)
            Errors.Add($"{field} must be at most 100 characters.");
    }

    /// <summary>Generates a URL-safe slug from a title.</summary>
    public static string Slugify(string value)
    {
        var s = value.Trim().ToLowerInvariant();
        s = Regex.Replace(s, @"[^a-z0-9]+", "-");
        s = Regex.Replace(s, @"-{2,}", "-").Trim('-');
        return s.Length > 90 ? s[..90] : s;
    }
}

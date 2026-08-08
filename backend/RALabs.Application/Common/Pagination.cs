namespace RALabs.Application.Common;

public class PaginatedResult<T>
{
    public List<T> Items { get; set; } = new();
    public int Page { get; set; }
    public int PageSize { get; set; }
    public int TotalCount { get; set; }
    public int TotalPages => PageSize <= 0 ? 0 : (int)Math.Ceiling(TotalCount / (double)PageSize);
}

public static class PageRequest
{
    public const int DefaultPage = 1;
    public const int DefaultPageSize = 20;
    public const int MaxPageSize = 100;

    public static (int Page, int PageSize) Normalize(int? page, int? pageSize)
    {
        var p = page ?? DefaultPage;
        var ps = pageSize ?? DefaultPageSize;
        if (p < 1) p = 1;
        if (ps < 1) ps = DefaultPageSize;
        if (ps > MaxPageSize) ps = MaxPageSize;
        return (p, ps);
    }
}

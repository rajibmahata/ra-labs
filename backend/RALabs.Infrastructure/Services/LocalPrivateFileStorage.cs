using RALabs.Application.Services;

namespace RALabs.Infrastructure.Services;

public sealed class LocalPrivateFileStorage : IPrivateFileStorage
{
    private readonly string _rootPath;

    public LocalPrivateFileStorage(string? rootPath)
    {
        _rootPath = Path.GetFullPath(string.IsNullOrWhiteSpace(rootPath)
            ? Path.Combine(AppContext.BaseDirectory, "private-storage")
            : rootPath);
        Directory.CreateDirectory(_rootPath);
    }

    public async Task SaveAsync(string key, Stream content, CancellationToken cancellationToken = default)
    {
        var path = GetPath(key);
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        await using var output = new FileStream(path, FileMode.CreateNew, FileAccess.Write, FileShare.None);
        await content.CopyToAsync(output, cancellationToken);
    }

    public Task<Stream> OpenReadAsync(string key, CancellationToken cancellationToken = default)
    {
        var path = GetPath(key);
        if (!File.Exists(path))
            throw new FileNotFoundException("Stored document was not found.");
        Stream stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read);
        return Task.FromResult(stream);
    }

    private string GetPath(string key)
    {
        if (string.IsNullOrWhiteSpace(key) || key.Contains("..", StringComparison.Ordinal) || Path.IsPathRooted(key))
            throw new InvalidOperationException("Invalid storage key.");
        return Path.Combine(_rootPath, key.Replace('/', Path.DirectorySeparatorChar));
    }
}
using RALabs.Application.Services;

namespace RALabs.Api.Jobs;

public class GithubSyncOptions
{
    public const string SectionName = "GithubSync";
    public int RunIntervalHours { get; set; } = 24;
}

public class GithubSyncHostedService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<GithubSyncHostedService> _logger;
    private readonly int _intervalHours;

    public GithubSyncHostedService(
        IServiceScopeFactory scopeFactory,
        IConfiguration config,
        ILogger<GithubSyncHostedService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
        _intervalHours = config.GetValue<int>($"{GithubSyncOptions.SectionName}:RunIntervalHours", 24);
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Initial run shortly after startup, then on the configured interval.
        await DelayAsync(TimeSpan.FromSeconds(15), stoppingToken);
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await RunSyncAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "GitHub sync run failed.");
            }
            await DelayAsync(TimeSpan.FromHours(_intervalHours), stoppingToken);
        }
    }

    private async Task RunSyncAsync(CancellationToken ct)
    {
        using var scope = _scopeFactory.CreateScope();
        var svc = scope.ServiceProvider.GetRequiredService<IGithubSyncService>();
        var result = await svc.SyncAllAsync(ct);
        _logger.LogInformation("GitHub sync complete: {Status} for {Member} ({Commits} commits, {Repos} repos).",
            result.Status, result.MemberName, result.Commits90d, result.ActiveRepos);
    }

    private static Task DelayAsync(TimeSpan time, CancellationToken ct)
        => Task.Delay(time, ct);
}

using Microsoft.AspNetCore.DataProtection;
using RALabs.Application.Services;

namespace RALabs.Tests;

/// <summary>Test helpers shared by unit tests.</summary>
public static class TestHelpers
{
    public static IDataProtectionProvider EphemeralProtection() =>
        DataProtectionProvider.Create("RALabs.Tests");

    public static ITranslationAgentService NoOpTranslations() => new NoOpTranslationAgent();

    private sealed class NoOpTranslationAgent : ITranslationAgentService
    {
        public Task EnsureTranslatedAsync(string locale, CancellationToken ct) => Task.CompletedTask;
    }
}

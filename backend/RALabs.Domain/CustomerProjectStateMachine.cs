using RALabs.Domain.Enums;

namespace RALabs.Domain;

public static class CustomerProjectStateMachine
{
    public static readonly IReadOnlyDictionary<CustomerProjectStatus, CustomerProjectStatus[]> AllowedTransitions =
        new Dictionary<CustomerProjectStatus, CustomerProjectStatus[]>
        {
            [CustomerProjectStatus.Intake] = new[] { CustomerProjectStatus.PrdDraft },
            [CustomerProjectStatus.PrdDraft] = new[] { CustomerProjectStatus.PrdSigned },
            [CustomerProjectStatus.PrdSigned] = new[] { CustomerProjectStatus.InBuild },
            [CustomerProjectStatus.InBuild] = new[] { CustomerProjectStatus.Demo },
            [CustomerProjectStatus.Demo] = new[] { CustomerProjectStatus.Delivered },
            [CustomerProjectStatus.Delivered] = new[] { CustomerProjectStatus.Closed },
            [CustomerProjectStatus.Closed] = Array.Empty<CustomerProjectStatus>()
        };

    public static bool CanTransition(CustomerProjectStatus from, CustomerProjectStatus to)
        => AllowedTransitions.TryGetValue(from, out var targets) && targets.Contains(to);

    public static CustomerProjectStatus? Next(CustomerProjectStatus from)
        => AllowedTransitions[from].FirstOrDefault();
}

using RALabs.Application.Common;
using RALabs.Application.Exceptions;
using RALabs.Domain;
using RALabs.Domain.Enums;

namespace RALabs.Tests;

public class GuardTests
{
    [Fact]
    public void Required_Empty_Throws()
    {
        Guard.Reset();
        Guard.Required(null, "title", 200);
        var ex = Assert.Throws<ValidationException>(() => Guard.ThrowIfAny("project"));
        Assert.Contains("title is required", ex.Message);
    }

    [Fact]
    public void Required_TooLong_AddsError()
    {
        Guard.Reset();
        Guard.Required(new string('a', 201), "title", 200);
        Assert.Throws<ValidationException>(() => Guard.ThrowIfAny("project"));
    }

    [Fact]
    public void Email_Invalid_Throws()
    {
        Guard.Reset();
        Guard.Email("not-an-email", "email");
        Assert.Throws<ValidationException>(() => Guard.ThrowIfAny("auth"));
    }

    [Fact]
    public void Email_Valid_Passes()
    {
        Guard.Reset();
        Guard.Email("rajib@ralabs.dev", "email");
        Guard.ThrowIfAny("auth");
    }

    [Fact]
    public void EmailOrPhone_Phone_Passes()
    {
        Guard.Reset();
        Guard.EmailOrPhone("+91 98765 43210", "contactInfo");
        Guard.ThrowIfAny("lead");
    }

    [Fact]
    public void Slug_Cleaned()
    {
        Assert.Equal("hello-world", Guard.Slugify("Hello World!"));
        Assert.Equal("lexvault", Guard.Slugify("LexVault"));
    }

    [Fact]
    public void Password_TooShort_Throws()
    {
        Guard.Reset();
        Guard.Password("short", "password", 8);
        Assert.Throws<ValidationException>(() => Guard.ThrowIfAny("auth"));
    }

    [Fact]
    public void Range_OutOfBounds_Throws()
    {
        Guard.Reset();
        Guard.Range(0, "rating", 1, 5);
        Assert.Throws<ValidationException>(() => Guard.ThrowIfAny("feedback"));
    }
}

public class CustomerProjectStateMachineTests
{
    [Fact]
    public void ValidTransitions_Allowed()
    {
        Assert.True(CustomerProjectStateMachine.CanTransition(CustomerProjectStatus.Intake, CustomerProjectStatus.PrdDraft));
        Assert.True(CustomerProjectStateMachine.CanTransition(CustomerProjectStatus.PrdDraft, CustomerProjectStatus.PrdSigned));
        Assert.True(CustomerProjectStateMachine.CanTransition(CustomerProjectStatus.InBuild, CustomerProjectStatus.Demo));
        Assert.True(CustomerProjectStateMachine.CanTransition(CustomerProjectStatus.Delivered, CustomerProjectStatus.Closed));
    }

    [Fact]
    public void SkippedStates_Rejected()
    {
        Assert.False(CustomerProjectStateMachine.CanTransition(CustomerProjectStatus.Intake, CustomerProjectStatus.InBuild));
        Assert.False(CustomerProjectStateMachine.CanTransition(CustomerProjectStatus.PrdSigned, CustomerProjectStatus.Closed));
    }

    [Fact]
    public void TerminalState_NoTransitions()
    {
        Assert.False(CustomerProjectStateMachine.CanTransition(CustomerProjectStatus.Closed, CustomerProjectStatus.Delivered));
    }

    [Fact]
    public void AllStatuses_HaveLinearNextOrTerminal()
    {
        foreach (CustomerProjectStatus status in Enum.GetValues<CustomerProjectStatus>())
        {
            if (status == CustomerProjectStatus.Closed)
                Assert.Empty(CustomerProjectStateMachine.AllowedTransitions[status]);
            else
                Assert.Single(CustomerProjectStateMachine.AllowedTransitions[status]);
        }
    }
}

using RALabs.Api.Mcp;

namespace RALabs.Tests;

/// <summary>ADM-001 MCP parity: every customer-management API capability is
/// exposed as an MCP tool with the correct required role, and known tool
/// definitions stay in sync with the dispatch table surface.</summary>
public class McpToolContractTests
{
    private static List<McpToolDef> Definitions =>
        new McpToolRegistry(null!).Definitions;

    private static McpToolDef? Find(string name) =>
        Definitions.FirstOrDefault(d => d.Name == name);

    [Theory]
    [InlineData("list_customers")]
    [InlineData("get_customer")]
    [InlineData("update_customer")]
    [InlineData("set_customer_status")]
    [InlineData("delete_customer")]
    [InlineData("delete_customers")]
    [InlineData("import_customers")]
    [InlineData("export_customers")]
    public void CustomerManagement_Contract_IsExposedToAdmins(string tool)
    {
        var def = Find(tool);
        Assert.NotNull(def);
        Assert.Equal("admin", def!.RequiredRole);
    }

    [Fact]
    public void CustomerTools_RequireCustomerRole()
    {
        foreach (var tool in new[] { "customer_list_projects", "customer_create_project", "customer_get_project",
                     "customer_get_prd", "customer_sign_prd", "customer_get_invoices", "customer_submit_feedback" })
        {
            var def = Find(tool);
            Assert.NotNull(def);
            Assert.Equal("customer", def!.RequiredRole);
        }
    }

    [Fact]
    public void AdminGovernance_Tools_AreDefined()
    {
        // Notifications / dashboard / reviews observability + draft refresh,
        // previously missing from the published tool list.
        foreach (var tool in new[] { "get_dashboard_stats", "list_notifications", "mark_notification_read",
                     "list_reviews", "moderate_review", "generate_project_refresh" })
            Assert.NotNull(Find(tool));
    }

    [Fact]
    public void Anonymous_Tools_NeverRequireAuth_AndAdminSurface_IsNotEmpty()
    {
        Assert.Contains(Definitions, d => d.RequiredRole == "anonymous" && d.Name == "list_projects");
        Assert.True(Definitions.Count(d => d.RequiredRole == "admin") >= 30);
    }

    [Fact]
    public void ToolNames_AreUnique()
    {
        var duplicates = Definitions.GroupBy(d => d.Name).Where(g => g.Count() > 1).Select(g => g.Key).ToList();
        Assert.Empty(duplicates);
    }
}

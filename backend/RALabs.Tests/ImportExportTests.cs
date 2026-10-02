using System.Text;
using Microsoft.EntityFrameworkCore;
using RALabs.Application.Services;
using RALabs.Domain.Entities;
using RALabs.Domain.Enums;
using RALabs.Infrastructure.Data;

namespace RALabs.Tests;

/// <summary>Admin import/export consistency (GAP-010): leads and team members
/// import via CSV with per-row validation and duplicate handling; exports
/// produce stable, filter-honoring CSV payloads.</summary>
public class ImportExportTests
{
    private static RALabsDbContext CreateDb() => new(
        new DbContextOptionsBuilder<RALabsDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);

    private static MemoryStream CsvStream(string content) =>
        new(Encoding.UTF8.GetBytes(content));

    [Fact]
    public async Task LeadsImport_CreatesValidRows_AndSkipsDuplicates()
    {
        var db = CreateDb();
        db.Leads.Add(new Lead { Id = Guid.NewGuid(), Name = "Existing", ContactInfo = "existing@example.com", Source = LeadSource.Form, Status = LeadStatus.New, CreatedAt = DateTime.UtcNow });
        await db.SaveChangesAsync();

        var service = new LeadService(new LeadRepository(db));
        var csv = "name,contactInfo,message,source\r\n" +
                  "Priya,p@example.com,Hello there,form\r\n" +
                  "Arjun,9999999999,Call me,chatbot\r\n" +
                  "Dup,existing@example.com,Duplicate row,form\r\n" +
                  "Bad,,No contact info,form\r\n";
        var result = await service.ImportAsync(CsvStream(csv));

        Assert.Equal(2, result.Created);
        Assert.Equal(1, result.Skipped);
        Assert.Equal(2, result.Errors.Count);
        Assert.Equal(4, result.Errors[0].Row);
        Assert.Equal(5, result.Errors[1].Row);
        Assert.Equal(1, await db.Leads.CountAsync(l => l.Name == "Priya" && l.Source == LeadSource.Form && l.Status == LeadStatus.New));
        Assert.Equal(1, await db.Leads.CountAsync(l => l.Name == "Arjun" && l.Source == LeadSource.Chatbot));
    }

    [Fact]
    public async Task LeadsExport_HonorsFilters_AndReturnsHeaders()
    {
        var db = CreateDb();
        db.Leads.AddRange(
            new Lead { Id = Guid.NewGuid(), Name = "New One", ContactInfo = "new@example.com", Message = "m1", Source = LeadSource.Form, Status = LeadStatus.New, CreatedAt = DateTime.UtcNow },
            new Lead { Id = Guid.NewGuid(), Name = "Old One", ContactInfo = "old@example.com", Message = "m2", Source = LeadSource.Chatbot, Status = LeadStatus.Contacted, CreatedAt = DateTime.UtcNow });
        await db.SaveChangesAsync();

        var service = new LeadService(new LeadRepository(db));
        var bytes = await service.ExportAsync("new", "form");
        var text = Encoding.UTF8.GetString(bytes).Replace("\r\n", "\n");

        Assert.StartsWith("id,name,contactInfo,message,source,status,notes,createdAt\n", text);
        Assert.Contains("New One", text);
        Assert.DoesNotContain("Old One", text);
    }

    [Fact]
    public async Task TeamImport_CreatesRows_AndSkipsExistingSlugs()
    {
        var db = CreateDb();
        db.TeamMembers.Add(new TeamMember { Id = Guid.NewGuid(), Name = "Rajib", Slug = "rajib", Role = "Founder", Bio = "bio", IsActive = true, CreatedAt = DateTime.UtcNow });
        await db.SaveChangesAsync();

        var service = new TeamService(new TeamRepository(db), TestHelpers.EphemeralProtection());
        var csv = "name,role,bio,slug,githubUsername,githubAccountUrl,email,linkedinUrl,avatarUrl,location,isPublished\r\n" +
                  "Abhishek,Founder,Co-founder bio,,abhishek,https://github.com/abhishek,abhishek@example.com,,https://example.com/a.png,Kolkata,false\r\n" +
                  "Rajib,Founder,Duplicate slug,rajib,,,,,,,false\r\n" +
                  "Trio,Engineer,Engineer bio,trio,,\"\",\"\",\"\",\"\",\"\",true\r\n";
        var result = await service.ImportAsync(CsvStream(csv));

        Assert.Equal(2, result.Created);
        Assert.Equal(1, result.Skipped);
        Assert.Contains(result.Errors, e => e.Row == 3 && e.Message.Contains("slug 'rajib'"));
        Assert.Equal(1, await db.TeamMembers.CountAsync(m => m.Name == "Abhishek" && m.Slug == "abhishek" && m.IsPublished == false));
        Assert.Equal(1, await db.TeamMembers.CountAsync(m => m.Name == "Trio" && m.Slug == "trio" && m.IsPublished));
    }

    [Fact]
    public async Task TeamExport_AndContentExport_ProduceExpectedPayloads()
    {
        var db = CreateDb();
        db.TeamMembers.Add(new TeamMember { Id = Guid.NewGuid(), Name = "Rajib, " + "Quote \"Q\"", Slug = "rajib", Role = "Founder", Bio = "bio", IsActive = true, CreatedAt = DateTime.UtcNow });
        db.PageContents.Add(new PageContent { Id = Guid.NewGuid(), Key = "hero.title", Locale = "en", Value = "Hello, world" });
        await db.SaveChangesAsync();

        var team = new TeamService(new TeamRepository(db), TestHelpers.EphemeralProtection());
        var teamCsv = Encoding.UTF8.GetString(await team.ExportAsync()).Replace("\r\n", "\n");
        Assert.StartsWith("id,name,slug,role,bio,githubUsername,githubAccountUrl,email,linkedinUrl,avatarUrl,location,isActive,isPublished,createdAt\n", teamCsv);
        Assert.Contains("\"Rajib, Quote \"\"Q\"\"\"", teamCsv);

        var content = new ContentService(new ContentRepository(db), TestHelpers.NoOpTranslations());
        var contentCsv = Encoding.UTF8.GetString(await content.ExportAsync(null)).Replace("\r\n", "\n");
        Assert.StartsWith("key,locale,value,updatedAt\n", contentCsv);
        Assert.Contains("\"Hello, world\"", contentCsv);
    }
}

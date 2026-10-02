using System.Text;
using Microsoft.EntityFrameworkCore;
using RALabs.Application.DTOs;
using RALabs.Application.Exceptions;
using RALabs.Application.Services;
using RALabs.Domain.Entities;
using RALabs.Domain.Enums;
using RALabs.Infrastructure.Data;
using RALabs.Infrastructure.Services;

namespace RALabs.Tests;

/// <summary>Customer-management QA (ADM-001 / GAP-029 backend contract): search,
/// filtered pagination, edit validation, duplicate email, lifecycle token
/// revocation, deletion cleanup, import row errors, and export payload shape.</summary>
public class CustomerManagementTests
{
    private static RALabsDbContext CreateDb() => new(
        new DbContextOptionsBuilder<RALabsDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);

    private static CustomerManagementService CreateService(RALabsDbContext db) =>
        new(new CustomerRepository(db), new CustomerProjectRepository(db),
            new KnowledgeChunkRepository(db), new PasswordHasher());

    private static Customer Customer(string name, string email, bool isActive = true)
    {
        var customer = new Customer
        {
            Id = Guid.NewGuid(),
            Name = name,
            Email = email,
            IsActive = isActive,
            PasswordHash = "salt:hash",
            CreatedAt = DateTime.UtcNow
        };
        return customer;
    }

    [Fact]
    public async Task List_SearchAndActiveFilter_Paginate_WithTotals()
    {
        var db = CreateDb();
        db.Customers.AddRange(
            Customer("Asha Kumar", "asha@example.com"),
            Customer("Bilal Khan", "bilal@example.com", isActive: false),
            Customer("Ashley Cole", "ashley@example.com"));
        await db.SaveChangesAsync();

        var service = CreateService(db);

        var bySearch = await service.ListAsync(1, 20, "asha", null);
        Assert.Single(bySearch.Items);
        Assert.Equal("Asha Kumar", bySearch.Items[0].Name);
        Assert.Equal(1, bySearch.TotalCount);

        var inactive = await service.ListAsync(null, null, null, false);
        Assert.Single(inactive.Items);
        Assert.Equal("Bilal Khan", inactive.Items[0].Name);

        var everyone = await service.ListAsync(1, 2, null, null);
        Assert.Equal(2, everyone.Items.Count);
        Assert.Equal(3, everyone.TotalCount);
    }

    [Fact]
    public async Task Update_DuplicateEmail_Conflicts()
    {
        var db = CreateDb();
        var first = Customer("First", "first@example.com");
        var second = Customer("Second", "second@example.com");
        db.Customers.AddRange(first, second);
        await db.SaveChangesAsync();

        var service = CreateService(db);

        await Assert.ThrowsAsync<ConflictException>(() => service.UpdateAsync(
            second.Id, new UpdateCustomerByAdminRequest("Second", "FIRST@example.com", null)));
    }

    [Fact]
    public async Task Update_PasswordReset_ClearsRefreshToken()
    {
        var db = CreateDb();
        var customer = Customer("Existing", "existing@example.com");
        customer.RefreshTokenHash = "token-hash";
        customer.RefreshTokenExpiresAt = DateTime.UtcNow.AddDays(7);
        db.Customers.Add(customer);
        await db.SaveChangesAsync();

        var service = CreateService(db);
        var result = await service.UpdateAsync(customer.Id,
            new UpdateCustomerByAdminRequest("Existing Renamed", "renamed@example.com", "NewPassword@123"));

        Assert.Equal("Existing Renamed", result.Name);
        Assert.Null(customer.RefreshTokenHash);
        Assert.Null(customer.RefreshTokenExpiresAt);
        Assert.NotEqual("salt:hash", customer.PasswordHash);
    }

    [Fact]
    public async Task SetStatus_Deactivate_ClearsRefreshToken_AndActivates_Restores()
    {
        var db = CreateDb();
        var customer = Customer("Toggle", "toggle@example.com");
        customer.RefreshTokenHash = "token-hash";
        customer.RefreshTokenExpiresAt = DateTime.UtcNow.AddDays(7);
        db.Customers.Add(customer);
        await db.SaveChangesAsync();

        var service = CreateService(db);
        var deactivated = await service.SetStatusAsync(customer.Id, false);
        Assert.False(deactivated.IsActive);
        Assert.Null(customer.RefreshTokenHash);

        var activated = await service.SetStatusAsync(customer.Id, true);
        Assert.True(activated.IsActive);
    }

    [Fact]
    public async Task Delete_RemovesProjectKnowledgeChunks_ThenCustomer()
    {
        var db = CreateDb();
        var customer = Customer("Doomed", "doomed@example.com");
        var project = new CustomerProject
        {
            Id = Guid.NewGuid(),
            CustomerId = customer.Id,
            Customer = customer,
            Title = "Doomed project",
            Status = CustomerProjectStatus.Intake,
            CreatedAt = DateTime.UtcNow
        };
        db.Customers.Add(customer);
        db.CustomerProjects.Add(project);
        db.KnowledgeChunks.Add(new KnowledgeChunk
        {
            Id = Guid.NewGuid(),
            SourceType = KnowledgeSourceType.CustomerDocument,
            SourceId = project.Id.ToString(),
            CustomerProjectId = project.Id,
            Locale = "en",
            ChunkText = "private chunk",
            CreatedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync();

        var service = CreateService(db);
        await service.DeleteAsync(customer.Id);

        Assert.Empty(await db.KnowledgeChunks.Where(c => c.CustomerProjectId == project.Id).ToListAsync());
        Assert.Null(await db.Customers.FindAsync(customer.Id));
        Assert.Null(await db.CustomerProjects.FindAsync(project.Id));
    }

    [Fact]
    public async Task DeleteMany_DeduplicatesIds()
    {
        var db = CreateDb();
        var one = Customer("One", "one@example.com");
        var two = Customer("Two", "two@example.com");
        db.Customers.AddRange(one, two);
        await db.SaveChangesAsync();

        var service = CreateService(db);
        await service.DeleteManyAsync(new[] { one.Id, one.Id, two.Id });

        Assert.Equal(0, await db.Customers.CountAsync());
    }

    [Fact]
    public async Task Import_EmptyFile_AndBadHeaders_AreRejected()
    {
        var db = CreateDb();
        var service = CreateService(db);

        var empty = await service.ImportAsync(new MemoryStream(Encoding.UTF8.GetBytes("")));
        Assert.Equal(0, empty.Created);
        Assert.Contains(empty.Errors, e => e.Message.Contains("empty", StringComparison.OrdinalIgnoreCase));

        var badHeaders = await service.ImportAsync(new MemoryStream(
            Encoding.UTF8.GetBytes("name,email\r\nX,x@example.com\r\n")));
        Assert.Equal(0, badHeaders.Created);
        Assert.Contains(badHeaders.Errors, e => e.Message.Contains("Headers must be", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public async Task Import_CreatesRows_SkipsDuplicates_ReportsRowErrors()
    {
        var db = CreateDb();
        db.Customers.Add(Customer("Existing", "existing@example.com"));
        await db.SaveChangesAsync();

        var service = CreateService(db);
        var csv = "name,email,password\r\n" +
                  "New One,new1@example.com,Password@123\r\n" +
                  "Dup,dup@example.com,bad\r\n" +
                  "Dup,dup@example.com,Another@123\r\n" +
                  "Existing,EXISTING@example.com,Whatever@123\r\n" +
                  "Bad Email,not-an-email,Password@123\r\n";
        var result = await service.ImportAsync(new MemoryStream(Encoding.UTF8.GetBytes(csv)));

        // Header is row 1; data rows are numbered from 2.
        Assert.Equal(2, result.Created);          // New One + first valid Dup row
        Assert.Equal(1, result.Skipped);          // seeded account collision
        Assert.Equal(3, result.Errors.Count);
        Assert.Contains(result.Errors, e => e.Row == 3); // invalid password on the first Dup row
        Assert.Contains(result.Errors, e => e.Row == 5 && e.Message.Contains("already exists", StringComparison.OrdinalIgnoreCase));
        Assert.Contains(result.Errors, e => e.Row == 6); // invalid email
        // The duplicate email was imported exactly once (first valid occurrence).
        Assert.Equal(1, await db.Customers.CountAsync(c => c.Email == "dup@example.com"));
        // The valid row is stored with a real password hash (never plaintext).
        var created = await db.Customers.SingleAsync(c => c.Email == "new1@example.com");
        Assert.NotEqual("Password@123", created.PasswordHash);
    }

    [Fact]
    public async Task Import_ExceedingMaxRows_IsRejected()
    {
        var db = CreateDb();
        var service = CreateService(db);

        var csv = new StringBuilder("name,email,password\r\n");
        for (var i = 0; i < 501; i++)
            csv.Append($"User {i},user{i}@example.com,Password@123\r\n");

        var result = await service.ImportAsync(new MemoryStream(Encoding.UTF8.GetBytes(csv.ToString())));
        Assert.Equal(0, result.Created);
        Assert.Contains(result.Errors, e => e.Message.Contains("500", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public async Task Export_HonorsIdsFilter_AndNeverContainsCredentialColumns()
    {
        var db = CreateDb();
        var kept = Customer("Kept", "kept@example.com");
        var dropped = Customer("Dropped", "dropped@example.com");
        dropped.PasswordHash = "secret-hash:values";
        dropped.RefreshTokenHash = "refresh-secret";
        db.Customers.AddRange(kept, dropped);
        await db.SaveChangesAsync();

        var service = CreateService(db);
        var text = Encoding.UTF8.GetString(await service.ExportAsync(new[] { kept.Id }, null, null));

        Assert.StartsWith("id,name,email,isActive,createdAt,projectCount", text.Replace("\r\n", "\n"));
        Assert.Contains("kept@example.com", text);
        Assert.DoesNotContain("dropped@example.com", text);
        Assert.DoesNotContain("secret-hash", text);
        Assert.DoesNotContain("refresh-secret", text);
        Assert.DoesNotContain("passwordHash", text, StringComparison.OrdinalIgnoreCase);
    }
}

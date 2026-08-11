using System.Globalization;
using System.Text;
using RALabs.Application.Common;
using RALabs.Application.DTOs;
using RALabs.Application.Exceptions;
using RALabs.Domain.Entities;
using RALabs.Domain.Interfaces;

namespace RALabs.Application.Services;

public interface ICustomerManagementService
{
    Task<PaginatedResult<AdminCustomerDto>> ListAsync(int? page, int? pageSize, string? search, bool? isActive);
    Task<AdminCustomerDto> GetAsync(Guid id);
    Task<AdminCustomerDto> UpdateAsync(Guid id, UpdateCustomerByAdminRequest request);
    Task<AdminCustomerDto> SetStatusAsync(Guid id, bool isActive);
    Task DeleteAsync(Guid id);
    Task DeleteManyAsync(IEnumerable<Guid> ids);
    Task<CustomerImportResultDto> ImportAsync(Stream csv);
    Task<byte[]> ExportAsync(IEnumerable<Guid>? ids, string? search, bool? isActive);
}

public sealed class CustomerManagementService : ICustomerManagementService
{
    private const int MaxImportRows = 500;
    private readonly ICustomerRepository _customers;
    private readonly ICustomerProjectRepository _projects;
    private readonly IKnowledgeChunkRepository _chunks;
    private readonly IPasswordHasher _hasher;

    public CustomerManagementService(
        ICustomerRepository customers,
        ICustomerProjectRepository projects,
        IKnowledgeChunkRepository chunks,
        IPasswordHasher hasher)
    {
        _customers = customers;
        _projects = projects;
        _chunks = chunks;
        _hasher = hasher;
    }

    public async Task<PaginatedResult<AdminCustomerDto>> ListAsync(int? page, int? pageSize, string? search, bool? isActive)
    {
        var (normalizedPage, normalizedPageSize) = PageRequest.Normalize(page, pageSize);
        var customers = await _customers.GetAllAsync(normalizedPage, normalizedPageSize, search, isActive);
        var total = await _customers.CountAllAsync(search, isActive);
        return new PaginatedResult<AdminCustomerDto>
        {
            Items = customers.Select(ToDto).ToList(),
            Page = normalizedPage,
            PageSize = normalizedPageSize,
            TotalCount = total
        };
    }

    public async Task<AdminCustomerDto> GetAsync(Guid id) => ToDto(await FindAsync(id));

    public async Task<AdminCustomerDto> UpdateAsync(Guid id, UpdateCustomerByAdminRequest request)
    {
        Guard.Reset();
        Guard.Required(request.Name, "name", 100);
        Guard.Email(request.Email, "email", 200);
        if (!string.IsNullOrWhiteSpace(request.Password)) Guard.Password(request.Password);
        Guard.ThrowIfAny("customer account");

        var customer = await FindAsync(id);
        var email = request.Email.Trim().ToLowerInvariant();
        if (await _customers.EmailExistsAsync(email, id))
            throw new ConflictException("An account with this email already exists.");

        customer.Name = request.Name.Trim();
        customer.Email = email;
        if (!string.IsNullOrWhiteSpace(request.Password)) customer.PasswordHash = _hasher.Hash(request.Password);
        customer.RefreshTokenHash = null;
        customer.RefreshTokenExpiresAt = null;
        customer.UpdatedAt = DateTime.UtcNow;
        await _customers.UpdateAsync(customer);
        return ToDto(customer);
    }

    public async Task<AdminCustomerDto> SetStatusAsync(Guid id, bool isActive)
    {
        var customer = await FindAsync(id);
        customer.IsActive = isActive;
        customer.UpdatedAt = DateTime.UtcNow;
        if (!isActive)
        {
            customer.RefreshTokenHash = null;
            customer.RefreshTokenExpiresAt = null;
        }
        await _customers.UpdateAsync(customer);
        return ToDto(customer);
    }

    public async Task DeleteAsync(Guid id)
    {
        var customer = await FindAsync(id);
        foreach (var projectId in await _projects.GetIdsByCustomerAsync(id))
            await _chunks.DeleteByProjectAsync(projectId);
        await _customers.DeleteAsync(customer);
    }

    public async Task DeleteManyAsync(IEnumerable<Guid> ids)
    {
        foreach (var id in ids.Distinct()) await DeleteAsync(id);
    }

    public async Task<CustomerImportResultDto> ImportAsync(Stream csv)
    {
        using var reader = new StreamReader(csv, Encoding.UTF8, leaveOpen: true);
        var rows = new List<string[]>();
        string? line;
        while ((line = await reader.ReadLineAsync()) is not null)
        {
            if (!string.IsNullOrWhiteSpace(line)) rows.Add(CsvHelper.ParseLine(line));
            if (rows.Count > MaxImportRows + 1) break;
        }

        var errors = new List<CustomerImportErrorDto>();
        if (rows.Count == 0)
            return new CustomerImportResultDto(0, 0, new List<CustomerImportErrorDto> { new(1, "The CSV file is empty.") });
        if (rows[0].Length != 3 || !rows[0][0].Equals("name", StringComparison.OrdinalIgnoreCase) ||
            !rows[0][1].Equals("email", StringComparison.OrdinalIgnoreCase) || !rows[0][2].Equals("password", StringComparison.OrdinalIgnoreCase))
            return new CustomerImportResultDto(0, 0, new List<CustomerImportErrorDto> { new(1, "Headers must be: name,email,password.") });
        if (rows.Count - 1 > MaxImportRows)
            return new CustomerImportResultDto(0, 0, new List<CustomerImportErrorDto> { new(2, $"Import cannot exceed {MaxImportRows} rows.") });

        var created = 0;
        var skipped = 0;
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        for (var index = 1; index < rows.Count; index++)
        {
            var rowNumber = index + 1;
            var row = rows[index];
            if (row.Length != 3)
            {
                errors.Add(new(rowNumber, "Each row must contain name, email, and password."));
                continue;
            }
            var name = row[0].Trim();
            var email = row[1].Trim().ToLowerInvariant();
            var password = row[2];
            Guard.Reset();
            Guard.Required(name, "name", 100);
            Guard.Email(email, "email", 200);
            Guard.Password(password);
            try { Guard.ThrowIfAny("customer row"); }
            catch (ValidationException ex) { errors.Add(new(rowNumber, ex.Message)); continue; }
            if (!seen.Add(email) || await _customers.EmailExistsAsync(email))
            {
                skipped++;
                errors.Add(new(rowNumber, "A customer with this email already exists."));
                continue;
            }
            await _customers.AddAsync(new Customer
            {
                Id = Guid.NewGuid(),
                Name = name,
                Email = email,
                PasswordHash = _hasher.Hash(password),
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            });
            created++;
        }
        return new CustomerImportResultDto(created, skipped, errors);
    }

    public async Task<byte[]> ExportAsync(IEnumerable<Guid>? ids, string? search, bool? isActive)
    {
        var all = await _customers.GetAllAsync(1, int.MaxValue, search, isActive);
        var selected = ids is null ? all : all.Where(customer => ids.Contains(customer.Id)).ToList();
        var builder = new StringBuilder("id,name,email,isActive,createdAt,projectCount\r\n");
        foreach (var customer in selected)
        {
            builder.AppendLine(string.Join(',',
                customer.Id,
                CsvHelper.Escape(customer.Name),
                CsvHelper.Escape(customer.Email),
                customer.IsActive,
                customer.CreatedAt.ToString("O", CultureInfo.InvariantCulture),
                customer.Projects.Count));
        }
        return Encoding.UTF8.GetBytes(builder.ToString());
    }

    private async Task<Customer> FindAsync(Guid id) =>
        await _customers.GetByIdAsync(id) ?? throw new NotFoundException("Customer not found.");

    private static AdminCustomerDto ToDto(Customer customer) =>
        new(customer.Id, customer.Name, customer.Email, customer.IsActive, customer.CreatedAt, customer.UpdatedAt, customer.Projects.Count);
}

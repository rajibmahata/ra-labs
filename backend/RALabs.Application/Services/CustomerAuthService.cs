using RALabs.Application.Common;
using RALabs.Application.DTOs;
using RALabs.Application.Exceptions;
using RALabs.Domain;
using RALabs.Domain.Entities;
using RALabs.Domain.Enums;
using RALabs.Domain.Interfaces;
using System.Security.Cryptography;

namespace RALabs.Application.Services;

public interface ICustomerAuthService
{
    Task<CustomerLoginResponse> RegisterAsync(CustomerRegisterRequest request);
    Task<CustomerDto> CreateByAdminAsync(CreateCustomerByAdminRequest request);
    Task<CustomerLoginResponse> LoginAsync(LoginRequest request);
    Task<CustomerLoginResponse> RefreshAsync(RefreshTokenRequest request);
    Task ForgotPasswordAsync(ForgotPasswordRequest request);
    Task ResetPasswordAsync(ResetPasswordRequest request);
}

public record CustomerRegisterRequest(string Name, string Email, string Password);
public record CreateCustomerByAdminRequest(string Name, string Email, string Password);
public record CustomerLoginResponse(string AccessToken, string RefreshToken, DateTime ExpiresAt, CustomerDto User);
public record CustomerDto(Guid Id, string Name, string Email);

public interface ICustomerProjectService
{
    Task<CustomerProjectDto> CreateAsync(Guid customerId, CreateCustomerProjectRequest request);
    Task<List<CustomerProjectDto>> GetMyProjectsAsync(Guid customerId, int? page, int? pageSize);
    Task<CustomerProjectDto> GetMyProjectAsync(Guid customerId, Guid id);
    Task<CustomerProjectDto> GetForAdminAsync(Guid id);
    Task<List<CustomerProjectDto>> GetAllForAdminAsync(int? page, int? pageSize, string? status, string? search, Guid? customerId);
    Task<CustomerProjectDto> UpdateStatusAsync(Guid id, UpdateCustomerProjectRequest request);
    Task<DocumentDto> UploadDocumentAsync(Guid customerId, Guid projectId, string fileName, Stream content, string contentType, long fileSize, string? description);
    Task<StoredDocumentDownload> DownloadDocumentAsync(Guid customerId, Guid projectId, Guid documentId);
    Task<List<DocumentDto>> GetDocumentsAsync(Guid projectId);
    Task<List<DocumentDto>> GetMyDocumentsAsync(Guid customerId, Guid projectId);
    Task<ClientPrdDto> GetPrdAsync(Guid id);
    Task<ClientPrdDto> GetMyPrdAsync(Guid customerId, Guid projectId);
    Task<ClientPrdDto> SavePrdAsync(Guid id, SavePrdRequest request);
    Task<ClientPrdDto> SignPrdAsync(Guid customerId, Guid id, SignPrdRequest request);
    Task<ClientPrdDto> AdminSignPrdAsync(Guid id, string adminName);
    Task<DemoDto> AddDemoAsync(Guid id, AddDemoRequest request);
    Task<DemoDto?> GetDemoAsync(Guid id);
    Task<DemoDto?> GetMyDemoAsync(Guid customerId, Guid projectId);
    Task<InvoiceDto> CreateInvoiceAsync(Guid id, CreateInvoiceRequest request);
    Task<List<InvoiceDto>> GetInvoicesAsync(Guid id);
    Task<List<InvoiceDto>> GetMyInvoicesAsync(Guid customerId, Guid projectId);
    Task<FeedbackDto> SubmitFeedbackAsync(Guid customerId, Guid id, SubmitFeedbackRequest request);
    Task<FeedbackDto?> GetFeedbackAsync(Guid id);
    Task<FeedbackDto> ApproveFeedbackAsync(Guid id);
    Task<PaginatedResult<AdminFeedbackDto>> GetFeedbacksForAdminAsync(int? page, int? pageSize, string? search, bool? published);
    Task<FeedbackDto> ModerateFeedbackAsync(Guid id, bool approved);
}

public record CreateCustomerProjectRequest(
    string Title,
    string? Goal = null,
    string? Audience = null,
    string? Requirements = null,
    string? Timeline = null,
    string? BudgetOrConstraints = null,
    string? ReferenceLinks = null);
public record CreateCustomerProjectByAdminRequest(
    Guid CustomerId,
    string Title,
    string? Goal = null,
    string? Audience = null,
    string? Requirements = null,
    string? Timeline = null,
    string? BudgetOrConstraints = null,
    string? ReferenceLinks = null);
public record CustomerProjectDto(Guid Id, Guid CustomerId, string Title, string Status, Guid ChatThreadId,
    int DocumentCount, string? PrdStatus, Guid? LatestDemoId, DateTime CreatedAt, DateTime? UpdatedAt, string? AdminNotes,
    string? Goal = null, string? Audience = null, string? Requirements = null, string? Timeline = null,
    string? BudgetOrConstraints = null, string? ReferenceLinks = null);
public record UpdateCustomerProjectRequest(string? Status, string? AdminNotes);
public record DocumentDto(Guid Id, Guid CustomerProjectId, string FileName, string FileUrl, string UploadedBy, string? Description, DateTime CreatedAt);
public record StoredDocumentDownload(Stream Content, string FileName, string ContentType);

public interface IPrivateFileStorage
{
    Task SaveAsync(string key, Stream content, CancellationToken cancellationToken = default);
    Task<Stream> OpenReadAsync(string key, CancellationToken cancellationToken = default);
}
public record ClientPrdDto(Guid Id, Guid CustomerProjectId, string Content, string Status, string? SignerNameCustomer, DateTime? SignedAtCustomer, string? SignerNameAdmin, DateTime? SignedAtAdmin, DateTime CreatedAt, DateTime? UpdatedAt);
public record SavePrdRequest(string Content);
public record SignPrdRequest(string ConfirmName);
public record DemoDto(Guid Id, Guid CustomerProjectId, string Type, string UrlOrAsset, string? Notes, DateTime CreatedAt);
public record AddDemoRequest(string Type, string UrlOrAsset, string? Notes);
public record InvoiceDto(Guid Id, Guid CustomerProjectId, decimal Amount, string Currency, string Status, string? Notes, DateTime CreatedAt);
public record CreateInvoiceRequest(decimal Amount, string Currency, string? Status, string? Notes);
public record FeedbackDto(Guid Id, Guid CustomerProjectId, int Rating, string Comment, bool ConsentToPublish, bool IsPublished, DateTime CreatedAt);
public record AdminFeedbackDto(Guid Id, Guid CustomerProjectId, string CustomerName, string ProjectTitle,
    int Rating, string Comment, bool ConsentToPublish, bool IsPublished, DateTime CreatedAt);
public record SubmitFeedbackRequest(int Rating, string Comment, bool ConsentToPublish);

public class CustomerAuthService : ICustomerAuthService
{
    private readonly ICustomerRepository _customers;
    private readonly IPasswordHasher _hasher;
    private readonly IJwtService _jwt;
    private readonly IEmailSender _email;
    private readonly INotificationService? _notifications;

    public CustomerAuthService(ICustomerRepository customers, IPasswordHasher hasher, IJwtService jwt, IEmailSender email, INotificationService? notifications = null)
    {
        _customers = customers;
        _hasher = hasher;
        _jwt = jwt;
        _email = email;
        _notifications = notifications;
    }

    public async Task<CustomerLoginResponse> RegisterAsync(CustomerRegisterRequest request)
    {
        Guard.Reset();
        Guard.Required(request.Name, "name", 100);
        Guard.Email(request.Email, "email", 200);
        Guard.Password(request.Password);
        Guard.ThrowIfAny("registration");

        var email = request.Email.Trim().ToLowerInvariant();
        if (await _customers.EmailExistsAsync(email))
            throw new ConflictException("An account with this email already exists.");

        var customer = new Customer
        {
            Id = Guid.NewGuid(),
            Name = request.Name.Trim(),
            Email = email,
            PasswordHash = _hasher.Hash(request.Password),
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };
        var id = await _customers.AddAsync(customer);
        customer.Id = id;
        if (_notifications is not null)
        {
            await _notifications.CreateAsync(
                "customer_registration",
                "New customer registered",
                $"{customer.Name} created a customer account.",
                customerId: customer.Id);
        }
        return await IssueTokensAsync(customer);
    }

    public async Task<CustomerDto> CreateByAdminAsync(CreateCustomerByAdminRequest request)
    {
        Guard.Reset();
        Guard.Required(request.Name, "name", 100);
        Guard.Email(request.Email, "email", 200);
        Guard.Password(request.Password);
        Guard.ThrowIfAny("customer account");

        var email = request.Email.Trim().ToLowerInvariant();
        if (await _customers.EmailExistsAsync(email))
            throw new ConflictException("An account with this email already exists.");

        var customer = new Customer
        {
            Id = Guid.NewGuid(),
            Name = request.Name.Trim(),
            Email = email,
            PasswordHash = _hasher.Hash(request.Password),
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };
        await _customers.AddAsync(customer);
        if (_notifications is not null)
            await _notifications.CreateAsync("customer_registration", "Customer added by admin", $"{customer.Name} was added to the customer workspace.", customerId: customer.Id);
        return new CustomerDto(customer.Id, customer.Name, customer.Email);
    }

    public async Task<CustomerLoginResponse> LoginAsync(LoginRequest request)
    {
        Guard.Reset();
        Guard.Email(request.Email, "email");
        Guard.Required(request.Password, "password", 100);
        Guard.ThrowIfAny("login");

        var customer = await _customers.GetByEmailAsync(request.Email.Trim().ToLowerInvariant());
        if (customer is null || !_hasher.Verify(request.Password, customer.PasswordHash))
            throw new Exceptions.UnauthorizedAccessException("Invalid email or password.");
        if (!customer.IsActive)
            throw new ForbiddenAccessException("This account has been disabled.");

        return await IssueTokensAsync(customer);
    }

    public async Task<CustomerLoginResponse> RefreshAsync(RefreshTokenRequest request)
    {
        Guard.Reset();
        Guard.Required(request.RefreshToken, "refreshToken", 500);
        Guard.ThrowIfAny("refresh");

        var hash = HashToken(request.RefreshToken);
        var customer = await _customers.GetByRefreshTokenHashAsync(hash)
            ?? throw new Exceptions.UnauthorizedAccessException("Invalid refresh token.");
        if (!customer.IsActive)
            throw new ForbiddenAccessException("This account has been disabled.");
        if (customer.RefreshTokenExpiresAt is null || DateTime.UtcNow > customer.RefreshTokenExpiresAt.Value)
            throw new Exceptions.UnauthorizedAccessException("Refresh token has expired. Please log in again.");

        return await IssueTokensAsync(customer);
    }

    public async Task ForgotPasswordAsync(ForgotPasswordRequest request)
    {
        Guard.Reset();
        Guard.Email(request.Email, "email", 200);
        Guard.ThrowIfAny("password reset");

        var customer = await _customers.GetByEmailAsync(request.Email.Trim().ToLowerInvariant());
        if (customer is null) return; // no email enumeration

        var token = Random.Shared.Next(100000, 999999).ToString();
        customer.PasswordResetToken = HashToken(token);
        customer.PasswordResetTokenExpiresAt = DateTime.UtcNow.AddHours(1);
        await _customers.UpdateAsync(customer);

        try
        {
            await _email.SendAsync(customer.Email, customer.Name, "Reset your R&A Labs password",
                $"Your R&A Labs password reset code is <b>{token}</b>. It expires in 1 hour.");
        }
        catch
        {
            customer.PasswordResetToken = null;
            customer.PasswordResetTokenExpiresAt = null;
            await _customers.UpdateAsync(customer);
            throw;
        }
    }

    public async Task ResetPasswordAsync(ResetPasswordRequest request)
    {
        Guard.Reset();
        Guard.Email(request.Email, "email", 200);
        Guard.Required(request.Token, "token", 20);
        Guard.Password(request.NewPassword);
        Guard.ThrowIfAny("password reset");

        var customer = await _customers.GetByEmailAsync(request.Email.Trim().ToLowerInvariant())
            ?? throw new Exceptions.UnauthorizedAccessException("Invalid reset request.");
        if (customer.PasswordResetToken is null
            || !CryptographicOperations.FixedTimeEquals(
                System.Text.Encoding.UTF8.GetBytes(customer.PasswordResetToken),
                System.Text.Encoding.UTF8.GetBytes(HashToken(request.Token))))
            throw new Exceptions.UnauthorizedAccessException("Invalid or expired reset token.");
        if (customer.PasswordResetTokenExpiresAt is null || DateTime.UtcNow > customer.PasswordResetTokenExpiresAt.Value)
            throw new Exceptions.UnauthorizedAccessException("Reset token has expired. Please request a new one.");

        customer.PasswordHash = _hasher.Hash(request.NewPassword);
        customer.PasswordResetToken = null;
        customer.PasswordResetTokenExpiresAt = null;
        await _customers.UpdateAsync(customer);
    }

    private async Task<CustomerLoginResponse> IssueTokensAsync(Customer customer)
    {
        var token = _jwt.GenerateToken(customer.Id, customer.Name, customer.Email, "customer");
        var refresh = _jwt.GenerateRefreshToken();
        customer.RefreshTokenHash = HashToken(refresh);
        customer.RefreshTokenExpiresAt = DateTime.UtcNow.AddDays(7);
        customer.UpdatedAt = DateTime.UtcNow;
        await _customers.UpdateAsync(customer);
        return new CustomerLoginResponse(token, refresh, DateTime.UtcNow.AddHours(24), new CustomerDto(customer.Id, customer.Name, customer.Email));
    }

    private static string HashToken(string token) => Convert.ToBase64String(SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(token)));
}

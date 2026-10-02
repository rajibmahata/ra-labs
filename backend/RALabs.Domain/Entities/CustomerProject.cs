using RALabs.Domain.Enums;

namespace RALabs.Domain.Entities;

public class Customer
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public string PasswordHash { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
    public string? RefreshTokenHash { get; set; }
    public DateTime? RefreshTokenExpiresAt { get; set; }
    public string? PasswordResetToken { get; set; }
    public DateTime? PasswordResetTokenExpiresAt { get; set; }
    public Guid? LeadId { get; set; }
    public List<CustomerProject> Projects { get; set; } = new();
}

public class CustomerProject
{
    public Guid Id { get; set; }
    public Guid CustomerId { get; set; }
    public Customer Customer { get; set; } = null!;
    public string Title { get; set; } = string.Empty;
    public string? Goal { get; set; }
    public string? Audience { get; set; }
    public string? Requirements { get; set; }
    public string? Timeline { get; set; }
    public string? BudgetOrConstraints { get; set; }
    public string? ReferenceLinks { get; set; }
    public CustomerProjectStatus Status { get; set; } = CustomerProjectStatus.Intake;
    public string? AdminNotes { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
    public List<ChatThread> Threads { get; set; } = new();
    public List<Document> Documents { get; set; } = new();
    public ClientPrd? ClientPrd { get; set; }
    public List<Demo> Demos { get; set; } = new();
    public List<Invoice> Invoices { get; set; } = new();
    public Feedback? Feedback { get; set; }
}

public class Document
{
    public Guid Id { get; set; }
    public Guid CustomerProjectId { get; set; }
    public CustomerProject CustomerProject { get; set; } = null!;
    public string FileName { get; set; } = string.Empty;
    public string FileUrl { get; set; } = string.Empty;
    public string StorageKey { get; set; } = string.Empty;
    public string ContentType { get; set; } = "application/octet-stream";
    public long FileSize { get; set; }
    public string UploadedBy { get; set; } = string.Empty;
    public string? Description { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class ClientPrd
{
    public Guid Id { get; set; }
    public Guid CustomerProjectId { get; set; }
    public CustomerProject CustomerProject { get; set; } = null!;
    public string Content { get; set; } = string.Empty;
    public ClientPrdStatus Status { get; set; } = ClientPrdStatus.Draft;
    public string? SignerNameCustomer { get; set; }
    public DateTime? SignedAtCustomer { get; set; }
    public string? SignerNameAdmin { get; set; }
    public DateTime? SignedAtAdmin { get; set; }
    public string? ExternalSignatureId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
}

public class Demo
{
    public Guid Id { get; set; }
    public Guid CustomerProjectId { get; set; }
    public CustomerProject CustomerProject { get; set; } = null!;
    public string Type { get; set; } = string.Empty;
    public string UrlOrAsset { get; set; } = string.Empty;
    public string? Notes { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class Invoice
{
    public Guid Id { get; set; }
    public Guid CustomerProjectId { get; set; }
    public CustomerProject CustomerProject { get; set; } = null!;
    public decimal Amount { get; set; }
    public string Currency { get; set; } = "USD";
    public InvoiceStatus Status { get; set; } = InvoiceStatus.Unpaid;
    public string? Notes { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
}

public class Feedback
{
    public Guid Id { get; set; }
    public Guid CustomerProjectId { get; set; }
    public CustomerProject CustomerProject { get; set; } = null!;
    public int Rating { get; set; }
    public string Comment { get; set; } = string.Empty;
    public bool ConsentToPublish { get; set; }
    public bool IsPublished { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

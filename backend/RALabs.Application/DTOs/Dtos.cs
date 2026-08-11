namespace RALabs.Application.DTOs;

// ── Auth ──
public record LoginRequest(string Email, string Password);
public record LoginResponse(string AccessToken, string RefreshToken, DateTime ExpiresAt, AdminUserDto User);
public record RefreshTokenRequest(string RefreshToken);
public record ForgotPasswordRequest(string Email);
public record ResetPasswordRequest(string Email, string Token, string NewPassword);
public record AdminUserDto(Guid Id, string Name, string Email, string Role, bool IsActive, Guid? TeamMemberId);
public record UpdateCustomerStatusRequest(bool IsActive);
public record UpdateCustomerByAdminRequest(string Name, string Email, string? Password);
public record AdminCustomerDto(Guid Id, string Name, string Email, bool IsActive, DateTime CreatedAt, DateTime? UpdatedAt, int ProjectCount);
public record CustomerImportErrorDto(int Row, string Message);
public record CustomerImportResultDto(int Created, int Skipped, List<CustomerImportErrorDto> Errors);

// ── Portfolio ──
public record CreateProjectRequest(
    string Title, string? Slug, string Summary, List<string>? StackTags,
    string? Status, string? GithubUrl, string? LiveSiteUrl, string? Category,
    string? BusinessPurpose, string? ProblemSolved, string? Solution,
    List<string>? KeyFeatures, string? CaseStudyBody, string? CoverImageUrl,
    List<string>? Screenshots, string? Duration, List<Guid>? TeamMemberIds,
    DateTime? CompletedAt, string? CustomerReference, bool? ShowCustomerReference,
    int? SortOrder, bool? IsFeatured, bool? IsActive, bool? IsPublished);

public record UpdateProjectRequest(
    string Title, string? Slug, string Summary, List<string>? StackTags,
    string? Status, string? GithubUrl, string? LiveSiteUrl, string? Category,
    string? BusinessPurpose, string? ProblemSolved, string? Solution,
    List<string>? KeyFeatures, string? CaseStudyBody, string? CoverImageUrl,
    List<string>? Screenshots, string? Duration, List<Guid>? TeamMemberIds,
    DateTime? CompletedAt, string? CustomerReference, bool? ShowCustomerReference,
    int? SortOrder, bool? IsFeatured, bool? IsActive, bool? IsPublished);
public record SetPublishedRequest(bool IsPublished);
public record SetActiveRequest(bool IsActive);
public record SetFeaturedRequest(bool IsFeatured);

public record ProjectDto(
    Guid Id, string Slug, string Title, string Summary, List<string> StackTags,
    string Status, string? GithubUrl, string? LiveSiteUrl, string? Category,
    string? BusinessPurpose, string? ProblemSolved, string? Solution,
    List<string> KeyFeatures, string? CaseStudyBody, string? CoverImageUrl,
    List<string> Screenshots, string? Duration, List<Guid> TeamMemberIds,
    DateTime? CompletedAt, string? CustomerReference, bool ShowCustomerReference,
    int SortOrder, bool IsFeatured, bool IsActive, bool IsPublished,
    DateTime CreatedAt, DateTime? UpdatedAt);

public record ProjectImportErrorDto(int Row, string Message);
public record ProjectImportResultDto(int Created, int Updated, int Skipped, List<ProjectImportErrorDto> Errors);

public record TeamBriefDto(Guid Id, string Name, string Slug, string Role, string? AvatarUrl);
public record ProjectDetailDto(ProjectDto Project, List<TeamBriefDto> TeamMembers);

public record GenerateDraftRequest(string SourceUrl, string SourceText);
public record ReviewDraftRequest(string Decision, string? Note);

// ── Team ──
public record CreateTeamRequest(
    string Name, string? Slug, string Role, string Bio, string? GithubUsername,
    string? GithubAccountUrl, string? GithubToken, string? AvatarUrl, string? Email,
    string? LinkedinUrl, string? Location, bool? IsPublished);

public record UpdateTeamRequest(
    string? Name, string? Slug, string? Role, string? Bio, string? GithubUsername,
    string? GithubAccountUrl, string? GithubToken, string? AvatarUrl, string? Email,
    string? LinkedinUrl, string? Location, bool? IsPublished);

public record TeamMemberDto(
    Guid Id, string Slug, string Name, string Role, string Bio,
    string? GithubUsername, string? GithubAccountUrl, bool HasGithubToken, string? AvatarUrl,
    string? Email, string? LinkedinUrl, string? Location, bool IsActive, bool IsPublished,
    GithubSnapshotDto? GithubSnapshot);

public record GithubSnapshotDto(
    int Commits90d, int ActiveRepos, DateTime? LastCommitAt, DateTime CapturedAt);

public record GithubRepositoryDto(
    Guid Id, string Owner, string Name, string FullName, string HtmlUrl,
    string? Description, string? PrimaryLanguage, List<string> Technologies,
    DateTime? PushedAt, DateTime SyncedAt);

// ── Content ──
public record CreateContentRequest(string Key, string Locale, string Value);
public record UpdateContentRequest(string Locale, string Value);
public record ContentDto(string Key, string Locale, string Value, DateTime UpdatedAt);
public record ContentResponse(string Locale, Dictionary<string, string> Content);
public record LocaleDto(string Code, string Label);

// ── Leads ──
public record CreateLeadRequest(string Name, string ContactInfo, string Message, string Source);
public record LeadDto(Guid Id, string Name, string ContactInfo, string Message, string Source,
    string Status, string? Notes, DateTime CreatedAt, DateTime? UpdatedAt);
public record UpdateLeadRequest(string? Status, string? Notes);
public record ModerateFeedbackRequest(bool Approved);

// ── Import / export ──
public record ImportErrorDto(int Row, string Message);
public record LeadImportResultDto(int Created, int Skipped, List<ImportErrorDto> Errors);
public record TeamImportResultDto(int Created, int Skipped, List<ImportErrorDto> Errors);

// ── Chat ──
public record SendMessageRequest(string Content, string? AttachmentUrl);
public record ChatMessageDto(Guid Id, string ThreadId, string SenderType, string? SenderName,
    string Content, string? AttachmentUrl, DateTime CreatedAt, List<string>? SuggestedActions = null);
public record ChatThreadDto(Guid Id, string Type, bool NeedsManualIntervention,
    Guid? CustomerProjectId, DateTime CreatedAt, List<ChatMessageDto>? Messages = null);
public record ChatThreadSummaryDto(Guid Id, string Type, bool NeedsManualIntervention,
    Guid? CustomerProjectId, DateTime? LastMessageAt, int MessageCount, DateTime CreatedAt);
public record UpdateThreadRequest(bool? NeedsManualIntervention);

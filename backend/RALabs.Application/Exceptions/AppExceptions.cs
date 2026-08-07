namespace RALabs.Application.Exceptions;

public enum ErrorCode
{
    VALIDATION_ERROR = 400,
    UNAUTHORIZED = 401,
    FORBIDDEN = 403,
    NOT_FOUND = 404,
    CONFLICT = 409,
    RATE_LIMITED = 429,
    INTERNAL_ERROR = 500
}

public class AppException : Exception
{
    public ErrorCode Code { get; }
    public string? Details { get; }

    public AppException(ErrorCode code, string message, string? details = null, Exception? inner = null)
        : base(message, inner)
    {
        Code = code;
        Details = details;
    }
}

public sealed class ValidationException : AppException
{
    public ValidationException(string message, string? details = null)
        : base(ErrorCode.VALIDATION_ERROR, message, details) { }
}

public sealed class UnauthorizedAccessException : AppException
{
    public UnauthorizedAccessException(string message)
        : base(ErrorCode.UNAUTHORIZED, message) { }
}

public sealed class ForbiddenAccessException : AppException
{
    public ForbiddenAccessException(string message)
        : base(ErrorCode.FORBIDDEN, message) { }
}

public sealed class NotFoundException : AppException
{
    public NotFoundException(string message)
        : base(ErrorCode.NOT_FOUND, message) { }
}

public sealed class ConflictException : AppException
{
    public ConflictException(string message)
        : base(ErrorCode.CONFLICT, message) { }
}

public sealed class RateLimitedException : AppException
{
    public RateLimitedException(string message)
        : base(ErrorCode.RATE_LIMITED, message) { }
}

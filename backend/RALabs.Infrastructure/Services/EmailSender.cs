using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using RALabs.Domain.Interfaces;
using System.Net;
using System.Net.Mail;

namespace RALabs.Infrastructure.Services;

/// <summary>
/// Email delivery behind SMTP config. In development, when SMTP is unset,
/// messages are logged to the console so flows are testable without a server.
/// Set Email:RequireSmtp=true (with a configured SmtpHost) to fail instead of
/// silently dropping mail — used by the password-reset flow.
/// </summary>
public class EmailSender : IEmailSender
{
    private readonly IConfiguration _config;
    private readonly ILogger<EmailSender> _logger;

    public EmailSender(IConfiguration config, ILogger<EmailSender> logger)
    {
        _config = config;
        _logger = logger;
    }

    public async Task SendAsync(string to, string toName, string subject, string htmlBody)
    {
        var host = _config["Email:SmtpHost"];
        var requireSmtp = _config.GetValue<bool>("Email:RequireSmtp");
        var from = _config["Email:FromEmail"] ?? "noreply@ralabs.dev";
        var fromName = _config["Email:FromName"] ?? "R&A Labs";

        if (string.IsNullOrWhiteSpace(host))
        {
            if (requireSmtp)
                throw new InvalidOperationException("Email:SmtpHost is not configured but Email:RequireSmtp is true.");
            _logger.LogInformation("[EMAIL-DEV] To={To} Subject={Subject} Body={Body}", to, subject, htmlBody);
            return;
        }

        using var client = new SmtpClient(host, _config.GetValue<int>("Email:SmtpPort", 587))
        {
            EnableSsl = _config.GetValue<bool>("Email:UseSsl", true),
            Credentials = new NetworkCredential(
                _config["Email:Username"] ?? string.Empty,
                _config["Email:Password"] ?? string.Empty)
        };

        var message = new MailMessage
        {
            From = new MailAddress(from, fromName),
            Subject = subject,
            IsBodyHtml = true,
            Body = htmlBody
        };
        message.To.Add(new MailAddress(to, toName));
        await client.SendMailAsync(message);
    }
}

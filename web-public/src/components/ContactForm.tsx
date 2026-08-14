import { useState, type FormEvent } from 'react';
import { api, ApiClientError } from '../api/client';
import { useI18n } from '../i18n';

interface FormErrors {
  name?: string;
  contactInfo?: string;
  message?: string;
}

interface Props {
  /** If true, renders a smaller inline variant for the home page */
  inline?: boolean;
  /** Called on successful submission */
  onSuccess?: () => void;
}

const EMAIL_OR_PHONE_RE =
  /^.+@.+\..+$|^\+?[\d\s\-().]{7,}$/;

export default function ContactForm({ inline, onSuccess }: Props) {
  const { t } = useI18n();

  const [name, setName] = useState('');
  const [contactInfo, setContactInfo] = useState('');
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  function validate(): FormErrors {
    const e: FormErrors = {};

    if (!name.trim()) {
      e.name = t('contact.error.nameRequired', 'Name is required.');
    } else if (name.length > 100) {
      e.name = t('contact.error.nameLength', 'Name must be 100 characters or fewer.');
    }

    if (!contactInfo.trim()) {
      e.contactInfo = t('contact.error.contactRequired', 'Email or phone is required.');
    } else if (contactInfo.length > 200) {
      e.contactInfo = t('contact.error.contactLength', 'Contact info must be 200 characters or fewer.');
    } else if (!EMAIL_OR_PHONE_RE.test(contactInfo.trim())) {
      e.contactInfo = t('contact.error.contactInvalid', 'Please enter a valid email or phone number.');
    }

    if (!message.trim()) {
      e.message = t('contact.error.messageRequired', 'Message is required.');
    } else if (message.length > 2000) {
      e.message = t('contact.error.messageLength', 'Message must be 2000 characters or fewer.');
    }

    return e;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setServerError(null);

    const validationErrors = validate();
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    setSubmitting(true);

    try {
      await api.submitLead({
        name: name.trim(),
        contactInfo: contactInfo.trim(),
        message: message.trim(),
        source: 'form',
      });

      setSubmitted(true);
      setName('');
      setContactInfo('');
      setMessage('');
      setErrors({});
      onSuccess?.();
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        if (err.code === 'RATE_LIMITED') {
          setServerError(
            t('contact.error.rateLimited', 'You have submitted too many messages. Please wait a moment and try again.')
          );
        } else {
          setServerError(err.message);
        }
      } else {
        setServerError(
          t('contact.error.generic', 'Something went wrong. Please try again or email us directly.')
        );
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div
        className={inline ? '' : 'contact-form-container'}
        role="status"
        aria-live="polite"
      >
        <div className="form-success">
          {t('contact.success', 'Thank you! We will get back to you soon.')}
        </div>
      </div>
    );
  }

  const formContent = (
    <form onSubmit={handleSubmit} noValidate aria-label="Contact form">
      {serverError && (
        <div className="form-server-error" role="alert">
          {serverError}
        </div>
      )}

      <div className="form-group">
        <label htmlFor="contact-name">
          {t('contact.name', 'Name')}
        </label>
        <input
          id="contact-name"
          type="text"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
          }}
          maxLength={100}
          required
          aria-invalid={!!errors.name}
          aria-describedby={errors.name ? 'contact-name-error' : undefined}
          placeholder="Your name"
        />
        {errors.name && (
          <div id="contact-name-error" className="form-error" role="alert">
            {errors.name}
          </div>
        )}
      </div>

      <div className="form-group">
        <label htmlFor="contact-info">
          {t('contact.email', 'Email or phone')}
        </label>
        <input
          id="contact-info"
          type="text"
          value={contactInfo}
          onChange={(e) => {
            setContactInfo(e.target.value);
            if (errors.contactInfo)
              setErrors((prev) => ({ ...prev, contactInfo: undefined }));
          }}
          maxLength={200}
          required
          aria-invalid={!!errors.contactInfo}
          aria-describedby={
            errors.contactInfo ? 'contact-info-error' : undefined
          }
          placeholder="you@example.com"
        />
        {errors.contactInfo && (
          <div id="contact-info-error" className="form-error" role="alert">
            {errors.contactInfo}
          </div>
        )}
      </div>

      <div className="form-group">
        <label htmlFor="contact-message">
          {t('contact.message', 'Message')}
        </label>
        <textarea
          id="contact-message"
          value={message}
          onChange={(e) => {
            setMessage(e.target.value);
            if (errors.message)
              setErrors((prev) => ({ ...prev, message: undefined }));
          }}
          maxLength={2000}
          required
          aria-invalid={!!errors.message}
          aria-describedby={errors.message ? 'contact-message-error' : undefined}
          placeholder="Tell us about your project..."
        />
        {errors.message && (
          <div id="contact-message-error" className="form-error" role="alert">
            {errors.message}
          </div>
        )}
      </div>

      <button
        type="submit"
        className="cta primary"
        disabled={submitting}
        style={{ width: '100%', justifyContent: 'center' }}
      >
        {submitting
          ? t('contact.sending', 'Sending...')
          : t('contact.submit', 'Send message')}
      </button>
    </form>
  );

  if (inline) {
    return formContent;
  }

  return <div className="contact-form-container">{formContent}</div>;
}

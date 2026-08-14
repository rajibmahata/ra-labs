import { useI18n } from '../i18n';
import ContactForm from '../components/ContactForm';

export default function Contact() {
  const { t } = useI18n();

  return (
    <section aria-labelledby="contact-heading">
      <div className="wrap">
        <div className="contact-layout">
          <div className="contact-info">
            <div className="eyebrow">
              {t('contact.eyebrow', 'Get in touch')}
            </div>
            <h1 id="contact-heading">
              {t('contact.title', 'Tell us the problem. We will sketch the first version.')}
            </h1>
            <p>
              {t(
                'contact.subtitle',
                'Usually a reply within one business day. No obligation — just a conversation about what you need.'
              )}
            </p>

            <div
              style={{
                marginTop: 32,
                padding: 20,
                background: 'var(--surface)',
                borderRadius: 'var(--radius)',
                border: '1px solid var(--line)',
                fontSize: '13.5px',
                color: 'var(--ink-dim)',
                lineHeight: 1.7,
              }}
            >
              <div style={{ fontWeight: 600, color: 'var(--ink)', marginBottom: 8 }}>
                {t('contact.next.heading', 'What happens next:')}
              </div>
              <ol style={{ paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <li>{t('contact.next.step1', 'We review your message, usually within one business day.')}</li>
                <li>{t('contact.next.step2', 'We schedule a quick call to understand your needs.')}</li>
                <li>{t('contact.next.step3', 'We send a rough sketch and an estimate — no commitment.')}</li>
              </ol>
            </div>
          </div>

          <ContactForm />
        </div>
      </div>
    </section>
  );
}

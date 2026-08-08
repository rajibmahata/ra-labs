import { useI18n } from '../i18n';

const PROCESS_STEPS = [
  { number: 1, titleKey: 'process.step1.title', bodyKey: 'process.step1.body', fallbackTitle: 'Understand', fallbackBody: 'Start with the problem, the people, and the outcome.' },
  { number: 2, titleKey: 'process.step2.title', bodyKey: 'process.step2.body', fallbackTitle: 'Register', fallbackBody: 'Create a private workspace for your project.' },
  { number: 3, titleKey: 'process.step3.title', bodyKey: 'process.step3.body', fallbackTitle: 'Submit the brief', fallbackBody: 'Share goals, requirements, timing, and constraints.' },
  { number: 4, titleKey: 'process.step4.title', bodyKey: 'process.step4.body', fallbackTitle: 'Discuss', fallbackBody: 'Use the project room to shape the first PRD together.' },
  { number: 5, titleKey: 'process.step5.title', bodyKey: 'process.step5.body', fallbackTitle: 'Approve', fallbackBody: 'Review the plan, sign off, and move into delivery.' },
];

export default function Process() {
  const { t } = useI18n();

  return (
    <section id="process" aria-labelledby="process-heading">
      <div className="wrap">
      <div className="section-head">
        <div>
          <div className="eyebrow">
            {t('process.eyebrow', 'How it works')}
          </div>
          <h2 id="process-heading">
            {t('process.title', 'From first question to working system')}
          </h2>
        </div>
      </div>

      <div className="process" role="list">
        {PROCESS_STEPS.map((step) => (
          <div className="process-step" key={step.number} role="listitem">
            <div className="n" aria-hidden="true">
              {step.number}
            </div>
            <h3>{t(step.titleKey, step.fallbackTitle)}</h3>
            <p>{t(step.bodyKey, step.fallbackBody)}</p>
          </div>
        ))}
      </div>
      <div className="process-bridge">
        <span className="eyebrow">{t('process.bridge.eyebrow', 'Your first brief')}</span>
        <p>{t('process.bridge.body', 'Bring a goal, the people it serves, the capabilities you need, a target timeline, and any constraints or references. The rest can be worked out together.')}</p>
      </div>
      </div>
    </section>
  );
}

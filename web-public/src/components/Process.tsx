import { useI18n } from '../i18n';

const PROCESS_STEPS = [
  { number: 1, titleKey: 'process.step1.title', bodyKey: 'process.step1.body', fallbackTitle: 'Discuss', fallbackBody: 'We listen to what you need.' },
  { number: 2, titleKey: 'process.step2.title', bodyKey: 'process.step2.body', fallbackTitle: 'Sketch', fallbackBody: 'Rough shapes, low fidelity on purpose.' },
  { number: 3, titleKey: 'process.step3.title', bodyKey: 'process.step3.body', fallbackTitle: 'Architect', fallbackBody: 'A real technical diagram, named and reviewed.' },
  { number: 4, titleKey: 'process.step4.title', bodyKey: 'process.step4.body', fallbackTitle: 'Build', fallbackBody: 'Engineers on judgment, agents on repetition.' },
  { number: 5, titleKey: 'process.step5.title', bodyKey: 'process.step5.body', fallbackTitle: 'Refine', fallbackBody: 'You react to something real, we close the loop.' },
];

export default function Process() {
  const { t } = useI18n();

  return (
    <section id="process" aria-labelledby="process-heading">
      <div className="section-head">
        <div>
          <div className="eyebrow">
            {t('process.eyebrow', 'How it works')}
          </div>
          <h2 id="process-heading">
            {t('process.title', 'Five steps, every time')}
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
    </section>
  );
}

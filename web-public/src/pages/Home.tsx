import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api, type ProjectSummary, type TeamMember } from '../api/client';
import { useI18n } from '../i18n';
import Hero from '../components/Hero';
import Process from '../components/Process';
import ProjectCard from '../components/ProjectCard';
import TeamCard from '../components/TeamCard';
import ContactForm from '../components/ContactForm';

export default function Home() {
  const { t } = useI18n();

  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [teamLoading, setTeamLoading] = useState(true);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [teamError, setTeamError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    setProjectsLoading(true);
    setProjectsError(null);

    api
      .getProjects({ pageSize: 3 })
      .then((res) => {
        if (!cancelled) {
          setProjects(res.data ?? []);
          setProjectsLoading(false);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setProjectsError(err.message);
          setProjectsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    setTeamLoading(true);
    setTeamError(null);

    api
      .getTeam()
      .then((res) => {
        if (!cancelled) {
          setTeam(res.data ?? []);
          setTeamLoading(false);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setTeamError(err.message);
          setTeamLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <Hero />
      <Process />

      <section className="brief-prep" aria-labelledby="brief-prep-heading">
        <div className="wrap brief-prep-layout">
          <div>
            <div className="eyebrow">{t('brief.eyebrow', 'A useful starting point')}</div>
            <h2 id="brief-prep-heading">{t('brief.title', 'A clear brief makes the first conversation useful.')}</h2>
            <p>{t('brief.body', 'You do not need a finished specification. Give us the shape of the problem and we will help turn it into a plan.')}</p>
          </div>
          <div className="brief-checklist" role="list">
            {['Goal', 'Audience', 'Key requirements', 'Timeline', 'Budget or constraints', 'References'].map((item, index) => (
              <div className="brief-check" role="listitem" key={item}>
                <span aria-hidden="true">0{index + 1}</span>
                <strong>{item}</strong>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="assistant-entry" aria-labelledby="assistant-entry-heading">
        <div className="wrap assistant-entry-layout">
          <div>
            <div className="eyebrow">A better first step</div>
            <h2 id="assistant-entry-heading">Start with a conversation, then keep the useful parts.</h2>
            <p>
              Tell the assistant what you want to build. When the direction is clear, create a private workspace to complete your brief and discuss it securely with the team.
            </p>
          </div>
          <a href="/customer/register" className="cta primary">Create a private workspace</a>
        </div>
      </section>

      {/* Portfolio preview */}
      <section id="work" className="alt" aria-labelledby="portfolio-heading">
        <div className="wrap">
          <div className="section-head">
            <div>
              <div className="eyebrow">
                {t('portfolio.eyebrow', 'Selected work')}
              </div>
              <h2 id="portfolio-heading">
                {t('portfolio.title', 'A few systems we have built')}
              </h2>
            </div>
            <Link to="/work" className="cta ghost">
              {t('portfolio.viewAll', 'View all')} &rarr;
            </Link>
          </div>

          {projectsLoading && (
            <div className="state-placeholder" aria-live="polite">
              <div className="spinner" />
              <p>Loading projects...</p>
            </div>
          )}

          {projectsError && !projectsLoading && (
            <div className="state-placeholder" role="alert">
              <h3>Could not load projects</h3>
              <p>{projectsError}</p>
            </div>
          )}

          {!projectsLoading && !projectsError && projects.length === 0 && (
            <div className="state-placeholder">
              <h3>No projects yet</h3>
              <p>Check back soon for our latest work.</p>
            </div>
          )}

          {!projectsLoading && !projectsError && projects.length > 0 && (
            <div className="card-grid">
              {projects.map((project, i) => (
                <ProjectCard key={project.id} project={project} index={i} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Team preview */}
      <section id="team" aria-labelledby="team-heading">
        <div className="wrap">
        <div className="section-head">
          <div>
            <div className="eyebrow">{t('team.eyebrow', 'Team')}</div>
            <h2 id="team-heading">
              {t('team.title', 'Two founders, GitHub-verified')}
            </h2>
          </div>
          <Link to="/team" className="cta ghost">
            {t('team.viewAll', 'Meet the team')} &rarr;
          </Link>
        </div>

        {teamLoading && (
          <div className="state-placeholder" aria-live="polite">
            <div className="spinner" />
            <p>Loading team...</p>
          </div>
        )}

        {teamError && !teamLoading && (
          <div className="state-placeholder" role="alert">
            <h3>Could not load team</h3>
            <p>{teamError}</p>
          </div>
        )}

        {!teamLoading && !teamError && team.length === 0 && (
          <div className="state-placeholder">
            <h3>No team members listed</h3>
            <p>Team profiles are coming soon.</p>
          </div>
        )}

        {!teamLoading && !teamError && team.length > 0 && (
          <div className="team-grid">
            {team.map((member, i) => (
              <TeamCard key={member.id} member={member} index={i} />
            ))}
          </div>
        )}
        </div>
      </section>

      {/* Contact section */}
      <section
        id="contact"
        className="alt"
        aria-labelledby="contact-heading"
      >
        <div className="wrap">
          <div className="contact-layout">
            <div className="contact-info">
              <div className="eyebrow">
                {t('contact.eyebrow', 'Get in touch')}
              </div>
              <h2 id="contact-heading">
                {t('contact.title', 'Tell us the problem. We will sketch the first version.')}
              </h2>
              <p>
                {t(
                  'contact.subtitle',
                  'Usually a reply within one business day.'
                )}
              </p>
            </div>
            <ContactForm inline />
          </div>
        </div>
      </section>

      {/* Final CTA panel */}
      <section>
        <div className="wrap">
        <div className="contact-panel">
          <div>
            <h2>
              {t(
                'contact.cta.panel',
                'Tell us the problem. We\'ll sketch the first version.'
              )}
            </h2>
            <p>
              {t(
                'contact.cta.subtext',
                'Usually a reply within one business day.'
              )}
            </p>
          </div>
          <Link to="/contact" className="cta on-dark">
            {t('contact.cta.button', 'Start a conversation')}
          </Link>
        </div>
        </div>
      </section>
    </>
  );
}

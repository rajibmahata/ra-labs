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
              {projects.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Team preview */}
      <section id="team" aria-labelledby="team-heading">
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
            {team.map((member) => (
              <TeamCard key={member.id} member={member} />
            ))}
          </div>
        )}
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
        <div className="contact-panel">
          <div>
            <h2>
              {t(
                'contact.cta.panel',
                'Ready to start? Send us a message.'
              )}
            </h2>
            <p>
              {t(
                'contact.cta.subtext',
                'No pressure — just a conversation about what you need.'
              )}
            </p>
          </div>
          <Link to="/contact" className="cta on-dark">
            {t('contact.cta.button', 'Start a conversation')}
          </Link>
        </div>
      </section>
    </>
  );
}

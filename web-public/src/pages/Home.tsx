import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api, type ProjectSummary, type TeamMember } from '../api/client';
import { useI18n } from '../i18n';
import ProjectCard from '../components/ProjectCard';
import TeamCard from '../components/TeamCard';
import ContactForm from '../components/ContactForm';
import AgentChatPanel from '../components/AgentChatPanel';

const CAPABILITIES = [
  {
    number: '01',
    titleKey: 'cap.answers.title',
    bodyKey: 'cap.answers.body',
    fallbackTitle: 'Answers about our work',
    fallbackBody: 'Portfolio, services, process and team — grounded in our indexed content and knowledge base.',
  },
  {
    number: '02',
    titleKey: 'cap.brief.title',
    bodyKey: 'cap.brief.body',
    fallbackTitle: 'Collects your project brief',
    fallbackBody: 'A guided step-by-step intake; the finished brief goes to the team and can follow you into the portal.',
  },
  {
    number: '03',
    titleKey: 'cap.grounded.title',
    bodyKey: 'cap.grounded.body',
    fallbackTitle: 'Grounded, not invented',
    fallbackBody: 'Retrieval-augmented answers. The agent says so when it does not know — no made-up facts.',
  },
  {
    number: '04',
    titleKey: 'cap.private.title',
    bodyKey: 'cap.private.body',
    fallbackTitle: 'Private by default',
    fallbackBody: 'The conversation lives in a session-scoped thread. No ads, no tracking, no sharing.',
  },
];

const PIPELINE_STEPS = [
  {
    number: 1,
    titleKey: 'pipeline.ask.title',
    bodyKey: 'pipeline.ask.body',
    fallbackTitle: 'Ask',
    fallbackBody: 'Type any question about our work, or describe the project you want to build.',
  },
  {
    number: 2,
    titleKey: 'pipeline.grounded.title',
    bodyKey: 'pipeline.grounded.body',
    fallbackTitle: 'Grounded reply',
    fallbackBody: 'The agent answers from our indexed portfolio and knowledge — never invented.',
  },
  {
    number: 3,
    titleKey: 'pipeline.brief.title',
    bodyKey: 'pipeline.brief.body',
    fallbackTitle: 'Brief collection',
    fallbackBody: 'Say "create a project" and the agent walks you through goal, users, features, timeline and budget.',
  },
  {
    number: 4,
    titleKey: 'pipeline.handoff.title',
    bodyKey: 'pipeline.handoff.body',
    fallbackTitle: 'Handoff',
    fallbackBody: 'The brief reaches the team. Continue privately in a customer workspace when you are ready.',
  },
];

export default function Home() {
  const { t } = useI18n();

  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [featured, setFeatured] = useState<ProjectSummary[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [featuredLoading, setFeaturedLoading] = useState(true);
  const [teamLoading, setTeamLoading] = useState(true);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [featuredError, setFeaturedError] = useState<string | null>(null);
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

    setFeaturedLoading(true);
    setFeaturedError(null);

    api
      .getFeaturedProjects({ pageSize: 3 })
      .then((res) => {
        if (!cancelled) {
          setFeatured(res.data ?? []);
          setFeaturedLoading(false);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setFeaturedError(err.message);
          setFeaturedLoading(false);
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
      {/* Hero: agent is the centerpiece */}
      <section className="hero agent-hero" aria-labelledby="hero-headline">
        <div className="wrap agent-hero-layout">
          <div className="agent-hero-copy">
            <div className="eyebrow">
              {t('hero.eyebrow', 'AI agent · engineering studio')}
            </div>
            <h1 id="hero-headline">
              {t('hero.headline', 'Describe the problem once. Our AI agent turns it into')}{' '}
              <span className="hl">{t('hero.headlineHighlight', 'a plan')}</span>.
            </h1>
            <p className="lede">
              {t(
                'hero.subheadline',
                'A two-founder engineering studio pairing senior engineering with an AI agent workforce. The agent answers questions about our work and collects your project brief for the team.'
              )}
            </p>
            <div className="cta-row">
              <a href="#agent-chat" className="cta primary">
                {t('hero.cta.primary', 'Ask the agent')}
              </a>
              <Link to="/work" className="cta ghost">
                {t('hero.cta.secondary', 'See the work')}
              </Link>
            </div>
            <p className="hero-note">
              {t('hero.cta.note', 'Your conversation stays in this browser session until you create a private workspace.')}
            </p>
          </div>

          <div id="agent-chat" className="agent-hero-panel" aria-label={t('agent.panel.label', 'R&A Labs AI agent')}>
            <AgentChatPanel mode="home" />
          </div>
        </div>
      </section>

      {/* What the agent can do */}
      <section id="capabilities" className="alt" aria-labelledby="capabilities-heading">
        <div className="wrap">
          <div className="section-head">
            <div>
              <div className="eyebrow">{t('cap.eyebrow', 'The assistant')}</div>
              <h2 id="capabilities-heading">{t('cap.title', 'What the agent can do')}</h2>
            </div>
          </div>
          <div className="cap-grid">
            {CAPABILITIES.map((cap) => (
              <div className="cap-card" key={cap.number}>
                <div className="n" aria-hidden="true">{cap.number}</div>
                <h3>{t(cap.titleKey, cap.fallbackTitle)}</h3>
                <p>{t(cap.bodyKey, cap.fallbackBody)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How the agent works — pipeline */}
      <section id="pipeline" aria-labelledby="pipeline-heading">
        <div className="wrap">
          <div className="section-head">
            <div>
              <div className="eyebrow">{t('pipeline.eyebrow', 'How it works')}</div>
              <h2 id="pipeline-heading">{t('pipeline.title', 'From first question to working plan')}</h2>
            </div>
          </div>
          <div className="process" role="list">
            {PIPELINE_STEPS.map((step) => (
              <div className="process-step" key={step.number} role="listitem">
                <div className="n" aria-hidden="true">{step.number}</div>
                <h3>{t(step.titleKey, step.fallbackTitle)}</h3>
                <p>{t(step.bodyKey, step.fallbackBody)}</p>
              </div>
            ))}
          </div>
          <div className="process-bridge">
            <span className="eyebrow">{t('pipeline.bridge.eyebrow', 'Your first brief')}</span>
            <p>{t('pipeline.bridge.body', 'Bring a goal, the people it serves, the capabilities you need, a target timeline, and any constraints or references. The agent will help you shape the rest.')}</p>
          </div>
        </div>
      </section>

      {/* Privacy */}
      <section id="privacy" className="alt" aria-labelledby="privacy-heading">
        <div className="wrap privacy-layout">
          <div>
            <div className="eyebrow">{t('privacy.eyebrow', 'Conversation privacy')}</div>
            <h2 id="privacy-heading">{t('privacy.title', 'A private workspace, not a public comment box')}</h2>
            <p>{t('privacy.body', 'Your conversation is kept in a session-scoped thread that only the RA Labs team can read. When you register, the thread moves into your project workspace so the brief and the conversation stay together.')}</p>
          </div>
          <div className="privacy-checklist" role="list">
            {[
              { key: 'privacy.check.thread', fallback: 'Session-scoped thread, no public history' },
              { key: 'privacy.check.attachments', fallback: 'Attachments stored privately, never published' },
              { key: 'privacy.check.team', fallback: 'Only the studio team can read your conversation' },
              { key: 'privacy.check.portal', fallback: 'Continue securely in the customer portal' },
            ].map((item) => (
              <div className="privacy-check" role="listitem" key={item.key}>
                <span aria-hidden="true">&check;</span>
                {t(item.key, item.fallback)}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured projects */}
      {(!featuredLoading && !featuredError && featured.length > 0) && (
        <section id="featured" className="alt" aria-labelledby="featured-heading">
          <div className="wrap">
            <div className="section-head">
              <div>
                <div className="eyebrow">Featured</div>
                <h2 id="featured-heading">Currently featured work</h2>
              </div>
              <Link to="/work" className="cta ghost">
                {t('portfolio.viewAll', 'View all')} &rarr;
              </Link>
            </div>
            <div className="card-grid">
              {featured.map((project, i) => (
                <ProjectCard key={project.id} project={project} index={i} />
              ))}
            </div>
          </div>
        </section>
      )}

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
          <Link to="/agent" className="cta on-dark">
            {t('contact.cta.button', 'Start a conversation')}
          </Link>
        </div>
        </div>
      </section>
    </>
  );
}
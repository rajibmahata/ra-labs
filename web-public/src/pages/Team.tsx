import { useState, useEffect } from 'react';
import { api, type TeamMember } from '../api/client';
import { useI18n } from '../i18n';
import TeamCard from '../components/TeamCard';

export default function Team() {
  const { t } = useI18n();

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    api
      .getTeam()
      .then((res) => {
        if (!cancelled) {
          setMembers(res.data ?? []);
          setLoading(false);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setError(err.message);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section aria-labelledby="team-heading">
      <div className="wrap">
        <div className="section-head">
          <div>
            <div className="eyebrow">{t('team.eyebrow', 'Team')}</div>
            <h1 id="team-heading">
              {t('team.title', 'The people behind the work')}
            </h1>
          </div>
        </div>

        {/* State: loading */}
        {loading && (
          <div className="state-placeholder" aria-live="polite">
            <div className="spinner" />
            <p>{t('team.loading', 'Loading team...')}</p>
          </div>
        )}

        {/* State: error */}
        {error && !loading && (
          <div className="state-placeholder" role="alert">
            <h3>{t('team.error', 'Could not load team')}</h3>
            <p>{error}</p>
          </div>
        )}

        {/* State: empty */}
        {!loading && !error && members.length === 0 && (
          <div className="state-placeholder">
            <h3>{t('team.empty.heading', 'No team members yet')}</h3>
            <p>{t('team.empty.body', 'Team profiles are coming soon.')}</p>
          </div>
        )}

        {/* State: populated */}
        {!loading && !error && members.length > 0 && (
          <div className="team-grid">
              {members.map((member, i) => (
                <TeamCard key={member.id} member={member} index={i} />
              ))}
          </div>
        )}
      </div>
    </section>
  );
}

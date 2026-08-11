import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  chat as chatApi,
  customerProjects as cpApi,
  drafts as draftsApi,
  github as githubApi,
  leads as leadsApi,
  notifications as notificationsApi,
  projects as projectsApi,
  reviews as reviewsApi,
  stats as statsApi,
  type DashboardStats,
  team as teamApi,
} from '../api/client';
import { useToast } from '../components/useToast';
import { StatCard } from '../components/StatCard';
import { DonutChart } from '../components/DonutChart';
import { BarChart } from '../components/BarChart';

const LEAD_COLORS: Record<string, string> = {
  new: '#2563eb',
  contacted: '#d97706',
  converted: '#16a34a',
  closed: '#64748b',
};

const PROJECT_COLORS: Record<string, string> = {
  intake: '#2563eb',
  prd_draft: '#d97706',
  prd_signed: '#8b5cf6',
  in_build: '#06b6d4',
  demo: '#ec4899',
  delivered: '#10b981',
  closed: '#64748b',
};

const PROJECT_LABELS: Record<string, string> = {
  intake: 'Intake',
  prd_draft: 'PRD Draft',
  prd_signed: 'PRD Signed',
  in_build: 'In Build',
  demo: 'Demo',
  delivered: 'Delivered',
  closed: 'Closed',
};

const ACTIVITY_KINDS = {
  lead: { label: 'Lead', className: 'badge--new' },
  draft: { label: 'Draft', className: 'badge--warning' },
  chat: { label: 'Chat', className: 'badge--neutral' },
} as const;

type ActivityItem = {
  id: string;
  kind: keyof typeof ACTIVITY_KINDS;
  title: string;
  meta: string;
  when: string;
  to: string;
};

type Stats = {
  customers: { total: number; active: number; inactive: number };
  customerProjects: { total: number; byStatus: Record<string, number> };
  leads: { total: number; newTotal: number; new7d: number; byStatus: Record<string, number> };
  reviews: { total: number; published: number; pending: number };
  team: { total: number; active: number; inactive: number };
  portfolio: { total: number; published: number; unpublished: number };
  drafts: { pending: number };
  chat: { intervention: number };
  notifications: { unread: number };
  githubLastCommitAt: string | null;
  githubSyncedAt: string | null;
  githubRepositories: number;
  knowledgeChunks: number;
  agentTasksPending: number;
};

const EMPTY_STATS: Stats = {
  customers: { total: 0, active: 0, inactive: 0 },
  customerProjects: { total: 0, byStatus: {} },
  leads: { total: 0, newTotal: 0, new7d: 0, byStatus: {} },
  reviews: { total: 0, published: 0, pending: 0 },
  team: { total: 0, active: 0, inactive: 0 },
  portfolio: { total: 0, published: 0, unpublished: 0 },
  drafts: { pending: 0 },
  chat: { intervention: 0 },
  notifications: { unread: 0 },
  githubLastCommitAt: null,
  githubSyncedAt: null,
  githubRepositories: 0,
  knowledgeChunks: 0,
  agentTasksPending: 0,
};

const DAY_MS = 24 * 60 * 60 * 1000;

function fromServerStats(s: DashboardStats): Stats {
  return {
    customers: { total: s.customersTotal, active: s.customersActive, inactive: s.customersInactive },
    customerProjects: { total: s.customerProjectsTotal, byStatus: s.customerProjectsByStatus },
    leads: { total: s.leadsTotal, newTotal: s.leadsNewTotal, new7d: s.leadsNew7d, byStatus: s.leadsByStatus },
    reviews: { total: s.reviewsTotal, published: s.reviewsPublished, pending: s.reviewsPending },
    team: { total: s.teamTotal, active: s.teamActive, inactive: s.teamTotal - s.teamActive },
    portfolio: { total: s.portfolioTotal, published: s.portfolioPublished, unpublished: s.portfolioTotal - s.portfolioPublished },
    drafts: { pending: s.draftsPending },
    chat: { intervention: s.chatIntervention },
    notifications: { unread: s.notificationsUnread },
    githubLastCommitAt: s.githubLastCommitAt,
    githubSyncedAt: s.githubSyncedAt,
    githubRepositories: s.githubRepositories,
    knowledgeChunks: s.knowledgeChunks,
    agentTasksPending: s.agentTasksPending,
  };
}

function formatRelative(iso: string | null | undefined): string {
  if (!iso) return 'Never';
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 0) return 'Just now';
  if (diff < 60 * 1000) return 'Just now';
  if (diff < 60 * 60 * 1000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < DAY_MS) return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 7 * DAY_MS) return `${Math.floor(diff / DAY_MS)}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function Dashboard() {
  const { teamProfile } = useAuth();
  const { addToast, ToastContainer } = useToast();
  const [stats, setStats] = useState<Stats>(EMPTY_STATS);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setRefreshing(true);
    setError('');

    let next: Stats;
    try {
      const res = await statsApi.get();
      next = fromServerStats(res.data);
    } catch {
      // Server-side aggregate unavailable: fall back to per-source aggregation.
      next = await aggregateClientSide();
      setError('Some data sources could not be loaded. Showing partial information.');
    }

    const [recentLeadsRes, draftsRes, chatRes] = await Promise.allSettled([
      leadsApi.list({ page: 1, pageSize: 5 }),
      draftsApi.list('pending'),
      chatApi.list({ page: 1, pageSize: 5 }),
    ]);

    setStats(next);

    const items: ActivityItem[] = [];
    if (recentLeadsRes.status === 'fulfilled') {
      for (const l of recentLeadsRes.value.data) {
        items.push({ id: `lead-${l.id}`, kind: 'lead', title: l.name, meta: `${l.source} · ${l.status}`, when: l.createdAt, to: '/admin/leads' });
      }
    }
    if (draftsRes.status === 'fulfilled') {
      for (const d of draftsRes.value.data) {
        items.push({ id: `draft-${d.id}`, kind: 'draft', title: d.title, meta: d.status, when: d.createdAt, to: '/admin/drafts' });
      }
    }
    if (chatRes.status === 'fulfilled') {
      for (const t of chatRes.value.data) {
        items.push({
          id: `chat-${t.id}`,
          kind: 'chat',
          title: `Conversation ${t.customerProjectId ? 'on project' : `(${t.type})`}`,
          meta: `${t.messageCount ?? 0} messages${t.needsManualIntervention ? ' · needs review' : ''}`,
          when: t.lastMessageAt ?? t.createdAt,
          to: '/admin/chat',
        });
      }
    }
    items.sort((a, b) => new Date(b.when).getTime() - new Date(a.when).getTime());
    setActivity(items.slice(0, 8));
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const syncGithub = async () => {
    setSyncing(true);
    try {
      const res = await githubApi.sync();
      addToast(res.data.status === 'ok' ? 'GitHub sync completed' : 'GitHub sync finished', res.data.status === 'ok' ? 'success' : 'info');
      await load();
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'GitHub sync failed', 'error');
    } finally {
      setSyncing(false);
    }
  };

  const leadSegments = useMemo(
    () =>
      (['new', 'contacted', 'converted', 'closed'] as const).map((s) => ({
        label: s.charAt(0).toUpperCase() + s.slice(1),
        value: stats.leads.byStatus[s] ?? 0,
        color: LEAD_COLORS[s],
      })),
    [stats.leads.byStatus],
  );

  const projectBars = useMemo(
    () =>
      Object.entries(stats.customerProjects.byStatus)
        .map(([status, value]) => ({ label: PROJECT_LABELS[status] ?? status, value, color: PROJECT_COLORS[status] ?? '#2563eb' }))
        .sort((a, b) => b.value - a.value),
    [stats.customerProjects.byStatus],
  );

  const portfolioBars = useMemo(
    () => [
      { label: 'Published', value: stats.portfolio.published, color: '#16a34a' },
      { label: 'Unpublished', value: stats.portfolio.unpublished, color: '#64748b' },
    ],
    [stats.portfolio],
  );

  const pendingActions = [
    { label: 'AI drafts awaiting review', count: stats.drafts.pending, to: '/admin/drafts', tone: 'badge--warning' },
    { label: 'Customer reviews to moderate', count: stats.reviews.pending, to: '/admin/reviews', tone: 'badge--new' },
    { label: 'Chat conversations needing review', count: stats.chat.intervention, to: '/admin/chat', tone: 'badge--danger' },
    { label: 'Unread notifications', count: stats.notifications.unread, to: '/admin/notifications', tone: 'badge--neutral' },
  ];

  const quickActions = [
    { label: 'Add customer', to: '/admin/customers' },
    { label: 'New customer project', to: '/admin/projects' },
    { label: 'Add portfolio project', to: '/admin/portfolio' },
    { label: 'Review drafts', to: '/admin/drafts' },
    { label: 'Moderate reviews', to: '/admin/reviews' },
    { label: 'Respond to leads', to: '/admin/leads' },
    { label: 'Manage content', to: '/admin/content' },
    { label: 'Team settings', to: '/admin/team' },
  ];

  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div>
      <ToastContainer />
      <div className="page-header">
        <div>
          <h1 className="page-title">Command Center</h1>
          <p className="page-subtitle">
            Welcome back, {teamProfile?.name ?? 'Admin'} · {today}
          </p>
        </div>
        <div className="page-actions">
          <button type="button" className="btn btn--outline" onClick={() => void load()} disabled={refreshing || loading}>
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
          <button type="button" className="btn btn--primary" onClick={() => void syncGithub()} disabled={syncing}>
            {syncing ? 'Syncing…' : 'Sync GitHub'}
          </button>
        </div>
      </div>

      {error && <div className="alert alert--warning" role="alert">{error}</div>}

      {loading ? (
        <div className="page-loader">
          <div className="spinner" />
          <p>Loading command center…</p>
        </div>
      ) : (
        <>
          <div className="stat-grid">
            <StatCard
              label="Total Customers"
              value={stats.customers.total}
              sub={`${stats.customers.active} active · ${stats.customers.inactive} inactive`}
              tone={stats.customers.active > 0 ? 'success' : 'default'}
              to="/admin/customers"
            />
            <StatCard
              label="Customer Projects"
              value={stats.customerProjects.total}
              sub={`${stats.customerProjects.total - (stats.customerProjects.byStatus.closed ?? 0)} in progress`}
              tone="info"
              to="/admin/projects"
            />
            <StatCard
              label="New Leads (7 days)"
              value={stats.leads.new7d}
              sub={`${stats.leads.newTotal} new · ${stats.leads.total} total`}
              tone={stats.leads.new7d > 0 ? 'warning' : 'default'}
              to="/admin/leads"
            />
            <StatCard
              label="Pending Reviews"
              value={stats.reviews.pending}
              sub={`${stats.reviews.published} approved · ${stats.reviews.total} total`}
              tone={stats.reviews.pending > 0 ? 'danger' : 'success'}
              to="/admin/reviews"
            />
            <StatCard
              label="Team Members"
              value={stats.team.total}
              sub={`${stats.team.active} active · ${stats.team.inactive} inactive`}
              tone={stats.team.active > 0 ? 'success' : 'default'}
              to="/admin/team"
            />
            <StatCard
              label="Portfolio Projects"
              value={stats.portfolio.total}
              sub={`${stats.portfolio.published} published · ${stats.portfolio.unpublished} unpublished`}
              tone={stats.portfolio.published > 0 ? 'success' : 'default'}
              to="/admin/portfolio"
            />
            <StatCard
              label="Pending Drafts"
              value={stats.drafts.pending}
              sub="AI drafts awaiting review"
              tone={stats.drafts.pending > 0 ? 'warning' : 'success'}
              to="/admin/drafts"
            />
            <StatCard
              label="Chat Intervention"
              value={stats.chat.intervention}
              sub={`${stats.notifications.unread} unread notifications`}
              tone={stats.chat.intervention > 0 ? 'danger' : 'default'}
              to="/admin/chat"
            />
          </div>

          <div className="dashboard-grid dashboard-grid--charts">
            <div className="card">
              <div className="card-header">
                <h2 className="card-title">Leads by Status</h2>
              </div>
              <div className="card-body">
                <DonutChart segments={leadSegments} centerValue={String(stats.leads.total)} centerLabel="total" />
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <h2 className="card-title">Customer Projects by Status</h2>
              </div>
              <div className="card-body">
                {stats.customerProjects.total === 0 ? (
                  <div className="state-message">
                    <h3>No customer projects</h3>
                    <p>Projects created by customers will appear here.</p>
                  </div>
                ) : (
                  <BarChart data={projectBars} />
                )}
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <h2 className="card-title">Portfolio Publishing</h2>
              </div>
              <div className="card-body">
                <BarChart data={portfolioBars} />
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <h2 className="card-title">System Status</h2>
              </div>
              <div className="card-body">
                <ul className="status-list">
                  <li className="status-item">
                    <span className="status-item-label">Last GitHub sync</span>
                    <span className="status-item-value">{formatRelative(stats.githubSyncedAt)}</span>
                  </li>
                  <li className="status-item">
                    <span className="status-item-label">Last team commit</span>
                    <span className="status-item-value">{formatRelative(stats.githubLastCommitAt)}</span>
                  </li>
                  <li className="status-item">
                    <span className="status-item-label">Synced repositories</span>
                    <span className="status-item-value">{stats.githubRepositories}</span>
                  </li>
                  <li className="status-item">
                    <span className="status-item-label">Pending AI drafts</span>
                    <span className="status-item-value">{stats.drafts.pending}</span>
                  </li>
                  <li className="status-item">
                    <span className="status-item-label">Knowledge chunks</span>
                    <span className="status-item-value">{stats.knowledgeChunks}</span>
                  </li>
                  <li className="status-item">
                    <span className="status-item-label">Pending agent tasks</span>
                    <span className="status-item-value">{stats.agentTasksPending}</span>
                  </li>
                  <li className="status-item">
                    <span className="status-item-label">Unread notifications</span>
                    <span className="status-item-value">{stats.notifications.unread}</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <div className="dashboard-grid dashboard-grid--split">
            <div className="card">
              <div className="card-header">
                <h2 className="card-title">Pending Actions</h2>
                <Link className="btn btn--outline btn--sm" to="/admin/notifications">
                  View notifications
                </Link>
              </div>
              <div className="card-body card-body--flush">
                {pendingActions.every((a) => a.count === 0) ? (
                  <div className="state-message">
                    <h3>All clear</h3>
                    <p>Nothing currently needs your attention.</p>
                  </div>
                ) : (
                  <ul className="action-list">
                    {pendingActions.map((a) => (
                      <li key={a.label} className="action-item">
                        <span className={`badge ${a.tone}`}>{a.count}</span>
                        <span className="action-item-label">{a.label}</span>
                        <Link className="btn btn--outline btn--sm" to={a.to}>
                          Open
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <h2 className="card-title">Recent Activity</h2>
              </div>
              <div className="card-body card-body--flush">
                {activity.length === 0 ? (
                  <div className="state-message">
                    <h3>No recent activity</h3>
                    <p>New leads, drafts, and conversations will appear here.</p>
                  </div>
                ) : (
                  <ul className="activity-list">
                    {activity.map((item) => (
                      <li key={item.id} className="activity-item">
                        <span className={`badge ${ACTIVITY_KINDS[item.kind].className}`}>{ACTIVITY_KINDS[item.kind].label}</span>
                        <div className="activity-item-body">
                          <Link className="activity-item-title" to={item.to}>
                            {item.title}
                          </Link>
                          <span className="activity-item-meta">{item.meta}</span>
                        </div>
                        <span className="activity-item-time">{formatRelative(item.when)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Quick Actions</h2>
            </div>
            <div className="card-body">
              <div className="quick-actions">
                {quickActions.map((qa) => (
                  <Link key={qa.to} className="btn btn--outline" to={qa.to}>
                    {qa.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/** Client-side fallback used when /admin/dashboard/stats is unavailable. */
async function aggregateClientSide(): Promise<Stats> {
  const next: Stats = { ...EMPTY_STATS };
  const [customersRes, customersActiveRes, projectsRes, leadsRes, leadsNewRes, reviewsRes, reviewsPublishedRes, teamRes, portfolioRes, draftsRes, chatInterventionRes, notificationsRes] =
    await Promise.allSettled([
      cpApi.listCustomers({ page: 1, pageSize: 1 }),
      cpApi.listCustomers({ page: 1, pageSize: 1, isActive: true }),
      cpApi.list(),
      leadsApi.list({ page: 1, pageSize: 1 }),
      leadsApi.list({ status: 'new', page: 1, pageSize: 100 }),
      reviewsApi.list({ page: 1, pageSize: 1 }),
      reviewsApi.list({ page: 1, pageSize: 1, published: true }),
      teamApi.list(),
      projectsApi.list(),
      draftsApi.list('pending'),
      chatApi.list({ needsManualIntervention: true, page: 1, pageSize: 1 }),
      notificationsApi.list({ unread: true, page: 1, pageSize: 1 }),
    ]);

  if (customersRes.status === 'fulfilled') next.customers.total = customersRes.value.pagination?.totalCount ?? 0;
  if (customersActiveRes.status === 'fulfilled') next.customers.active = customersActiveRes.value.pagination?.totalCount ?? 0;
  next.customers.inactive = next.customers.total - next.customers.active;

  if (projectsRes.status === 'fulfilled') {
    next.customerProjects.total = projectsRes.value.data.length;
    for (const p of projectsRes.value.data) {
      next.customerProjects.byStatus[p.status] = (next.customerProjects.byStatus[p.status] ?? 0) + 1;
    }
  }

  if (leadsRes.status === 'fulfilled') next.leads.total = leadsRes.value.pagination?.totalCount ?? 0;
  if (leadsNewRes.status === 'fulfilled') {
    const cutoff = Date.now() - 7 * DAY_MS;
    next.leads.newTotal = leadsNewRes.value.pagination?.totalCount ?? leadsNewRes.value.data.length;
    next.leads.new7d = leadsNewRes.value.data.filter((l) => new Date(l.createdAt).getTime() >= cutoff).length;
  }

  const statuses = ['new', 'contacted', 'converted', 'closed'] as const;
  const statusRes = await Promise.allSettled(
    statuses.map((s) => leadsApi.list({ status: s, page: 1, pageSize: 1 })),
  );
  statuses.forEach((s, i) => {
    next.leads.byStatus[s] = statusRes[i].status === 'fulfilled' ? (statusRes[i].value.pagination?.totalCount ?? 0) : 0;
  });

  if (reviewsRes.status === 'fulfilled') next.reviews.total = reviewsRes.value.pagination?.totalCount ?? 0;
  if (reviewsPublishedRes.status === 'fulfilled') next.reviews.published = reviewsPublishedRes.value.pagination?.totalCount ?? 0;
  next.reviews.pending = Math.max(0, next.reviews.total - next.reviews.published);

  if (teamRes.status === 'fulfilled') {
    next.team.total = teamRes.value.data.length;
    next.team.active = teamRes.value.data.filter((m) => m.isActive).length;
    let lastCommit: string | null = null;
    let syncedAt: string | null = null;
    for (const m of teamRes.value.data) {
      const snap = m.githubSnapshot;
      if (!snap) continue;
      if (!syncedAt || snap.capturedAt > syncedAt) syncedAt = snap.capturedAt;
      if (!lastCommit || snap.lastCommitAt > lastCommit) lastCommit = snap.lastCommitAt;
    }
    next.githubLastCommitAt = lastCommit;
    next.githubSyncedAt = syncedAt;
  }
  next.team.inactive = next.team.total - next.team.active;

  if (portfolioRes.status === 'fulfilled') {
    next.portfolio.total = portfolioRes.value.data.length;
    next.portfolio.published = portfolioRes.value.data.filter((p) => p.isPublished).length;
  }
  next.portfolio.unpublished = next.portfolio.total - next.portfolio.published;

  if (draftsRes.status === 'fulfilled') next.drafts.pending = draftsRes.value.data.length;
  if (chatInterventionRes.status === 'fulfilled') next.chat.intervention = chatInterventionRes.value.pagination?.totalCount ?? 0;
  if (notificationsRes.status === 'fulfilled') next.notifications.unread = notificationsRes.value.pagination?.totalCount ?? 0;

  return next;
}

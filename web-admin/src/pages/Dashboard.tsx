import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { leads as leadsApi } from '../api/client';
import type { Lead } from '../types';

export default function Dashboard() {
  const { teamProfile } = useAuth();
  const [recentLeads, setRecentLeads] = useState<Lead[]>([]);
  const [leadStats, setLeadStats] = useState<{ new: number; contacted: number; converted: number; total: number }>({ new: 0, contacted: 0, converted: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await leadsApi.list({ page: 1, pageSize: 5 });
        const leads = res.data as Lead[];
        setRecentLeads(leads);

        // Fetch all leads to compute stats (basic approach — ideally a stats endpoint would exist)
        const allRes = await leadsApi.list({ page: 1, pageSize: 100 });
        const allLeads = allRes.data as Lead[];
        setLeadStats({
          new: allLeads.filter((l) => l.status === 'new').length,
          contacted: allLeads.filter((l) => l.status === 'contacted').length,
          converted: allLeads.filter((l) => l.status === 'converted').length,
          total: allRes.pagination?.totalCount ?? allLeads.length,
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const lastCommitDate = teamProfile?.githubSnapshot?.lastCommitAt
    ? new Date(teamProfile.githubSnapshot.lastCommitAt).toLocaleDateString()
    : 'N/A';

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Welcome back, {teamProfile?.name ?? 'Admin'}</p>
        </div>
      </div>

      {error && <div className="alert alert--error" role="alert">{error}</div>}

      {loading ? (
        <div className="page-loader">
          <div className="spinner" />
          <p>Loading dashboard...</p>
        </div>
      ) : (
        <>
          <div className="stat-grid">
            <div className="stat-card">
              <span className="stat-card-label">New Leads</span>
              <span className="stat-card-value">{leadStats.new}</span>
              <span className="stat-card-sub">{leadStats.total} total leads</span>
            </div>
            <div className="stat-card">
              <span className="stat-card-label">Contacted</span>
              <span className="stat-card-value">{leadStats.contacted}</span>
              <span className="stat-card-sub">Awaiting response</span>
            </div>
            <div className="stat-card">
              <span className="stat-card-label">Converted</span>
              <span className="stat-card-value">{leadStats.converted}</span>
              <span className="stat-card-sub">Became customers</span>
            </div>
            <div className="stat-card">
              <span className="stat-card-label">Last GitHub Commit</span>
              <span className="stat-card-value" style={{ fontSize: 'var(--font-size-lg)' }}>{lastCommitDate}</span>
              <span className="stat-card-sub">From team snapshots</span>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Recent Leads</h2>
            </div>
            <div className="card-body card-body--flush">
              {recentLeads.length === 0 ? (
                <div className="state-message">
                  <span className="state-message-icon">📬</span>
                  <h3>No leads yet</h3>
                  <p>New leads from the public site and chatbot will appear here.</p>
                </div>
              ) : (
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Contact</th>
                        <th>Source</th>
                        <th>Status</th>
                        <th>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentLeads.map((lead) => (
                        <tr key={lead.id}>
                          <td style={{ fontWeight: 600 }}>{lead.name}</td>
                          <td>{lead.contactInfo}</td>
                          <td><span className={`badge badge--neutral`}>{lead.source}</span></td>
                          <td><span className={`badge badge--${lead.status}`}>{lead.status}</span></td>
                          <td>{new Date(lead.createdAt).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

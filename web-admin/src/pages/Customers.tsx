import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { customerProjects as cpApi } from '../api/client';
import type { Customer } from '../types';

export default function Customers() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchCustomers = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await cpApi.listCustomers({ page, pageSize: 20 });
      setCustomers(res.data as Customer[]);
      setTotalPages(res.pagination?.totalPages ?? 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load customers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCustomers(); }, [page]);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Customers</h1>
          <p className="page-subtitle">Registered customers and their active projects.</p>
        </div>
      </div>

      {error && <div className="alert alert--error" role="alert">{error}</div>}

      <div className="card">
        <div className="card-body card-body--flush">
          {loading ? (
            <div className="page-loader">
              <div className="spinner" />
            </div>
          ) : customers.length === 0 ? (
            <div className="state-message">
              <span className="state-message-icon">👥</span>
              <h3>No customers yet</h3>
              <p>Customers will appear here when they register and start projects.</p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Projects</th>
                    <th>Registered</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((c) => (
                    <tr
                      key={c.id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => navigate(`/admin/projects?customerId=${c.id}`)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/admin/projects?customerId=${c.id}`); } }}
                      tabIndex={0}
                      role="link"
                      aria-label={`View projects for ${c.name}`}
                    >
                      <td style={{ fontWeight: 600 }}>{c.name}</td>
                      <td>{c.email}</td>
                      <td>
                        <span className={`badge ${c.projectCount > 0 ? 'badge--live' : 'badge--neutral'}`}>
                          {c.projectCount}
                        </span>
                      </td>
                      <td>{new Date(c.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        {totalPages > 1 && (
          <div className="card-header" style={{ justifyContent: 'center' }}>
            <div className="form-inline">
              <button className="btn btn--outline btn--sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
              <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--content-muted)' }}>Page {page} of {totalPages}</span>
              <button className="btn btn--outline btn--sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

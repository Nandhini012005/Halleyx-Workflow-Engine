import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Edit2, Play, Trash2, GitBranch, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { workflowApi } from '../utils/api';
import { formatDistanceToNow } from 'date-fns';

function StatusBadge({ isActive }) {
  return isActive
    ? <span className="badge badge-green">● Active</span>
    : <span className="badge badge-gray">○ Inactive</span>;
}

export default function WorkflowListPage() {
  const navigate = useNavigate();
  const [workflows, setWorkflows] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, pages: 1 });
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(null);

  const fetchWorkflows = useCallback(async () => {
    setLoading(true);
    try {
      const res = await workflowApi.list({ page: pagination.page, limit: pagination.limit, search, status });
      setWorkflows(res.data.data);
      setPagination(p => ({ ...p, ...res.data.pagination }));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, search, status]);

  useEffect(() => { fetchWorkflows(); }, [fetchWorkflows]);

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete workflow "${name}"? This cannot be undone.`)) return;
    setDeleting(id);
    try {
      await workflowApi.delete(id);
      toast.success('Workflow deleted');
      fetchWorkflows();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeleting(null);
    }
  };

  const handleSearchChange = (e) => {
    setSearch(e.target.value);
    setPagination(p => ({ ...p, page: 1 }));
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Workflows</h1>
          <div className="subtitle">Design, manage and execute automated processes</div>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/workflows/new')}>
          <Plus size={15} /> New Workflow
        </button>
      </div>

      <div className="page-body">
        {/* Toolbar */}
        <div className="toolbar" style={{ marginBottom: 20 }}>
          <div className="search-wrap">
            <Search size={14} />
            <input
              className="search-input"
              placeholder="Search workflows..."
              value={search}
              onChange={handleSearchChange}
            />
          </div>
          <select
            className="form-select"
            style={{ width: 140 }}
            value={status}
            onChange={e => { setStatus(e.target.value); setPagination(p => ({ ...p, page: 1 })); }}
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <button className="btn btn-ghost btn-sm" onClick={fetchWorkflows} title="Refresh">
            <RefreshCw size={14} />
          </button>
          <span style={{ marginLeft: 'auto', fontSize: '0.78rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            {pagination.total} total
          </span>
        </div>

        {/* Table */}
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Name</th>
                  <th>Steps</th>
                  <th>Version</th>
                  <th>Status</th>
                  <th>Updated</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                      <div className="spinner" style={{ margin: '0 auto' }} />
                    </td>
                  </tr>
                ) : workflows.length === 0 ? (
                  <tr>
                    <td colSpan={7}>
                      <div className="empty-state">
                        <GitBranch size={40} className="empty-state-icon" />
                        <h3>No workflows yet</h3>
                        <p>Create your first workflow to get started</p>
                        <button className="btn btn-primary" onClick={() => navigate('/workflows/new')}>
                          <Plus size={14} /> Create Workflow
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : workflows.map(wf => (
                  <tr key={wf.id}>
                    <td><code style={{ fontSize: '0.72rem' }}>{wf.id?.slice(0, 8)}…</code></td>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{wf.name}</div>
                      {wf.description && <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: 2 }}>{wf.description}</div>}
                    </td>
                    <td>
                      <span className="badge badge-purple">{wf.step_count || 0} steps</span>
                    </td>
                    <td>
                      <span className="badge badge-gray">v{wf.version}</span>
                    </td>
                    <td><StatusBadge isActive={wf.is_active} /></td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontFamily: 'var(--font-mono)' }}>
                      {formatDistanceToNow(new Date(wf.updated_at), { addSuffix: true })}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/workflows/${wf.id}/edit`)} title="Edit">
                          <Edit2 size={13} /> Edit
                        </button>
                        <button className="btn btn-primary btn-sm" onClick={() => navigate(`/workflows/${wf.id}/execute`)} title="Execute">
                          <Play size={13} /> Run
                        </button>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleDelete(wf.id, wf.name)}
                          disabled={deleting === wf.id}
                          title="Delete"
                        >
                          {deleting === wf.id ? <div className="spinner" style={{ width: 12, height: 12 }} /> : <Trash2 size={13} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="pagination">
            <button
              className="page-btn"
              onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
              disabled={pagination.page <= 1}
            >
              <ChevronLeft size={14} />
            </button>
            {Array.from({ length: pagination.pages }, (_, i) => i + 1).map(p => (
              <button
                key={p}
                className={`page-btn${pagination.page === p ? ' active' : ''}`}
                onClick={() => setPagination(prev => ({ ...prev, page: p }))}
              >{p}</button>
            ))}
            <button
              className="page-btn"
              onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
              disabled={pagination.page >= pagination.pages}
            >
              <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>
    </>
  );
}

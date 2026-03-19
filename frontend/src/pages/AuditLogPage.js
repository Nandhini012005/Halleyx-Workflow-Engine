import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, Eye, RefreshCw, ChevronLeft, ChevronRight, CheckCircle, XCircle, Clock, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { executionApi } from '../utils/api';
import { formatDistanceToNow, format } from 'date-fns';

const STATUS_CONFIG = {
  pending:     { badge: 'badge-gray',   icon: Clock,        label: 'Pending'     },
  in_progress: { badge: 'badge-yellow', icon: RefreshCw,    label: 'In Progress' },
  completed:   { badge: 'badge-green',  icon: CheckCircle,  label: 'Completed'   },
  failed:      { badge: 'badge-red',    icon: XCircle,      label: 'Failed'      },
  canceled:    { badge: 'badge-gray',   icon: X,            label: 'Canceled'    },
};

export default function AuditLogPage() {
  const navigate = useNavigate();
  const [executions, setExecutions] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 1 });
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);

  // Stats
  const [stats, setStats] = useState({ total: 0, completed: 0, failed: 0, in_progress: 0 });

  const fetchExecutions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await executionApi.list({ page: pagination.page, limit: pagination.limit, status: statusFilter });
      setExecutions(res.data.data);
      setPagination(p => ({ ...p, ...res.data.pagination }));

      // Build stats from all (using current page data for approximation)
      const all = res.data.data;
      setStats({
        total: res.data.pagination.total,
        completed: all.filter(e => e.status === 'completed').length,
        failed: all.filter(e => e.status === 'failed').length,
        in_progress: all.filter(e => e.status === 'in_progress').length,
      });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, statusFilter]);

  useEffect(() => { fetchExecutions(); }, [fetchExecutions]);

  const getDuration = (ex) => {
    if (!ex.started_at || !ex.ended_at) return '—';
    const ms = new Date(ex.ended_at) - new Date(ex.started_at);
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Audit Log</h1>
          <div className="subtitle">Track workflow execution history and compliance</div>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={fetchExecutions}><RefreshCw size={14} /></button>
      </div>

      <div className="page-body">
        {/* Stats */}
        <div className="stats-grid">
          {[
            { label: 'Total Executions', value: pagination.total, color: 'var(--accent)' },
            { label: 'Completed', value: executions.filter(e => e.status === 'completed').length, color: 'var(--green)' },
            { label: 'Failed', value: executions.filter(e => e.status === 'failed').length, color: 'var(--red)' },
            { label: 'In Progress', value: executions.filter(e => e.status === 'in_progress').length, color: 'var(--yellow)' },
          ].map(s => (
            <div className="stat-card" key={s.label}>
              <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Filter toolbar */}
        <div className="toolbar" style={{ marginBottom: 16 }}>
          <select
            className="form-select"
            style={{ width: 160 }}
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setPagination(p => ({ ...p, page: 1 })); }}
          >
            <option value="">All Status</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
            <option value="in_progress">In Progress</option>
            <option value="canceled">Canceled</option>
            <option value="pending">Pending</option>
          </select>
          <span style={{ marginLeft: 'auto', fontSize: '0.78rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            {pagination.total} executions
          </span>
        </div>

        {/* Table */}
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Execution ID</th>
                  <th>Workflow</th>
                  <th>Version</th>
                  <th>Status</th>
                  <th>Steps</th>
                  <th>Triggered By</th>
                  <th>Start Time</th>
                  <th>Duration</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={9} style={{ textAlign: 'center', padding: 40 }}><div className="spinner" style={{ margin: '0 auto' }} /></td></tr>
                ) : executions.length === 0 ? (
                  <tr>
                    <td colSpan={9}>
                      <div className="empty-state">
                        <ClipboardList size={36} className="empty-state-icon" />
                        <h3>No executions yet</h3>
                        <p>Run a workflow to see execution history here</p>
                      </div>
                    </td>
                  </tr>
                ) : executions.map(ex => {
                  const cfg = STATUS_CONFIG[ex.status] || STATUS_CONFIG.pending;
                  const Icon = cfg.icon;
                  return (
                    <tr key={ex.id}>
                      <td><code style={{ fontSize: '0.72rem' }}>{ex.id?.slice(0, 8)}…</code></td>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{ex.workflow_name}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{ex.workflow_id?.slice(0,8)}…</div>
                      </td>
                      <td><span className="badge badge-gray">v{ex.workflow_version}</span></td>
                      <td>
                        <span className={`badge ${cfg.badge}`} style={{ gap: 5 }}>
                          <Icon size={10} /> {cfg.label}
                        </span>
                      </td>
                      <td><span className="badge badge-purple">{ex.logs?.length || 0} steps</span></td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{ex.triggered_by}</td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                        {ex.started_at ? format(new Date(ex.started_at), 'MMM dd, HH:mm:ss') : '—'}
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        {getDuration(ex)}
                      </td>
                      <td>
                        <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/executions/${ex.id}`)}>
                          <Eye size={12} /> View Logs
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="pagination">
            <button className="page-btn" onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))} disabled={pagination.page <= 1}>
              <ChevronLeft size={14} />
            </button>
            {Array.from({ length: Math.min(pagination.pages, 7) }, (_, i) => i + 1).map(p => (
              <button key={p} className={`page-btn${pagination.page === p ? ' active' : ''}`} onClick={() => setPagination(prev => ({ ...prev, page: p }))}>{p}</button>
            ))}
            <button className="page-btn" onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))} disabled={pagination.page >= pagination.pages}>
              <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>
    </>
  );
}

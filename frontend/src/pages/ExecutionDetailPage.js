import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle, XCircle, Clock, RefreshCw, X, ChevronDown, ChevronUp } from 'lucide-react';
import toast from 'react-hot-toast';
import { executionApi } from '../utils/api';
import { format } from 'date-fns';

const STATUS_CONFIG = {
  pending:     { badge: 'badge-gray',   color: 'var(--text-muted)',  icon: Clock        },
  in_progress: { badge: 'badge-yellow', color: 'var(--yellow)',      icon: RefreshCw    },
  completed:   { badge: 'badge-green',  color: 'var(--green)',       icon: CheckCircle  },
  failed:      { badge: 'badge-red',    color: 'var(--red)',         icon: XCircle      },
  canceled:    { badge: 'badge-gray',   color: 'var(--text-muted)',  icon: X            },
  awaiting_approval: { badge: 'badge-blue', color: 'var(--blue)',   icon: Clock        },
};

function DetailedLogEntry({ log }) {
  const [open, setOpen] = useState(false);
  const cfg = STATUS_CONFIG[log.status] || STATUS_CONFIG.pending;
  const Icon = cfg.icon;
  let ruleData = null;
  try { if (log.rule_evaluated) ruleData = JSON.parse(log.rule_evaluated); } catch {}

  return (
    <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderLeft: `3px solid ${cfg.color}`, borderRadius: '0 8px 8px 0', marginBottom: 10, overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <Icon size={16} style={{ color: cfg.color, flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 600 }}>{log.step_name}</span>
            <span className={`step-type-tag step-${log.step_type}`}>{log.step_type}</span>
            <span className={`badge ${cfg.badge}`}>{log.status.replace('_', ' ')}</span>
            {log.iteration > 0 && <span className="badge badge-purple">iteration {log.iteration}</span>}
          </div>
          <div style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginTop: 4, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {log.started_at && <span>Started: {format(new Date(log.started_at), 'HH:mm:ss.SSS')}</span>}
            {log.ended_at && <span>Ended: {format(new Date(log.ended_at), 'HH:mm:ss.SSS')}</span>}
            {log.duration_ms !== null && <span>Duration: {log.duration_ms}ms</span>}
          </div>
        </div>
        {(ruleData || log.error || log.metadata) && (
          <button className="btn btn-ghost btn-sm" onClick={() => setOpen(!open)}>
            {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        )}
      </div>

      {open && (
        <div style={{ padding: '0 16px 14px', borderTop: '1px solid var(--border)', paddingTop: 12 }}>
          {log.error && (
            <div style={{ background: 'var(--red-dim)', border: '1px solid rgba(255,79,106,0.3)', borderRadius: 6, padding: '8px 12px', marginBottom: 10, color: 'var(--red)', fontSize: '0.82rem' }}>
              ⚠ Error: {log.error}
            </div>
          )}

          {log.metadata?.assignee_email && (
            <div style={{ marginBottom: 8, fontSize: '0.82rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Assignee: </span>
              <span>{log.metadata.assignee_email}</span>
              {log.metadata.approved !== undefined && (
                <span style={{ marginLeft: 10, color: log.metadata.approved ? 'var(--green)' : 'var(--red)' }}>
                  {log.metadata.approved ? '✓ Approved' : '✗ Rejected'}
                </span>
              )}
            </div>
          )}

          {ruleData && (
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 6, padding: '10px 14px', fontSize: '0.78rem', fontFamily: 'var(--font-mono)' }}>
              <div style={{ marginBottom: 6, color: 'var(--text-secondary)', fontFamily: 'var(--font-main)', fontWeight: 600, fontSize: '0.8rem' }}>Rule Evaluation:</div>
              {ruleData.winning_rule && (
                <div style={{ marginBottom: 6 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Winning: </span>
                  <code style={{ color: ruleData.used_default ? 'var(--yellow)' : 'var(--green)', background: 'transparent', border: 'none' }}>
                    {ruleData.winning_rule.condition}
                  </code>
                  {ruleData.used_default && <span style={{ color: 'var(--yellow)', marginLeft: 8, fontSize: '0.7rem' }}>[DEFAULT FALLBACK]</span>}
                </div>
              )}
              {ruleData.next_step_id !== undefined && (
                <div style={{ marginBottom: 8 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Next step: </span>
                  <span style={{ color: ruleData.next_step_id ? 'var(--blue)' : 'var(--green)' }}>
                    {ruleData.next_step_id || '— END WORKFLOW —'}
                  </span>
                </div>
              )}
              {ruleData.evaluated?.length > 0 && (
                <div>
                  <div style={{ color: 'var(--text-muted)', marginBottom: 4 }}>All conditions checked:</div>
                  {ruleData.evaluated.map((e, i) => (
                    <div key={i} style={{ padding: '2px 0', color: e.matched ? 'var(--green)' : 'var(--text-muted)', display: 'flex', gap: 8 }}>
                      <span>{e.matched ? '✓' : '✗'}</span>
                      <span style={{ color: 'var(--text-muted)' }}>P{e.priority}:</span>
                      <span style={{ color: e.is_default ? 'var(--yellow)' : e.matched ? 'var(--green)' : 'var(--text-secondary)' }}>{e.condition}</span>
                      {e.error && <span style={{ color: 'var(--red)', fontSize: '0.7rem' }}>[{e.error}]</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ExecutionDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [execution, setExecution] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    executionApi.get(id).then(res => setExecution(res.data))
      .catch(err => { toast.error(err.message); navigate('/audit'); })
      .finally(() => setLoading(false));
  }, [id, navigate]);

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><div className="spinner" /></div>;
  if (!execution) return null;

  const cfg = STATUS_CONFIG[execution.status];
  const StatusIcon = cfg?.icon || Clock;

  return (
    <>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn btn-ghost btn-icon" onClick={() => navigate('/audit')}><ArrowLeft size={18} /></button>
          <div>
            <h1>{execution.workflow_name || 'Execution'} — Logs</h1>
            <div className="subtitle" style={{ fontFamily: 'var(--font-mono)' }}>{execution.id}</div>
          </div>
        </div>
        {cfg && <span className={`badge ${cfg.badge}`} style={{ fontSize: '0.85rem', padding: '6px 14px' }}>
          <StatusIcon size={11} style={{ marginRight: 5 }} />
          {execution.status.replace('_', ' ').toUpperCase()}
        </span>}
      </div>

      <div className="page-body" style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 24 }}>
        {/* Logs */}
        <div>
          <div className="card">
            <div className="card-header">
              <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>Step Execution Logs ({execution.logs?.length || 0})</span>
            </div>
            <div className="card-body">
              {!execution.logs?.length ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No logs available.</div>
              ) : execution.logs.map((log, idx) => <DetailedLogEntry key={idx} log={log} />)}
            </div>
          </div>
        </div>

        {/* Sidebar: metadata */}
        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-header"><span style={{ fontWeight: 600, fontSize: '0.88rem' }}>Execution Details</span></div>
            <div className="card-body">
              {[
                ['ID', <code style={{ fontSize: '0.72rem' }}>{execution.id?.slice(0,12)}…</code>],
                ['Workflow', execution.workflow_name],
                ['Version', `v${execution.workflow_version}`],
                ['Status', <span className={`badge ${cfg?.badge}`}>{execution.status}</span>],
                ['Triggered by', execution.triggered_by],
                ['Retries', execution.retries],
                ['Started', execution.started_at ? format(new Date(execution.started_at), 'MMM d, HH:mm:ss') : '—'],
                ['Ended', execution.ended_at ? format(new Date(execution.ended_at), 'MMM d, HH:mm:ss') : '—'],
              ].map(([label, value]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid var(--border)', fontSize: '0.82rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>{label}</span>
                  <span>{value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-header"><span style={{ fontWeight: 600, fontSize: '0.88rem' }}>Input Data</span></div>
            <div className="card-body">
              <pre style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', wordBreak: 'break-all', margin: 0 }}>
                {JSON.stringify(execution.data, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

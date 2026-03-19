import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Play, CheckCircle, XCircle, Clock, AlertTriangle, RefreshCw, X, ChevronDown, ChevronUp } from 'lucide-react';
import toast from 'react-hot-toast';
import { workflowApi, executionApi } from '../utils/api';

const STATUS_CONFIG = {
  pending:    { color: 'var(--text-muted)',   icon: Clock,         badge: 'badge-gray'   },
  in_progress:{ color: 'var(--yellow)',       icon: RefreshCw,     badge: 'badge-yellow' },
  completed:  { color: 'var(--green)',        icon: CheckCircle,   badge: 'badge-green'  },
  failed:     { color: 'var(--red)',          icon: XCircle,       badge: 'badge-red'    },
  canceled:   { color: 'var(--text-muted)',   icon: X,             badge: 'badge-gray'   },
};

function LogEntry({ log }) {
  const [open, setOpen] = useState(false);
  const cfg = STATUS_CONFIG[log.status] || STATUS_CONFIG.pending;
  const Icon = cfg.icon;

  let ruleData = null;
  try { if (log.rule_evaluated) ruleData = JSON.parse(log.rule_evaluated); } catch {}

  return (
    <div className={`log-entry log-${log.status}`}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Icon size={15} style={{ color: cfg.color, flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>{log.step_name}</span>
            <span className={`step-type-tag step-${log.step_type}`}>{log.step_type}</span>
            <span className={`badge ${cfg.badge}`}>{log.status}</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: 3 }}>
            {log.started_at && new Date(log.started_at).toLocaleTimeString()}
            {log.duration_ms && ` · ${log.duration_ms}ms`}
            {log.iteration > 0 && ` · iteration ${log.iteration}`}
          </div>
        </div>
        {(ruleData || log.error) && (
          <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setOpen(!open)}>
            {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        )}
      </div>
      {open && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
          {log.error && <div style={{ color: 'var(--red)', fontSize: '0.8rem', marginBottom: 8 }}>⚠ {log.error}</div>}
          {ruleData && (
            <div style={{ fontSize: '0.76rem', fontFamily: 'var(--font-mono)' }}>
              {ruleData.winning_rule && (
                <div style={{ marginBottom: 6 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Matched rule: </span>
                  <code style={{ color: ruleData.used_default ? 'var(--yellow)' : 'var(--green)' }}>
                    {ruleData.winning_rule.condition}
                  </code>
                  {ruleData.used_default && <span style={{ color: 'var(--yellow)', marginLeft: 6 }}>(DEFAULT)</span>}
                </div>
              )}
              {ruleData.next_step_id !== undefined && (
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Next: </span>
                  <span style={{ color: 'var(--green)' }}>{ruleData.next_step_id || 'END WORKFLOW'}</span>
                </div>
              )}
              {ruleData.evaluated?.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ color: 'var(--text-muted)', marginBottom: 4 }}>All evaluated:</div>
                  {ruleData.evaluated.map((e, i) => (
                    <div key={i} style={{ padding: '2px 0', color: e.matched ? 'var(--green)' : 'var(--text-muted)' }}>
                      {e.matched ? '✓' : '✗'} P{e.priority}: {e.condition}
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

export default function ExecutionPage() {
  const { id: workflowId } = useParams();
  const navigate = useNavigate();
  const [workflow, setWorkflow] = useState(null);
  const [inputData, setInputData] = useState({});
  const [execution, setExecution] = useState(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [errors, setErrors] = useState({});
  const pollRef = useRef(null);

  useEffect(() => {
    workflowApi.get(workflowId).then(res => {
      setWorkflow(res.data);
      // Initialize input form from schema
      const schema = res.data.input_schema;
      if (schema) {
        const entries = schema instanceof Map ? Object.fromEntries(schema) :
          (typeof schema === 'object' ? schema : {});
        const init = {};
        Object.entries(entries).forEach(([k, v]) => {
          init[k] = v.type === 'boolean' ? false : v.type === 'number' ? '' : '';
        });
        setInputData(init);
      }
    }).catch(err => { toast.error(err.message); navigate('/workflows'); })
    .finally(() => setLoading(false));
  }, [workflowId, navigate]);

  // Poll execution status
  const pollExecution = useCallback(async (execId) => {
    try {
      const res = await executionApi.get(execId);
      setExecution(res.data);
      if (['completed', 'failed', 'canceled'].includes(res.data.status)) {
        clearInterval(pollRef.current);
        setRunning(false);
      }
    } catch {}
  }, []);

  useEffect(() => () => clearInterval(pollRef.current), []);

  const handleExecute = async () => {
    const schema = workflow?.input_schema || {};
    const entries = typeof schema === 'object' ? schema : {};
    const newErrors = {};

    Object.entries(entries).forEach(([key, def]) => {
      if (def.required && (inputData[key] === '' || inputData[key] === undefined || inputData[key] === null)) {
        newErrors[key] = 'This field is required';
      }
    });

    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }
    setErrors({});

    setRunning(true);
    try {
      const res = await workflowApi.execute(workflowId, { data: inputData, triggered_by: 'ui-user' });
      setExecution(res.data);
      toast.success('Workflow started!');
      pollRef.current = setInterval(() => pollExecution(res.data.id), 1500);
    } catch (err) {
      toast.error(err.message);
      setRunning(false);
    }
  };

  const handleCancel = async () => {
    if (!execution) return;
    await executionApi.cancel(execution.id);
    clearInterval(pollRef.current);
    pollExecution(execution.id);
    toast.success('Execution canceled');
  };

  const handleRetry = async () => {
    if (!execution) return;
    setRunning(true);
    await executionApi.retry(execution.id);
    pollRef.current = setInterval(() => pollExecution(execution.id), 1500);
    toast.success('Retrying...');
  };

  const handleApprove = async (stepId, approved) => {
    await executionApi.approve(execution.id, { step_id: stepId, approved });
    toast.success(approved ? 'Approved!' : 'Rejected');
    pollExecution(execution.id);
    if (approved) {
      setRunning(true);
      pollRef.current = setInterval(() => pollExecution(execution.id), 1500);
    }
  };

  const renderInputField = (key, def) => {
    if (def.type === 'boolean') {
      return (
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
          <label className="toggle">
            <input type="checkbox" checked={!!inputData[key]} onChange={e => setInputData(d => ({ ...d, [key]: e.target.checked }))} />
            <span className="toggle-track" />
          </label>
          <span style={{ fontSize: '0.85rem' }}>{inputData[key] ? 'true' : 'false'}</span>
        </label>
      );
    }
    if (def.type === 'enum' && def.allowed_values?.length > 0) {
      return (
        <select className="form-select" value={inputData[key] || ''} onChange={e => setInputData(d => ({ ...d, [key]: e.target.value }))}>
          <option value="">— Select —</option>
          {def.allowed_values.map(v => <option key={v} value={v}>{v}</option>)}
        </select>
      );
    }
    return (
      <input
        className={`form-input${def.type === 'number' ? ' form-mono' : ''}`}
        type={def.type === 'number' ? 'number' : 'text'}
        value={inputData[key] || ''}
        onChange={e => setInputData(d => ({ ...d, [key]: def.type === 'number' ? (e.target.value === '' ? '' : parseFloat(e.target.value)) : e.target.value }))}
        placeholder={def.description || key}
      />
    );
  };

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><div className="spinner" /></div>;

  const schema = workflow?.input_schema || {};
  const schemaEntries = typeof schema === 'object' ? Object.entries(schema) : [];
  const statusCfg = execution ? STATUS_CONFIG[execution.status] : null;
  const awaitingApproval = execution?.logs?.find(l => l.status === 'awaiting_approval');

  return (
    <>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn btn-ghost btn-icon" onClick={() => navigate('/workflows')}><ArrowLeft size={18} /></button>
          <div>
            <h1>Execute: {workflow?.name}</h1>
            <div className="subtitle">v{workflow?.version}</div>
          </div>
        </div>
        {execution && statusCfg && (
          <span className={`badge ${statusCfg.badge}`} style={{ fontSize: '0.85rem', padding: '6px 14px' }}>
            {execution.status.replace('_', ' ').toUpperCase()}
          </span>
        )}
      </div>

      <div className="page-body" style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 24 }}>
        {/* Input form */}
        <div>
          <div className="card">
            <div className="card-header">
              <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>Input Data</span>
            </div>
            <div className="card-body">
              {schemaEntries.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: 16 }}>No input schema defined. Run with empty data.</div>
              ) : (
                schemaEntries.map(([key, def]) => (
                  <div className="form-group" key={key}>
                    <label className="form-label">
                      {key} {def.required && <span className="required">*</span>}
                      <span style={{ marginLeft: 6, fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{def.type}</span>
                    </label>
                    {renderInputField(key, def)}
                    {def.description && <div className="form-hint">{def.description}</div>}
                    {errors[key] && <div className="form-error">{errors[key]}</div>}
                  </div>
                ))
              )}

              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleExecute} disabled={running || execution?.status === 'in_progress'}>
                  {running ? <><div className="spinner" style={{ width: 14, height: 14 }} /> Running...</> : <><Play size={14} /> Execute</>}
                </button>
                {execution && ['in_progress', 'pending'].includes(execution.status) && (
                  <button className="btn btn-danger" onClick={handleCancel}><X size={14} /> Cancel</button>
                )}
                {execution?.status === 'failed' && (
                  <button className="btn btn-secondary" onClick={handleRetry}><RefreshCw size={14} /> Retry</button>
                )}
              </div>
            </div>
          </div>

          {/* Approval action */}
          {awaitingApproval && (
            <div className="card" style={{ marginTop: 16, border: '1px solid rgba(79,172,254,0.4)' }}>
              <div className="card-header" style={{ borderBottom: '1px solid rgba(79,172,254,0.2)' }}>
                <span style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--blue)' }}>⏳ Awaiting Approval</span>
              </div>
              <div className="card-body">
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 14 }}>
                  Step <strong>{awaitingApproval.step_name}</strong> requires approval.
                  {awaitingApproval.metadata?.instructions && <><br/><em style={{ marginTop: 6, display: 'block' }}>{awaitingApproval.metadata.instructions}</em></>}
                </p>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => handleApprove(awaitingApproval.step_id, true)}>
                    <CheckCircle size={14} /> Approve
                  </button>
                  <button className="btn btn-danger" style={{ flex: 1 }} onClick={() => handleApprove(awaitingApproval.step_id, false)}>
                    <XCircle size={14} /> Reject
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Execution Logs */}
        <div>
          <div className="card">
            <div className="card-header">
              <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>Execution Logs</span>
              {execution && (
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>ID: {execution.id?.slice(0,8)}…</span>
                  {running && <div className="spinner" style={{ width: 14, height: 14 }} />}
                </div>
              )}
            </div>
            <div className="card-body">
              {!execution ? (
                <div className="empty-state" style={{ padding: '40px 0' }}>
                  <Play size={36} className="empty-state-icon" />
                  <h3>Ready to execute</h3>
                  <p>Fill in the input data and click Execute</p>
                </div>
              ) : execution.logs?.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', padding: '20px 0' }}>
                  {running ? 'Starting execution...' : 'No logs yet.'}
                </div>
              ) : (
                <div>
                  {execution.logs.map((log, idx) => <LogEntry key={idx} log={log} />)}
                  {execution.status === 'completed' && (
                    <div style={{ textAlign: 'center', padding: '16px', color: 'var(--green)', fontWeight: 600, marginTop: 8 }}>
                      ✓ Workflow completed successfully
                    </div>
                  )}
                  {execution.status === 'failed' && (
                    <div style={{ textAlign: 'center', padding: '16px', color: 'var(--red)', fontWeight: 600, marginTop: 8 }}>
                      ✗ Workflow failed · {execution.retries} retries
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Execution metadata */}
          {execution && (
            <div className="card" style={{ marginTop: 16 }}>
              <div className="card-header"><span style={{ fontWeight: 600, fontSize: '0.88rem' }}>Execution Info</span></div>
              <div className="card-body">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 20px', fontSize: '0.8rem', fontFamily: 'var(--font-mono)' }}>
                  {[
                    ['Status', execution.status],
                    ['Version', `v${execution.workflow_version}`],
                    ['Triggered by', execution.triggered_by],
                    ['Retries', execution.retries],
                    ['Started', execution.started_at ? new Date(execution.started_at).toLocaleString() : '—'],
                    ['Ended', execution.ended_at ? new Date(execution.ended_at).toLocaleString() : '—'],
                  ].map(([label, value]) => (
                    <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '1px' }}>{label}</span>
                      <span style={{ color: 'var(--text-primary)' }}>{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

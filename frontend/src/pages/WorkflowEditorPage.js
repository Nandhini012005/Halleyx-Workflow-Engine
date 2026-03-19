import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Save, Trash2, ChevronDown, ChevronUp, Settings, Shield, Bell, Zap, GripVertical, Edit2, X, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { workflowApi, stepApi, ruleApi } from '../utils/api';
import RuleEditor from '../components/rules/RuleEditor';

const STEP_ICONS = { task: Zap, approval: Shield, notification: Bell };
const STEP_COLORS = { task: 'step-task', approval: 'step-approval', notification: 'step-notification' };

// ── Schema Editor ────────────────────────────────────────────────────────────
function SchemaEditor({ schema, onChange }) {
  const [fields, setFields] = useState(() => {
    if (!schema) return [];
    const entries = schema instanceof Map ? Object.fromEntries(schema) : schema;
    return Object.entries(entries).map(([key, val]) => ({ key, ...val }));
  });

  const updateParent = (updated) => {
    const obj = {};
    updated.forEach(f => { if (f.key) obj[f.key] = { type: f.type, required: f.required, allowed_values: f.allowed_values || [], description: f.description || '' }; });
    onChange(obj);
  };

  const addField = () => {
    const updated = [...fields, { key: '', type: 'string', required: false, allowed_values: [], description: '' }];
    setFields(updated);
  };

  const updateField = (idx, updates) => {
    const updated = fields.map((f, i) => i === idx ? { ...f, ...updates } : f);
    setFields(updated);
    updateParent(updated);
  };

  const removeField = (idx) => {
    const updated = fields.filter((_, i) => i !== idx);
    setFields(updated);
    updateParent(updated);
  };

  return (
    <div>
      {fields.map((field, idx) => (
        <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 120px 80px 1fr auto', gap: 8, marginBottom: 8, alignItems: 'center' }}>
          <input className="form-input form-mono" placeholder="field_name" value={field.key} onChange={e => updateField(idx, { key: e.target.value })} />
          <select className="form-select" value={field.type} onChange={e => updateField(idx, { type: e.target.value })}>
            <option value="string">string</option>
            <option value="number">number</option>
            <option value="boolean">boolean</option>
            <option value="enum">enum</option>
          </select>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
            <input type="checkbox" checked={field.required} onChange={e => updateField(idx, { required: e.target.checked })} />
            Req
          </label>
          <input className="form-input form-mono" placeholder={field.type === 'enum' ? 'val1,val2,val3' : 'description'} value={field.type === 'enum' ? (field.allowed_values || []).join(',') : (field.description || '')} onChange={e => { if (field.type === 'enum') updateField(idx, { allowed_values: e.target.value.split(',').map(v => v.trim()) }); else updateField(idx, { description: e.target.value }); }} />
          <button className="btn btn-ghost btn-icon" onClick={() => removeField(idx)}><X size={14} /></button>
        </div>
      ))}
      <button className="btn btn-secondary btn-sm" style={{ marginTop: 4 }} onClick={addField}><Plus size={13} /> Add Field</button>
    </div>
  );
}

// ── Step Form Modal ──────────────────────────────────────────────────────────
function StepModal({ step, workflowId, onSave, onClose }) {
  const [form, setForm] = useState(step || { name: '', step_type: 'task', order: 1, metadata: {} });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.name.trim()) return toast.error('Step name is required');
    setSaving(true);
    try {
      let saved;
      if (step?._id) {
        const res = await stepApi.update(step._id, form);
        saved = res.data;
        toast.success('Step updated');
      } else {
        const res = await stepApi.create(workflowId, form);
        saved = res.data;
        toast.success('Step created');
      }
      onSave(saved);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2>{step?._id ? 'Edit Step' : 'Add Step'}</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Step Name <span className="required">*</span></label>
            <input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Manager Approval" />
          </div>
          <div className="form-group">
            <label className="form-label">Type <span className="required">*</span></label>
            <select className="form-select" value={form.step_type} onChange={e => setForm(f => ({ ...f, step_type: e.target.value }))}>
              <option value="task">Task – Automated action</option>
              <option value="approval">Approval – Requires user action</option>
              <option value="notification">Notification – Sends alert/message</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Order</label>
            <input className="form-input" type="number" min={1} value={form.order} onChange={e => setForm(f => ({ ...f, order: parseInt(e.target.value) || 1 }))} />
          </div>
          {form.step_type === 'approval' && (
            <div className="form-group">
              <label className="form-label">Assignee Email</label>
              <input className="form-input" value={form.metadata?.assignee_email || ''} onChange={e => setForm(f => ({ ...f, metadata: { ...f.metadata, assignee_email: e.target.value } }))} placeholder="approver@company.com" />
            </div>
          )}
          {form.step_type === 'notification' && (
            <>
              <div className="form-group">
                <label className="form-label">Channel</label>
                <select className="form-select" value={form.metadata?.notification_channel || 'email'} onChange={e => setForm(f => ({ ...f, metadata: { ...f.metadata, notification_channel: e.target.value } }))}>
                  <option value="email">Email</option>
                  <option value="slack">Slack</option>
                  <option value="ui">UI</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Template</label>
                <textarea className="form-textarea form-mono" value={form.metadata?.template || ''} onChange={e => setForm(f => ({ ...f, metadata: { ...f.metadata, template: e.target.value } }))} placeholder="Message template with {{field}} placeholders" />
              </div>
            </>
          )}
          <div className="form-group">
            <label className="form-label">Instructions</label>
            <textarea className="form-textarea" value={form.metadata?.instructions || ''} onChange={e => setForm(f => ({ ...f, metadata: { ...f.metadata, instructions: e.target.value } }))} placeholder="Step instructions for assignees" />
          </div>
          {form.step_type !== 'approval' && (
            <>
              <div className="form-group">
                <label className="form-label">Max Loop Iterations</label>
                <input className="form-input" type="number" min={1} max={100} value={form.metadata?.max_iterations || 10} onChange={e => setForm(f => ({ ...f, metadata: { ...f.metadata, max_iterations: parseInt(e.target.value) || 10 } }))} />
                <div className="form-hint">Prevents infinite loops. Default: 10</div>
              </div>
            </>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? <div className="spinner" /> : <Check size={14} />} Save Step
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Step Card ────────────────────────────────────────────────────────────────
function StepCard({ step, allSteps, workflowId, onEdit, onDelete, isLast }) {
  const [expanded, setExpanded] = useState(false);
  const [rules, setRules] = useState([]);
  const [loadingRules, setLoadingRules] = useState(false);
  const [showRuleEditor, setShowRuleEditor] = useState(false);
  const Icon = STEP_ICONS[step.step_type] || Zap;

  const loadRules = useCallback(async () => {
    setLoadingRules(true);
    try {
      const res = await ruleApi.list(step._id);
      setRules(res.data);
    } catch {}
    setLoadingRules(false);
  }, [step._id]);

  useEffect(() => { if (expanded) loadRules(); }, [expanded, loadRules]);

  return (
    <div className="step-node">
      {!isLast && <div className="step-connector" />}
      <div className={`step-dot step-dot-${step.step_type}`}>
        <Icon size={16} />
      </div>
      <div className="step-card-inner" style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{step.name}</span>
              <span className={`step-type-tag ${STEP_COLORS[step.step_type]}`}>{step.step_type}</span>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>order:{step.order}</span>
            </div>
            {step.metadata?.assignee_email && <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', marginTop: 2 }}>👤 {step.metadata.assignee_email}</div>}
            {step.metadata?.notification_channel && <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', marginTop: 2 }}>📢 {step.metadata.notification_channel}</div>}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn btn-secondary btn-sm" onClick={() => onEdit(step)}><Edit2 size={12} /></button>
            <button className="btn btn-danger btn-sm" onClick={() => onDelete(step._id, step.name)}><Trash2 size={12} /></button>
            <button className="btn btn-ghost btn-sm" onClick={() => setExpanded(!expanded)}>
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          </div>
        </div>

        {expanded && (
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '1px' }}>Rules ({rules.length})</span>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowRuleEditor(true)}><Plus size={12} /> Add Rule</button>
            </div>
            {loadingRules ? <div className="spinner" /> : (
              rules.length === 0 ? (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', padding: '8px 0' }}>No rules defined. Add rules to control flow.</div>
              ) : (
                <div>
                  {rules.sort((a, b) => a.priority - b.priority).map(rule => (
                    <div key={rule._id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)', marginBottom: 6, border: '1px solid var(--border)' }}>
                      <span style={{ fontSize: '0.7rem', fontFamily: 'var(--font-mono)', color: 'var(--accent)', background: 'var(--accent-dim)', padding: '2px 6px', borderRadius: 4 }}>P{rule.priority}</span>
                      <code style={{ flex: 1, fontSize: '0.78rem', background: 'transparent', border: 'none', color: rule.condition === 'DEFAULT' ? 'var(--yellow)' : 'var(--text-primary)' }}>{rule.condition}</code>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>→</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--green)', fontFamily: 'var(--font-mono)' }}>
                        {rule.next_step_id ? allSteps.find(s => s._id === rule.next_step_id)?.name || rule.next_step_id?.slice(0,8) : 'END'}
                      </span>
                      <button className="btn btn-danger btn-sm" onClick={async () => { await ruleApi.delete(rule._id); loadRules(); toast.success('Rule deleted'); }}><Trash2 size={11} /></button>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        )}
      </div>

      {showRuleEditor && (
        <RuleEditor
          stepId={step._id}
          allSteps={allSteps}
          onSave={() => { setShowRuleEditor(false); loadRules(); }}
          onClose={() => setShowRuleEditor(false)}
        />
      )}
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function WorkflowEditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = !id;

  const [workflow, setWorkflow] = useState({ name: '', description: '', is_active: true, input_schema: {} });
  const [steps, setSteps] = useState([]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('steps');
  const [showStepModal, setShowStepModal] = useState(false);
  const [editingStep, setEditingStep] = useState(null);

  useEffect(() => {
    if (!isNew) {
      setLoading(true);
      workflowApi.get(id).then(res => {
        const { steps: wfSteps, ...wfData } = res.data;
        setWorkflow(wfData);
        setSteps(wfSteps || []);
      }).catch(err => {
        toast.error(err.message);
        navigate('/workflows');
      }).finally(() => setLoading(false));
    }
  }, [id, isNew, navigate]);

  const handleSaveWorkflow = async () => {
    if (!workflow.name.trim()) return toast.error('Workflow name is required');
    setSaving(true);
    try {
      let saved;
      if (isNew) {
        const res = await workflowApi.create(workflow);
        saved = res.data;
        toast.success('Workflow created!');
        navigate(`/workflows/${saved.id}/edit`);
      } else {
        const res = await workflowApi.update(id, workflow);
        saved = res.data;
        setWorkflow(saved);
        toast.success('Workflow saved (v' + saved.version + ')');
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteStep = async (stepId, stepName) => {
    if (!window.confirm(`Delete step "${stepName}"?`)) return;
    try {
      await stepApi.delete(stepId);
      setSteps(s => s.filter(st => st._id !== stepId));
      toast.success('Step deleted');
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleStepSaved = (saved) => {
    setSteps(prev => {
      const idx = prev.findIndex(s => s._id === saved._id);
      if (idx >= 0) return prev.map(s => s._id === saved._id ? saved : s);
      return [...prev, saved].sort((a, b) => a.order - b.order);
    });
    setShowStepModal(false);
    setEditingStep(null);
  };

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}><div className="spinner" /></div>;

  return (
    <>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn btn-ghost btn-icon" onClick={() => navigate('/workflows')}><ArrowLeft size={18} /></button>
          <div>
            <h1>{isNew ? 'New Workflow' : `Edit: ${workflow.name}`}</h1>
            {!isNew && <div className="subtitle">v{workflow.version} · {steps.length} steps</div>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {!isNew && (
            <button className="btn btn-secondary" onClick={() => navigate(`/workflows/${id}/execute`)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg> Run Workflow
            </button>
          )}
          <button className="btn btn-primary" onClick={handleSaveWorkflow} disabled={saving}>
            {saving ? <div className="spinner" /> : <Save size={14} />} Save
          </button>
        </div>
      </div>

      <div className="page-body" style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 24 }}>
        {/* Left: Workflow Settings */}
        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-header">
              <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>Workflow Settings</span>
              <Settings size={15} style={{ color: 'var(--text-muted)' }} />
            </div>
            <div className="card-body">
              <div className="form-group">
                <label className="form-label">Name <span className="required">*</span></label>
                <input className="form-input" value={workflow.name} onChange={e => setWorkflow(w => ({ ...w, name: e.target.value }))} placeholder="e.g. Expense Approval" />
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea className="form-textarea" value={workflow.description || ''} onChange={e => setWorkflow(w => ({ ...w, description: e.target.value }))} placeholder="Brief description..." rows={3} />
              </div>
              <div className="form-group" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <label className="form-label" style={{ margin: 0 }}>Active</label>
                <label className="toggle">
                  <input type="checkbox" checked={workflow.is_active} onChange={e => setWorkflow(w => ({ ...w, is_active: e.target.checked }))} />
                  <span className="toggle-track" />
                </label>
              </div>
              {!isNew && (
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', padding: '8px 0', borderTop: '1px solid var(--border)', marginTop: 8 }}>
                  <div>Version: v{workflow.version}</div>
                  <div style={{ marginTop: 4, wordBreak: 'break-all' }}>ID: {workflow.id}</div>
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>Input Schema</span>
            </div>
            <div className="card-body">
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 12 }}>Define the fields required to run this workflow.</div>
              <SchemaEditor schema={workflow.input_schema} onChange={schema => setWorkflow(w => ({ ...w, input_schema: schema }))} />
            </div>
          </div>
        </div>

        {/* Right: Steps */}
        <div>
          <div className="card">
            <div className="card-header">
              <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>Steps ({steps.length})</span>
              <button className="btn btn-primary btn-sm" onClick={() => { setEditingStep(null); setShowStepModal(true); }} disabled={isNew}>
                <Plus size={13} /> Add Step
              </button>
            </div>
            <div className="card-body">
              {isNew ? (
                <div className="empty-state" style={{ padding: '32px 0' }}>
                  <p>Save the workflow first, then add steps.</p>
                </div>
              ) : steps.length === 0 ? (
                <div className="empty-state" style={{ padding: '32px 0' }}>
                  <Zap size={32} className="empty-state-icon" />
                  <h3>No steps yet</h3>
                  <p>Add your first step to build the workflow</p>
                  <button className="btn btn-primary btn-sm" onClick={() => setShowStepModal(true)}><Plus size={13} /> Add Step</button>
                </div>
              ) : (
                <div className="step-flow">
                  {steps.sort((a, b) => a.order - b.order).map((step, idx) => (
                    <StepCard
                      key={step._id}
                      step={step}
                      allSteps={steps}
                      workflowId={id}
                      onEdit={s => { setEditingStep(s); setShowStepModal(true); }}
                      onDelete={handleDeleteStep}
                      isLast={idx === steps.length - 1}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {showStepModal && (
        <StepModal
          step={editingStep}
          workflowId={id}
          onSave={handleStepSaved}
          onClose={() => { setShowStepModal(false); setEditingStep(null); }}
        />
      )}
    </>
  );
}

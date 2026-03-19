import React, { useState } from 'react';
import { X, Check, AlertCircle, Info } from 'lucide-react';
import toast from 'react-hot-toast';
import { ruleApi } from '../../utils/api';

export default function RuleEditor({ stepId, allSteps, rule, onSave, onClose }) {
  const [form, setForm] = useState(rule || { condition: '', next_step_id: '', priority: 10 });
  const [saving, setSaving] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState(null);

  const handleValidate = async () => {
    if (!form.condition.trim()) return;
    setValidating(true);
    try {
      const res = await ruleApi.validate(form.condition);
      setValidationResult(res.data);
    } catch {
      setValidationResult({ valid: false, error: 'Validation failed' });
    } finally {
      setValidating(false);
    }
  };

  const handleSave = async () => {
    if (!form.condition.trim()) return toast.error('Condition is required');
    if (form.priority === undefined || form.priority === '') return toast.error('Priority is required');

    setSaving(true);
    try {
      let saved;
      if (rule?._id) {
        const res = await ruleApi.update(rule._id, form);
        saved = res.data;
        toast.success('Rule updated');
      } else {
        const res = await ruleApi.create(stepId, {
          ...form,
          next_step_id: form.next_step_id || null
        });
        saved = res.data;
        toast.success('Rule created');
      }
      onSave(saved);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const conditionExamples = [
    "amount > 100 && country == 'US'",
    "priority == 'High'",
    "amount <= 100 || priority == 'Low'",
    "contains(department, 'Eng')",
    "DEFAULT"
  ];

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg">
        <div className="modal-header">
          <h2>{rule?._id ? 'Edit Rule' : 'Add Rule'}</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Priority <span className="required">*</span></label>
            <input
              className="form-input"
              type="number"
              min={1}
              value={form.priority}
              onChange={e => setForm(f => ({ ...f, priority: parseInt(e.target.value) || 1 }))}
              style={{ width: 120 }}
            />
            <div className="form-hint">Lower number = evaluated first. Use DEFAULT as fallback (any priority).</div>
          </div>

          <div className="form-group">
            <label className="form-label">Condition <span className="required">*</span></label>
            <div style={{ position: 'relative' }}>
              <input
                className="form-input form-mono"
                value={form.condition}
                onChange={e => { setForm(f => ({ ...f, condition: e.target.value })); setValidationResult(null); }}
                placeholder="e.g. amount > 100 && country == 'US'"
                onBlur={handleValidate}
              />
            </div>
            {validationResult && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, fontSize: '0.78rem' }}>
                {validationResult.valid
                  ? <><Check size={13} style={{ color: 'var(--green)' }} /><span style={{ color: 'var(--green)' }}>Valid condition</span></>
                  : <><AlertCircle size={13} style={{ color: 'var(--red)' }} /><span style={{ color: 'var(--red)' }}>{validationResult.error}</span></>
                }
              </div>
            )}
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 6, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '1px' }}>Quick Insert:</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {conditionExamples.map(ex => (
                  <button
                    key={ex}
                    className="btn btn-ghost btn-sm"
                    style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', padding: '3px 8px', border: '1px solid var(--border)' }}
                    onClick={() => { setForm(f => ({ ...f, condition: ex })); setValidationResult(null); }}
                  >{ex}</button>
                ))}
              </div>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Next Step</label>
            <select
              className="form-select"
              value={form.next_step_id || ''}
              onChange={e => setForm(f => ({ ...f, next_step_id: e.target.value || null }))}
            >
              <option value="">— End Workflow —</option>
              {allSteps.map(step => (
                <option key={step._id} value={step._id}>{step.name} ({step.step_type})</option>
              ))}
            </select>
            <div className="form-hint">Leave empty to end the workflow after this step.</div>
          </div>

          <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '12px 14px', fontSize: '0.78rem' }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8, color: 'var(--text-secondary)' }}>
              <Info size={13} style={{ flexShrink: 0, marginTop: 1 }} />
              <strong>Supported operators:</strong>
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.74rem', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
              <div><span style={{ color: 'var(--accent-hover)' }}>Comparison:</span> == != &lt; &gt; &lt;= &gt;=</div>
              <div><span style={{ color: 'var(--accent-hover)' }}>Logical:</span> &amp;&amp; (AND) || (OR)</div>
              <div><span style={{ color: 'var(--accent-hover)' }}>String:</span> contains(field, "val") · startsWith(field, "prefix") · endsWith(field, "suffix")</div>
              <div><span style={{ color: 'var(--yellow)' }}>Special:</span> DEFAULT — matches when no other rule matches</div>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? <div className="spinner" /> : <Check size={14} />} Save Rule
          </button>
        </div>
      </div>
    </div>
  );
}

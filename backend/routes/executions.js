const express = require('express');
const router = express.Router();
const Execution = require('../models/Execution');
const Workflow = require('../models/Workflow');
const { startExecution, approveStep, retryStep } = require('../engine/workflowEngine');

// POST /api/workflows/:workflow_id/execute - Start execution
router.post('/workflows/:workflow_id/execute', async (req, res, next) => {
  try {
    const workflow = await Workflow.findById(req.params.workflow_id);
    if (!workflow) return res.status(404).json({ error: 'Workflow not found' });
    if (!workflow.is_active) return res.status(400).json({ error: 'Workflow is not active' });

    const { data = {}, triggered_by = 'anonymous' } = req.body;

    // Validate required input fields
    if (workflow.input_schema && workflow.input_schema.size > 0) {
      const schema = Object.fromEntries(workflow.input_schema);
      const errors = [];
      for (const [field, def] of Object.entries(schema)) {
        if (def.required && (data[field] === undefined || data[field] === null)) {
          errors.push(`Field '${field}' is required`);
        }
        if (data[field] !== undefined && def.allowed_values && def.allowed_values.length > 0) {
          if (!def.allowed_values.includes(data[field])) {
            errors.push(`Field '${field}' must be one of: ${def.allowed_values.join(', ')}`);
          }
        }
      }
      if (errors.length > 0) return res.status(400).json({ error: 'Validation failed', details: errors });
    }

    const execution = new Execution({
      workflow_id: workflow._id,
      workflow_version: workflow.version,
      data,
      triggered_by,
      status: 'pending'
    });
    await execution.save();

    // Run async (non-blocking for approval steps)
    startExecution(execution, workflow).catch(err => {
      console.error('Execution error:', err);
    });

    res.status(201).json(execution);
  } catch (err) { next(err); }
});

// GET /api/executions - List all executions (audit log)
router.get('/executions', async (req, res, next) => {
  try {
    const { page = 1, limit = 20, workflow_id, status } = req.query;
    const query = {};
    if (workflow_id) query.workflow_id = workflow_id;
    if (status) query.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await Execution.countDocuments(query);
    const executions = await Execution.find(query)
      .sort({ started_at: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Enrich with workflow names
    const enriched = await Promise.all(executions.map(async (ex) => {
      const wf = await Workflow.findById(ex.workflow_id).select('name').lean();
      return { ...ex.toJSON(), workflow_name: wf?.name || 'Unknown' };
    }));

    res.json({
      data: enriched,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) }
    });
  } catch (err) { next(err); }
});

// GET /api/executions/:id - Get execution status & logs
router.get('/executions/:id', async (req, res, next) => {
  try {
    const execution = await Execution.findById(req.params.id);
    if (!execution) return res.status(404).json({ error: 'Execution not found' });

    const workflow = await Workflow.findById(execution.workflow_id).select('name').lean();
    res.json({ ...execution.toJSON(), workflow_name: workflow?.name });
  } catch (err) { next(err); }
});

// POST /api/executions/:id/cancel
router.post('/executions/:id/cancel', async (req, res, next) => {
  try {
    const execution = await Execution.findById(req.params.id);
    if (!execution) return res.status(404).json({ error: 'Execution not found' });
    if (['completed', 'failed', 'canceled'].includes(execution.status)) {
      return res.status(400).json({ error: `Cannot cancel execution in '${execution.status}' status` });
    }

    execution.status = 'canceled';
    execution.ended_at = new Date();
    await execution.save();
    res.json(execution);
  } catch (err) { next(err); }
});

// POST /api/executions/:id/retry - Retry failed step
router.post('/executions/:id/retry', async (req, res, next) => {
  try {
    const execution = await Execution.findById(req.params.id);
    if (!execution) return res.status(404).json({ error: 'Execution not found' });
    if (execution.status !== 'failed') {
      return res.status(400).json({ error: 'Only failed executions can be retried' });
    }

    const result = await retryStep(execution);
    const updated = await Execution.findById(req.params.id);
    res.json({ ...updated.toJSON(), retry_result: result });
  } catch (err) { next(err); }
});

// POST /api/executions/:id/approve - Approve/reject an approval step
router.post('/executions/:id/approve', async (req, res, next) => {
  try {
    const execution = await Execution.findById(req.params.id);
    if (!execution) return res.status(404).json({ error: 'Execution not found' });

    const { step_id, approved = true } = req.body;
    if (!step_id) return res.status(400).json({ error: 'step_id is required' });

    const result = await approveStep(execution, step_id, approved);
    const updated = await Execution.findById(req.params.id);
    res.json({ ...updated.toJSON(), approval_result: result });
  } catch (err) { next(err); }
});

module.exports = router;

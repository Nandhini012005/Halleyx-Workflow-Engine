const express = require('express');
const router = express.Router();
const Step = require('../models/Step');
const Rule = require('../models/Rule');
const Workflow = require('../models/Workflow');

// POST /api/workflows/:workflow_id/steps
router.post('/workflows/:workflow_id/steps', async (req, res, next) => {
  try {
    const workflow = await Workflow.findById(req.params.workflow_id);
    if (!workflow) return res.status(404).json({ error: 'Workflow not found' });

    const { name, step_type, order, metadata } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });
    if (!step_type) return res.status(400).json({ error: 'step_type is required' });

    // Auto-assign order if not provided
    let stepOrder = order;
    if (stepOrder === undefined) {
      const lastStep = await Step.findOne({ workflow_id: req.params.workflow_id }).sort({ order: -1 });
      stepOrder = lastStep ? lastStep.order + 1 : 1;
    }

    const step = new Step({
      workflow_id: req.params.workflow_id,
      name,
      step_type,
      order: stepOrder,
      metadata: metadata || {}
    });
    await step.save();

    // Set as start_step if first step
    if (!workflow.start_step_id) {
      workflow.start_step_id = step._id;
      await workflow.save();
    }

    res.status(201).json(step);
  } catch (err) { next(err); }
});

// GET /api/workflows/:workflow_id/steps
router.get('/workflows/:workflow_id/steps', async (req, res, next) => {
  try {
    const steps = await Step.find({ workflow_id: req.params.workflow_id }).sort({ order: 1 });
    res.json(steps);
  } catch (err) { next(err); }
});

// PUT /api/steps/:id
router.put('/steps/:id', async (req, res, next) => {
  try {
    const step = await Step.findById(req.params.id);
    if (!step) return res.status(404).json({ error: 'Step not found' });

    const { name, step_type, order, metadata } = req.body;
    if (name !== undefined) step.name = name;
    if (step_type !== undefined) step.step_type = step_type;
    if (order !== undefined) step.order = order;
    if (metadata !== undefined) step.metadata = { ...step.metadata, ...metadata };
    step.updated_at = new Date();

    await step.save();
    res.json(step);
  } catch (err) { next(err); }
});

// DELETE /api/steps/:id
router.delete('/steps/:id', async (req, res, next) => {
  try {
    const step = await Step.findByIdAndDelete(req.params.id);
    if (!step) return res.status(404).json({ error: 'Step not found' });

    // Cascade delete rules
    await Rule.deleteMany({ step_id: req.params.id });

    // Update workflow start_step if needed
    const workflow = await Workflow.findById(step.workflow_id);
    if (workflow && workflow.start_step_id === req.params.id) {
      const firstStep = await Step.findOne({ workflow_id: step.workflow_id }).sort({ order: 1 });
      workflow.start_step_id = firstStep ? firstStep._id : null;
      await workflow.save();
    }

    res.json({ message: 'Step deleted successfully' });
  } catch (err) { next(err); }
});

module.exports = router;

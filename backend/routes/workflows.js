const express = require('express');
const router = express.Router();
const Workflow = require('../models/Workflow');
const Step = require('../models/Step');
const Rule = require('../models/Rule');

// POST /api/workflows - Create workflow
router.post('/', async (req, res, next) => {
  try {
    const { name, description, input_schema, start_step_id } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });

    const workflow = new Workflow({ name, description, input_schema, start_step_id });
    await workflow.save();
    res.status(201).json(workflow);
  } catch (err) { next(err); }
});

// GET /api/workflows - List workflows with pagination & search
router.get('/', async (req, res, next) => {
  try {
    const { page = 1, limit = 10, search = '', status } = req.query;
    const query = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    if (status === 'active') query.is_active = true;
    if (status === 'inactive') query.is_active = false;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await Workflow.countDocuments(query);
    const workflows = await Workflow.find(query)
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Add step count to each workflow
    const workflowsWithCounts = await Promise.all(
      workflows.map(async (wf) => {
        const stepCount = await Step.countDocuments({ workflow_id: wf._id });
        return { ...wf.toJSON(), step_count: stepCount };
      })
    );

    res.json({
      data: workflowsWithCounts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (err) { next(err); }
});

// GET /api/workflows/:id - Get workflow with steps and rules
router.get('/:id', async (req, res, next) => {
  try {
    const workflow = await Workflow.findById(req.params.id);
    if (!workflow) return res.status(404).json({ error: 'Workflow not found' });

    const steps = await Step.find({ workflow_id: req.params.id }).sort({ order: 1 });
    const stepsWithRules = await Promise.all(
      steps.map(async (step) => {
        const rules = await Rule.find({ step_id: step._id }).sort({ priority: 1 });
        return { ...step.toJSON(), rules };
      })
    );

    res.json({ ...workflow.toJSON(), steps: stepsWithRules });
  } catch (err) { next(err); }
});

// PUT /api/workflows/:id - Update workflow (creates new version)
router.put('/:id', async (req, res, next) => {
  try {
    const workflow = await Workflow.findById(req.params.id);
    if (!workflow) return res.status(404).json({ error: 'Workflow not found' });

    const { name, description, input_schema, start_step_id, is_active } = req.body;

    if (name !== undefined) workflow.name = name;
    if (description !== undefined) workflow.description = description;
    if (input_schema !== undefined) workflow.input_schema = input_schema;
    if (start_step_id !== undefined) workflow.start_step_id = start_step_id;
    if (is_active !== undefined) workflow.is_active = is_active;

    // Increment version on substantive updates
    workflow.version += 1;
    workflow.updated_at = new Date();

    await workflow.save();
    res.json(workflow);
  } catch (err) { next(err); }
});

// DELETE /api/workflows/:id - Delete workflow
router.delete('/:id', async (req, res, next) => {
  try {
    const workflow = await Workflow.findByIdAndDelete(req.params.id);
    if (!workflow) return res.status(404).json({ error: 'Workflow not found' });

    // Cascade delete steps and rules
    const steps = await Step.find({ workflow_id: req.params.id });
    for (const step of steps) {
      await Rule.deleteMany({ step_id: step._id });
    }
    await Step.deleteMany({ workflow_id: req.params.id });

    res.json({ message: 'Workflow deleted successfully' });
  } catch (err) { next(err); }
});

module.exports = router;

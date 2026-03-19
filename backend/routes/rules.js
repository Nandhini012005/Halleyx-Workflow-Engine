const express = require('express');
const router = express.Router();
const Rule = require('../models/Rule');
const Step = require('../models/Step');
const { validateCondition } = require('../engine/ruleEngine');

// POST /api/steps/:step_id/rules
router.post('/steps/:step_id/rules', async (req, res, next) => {
  try {
    const step = await Step.findById(req.params.step_id);
    if (!step) return res.status(404).json({ error: 'Step not found' });

    const { condition, next_step_id, priority } = req.body;
    if (!condition) return res.status(400).json({ error: 'condition is required' });
    if (priority === undefined) return res.status(400).json({ error: 'priority is required' });

    // Validate condition syntax
    const validation = validateCondition(condition);
    if (!validation.valid) {
      return res.status(400).json({ error: `Invalid condition: ${validation.error}` });
    }

    const rule = new Rule({
      step_id: req.params.step_id,
      condition,
      next_step_id: next_step_id || null,
      priority: parseInt(priority)
    });
    await rule.save();
    res.status(201).json(rule);
  } catch (err) { next(err); }
});

// GET /api/steps/:step_id/rules
router.get('/steps/:step_id/rules', async (req, res, next) => {
  try {
    const rules = await Rule.find({ step_id: req.params.step_id }).sort({ priority: 1 });
    res.json(rules);
  } catch (err) { next(err); }
});

// PUT /api/rules/:id
router.put('/rules/:id', async (req, res, next) => {
  try {
    const rule = await Rule.findById(req.params.id);
    if (!rule) return res.status(404).json({ error: 'Rule not found' });

    const { condition, next_step_id, priority } = req.body;

    if (condition !== undefined) {
      const validation = validateCondition(condition);
      if (!validation.valid) {
        return res.status(400).json({ error: `Invalid condition: ${validation.error}` });
      }
      rule.condition = condition;
    }
    if (next_step_id !== undefined) rule.next_step_id = next_step_id;
    if (priority !== undefined) rule.priority = parseInt(priority);
    rule.updated_at = new Date();

    await rule.save();
    res.json(rule);
  } catch (err) { next(err); }
});

// DELETE /api/rules/:id
router.delete('/rules/:id', async (req, res, next) => {
  try {
    const rule = await Rule.findByIdAndDelete(req.params.id);
    if (!rule) return res.status(404).json({ error: 'Rule not found' });
    res.json({ message: 'Rule deleted successfully' });
  } catch (err) { next(err); }
});

// POST /api/rules/validate - Validate condition syntax
router.post('/rules/validate', (req, res) => {
  const { condition } = req.body;
  if (!condition) return res.status(400).json({ error: 'condition is required' });
  const result = validateCondition(condition);
  res.json(result);
});

module.exports = router;

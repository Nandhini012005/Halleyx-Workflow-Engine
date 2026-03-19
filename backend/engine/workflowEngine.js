/**
 * Workflow Execution Engine
 * Handles step-by-step execution, approvals, notifications, branching, looping
 */

const Execution = require('../models/Execution');
const Step = require('../models/Step');
const Rule = require('../models/Rule');
const { evaluateRules } = require('./ruleEngine');

const MAX_LOOP_ITERATIONS = 10; // configurable default

/**
 * Execute a single step
 */
async function executeStep(execution, step, allSteps, loopCounters = {}) {
  const stepStart = Date.now();
  const logEntry = {
    step_id: step._id,
    step_name: step.name,
    step_type: step.step_type,
    status: 'in_progress',
    started_at: new Date(),
    ended_at: null,
    duration_ms: null,
    rule_evaluated: null,
    next_step_id: null,
    error: null,
    metadata: step.metadata,
    iteration: loopCounters[step._id] || 0
  };

  try {
    // Handle step types
    if (step.step_type === 'approval') {
      // Approval steps pause execution - mark as awaiting
      logEntry.status = 'awaiting_approval';
      logEntry.ended_at = new Date();
      logEntry.duration_ms = Date.now() - stepStart;
      execution.logs.push(logEntry);
      execution.current_step_id = step._id;
      execution.status = 'in_progress';
      await execution.save();
      return { paused: true, awaiting_approval: true, step_id: step._id };
    }

    if (step.step_type === 'notification') {
      // Simulate notification sending
      const channel = step.metadata?.notification_channel || 'ui';
      console.log(`[NOTIFICATION] Channel: ${channel}, Step: ${step.name}`);
      // In production: send actual email/Slack via nodemailer/webhook
    }

    // Task or Notification - evaluate rules to find next step
    const rules = await Rule.find({ step_id: step._id }).lean();
    const { rule, log: ruleLog } = evaluateRules(rules, execution.data);

    logEntry.rule_evaluated = JSON.stringify(ruleLog);

    if (!rule && rules.length > 0) {
      // No matching rule and no DEFAULT
      logEntry.status = 'failed';
      logEntry.error = 'No matching rule found and no DEFAULT rule defined';
      logEntry.ended_at = new Date();
      logEntry.duration_ms = Date.now() - stepStart;
      execution.logs.push(logEntry);
      execution.status = 'failed';
      execution.ended_at = new Date();
      await execution.save();
      return { failed: true, error: logEntry.error };
    }

    const nextStepId = rule ? rule.next_step_id : null;

    // Handle looping
    if (nextStepId && step.metadata?.loop_target_step_id === nextStepId) {
      const iterations = (loopCounters[step._id] || 0) + 1;
      const maxIter = step.metadata?.max_iterations || MAX_LOOP_ITERATIONS;
      if (iterations >= maxIter) {
        logEntry.status = 'failed';
        logEntry.error = `Max loop iterations (${maxIter}) reached for step: ${step.name}`;
        logEntry.ended_at = new Date();
        logEntry.duration_ms = Date.now() - stepStart;
        execution.logs.push(logEntry);
        execution.status = 'failed';
        execution.ended_at = new Date();
        await execution.save();
        return { failed: true, error: logEntry.error };
      }
      loopCounters[step._id] = iterations;
    }

    logEntry.next_step_id = nextStepId;
    logEntry.status = 'completed';
    logEntry.ended_at = new Date();
    logEntry.duration_ms = Date.now() - stepStart;
    execution.logs.push(logEntry);

    if (!nextStepId) {
      // Workflow complete
      execution.status = 'completed';
      execution.current_step_id = null;
      execution.ended_at = new Date();
      await execution.save();
      return { completed: true };
    }

    // Continue to next step
    execution.current_step_id = nextStepId;
    await execution.save();

    const nextStep = allSteps.find(s => s._id === nextStepId);
    if (!nextStep) {
      execution.status = 'failed';
      execution.ended_at = new Date();
      await execution.save();
      return { failed: true, error: `Next step ${nextStepId} not found` };
    }

    return executeStep(execution, nextStep, allSteps, loopCounters);

  } catch (err) {
    logEntry.status = 'failed';
    logEntry.error = err.message;
    logEntry.ended_at = new Date();
    logEntry.duration_ms = Date.now() - stepStart;
    execution.logs.push(logEntry);
    execution.status = 'failed';
    execution.ended_at = new Date();
    await execution.save();
    return { failed: true, error: err.message };
  }
}

/**
 * Start workflow execution
 */
async function startExecution(execution, workflow) {
  execution.status = 'in_progress';
  await execution.save();

  const allSteps = await Step.find({ workflow_id: workflow._id }).sort({ order: 1 }).lean();

  if (!allSteps.length) {
    execution.status = 'failed';
    execution.ended_at = new Date();
    await execution.save();
    return { failed: true, error: 'Workflow has no steps' };
  }

  const startStep = workflow.start_step_id
    ? allSteps.find(s => s._id === workflow.start_step_id)
    : allSteps[0];

  if (!startStep) {
    execution.status = 'failed';
    execution.ended_at = new Date();
    await execution.save();
    return { failed: true, error: 'Start step not found' };
  }

  execution.current_step_id = startStep._id;
  await execution.save();

  return executeStep(execution, startStep, allSteps, {});
}

/**
 * Approve a step and continue execution
 */
async function approveStep(execution, stepId, approved = true) {
  const allSteps = await Step.find({ workflow_id: execution.workflow_id }).sort({ order: 1 }).lean();
  const step = allSteps.find(s => s._id === stepId);

  if (!step) return { failed: true, error: 'Step not found' };

  // Update last log entry for this step
  const logIdx = execution.logs.findLastIndex ? 
    execution.logs.findLastIndex(l => l.step_id === stepId) :
    execution.logs.map(l => l.step_id).lastIndexOf(stepId);

  if (logIdx >= 0) {
    execution.logs[logIdx].status = approved ? 'completed' : 'failed';
    execution.logs[logIdx].ended_at = new Date();
    execution.logs[logIdx].metadata = { ...execution.logs[logIdx].metadata, approved };
  }

  if (!approved) {
    execution.status = 'failed';
    execution.ended_at = new Date();
    await execution.save();
    return { failed: true, reason: 'Approval rejected' };
  }

  // Evaluate rules and continue
  const rules = await Rule.find({ step_id: stepId }).lean();
  const { rule } = evaluateRules(rules, execution.data);
  const nextStepId = rule ? rule.next_step_id : null;

  execution.logs[logIdx].next_step_id = nextStepId;
  execution.markModified('logs');

  if (!nextStepId) {
    execution.status = 'completed';
    execution.ended_at = new Date();
    await execution.save();
    return { completed: true };
  }

  execution.current_step_id = nextStepId;
  await execution.save();

  const nextStep = allSteps.find(s => s._id === nextStepId);
  if (!nextStep) {
    execution.status = 'failed';
    await execution.save();
    return { failed: true, error: 'Next step not found' };
  }

  return executeStep(execution, nextStep, allSteps, {});
}

/**
 * Retry the failed step
 */
async function retryStep(execution) {
  const allSteps = await Step.find({ workflow_id: execution.workflow_id }).sort({ order: 1 }).lean();
  const failedStepId = execution.current_step_id;
  const step = allSteps.find(s => s._id === failedStepId);

  if (!step) return { failed: true, error: 'Failed step not found' };

  execution.status = 'in_progress';
  execution.retries += 1;
  await execution.save();

  return executeStep(execution, step, allSteps, {});
}

module.exports = { startExecution, approveStep, retryStep };

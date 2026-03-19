/**
 * Seed Script - Creates 2 sample workflows with steps and rules
 * Run: node utils/seed.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Workflow = require('../models/Workflow');
const Step = require('../models/Step');
const Rule = require('../models/Rule');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/halleyx_workflow';

async function seed() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB');

  // Clean existing data
  await Workflow.deleteMany({});
  await Step.deleteMany({});
  await Rule.deleteMany({});
  console.log('Cleared existing data');

  // ── WORKFLOW 1: Expense Approval ──────────────────────────────────────
  const expenseWF = new Workflow({
    name: 'Expense Approval',
    description: 'Multi-level expense approval workflow based on amount and priority',
    version: 3,
    is_active: true,
    input_schema: new Map([
      ['amount', { type: 'number', required: true, description: 'Expense amount in USD' }],
      ['country', { type: 'string', required: true, description: 'Country code' }],
      ['priority', { type: 'enum', required: true, allowed_values: ['Low', 'Medium', 'High'], description: 'Request priority' }],
      ['description', { type: 'string', required: false, description: 'Expense description' }]
    ])
  });
  await expenseWF.save();

  const step1 = new Step({ workflow_id: expenseWF._id, name: 'Manager Approval', step_type: 'approval', order: 1, metadata: { assignee_email: 'manager@company.com', instructions: 'Review and approve the expense request' } });
  const step2 = new Step({ workflow_id: expenseWF._id, name: 'Finance Notification', step_type: 'notification', order: 2, metadata: { notification_channel: 'email', template: 'High-priority expense approved. Amount: {{amount}}' } });
  const step3 = new Step({ workflow_id: expenseWF._id, name: 'CEO Approval', step_type: 'approval', order: 3, metadata: { assignee_email: 'ceo@company.com', instructions: 'Final approval required for high-value expense' } });
  const step4 = new Step({ workflow_id: expenseWF._id, name: 'Task Completion', step_type: 'task', order: 4, metadata: { instructions: 'Mark expense as approved and process payment' } });
  const step5 = new Step({ workflow_id: expenseWF._id, name: 'Task Rejection', step_type: 'task', order: 5, metadata: { instructions: 'Notify requestor of rejection' } });

  await step1.save(); await step2.save(); await step3.save(); await step4.save(); await step5.save();

  expenseWF.start_step_id = step1._id;
  await expenseWF.save();

  // Rules for Manager Approval
  await new Rule({ step_id: step1._id, condition: "amount > 100 && country == 'US' && priority == 'High'", next_step_id: step2._id, priority: 1 }).save();
  await new Rule({ step_id: step1._id, condition: "amount <= 100 || priority == 'Low'", next_step_id: step4._id, priority: 2 }).save();
  await new Rule({ step_id: step1._id, condition: "priority == 'Low' && country != 'US'", next_step_id: step5._id, priority: 3 }).save();
  await new Rule({ step_id: step1._id, condition: 'DEFAULT', next_step_id: step5._id, priority: 4 }).save();

  // Rules for Finance Notification
  await new Rule({ step_id: step2._id, condition: 'amount > 1000', next_step_id: step3._id, priority: 1 }).save();
  await new Rule({ step_id: step2._id, condition: 'DEFAULT', next_step_id: step4._id, priority: 2 }).save();

  // Rules for CEO Approval
  await new Rule({ step_id: step3._id, condition: 'DEFAULT', next_step_id: step4._id, priority: 1 }).save();

  // Task steps - no next step (end workflow)
  await new Rule({ step_id: step4._id, condition: 'DEFAULT', next_step_id: null, priority: 1 }).save();
  await new Rule({ step_id: step5._id, condition: 'DEFAULT', next_step_id: null, priority: 1 }).save();

  console.log('✅ Expense Approval workflow created');

  // ── WORKFLOW 2: Employee Onboarding ──────────────────────────────────
  const onboardingWF = new Workflow({
    name: 'Employee Onboarding',
    description: 'Automated onboarding workflow for new employees',
    version: 1,
    is_active: true,
    input_schema: new Map([
      ['department', { type: 'enum', required: true, allowed_values: ['Engineering', 'Sales', 'HR', 'Finance'], description: 'Employee department' }],
      ['employee_name', { type: 'string', required: true, description: 'Full name of the employee' }],
      ['start_date', { type: 'string', required: true, description: 'Start date (ISO format)' }],
      ['is_remote', { type: 'boolean', required: false, description: 'Whether employee is remote' }]
    ])
  });
  await onboardingWF.save();

  const ob1 = new Step({ workflow_id: onboardingWF._id, name: 'IT Setup Notification', step_type: 'notification', order: 1, metadata: { notification_channel: 'email', template: 'New employee {{employee_name}} joining {{department}} on {{start_date}}. Please provision access.' } });
  const ob2 = new Step({ workflow_id: onboardingWF._id, name: 'HR Document Review', step_type: 'approval', order: 2, metadata: { assignee_email: 'hr@company.com', instructions: 'Review and approve employee documents' } });
  const ob3 = new Step({ workflow_id: onboardingWF._id, name: 'Department Head Welcome', step_type: 'notification', order: 3, metadata: { notification_channel: 'email', template: 'Welcome {{employee_name}} to the {{department}} team!' } });
  const ob4 = new Step({ workflow_id: onboardingWF._id, name: 'Remote Equipment Setup', step_type: 'task', order: 4, metadata: { instructions: 'Arrange equipment shipping for remote employee' } });
  const ob5 = new Step({ workflow_id: onboardingWF._id, name: 'Onboarding Complete', step_type: 'task', order: 5, metadata: { instructions: 'Mark onboarding as complete in HRIS' } });

  await ob1.save(); await ob2.save(); await ob3.save(); await ob4.save(); await ob5.save();
  onboardingWF.start_step_id = ob1._id;
  await onboardingWF.save();

  await new Rule({ step_id: ob1._id, condition: 'DEFAULT', next_step_id: ob2._id, priority: 1 }).save();
  await new Rule({ step_id: ob2._id, condition: 'DEFAULT', next_step_id: ob3._id, priority: 1 }).save();
  await new Rule({ step_id: ob3._id, condition: 'is_remote == true', next_step_id: ob4._id, priority: 1 }).save();
  await new Rule({ step_id: ob3._id, condition: 'DEFAULT', next_step_id: ob5._id, priority: 2 }).save();
  await new Rule({ step_id: ob4._id, condition: 'DEFAULT', next_step_id: ob5._id, priority: 1 }).save();
  await new Rule({ step_id: ob5._id, condition: 'DEFAULT', next_step_id: null, priority: 1 }).save();

  console.log('✅ Employee Onboarding workflow created');

  await mongoose.disconnect();
  console.log('\n🎉 Seeding complete!');
}

seed().catch(err => { console.error(err); process.exit(1); });

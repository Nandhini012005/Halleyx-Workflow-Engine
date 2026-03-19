const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const stepLogSchema = new mongoose.Schema({
  step_id: { type: String },
  step_name: { type: String },
  step_type: { type: String },
  status: { type: String, enum: ['pending', 'in_progress', 'completed', 'failed', 'skipped', 'awaiting_approval'] },
  started_at: { type: Date },
  ended_at: { type: Date },
  duration_ms: { type: Number },
  rule_evaluated: { type: String },
  next_step_id: { type: String },
  error: { type: String },
  metadata: { type: mongoose.Schema.Types.Mixed },
  iteration: { type: Number, default: 0 } // for loop tracking
}, { _id: false });

const executionSchema = new mongoose.Schema({
  _id: { type: String, default: () => uuidv4() },
  workflow_id: { type: String, ref: 'Workflow', required: true },
  workflow_version: { type: Number, required: true },
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'completed', 'failed', 'canceled'],
    default: 'pending'
  },
  data: { type: mongoose.Schema.Types.Mixed, default: {} },
  logs: [stepLogSchema],
  current_step_id: { type: String, default: null },
  retries: { type: Number, default: 0 },
  triggered_by: { type: String, default: 'anonymous' },
  started_at: { type: Date, default: Date.now },
  ended_at: { type: Date, default: null }
}, {
  _id: false,
  timestamps: false,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

module.exports = mongoose.model('Execution', executionSchema);

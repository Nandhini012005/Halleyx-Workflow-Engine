const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const stepSchema = new mongoose.Schema({
  _id: { type: String, default: () => uuidv4() },
  workflow_id: { type: String, ref: 'Workflow', required: true },
  name: { type: String, required: true, trim: true },
  step_type: { type: String, enum: ['task', 'approval', 'notification'], required: true },
  order: { type: Number, required: true },
  metadata: {
    assignee_email: { type: String },
    notification_channel: { type: String, enum: ['email', 'slack', 'ui'] },
    template: { type: String },
    instructions: { type: String },
    max_iterations: { type: Number, default: 10 }, // for loop support
    loop_condition: { type: String }, // optional loop back condition
    loop_target_step_id: { type: String } // step to loop back to
  },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
}, {
  _id: false,
  timestamps: false,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

stepSchema.pre('save', function(next) {
  this.updated_at = new Date();
  next();
});

module.exports = mongoose.model('Step', stepSchema);

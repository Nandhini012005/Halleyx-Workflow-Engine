const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const ruleSchema = new mongoose.Schema({
  _id: { type: String, default: () => uuidv4() },
  step_id: { type: String, ref: 'Step', required: true },
  condition: { type: String, required: true, trim: true }, // "DEFAULT" or expression
  next_step_id: { type: String, default: null }, // null = end workflow
  priority: { type: Number, required: true },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
}, {
  _id: false,
  timestamps: false,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

ruleSchema.pre('save', function(next) {
  this.updated_at = new Date();
  next();
});

module.exports = mongoose.model('Rule', ruleSchema);

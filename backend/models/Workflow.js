const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const inputSchemaFieldSchema = new mongoose.Schema({
  type: { type: String, enum: ['string', 'number', 'boolean', 'enum'], required: true },
  required: { type: Boolean, default: false },
  allowed_values: [mongoose.Schema.Types.Mixed],
  description: { type: String }
}, { _id: false });

const workflowSchema = new mongoose.Schema({
  _id: { type: String, default: () => uuidv4() },
  name: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  version: { type: Number, default: 1 },
  is_active: { type: Boolean, default: true },
  input_schema: { type: Map, of: inputSchemaFieldSchema, default: {} },
  start_step_id: { type: String, default: null },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
}, {
  _id: false,
  timestamps: false,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

workflowSchema.pre('save', function(next) {
  this.updated_at = new Date();
  next();
});

workflowSchema.pre('findOneAndUpdate', function(next) {
  this.set({ updated_at: new Date() });
  next();
});

module.exports = mongoose.model('Workflow', workflowSchema);

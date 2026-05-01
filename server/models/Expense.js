const mongoose = require('mongoose');

function money(v) {
  return Number.parseFloat(Number(v || 0).toFixed(2));
}

const splitSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  share: { type: Number, required: true, min: 0, set: money },
  raw: { type: Number, default: 0 }
}, { _id: false });

const expenseSchema = new mongoose.Schema({
  group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true, index: true },
  description: { type: String, required: true, trim: true },
  amount: { type: Number, required: true, min: 0.01, set: money },
  paidBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: Date, default: Date.now },
  splitType: { type: String, enum: ['equal', 'percent', 'amount', 'shares'], default: 'equal' },
  splits: [splitSchema],
  isSettlement: { type: Boolean, default: false },
  settledTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now }
});

expenseSchema.index({ group: 1, createdAt: -1 });

module.exports = mongoose.model('Expense', expenseSchema);

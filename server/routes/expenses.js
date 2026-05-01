const mongoose = require('mongoose');
const express = require('express');
const Expense = require('../models/Expense');
const Group = require('../models/Group');
const protect = require('../middleware/protect');
const { calculateSplits, round2 } = require('../utils/splitLogic');

const router = express.Router();
router.use(protect);

function validId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

async function getAuthorizedGroup(groupId, userId) {
  if (!validId(groupId)) return null;
  const group = await Group.findById(groupId).populate('members', 'name email');
  if (!group || !group.members.some((m) => m._id.equals(userId))) return null;
  return group;
}

function assertMembers(group, ids) {
  const set = new Set(group.members.map((m) => m._id.toString()));
  return ids.every((id) => set.has(id.toString()));
}

router.get('/group/:groupId', async (req, res, next) => {
  try {
    const group = await getAuthorizedGroup(req.params.groupId, req.user._id);
    if (!group) return res.status(404).json({ message: 'Group not found' });
    const page = Math.max(Number.parseInt(req.query.page || '1', 10), 1);
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit || '20', 10), 1), 50);
    const expenses = await Expense.find({ group: group._id })
      .populate('paidBy', 'name email')
      .populate('createdBy', 'name email')
      .populate('settledTo', 'name email')
      .populate('splits.user', 'name email')
      .sort({ date: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit + 1);
    res.json({ expenses: expenses.slice(0, limit), hasMore: expenses.length > limit, group });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const group = await getAuthorizedGroup(req.body.groupId, req.user._id);
    if (!group) return res.status(404).json({ message: 'Group not found' });
    const description = String(req.body.description || '').trim();
    const amount = round2(req.body.amount);
    const paidBy = String(req.body.paidBy || '');
    const splitType = req.body.splitType || 'equal';
    if (!description || amount <= 0 || !validId(paidBy)) return res.status(400).json({ message: 'Description, amount, and payer are required' });
    if (!assertMembers(group, [paidBy])) return res.status(400).json({ message: 'Payer must be a group member' });

    const splits = calculateSplits({ amount, splitType, members: group.members.map((m) => m._id), paidBy, rawSplits: req.body.splits || [] });
    const expense = await Expense.create({
      group: group._id,
      description,
      amount,
      paidBy,
      date: req.body.date ? new Date(req.body.date) : new Date(),
      splitType,
      splits,
      createdBy: req.user._id
    });
    await expense.populate('paidBy createdBy settledTo splits.user', 'name email');
    res.status(201).json({ expense });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    if (!validId(req.params.id)) return res.status(400).json({ message: 'Invalid expense id' });
    const expense = await Expense.findById(req.params.id);
    if (!expense) return res.status(404).json({ message: 'Expense not found' });
    if (!expense.createdBy.equals(req.user._id)) return res.status(403).json({ message: 'Only the creator can edit this expense' });
    const group = await getAuthorizedGroup(expense.group, req.user._id);
    if (!group) return res.status(403).json({ message: 'Group access denied' });

    const amount = round2(req.body.amount);
    const paidBy = String(req.body.paidBy || '');
    if (!assertMembers(group, [paidBy])) return res.status(400).json({ message: 'Payer must be a group member' });
    expense.description = String(req.body.description || '').trim();
    expense.amount = amount;
    expense.paidBy = paidBy;
    expense.date = req.body.date ? new Date(req.body.date) : expense.date;
    expense.splitType = req.body.splitType || 'equal';
    expense.splits = calculateSplits({ amount, splitType: expense.splitType, members: group.members.map((m) => m._id), paidBy, rawSplits: req.body.splits || [] });
    await expense.save();
    await expense.populate('paidBy createdBy settledTo splits.user', 'name email');
    res.json({ expense });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    if (!validId(req.params.id)) return res.status(400).json({ message: 'Invalid expense id' });
    const expense = await Expense.findById(req.params.id);
    if (!expense) return res.status(404).json({ message: 'Expense not found' });
    if (!expense.createdBy.equals(req.user._id)) return res.status(403).json({ message: 'Only the creator can delete this expense' });
    await Expense.findByIdAndDelete(expense._id);
    res.json({ message: 'Expense deleted' });
  } catch (err) {
    next(err);
  }
});

router.post('/settle', async (req, res, next) => {
  try {
    const group = await getAuthorizedGroup(req.body.groupId, req.user._id);
    if (!group) return res.status(404).json({ message: 'Group not found' });
    const payer = String(req.body.payer || '');
    const payee = String(req.body.payee || '');
    const amount = round2(req.body.amount);
    if (amount <= 0) return res.status(400).json({ message: 'Settlement amount must be greater than zero' });
    if (!assertMembers(group, [payer, payee]) || payer === payee) return res.status(400).json({ message: 'Payer and payee must be different group members' });

    const expense = await Expense.create({
      group: group._id,
      description: String(req.body.note || 'Settlement').trim() || 'Settlement',
      amount,
      paidBy: payer,
      settledTo: payee,
      date: new Date(),
      splitType: 'amount',
      splits: [{ user: payee, share: amount, raw: amount }],
      isSettlement: true,
      createdBy: req.user._id
    });
    await expense.populate('paidBy createdBy settledTo splits.user', 'name email');
    res.status(201).json({ expense });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

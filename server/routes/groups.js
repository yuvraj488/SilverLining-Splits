const mongoose = require('mongoose');
const express = require('express');
const Group = require('../models/Group');
const User = require('../models/User');
const Expense = require('../models/Expense');
const protect = require('../middleware/protect');
const { sendGroupInviteEmail } = require('../utils/mailer');
const { getNetBalances, getSimplifiedDebts } = require('../utils/splitLogic');

const router = express.Router();
router.use(protect);

function validId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

async function requireGroup(req, res, next) {
  try {
    if (!validId(req.params.id)) return res.status(400).json({ message: 'Invalid group id' });
    const group = await Group.findById(req.params.id).populate('members', 'name email verified');
    if (!group) return res.status(404).json({ message: 'Group not found' });
    if (!group.members.some((m) => m._id.equals(req.user._id))) return res.status(403).json({ message: 'You do not have access to this group' });
    req.group = group;
    next();
  } catch (err) {
    next(err);
  }
}

function memberMap(group) {
  return new Map(group.members.map((m) => [m._id.toString(), m]));
}

router.get('/join', async (req, res, next) => {
  try {
    const token = String(req.query.token || '');
    const group = await Group.findOne({ inviteToken: token }).populate('members', 'name email');
    if (!group) return res.status(404).json({ message: 'Invite not found' });
    res.json({
      group: { id: group._id, name: group.name, memberCount: group.members.length },
      alreadyMember: group.members.some((m) => m._id.equals(req.user._id))
    });
  } catch (err) {
    next(err);
  }
});

router.post('/join', async (req, res, next) => {
  try {
    const token = String(req.body.token || '');
    const group = await Group.findOne({ inviteToken: token });
    if (!group) return res.status(404).json({ message: 'Invite not found' });
    if (!group.members.some((id) => id.equals(req.user._id))) group.members.push(req.user._id);
    await group.save();
    res.json({ groupId: group._id, message: 'Joined group' });
  } catch (err) {
    next(err);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const groups = await Group.find({ members: req.user._id }).populate('members', 'name email').sort({ createdAt: -1 });
    res.json({ groups });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const name = String(req.body.name || '').trim();
    const inviteEmails = [...new Set((req.body.inviteEmails || []).map((email) => String(email).trim().toLowerCase()).filter(Boolean))];
    if (!name) return res.status(400).json({ message: 'Group name is required' });

    const invitedUsers = await User.find({ email: { $in: inviteEmails } });
    const memberIds = [req.user._id, ...invitedUsers.map((u) => u._id)];
    const group = await Group.create({ name, createdBy: req.user._id, members: [...new Set(memberIds.map((id) => id.toString()))] });
    const inviteLink = `${process.env.BASE_URL || 'http://localhost:5000'}/join.html?token=${group.inviteToken}`;

    await Promise.all(inviteEmails.map((email) => sendGroupInviteEmail(email, req.user.name, group.name, inviteLink)));
    await group.populate('members', 'name email');
    res.status(201).json({ group });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', requireGroup, async (req, res) => {
  res.json({ group: req.group });
});

router.patch('/:id', requireGroup, async (req, res, next) => {
  try {
    if (!req.group.createdBy.equals(req.user._id)) return res.status(403).json({ message: 'Only the creator can rename this group' });
    const name = String(req.body.name || '').trim();
    if (!name) return res.status(400).json({ message: 'Group name is required' });
    req.group.name = name;
    await req.group.save();
    res.json({ group: req.group });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requireGroup, async (req, res, next) => {
  try {
    if (!req.group.createdBy.equals(req.user._id)) return res.status(403).json({ message: 'Only the creator can delete this group' });
    await Expense.deleteMany({ group: req.group._id });
    await Group.findByIdAndDelete(req.group._id);
    res.json({ message: 'Group deleted' });
  } catch (err) {
    next(err);
  }
});

router.get('/:id/summary', requireGroup, async (req, res, next) => {
  try {
    const net = await getNetBalances(req.group._id);
    const users = memberMap(req.group);
    const balances = req.group.members.map((member) => ({
      user: member,
      amount: Number((net[member._id.toString()] || 0).toFixed(2))
    }));
    res.json({ balances, currentUserBalance: Number((net[req.user._id.toString()] || 0).toFixed(2)), users: Object.fromEntries(users) });
  } catch (err) {
    next(err);
  }
});

router.get('/:id/balances', requireGroup, async (req, res, next) => {
  try {
    const debts = await getSimplifiedDebts(req.group._id);
    const users = Object.fromEntries(req.group.members.map((m) => [m._id.toString(), m]));
    res.json({ debts, users });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

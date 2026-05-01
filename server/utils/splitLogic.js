const Expense = require('../models/Expense');

function round2(n) {
  return Number.parseFloat(Number(n || 0).toFixed(2));
}

function idsEqual(a, b) {
  return a && b && a.toString() === b.toString();
}

function calculateSplits({ amount, splitType, members, paidBy, rawSplits = [] }) {
  const total = round2(amount);
  const memberIds = members.map((m) => m.toString());
  const rawByUser = new Map(rawSplits.map((s) => [s.user.toString(), Number(s.raw ?? s.share ?? 0)]));
  let splits = [];

  if (splitType === 'equal') {
    const base = Math.floor((total / memberIds.length) * 100) / 100;
    let remainder = round2(total - base * memberIds.length);
    splits = memberIds.map((user) => {
      const extra = idsEqual(user, paidBy) ? remainder : 0;
      remainder = idsEqual(user, paidBy) ? 0 : remainder;
      return { user, share: round2(base + extra), raw: 1 };
    });
  } else if (splitType === 'percent') {
    const sum = memberIds.reduce((acc, id) => acc + (rawByUser.get(id) || 0), 0);
    if (Math.abs(sum - 100) > 0.01) throw new Error('Percent splits must total 100%');
    splits = memberIds.map((user) => ({ user, share: round2(total * ((rawByUser.get(user) || 0) / 100)), raw: rawByUser.get(user) || 0 }));
  } else if (splitType === 'amount') {
    splits = memberIds.map((user) => ({ user, share: round2(rawByUser.get(user) || 0), raw: rawByUser.get(user) || 0 }));
  } else if (splitType === 'shares') {
    const sum = memberIds.reduce((acc, id) => acc + (rawByUser.get(id) || 0), 0);
    if (sum <= 0) throw new Error('Share count must be greater than zero');
    splits = memberIds.map((user) => ({ user, share: round2(total * ((rawByUser.get(user) || 0) / sum)), raw: rawByUser.get(user) || 0 }));
  }

  const diff = round2(total - splits.reduce((acc, split) => acc + split.share, 0));
  if (Math.abs(diff) > 0 && splits.length) {
    const payerSplit = splits.find((split) => idsEqual(split.user, paidBy)) || splits[0];
    payerSplit.share = round2(payerSplit.share + diff);
  }

  const sumShares = splits.reduce((acc, split) => acc + split.share, 0);
  if (Math.abs(sumShares - total) > 0.01) throw new Error('Splits must add up to the expense amount');
  return splits;
}

function buildNetBalances(expenses) {
  const netBalance = {};
  for (const exp of expenses) {
    const paidBy = exp.paidBy._id ? exp.paidBy._id.toString() : exp.paidBy.toString();
    netBalance[paidBy] = round2((netBalance[paidBy] || 0) + exp.amount);
    for (const split of exp.splits) {
      const user = split.user._id ? split.user._id.toString() : split.user.toString();
      netBalance[user] = round2((netBalance[user] || 0) - split.share);
    }
  }
  return netBalance;
}

async function getNetBalances(groupId) {
  const expenses = await Expense.find({ group: groupId });
  return buildNetBalances(expenses);
}

async function getSimplifiedDebts(groupId) {
  const expenses = await Expense.find({ group: groupId });
  const netBalance = buildNetBalances(expenses);
  const creditors = [];
  const debtors = [];

  for (const [userId, balance] of Object.entries(netBalance)) {
    if (balance > 0.005) creditors.push({ userId, amount: balance });
    else if (balance < -0.005) debtors.push({ userId, amount: Math.abs(balance) });
  }

  const transactions = [];
  while (creditors.length && debtors.length) {
    creditors.sort((a, b) => b.amount - a.amount);
    debtors.sort((a, b) => b.amount - a.amount);
    const c = creditors[0];
    const d = debtors[0];
    const amount = Math.min(c.amount, d.amount);
    transactions.push({ from: d.userId, to: c.userId, amount: round2(amount) });
    c.amount = round2(c.amount - amount);
    d.amount = round2(d.amount - amount);
    if (c.amount < 0.005) creditors.shift();
    if (d.amount < 0.005) debtors.shift();
  }
  return transactions;
}

module.exports = { calculateSplits, getNetBalances, getSimplifiedDebts, buildNetBalances, round2 };

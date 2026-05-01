const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const express = require('express');
const rateLimit = require('express-rate-limit');
const User = require('../models/User');
const protect = require('../middleware/protect');
const { signToken } = require('../utils/tokens');
const { sendVerificationEmail, sendWelcomeEmail } = require('../utils/mailer');

const router = express.Router();
const authLimiter = rateLimit({ windowMs: 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false });

function smtpConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

router.post('/signup', authLimiter, async (req, res, next) => {
  try {
    const name = String(req.body.name || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    if (!name || !email || password.length < 8) return res.status(400).json({ message: 'Name, valid email, and 8+ character password are required' });

    const exists = await User.findOne({ email });
    if (exists) return res.status(409).json({ message: 'An account with that email already exists' });

    const verifyToken = crypto.randomBytes(24).toString('hex');
    const user = await User.create({
      name,
      email,
      passwordHash: await bcrypt.hash(password, 12),
      verified: false,
      verifyToken,
      verifyTokenExp: new Date(Date.now() + 24 * 60 * 60 * 1000)
    });

    if (smtpConfigured()) {
      await sendVerificationEmail(user.email, user.name, verifyToken);
      res.status(201).json({ message: 'Verification email sent' });
    } else {
      const link = `${process.env.BASE_URL || 'http://localhost:5001'}/verify.html?token=${verifyToken}`;
      console.log(`Verification email skipped because SMTP is not configured. Verification link for ${user.email}: ${link}`);
      res.status(201).json({ message: 'Verification link generated. SMTP is not configured, so check the server logs for the local verification link.' });
    }
  } catch (err) {
    next(err);
  }
});

router.post('/login', authLimiter, async (req, res, next) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) return res.status(401).json({ message: 'Invalid email or password' });
    if (!user.verified) return res.status(403).json({ message: 'Please verify your email before signing in' });
    res.json({ token: signToken(user), user: user.toSafeJSON() });
  } catch (err) {
    next(err);
  }
});

router.get('/verify', async (req, res, next) => {
  try {
    const token = String(req.query.token || '');
    const user = await User.findOne({ verifyToken: token, verifyTokenExp: { $gt: new Date() } });
    if (!user) return res.status(400).json({ message: 'Invalid or expired verification link' });
    user.verified = true;
    user.verifyToken = undefined;
    user.verifyTokenExp = undefined;
    await user.save();
    await sendWelcomeEmail(user.email, user.name);
    res.json({ message: 'Email verified' });
  } catch (err) {
    next(err);
  }
});

router.get('/me', protect, async (req, res) => {
  res.json({ user: req.user.toSafeJSON ? req.user.toSafeJSON() : req.user });
});

router.post('/logout', (req, res) => {
  res.json({ message: 'Logged out' });
});

router.post('/resend-verification', authLimiter, async (req, res, next) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.verified) return res.json({ message: 'Already verified' });
    user.verifyToken = crypto.randomBytes(24).toString('hex');
    user.verifyTokenExp = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await user.save();
    await sendVerificationEmail(user.email, user.name, user.verifyToken);
    res.json({ message: 'Verification email sent' });
  } catch (err) {
    next(err);
  }
});

router.patch('/profile', protect, async (req, res, next) => {
  try {
    const name = String(req.body.name || '').trim();
    if (!name) return res.status(400).json({ message: 'Name is required' });
    const user = await User.findByIdAndUpdate(req.user._id, { name }, { new: true }).select('-passwordHash -verifyToken -verifyTokenExp -resetToken -resetTokenExp');
    res.json({ user: user.toSafeJSON() });
  } catch (err) {
    next(err);
  }
});

router.post('/change-password', protect, async (req, res, next) => {
  try {
    const currentPassword = String(req.body.currentPassword || '');
    const newPassword = String(req.body.newPassword || '');
    if (newPassword.length < 8) return res.status(400).json({ message: 'New password must be at least 8 characters' });
    const user = await User.findById(req.user._id);
    if (!(await bcrypt.compare(currentPassword, user.passwordHash))) return res.status(401).json({ message: 'Current password is incorrect' });
    user.passwordHash = await bcrypt.hash(newPassword, 12);
    await user.save();
    res.json({ message: 'Password changed' });
  } catch (err) {
    next(err);
  }
});

router.delete('/account', protect, async (req, res, next) => {
  try {
    await User.findByIdAndDelete(req.user._id);
    res.json({ message: 'Account deleted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

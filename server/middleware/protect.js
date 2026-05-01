const User = require('../models/User');
const { verifyToken } = require('../utils/tokens');

module.exports = async function protect(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ message: 'Authentication required' });

    const payload = verifyToken(token);
    const user = await User.findById(payload.id).select('-passwordHash -verifyToken -verifyTokenExp -resetToken -resetTokenExp');
    if (!user) return res.status(401).json({ message: 'User not found' });
    req.user = user;
    next();
  } catch (err) {
    res.status(401).json({ message: 'Invalid or expired token' });
  }
};

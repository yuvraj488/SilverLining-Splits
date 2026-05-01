const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  verified: { type: Boolean, default: false },
  verifyToken: String,
  verifyTokenExp: Date,
  resetToken: String,
  resetTokenExp: Date,
  createdAt: { type: Date, default: Date.now }
});

userSchema.methods.toSafeJSON = function toSafeJSON() {
  return { id: this._id, name: this.name, email: this.email, verified: this.verified, createdAt: this.createdAt };
};

module.exports = mongoose.model('User', userSchema);

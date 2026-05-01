const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config();

const connectDB = require('./config/db');

const app = express();
const isProduction = process.env.NODE_ENV === 'production';
const corsOrigin = process.env.BASE_URL || true;

const dbReady = connectDB();

app.use(cors({ origin: isProduction ? corsOrigin : true, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '../public')));

app.use('/api', async (req, res, next) => {
  if (!process.env.MONGO_URI) {
    return res.status(503).json({
      message: 'MongoDB is not configured. Create a .env file with MONGO_URI, then restart the server.'
    });
  }

  if (mongoose.connection.readyState !== 1) {
    await Promise.race([
      dbReady,
      new Promise((resolve) => setTimeout(resolve, 10000))
    ]);
  }

  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({
      message: 'MongoDB is still connecting. Try again in a moment. If this persists, check the MongoDB Atlas Network Access settings.'
    });
  }

  next();
});

app.use('/api/auth', require('./routes/auth'));
app.use('/api/groups', require('./routes/groups'));
app.use('/api/expenses', require('./routes/expenses'));

app.get('/health', (req, res) => res.json({ ok: true, name: 'SilverLining-Splits' }));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ message: err.message || 'Server error' });
});

const PORT = process.env.PORT || 5000;
if (require.main === module) {
  app.listen(PORT, () => console.log(`SilverLining-Splits running on port ${PORT}`));
}

module.exports = app;

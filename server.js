require('dotenv').config();

const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');
const { initDB } = require('./db');
const authRouter = require('./routes/auth');
const roomsRouter = require('./routes/rooms');
const wsRouter = require('./routes/ws');
const adminRouter = require('./routes/admin');
const surveyRouter = require('./routes/survey');
const aiRouter = require('./routes/ai');
const panelRouter = require('./routes/panel');

const app = express();

// CORS — app 우선, demo/ntable.kr 도 전환기 동안 유지
app.use(cors({
  origin: [
    'https://app.ntable.kr',
    'https://demo.ntable.kr',
    'https://ntable.kr',
    'https://www.ntable.kr',
    'http://localhost:3000',
    'http://localhost:3001',
  ],
  credentials: true,
}));

// demo.ntable.kr 로 들어온 요청 → app.ntable.kr 로 301 리다이렉트
// (기존 QR·공유 링크 보호. Phase 4에서 제거 예정.)
app.use((req, res, next) => {
  const host = (req.headers['x-forwarded-host'] || req.headers.host || '').toLowerCase();
  if (host === 'demo.ntable.kr') {
    return res.redirect(301, `https://app.ntable.kr${req.originalUrl}`);
  }
  next();
});

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.use('/api', authRouter);
app.use('/api', roomsRouter);
app.use('/api', adminRouter);
app.use('/api', surveyRouter);
app.use('/api', aiRouter);
app.use('/api', panelRouter);

// Page routes
app.get('/room/:code/host', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'host.html'));
});
app.get('/room/:code', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'guest.html'));
});
app.get('/survey', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'survey.html'));
});
app.get('/result', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'result.html'));
});
app.get('/create', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'create.html'));
});
app.get('/profile', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'profile.html'));
});
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Fallback: serve login.html for non-api routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// HTTP server
const server = http.createServer(app);

wsRouter.init(server);
adminRouter.init(require('./db').pool, wsRouter);

const PORT = process.env.PORT || 8080;

// Init DB then start server
initDB()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`[server] Running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('[server] Failed to initialize DB:', err);
    process.exit(1);
  });

module.exports = server;

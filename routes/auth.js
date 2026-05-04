const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../db');
const { captureDbError } = require('./_db-errors');
const { isUserActive } = require('./ws');

// POST /api/login
router.post('/login', async (req, res) => {
  const { nickname, uuid } = req.body;

  if (!nickname || nickname.trim().length === 0) {
    return res.status(400).json({ error: 'NICKNAME_REQUIRED' });
  }

  const trimmedNickname = nickname.trim();

  // 한글/영문/숫자만 허용
  if (!/^[가-힣a-zA-Z0-9]+$/.test(trimmedNickname)) {
    return res.status(400).json({ error: 'INVALID_NICKNAME' });
  }

  try {
    if (uuid) {
      // 1) uuid 지정: 기존 유저 조회 (localStorage 재접속)
      const result = await pool.query(
        'SELECT * FROM users WHERE uuid = $1',
        [uuid]
      );
      if (result.rows.length > 0) {
        return res.json({ uuid, is_new: false, profile: result.rows[0] });
      }
      // uuid가 DB에 없으면 → 닉네임 기반 경로로 폴백
    }

    // 2) 닉네임으로 기존 유저 조회 (localStorage 유실 or 타 브라우저 로그인)
    const existing = await pool.query(
      'SELECT * FROM users WHERE nickname = $1',
      [trimmedNickname]
    );
    if (existing.rows.length > 0) {
      const profile = existing.rows[0];
      // 기존 유저가 현재 어디서든 WS 접속 중이고, 요청한 uuid가 본인과 다르면 탈취 시도 차단
      if (isUserActive(profile.uuid) && uuid !== profile.uuid) {
        return res.status(409).json({ error: 'NICKNAME_IN_USE' });
      }
      return res.json({ uuid: profile.uuid, is_new: false, profile });
    }

    // 3) 신규 유저 생성
    const newUuid = uuidv4();
    await pool.query(
      'INSERT INTO users (uuid, nickname) VALUES ($1, $2)',
      [newUuid, trimmedNickname]
    );
    return res.json({ uuid: newUuid, is_new: true });
  } catch (err) {
    captureDbError('POST /api/login', err, { uuid, nickname: trimmedNickname });
    return res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// GET /api/me?uuid=
router.get('/me', async (req, res) => {
  const { uuid } = req.query;
  if (!uuid) return res.status(400).json({ error: 'UUID_REQUIRED' });

  try {
    const result = await pool.query(
      'SELECT * FROM users WHERE uuid = $1',
      [uuid]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'USER_NOT_FOUND' });
    }
    return res.json(result.rows[0]);
  } catch (err) {
    captureDbError('GET /api/me', err, { uuid });
    return res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// PUT /api/profile
router.put('/profile', async (req, res) => {
  const { uuid, gender, birth_year, region, industry, mbti, interest, instagram } = req.body;
  if (!uuid) return res.status(400).json({ error: 'UUID_REQUIRED' });

  try {
    await pool.query(
      `UPDATE users SET
        gender = $1,
        birth_year = $2,
        region = $3,
        industry = $4,
        mbti = $5,
        interest = $6,
        instagram = $7
       WHERE uuid = $8`,
      [gender, birth_year, region, industry, mbti, interest, instagram, uuid]
    );
    return res.json({ success: true });
  } catch (err) {
    captureDbError('PUT /api/profile', err, { uuid });
    return res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// GET /api/check-nickname?nickname=
// available: 완전 신규 여부 / exists: 기존 계정 존재 여부
router.get('/check-nickname', async (req, res) => {
  const { nickname } = req.query;
  if (!nickname) return res.status(400).json({ error: 'NICKNAME_REQUIRED' });

  try {
    const result = await pool.query(
      'SELECT uuid FROM users WHERE nickname = $1',
      [nickname.trim()]
    );
    const exists = result.rows.length > 0;
    const existingUuid = exists ? result.rows[0].uuid : null;
    const active = exists ? isUserActive(existingUuid) : false;
    return res.json({ available: !exists, exists, active, uuid: existingUuid });
  } catch (err) {
    captureDbError('GET /api/check-nickname', err, { nickname });
    return res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// GET /api/my-room?uuid=
router.get('/my-room', async (req, res) => {
  const { uuid } = req.query;
  if (!uuid) return res.status(400).json({ error: 'UUID_REQUIRED' });

  try {
    const result = await pool.query(
      `SELECT room_code, title, status FROM rooms
       WHERE host_uuid = $1 AND status IN ('waiting', 'open')
       ORDER BY created_at DESC LIMIT 1`,
      [uuid]
    );
    if (result.rows.length === 0) {
      return res.json({ room_code: null });
    }
    return res.json(result.rows[0]);
  } catch (err) {
    captureDbError('GET /api/my-room', err, { uuid });
    return res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// POST /api/survey
router.post('/survey', async (req, res) => {
  const { uuid, room_code, satisfaction, revisit, nps, best_moment, regret, review } = req.body;
  if (!uuid || !room_code) return res.status(400).json({ error: 'uuid, room_code required' });

  try {
    const roomRes = await pool.query('SELECT id FROM rooms WHERE room_code = $1', [room_code]);
    if (roomRes.rows.length === 0) return res.status(404).json({ error: 'room not found' });
    const room_id = roomRes.rows[0].id;

    await pool.query(
      `INSERT INTO survey_responses (uuid, room_id, satisfaction, revisit, nps, best_moment, regret, review)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT DO NOTHING`,
      [uuid, room_id, satisfaction, revisit ? true : false, nps, best_moment || null, regret || null, review || null]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'db error' });
  }
});

// GET /api/result?uuid=&room_code=
router.get('/result', async (req, res) => {
  const { uuid, room_code } = req.query;
  if (!uuid || !room_code) return res.status(400).json({ error: 'uuid, room_code required' });

  try {
    const roomRes = await pool.query('SELECT id FROM rooms WHERE room_code = $1', [room_code]);
    if (roomRes.rows.length === 0) return res.status(404).json({ error: 'room not found' });
    const room_id = roomRes.rows[0].id;

    const mrRes = await pool.query(
      'SELECT match_json, votes_json, fi_count FROM member_results WHERE uuid = $1 AND room_id = $2',
      [uuid, room_id]
    );
    const mr = mrRes.rows[0] || {};
    const match_json = mr.match_json || {};
    const fi_count = mr.fi_count || 0;

    // 베스트 매칭 상대 닉네임
    let match_nickname = null;
    const match_uuid = match_json.matched_uuid || null;
    if (match_uuid) {
      const userRes = await pool.query('SELECT nickname FROM users WHERE uuid = $1', [match_uuid]);
      match_nickname = userRes.rows[0]?.nickname || null;
    }

    // 참가자 수
    const countRes = await pool.query(
      'SELECT COUNT(*) as cnt FROM member_results WHERE room_id = $1',
      [room_id]
    );
    const participants = parseInt(countRes.rows[0].cnt, 10);

    // 문항 하이라이트
    const allVotesRes = await pool.query(
      'SELECT votes_json FROM member_results WHERE room_id = $1',
      [room_id]
    );
    const tally = {};
    for (const row of allVotesRes.rows) {
      const v = row.votes_json || {};
      for (const [qid, ans] of Object.entries(v)) {
        if (!tally[qid]) tally[qid] = {};
        tally[qid][ans] = (tally[qid][ans] || 0) + 1;
      }
    }
    const question_highlights = Object.entries(tally).map(([qid, counts]) => {
      const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
      return { question_id: qid, top_answer: top[0], count: top[1] };
    });

    res.json({ match_nickname, fi_count, participants, question_highlights });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'db error' });
  }
});

module.exports = router;

// mock-server.js — survey/result/personality API 테스트용
const express = require('express');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Mock DB 상태
const mockRooms = { 'TEST01': { id: 1, room_code: 'TEST01' } };
const mockUsers = {
  'uuid-alice': { uuid: 'uuid-alice', nickname: '앨리스', gender: '여성', birth_year: 1997, mbti: 'ENFP', interest: '여행', instagram: 'alice_gram' },
  'uuid-bob':   { uuid: 'uuid-bob',   nickname: '밥',    gender: '남성', birth_year: 1995, mbti: 'INTJ', interest: '독서', instagram: 'bob_reads' }
};
const mockMemberResults = {
  'uuid-alice-1': { uuid: 'uuid-alice', room_id: 1, match_json: { matched_uuid: 'uuid-bob' }, votes_json: { '1': 'A안', '2': 'B안', '3': 'A안' }, fi_count: 2 },
  'uuid-bob-1':   { uuid: 'uuid-bob',   room_id: 1, match_json: { matched_uuid: 'uuid-alice' }, votes_json: { '1': 'A안', '2': 'A안', '3': 'B안' }, fi_count: 1 }
};
const surveyResponses = [];

// POST /api/survey
app.post('/api/survey', (req, res) => {
  const { uuid, room_code, satisfaction, revisit, nps, best_moment, regret, review } = req.body;
  if (!uuid || !room_code) return res.status(400).json({ error: 'uuid, room_code required' });
  if (!mockRooms[room_code]) return res.status(404).json({ error: 'room not found' });

  surveyResponses.push({ uuid, room_code, satisfaction, revisit, nps, best_moment, regret, review });
  console.log('[survey] saved:', { uuid, satisfaction, revisit, nps });
  res.json({ success: true });
});

// GET /api/result
app.get('/api/result', (req, res) => {
  const { uuid, room_code } = req.query;
  if (!mockRooms[room_code]) return res.status(404).json({ error: 'room not found' });
  const room_id = mockRooms[room_code].id;

  const mr = Object.values(mockMemberResults).find(r => r.uuid === uuid && r.room_id === room_id);
  if (!mr) return res.json({ match_nickname: null, fi_count: 0, participants: 0, question_highlights: [] });

  const match_uuid = mr.match_json?.matched_uuid;
  const match_nickname = match_uuid ? mockUsers[match_uuid]?.nickname : null;
  const participants = Object.values(mockMemberResults).filter(r => r.room_id === room_id).length;

  // 하이라이트 계산
  const tally = {};
  Object.values(mockMemberResults).filter(r => r.room_id === room_id).forEach(r => {
    Object.entries(r.votes_json || {}).forEach(([qid, ans]) => {
      if (!tally[qid]) tally[qid] = {};
      tally[qid][ans] = (tally[qid][ans] || 0) + 1;
    });
  });
  const question_highlights = Object.entries(tally).map(([qid, counts]) => {
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    return { question_id: qid, top_answer: top[0], count: top[1] };
  });

  res.json({ match_nickname, fi_count: mr.fi_count, participants, question_highlights });
});

// GET /api/personality
app.get('/api/personality', (req, res) => {
  const { uuid } = req.query;
  const user = mockUsers[uuid] || {};
  const templates = [
    `오늘 모임에서 당신은 조용히 분위기를 만들어가는 숨은 연결자예요 ✨ 처음엔 낯을 가리는 듯하지만, 자리가 무르익을수록 빛나는 매력이 있죠.`,
    `오늘 모임에서 당신은 에너지 넘치는 분위기 메이커예요 🔥 어색한 침묵을 없애는 데 천재적인 재능을 가졌군요!`,
    `오늘 모임에서 당신은 깊은 대화를 이끄는 탐구자예요 🌙 겉보다 속이 훨씬 매력적인 타입이에요.`
  ];
  setTimeout(() => {
    res.json({ personality: templates[Math.floor(Math.random() * templates.length)] });
  }, 800); // 실제 API 딜레이 시뮬레이션
});

// Mock: vote/match (인스타 교환)
app.post('/api/rooms/:code/vote/match', (req, res) => {
  const { uuid } = req.body;
  const user = mockUsers[uuid];
  // 테스트: alice↔bob 상호 동의 시뮬레이션
  if (uuid === 'uuid-alice') {
    res.json({ match_json: { mutual: true, instagram: mockUsers['uuid-bob'].instagram } });
  } else {
    res.json({ match_json: { mutual: false } });
  }
});

const PORT = 3099;
app.listen(PORT, () => {
  console.log(`\n✅ Mock 서버 실행: http://localhost:${PORT}`);
  console.log('\n테스트 URL:');
  console.log(`  survey: http://localhost:${PORT}/survey.html?room=TEST01  (demo_uuid=uuid-alice 미리 세팅 필요)`);
  console.log(`  result: http://localhost:${PORT}/result.html?room=TEST01&uuid=uuid-alice`);
  console.log('\ncurl 테스트:');
  console.log(`  POST survey: curl -X POST http://localhost:${PORT}/api/survey -H "Content-Type: application/json" -d '{"uuid":"uuid-alice","room_code":"TEST01","satisfaction":5,"revisit":true,"nps":9,"review":"최고였어요"}'`);
  console.log(`  GET result:  curl "http://localhost:${PORT}/api/result?uuid=uuid-alice&room_code=TEST01"`);
  console.log(`  GET persona: curl "http://localhost:${PORT}/api/personality?uuid=uuid-alice&room_code=TEST01"`);
});

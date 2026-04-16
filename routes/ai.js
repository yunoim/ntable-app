// routes/ai.js
// 담당: 4-A번 개발자 (AI 퍼실리테이션 엔지니어)
// 역할: GET /api/personality — 유저 성향 분석 텍스트 생성

const express = require('express');
const router = express.Router();

// DB 연결 (db.js에서 pool export 가정)
const { pool } = require('../db');

// ─────────────────────────────────────────
// Claude API 호출 헬퍼
// ─────────────────────────────────────────
async function callClaudeAPI(profile, votes) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const currentYear = new Date().getFullYear();
  const age = profile.birth_year ? currentYear - profile.birth_year : '미상';

  // 투표 데이터 요약 텍스트 구성
  let votesSummary = '';
  if (votes && Array.isArray(votes) && votes.length > 0) {
    votesSummary = votes
      .map((v, i) => `Q${i + 1}. ${v.question || '질문'} → ${v.answer || '응답 없음'}`)
      .join('\n');
  } else {
    votesSummary = '투표 데이터 없음';
  }

  const prompt = `다음은 소셜 모임 참가자의 프로필과 연애 밸런스 게임 투표 결과야.

[프로필]
- 닉네임: ${profile.nickname}
- 성별: ${profile.gender === 'M' ? '남성' : profile.gender === 'F' ? '여성' : '미상'}
- 나이: ${age}세
- MBTI: ${profile.mbti || '미입력'}
- 관심사: ${profile.interest || '미입력'}

[밸런스 게임 투표 결과]
${votesSummary}

위 정보를 바탕으로 이 사람의 연애/소통 성향을 200자 내외 한국어로 분석해줘.
- 따뜻하고 재미있는 톤으로
- 구체적인 성향 묘사 (이론적 설명 금지)
- 마지막에 짧은 한 줄 매력 포인트 추가
- JSON, 마크다운, 따옴표 없이 텍스트만 출력`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  if (!response.ok) {
    const err = await response.text();
    console.error('[ai.js] Claude API error:', response.status, err);
    return null;
  }

  const data = await response.json();
  const text = data?.content?.[0]?.text?.trim();
  return text || null;
}

// ─────────────────────────────────────────
// 폴백 텍스트 생성 (API 키 없거나 오류 시)
// ─────────────────────────────────────────
function buildFallbackText(profile) {
  const mbtiDesc = profile.mbti
    ? `${profile.mbti} 유형으로`
    : '뚜렷한 개성으로';
  const interestDesc = profile.interest
    ? `${profile.interest}에 관심이 많은`
    : '다양한 분야에 관심 있는';

  return `${profile.nickname}님은 ${mbtiDesc}, ${interestDesc} 분이에요. 모임에서 자신만의 색깔로 자연스럽게 분위기를 만들어가는 타입! 오늘 새로운 인연을 만나기 딱 좋은 날이에요. ✨`;
}

// ─────────────────────────────────────────
// GET /api/personality?uuid=&room_code=
// ─────────────────────────────────────────
router.get('/personality', async (req, res) => {
  const { uuid, room_code } = req.query;

  if (!uuid || !room_code) {
    return res.status(400).json({ error: 'uuid와 room_code가 필요합니다.' });
  }

  try {
    // 1) 유저 프로필 조회
    const userResult = await pool.query(
      'SELECT uuid, nickname, gender, birth_year, mbti, interest, instagram FROM users WHERE uuid = $1',
      [uuid]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: '유저를 찾을 수 없습니다.' });
    }

    const profile = userResult.rows[0];

    // 2) 투표 결과 조회 (member_results)
    const resultRow = await pool.query(
      'SELECT votes_json FROM member_results WHERE uuid = $1 AND room_code = $2 ORDER BY created_at DESC LIMIT 1',
      [uuid, room_code]
    );

    let votes = [];
    if (resultRow.rows.length > 0 && resultRow.rows[0].votes_json) {
      try {
        const raw = resultRow.rows[0].votes_json;
        votes = typeof raw === 'string' ? JSON.parse(raw) : raw;
      } catch (e) {
        console.warn('[ai.js] votes_json 파싱 실패:', e.message);
      }
    }

    // 3) Claude API 호출 or 폴백
    let personality = null;
    let is_fallback = false;

    if (process.env.ANTHROPIC_API_KEY) {
      personality = await callClaudeAPI(profile, votes);
    }

    if (!personality) {
      personality = buildFallbackText(profile);
      is_fallback = true;
    }

    return res.json({
      uuid: profile.uuid,
      nickname: profile.nickname,
      personality,
      is_fallback
    });

  } catch (err) {
    console.error('[ai.js] /api/personality 오류:', err.message);
    return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

module.exports = router;

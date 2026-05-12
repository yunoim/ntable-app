#!/usr/bin/env node
// scripts/seed-demo-rooms.js
//
// 영구 데모방 시드. idempotent (upsert) — 안전하게 여러 번 실행 가능.
// 두 데모방:
//   - DEMOAI  (kind='ai',     pack='ai-workplace')     /ai 에서 진입
//   - DEMONT  (kind='ntable', pack='ntable-showcase')  /demo 에서 진입
//
// 호스트 UUID 는 단일 (닉 = 시연자). DEMO_HOST_UUID env 로 override 가능.
// 기본값 'demo-host-001' 은 단순 식별자 — F안 redeem 시 강제 세팅됨.
//
// 사용: npm run seed:demo

require('dotenv').config();
const { pool, initDB } = require('../db');
const {
  buildRoomQuestions,
  buildRoomTopics,
  getPack,
  getPackDefaults,
  getPackFlow,
} = require('../routes/question-sources');

const DEMO_HOST_UUID = process.env.DEMO_HOST_UUID || 'demo-host-001';
const DEMO_HOST_NICKNAME = process.env.DEMO_HOST_NICKNAME || '닉';

const DEMO_ROOMS = [
  {
    room_code: 'DEMOAI',
    title: '🤖 ntable × AI — 라이브 체험',
    pack_id: 'ai-workplace',
    demo_kind: 'ai',
    question_count: 3,
  },
  {
    room_code: 'DEMONT',
    title: '🍽 ntable — 5분 체험 모임',
    pack_id: 'ntable-showcase',
    demo_kind: 'ntable',
    question_count: 3,
  },
];

async function upsertHostUser() {
  await pool.query(
    `INSERT INTO users (uuid, nickname)
     VALUES ($1, $2)
     ON CONFLICT (uuid) DO UPDATE SET nickname = EXCLUDED.nickname`,
    [DEMO_HOST_UUID, DEMO_HOST_NICKNAME]
  );
}

async function upsertDemoRoom(spec) {
  const pack = getPack(spec.pack_id);
  if (!pack) throw new Error(`pack not found: ${spec.pack_id}`);
  const defaults = getPackDefaults(spec.pack_id);
  const questions = buildRoomQuestions(pack, spec.question_count);
  const topics = buildRoomTopics(pack);
  const closingSteps = getPackFlow(spec.pack_id);

  const chatEnabled = !defaults.skip_free_chat;

  const existing = await pool.query(
    `SELECT id FROM rooms WHERE room_code = $1`,
    [spec.room_code]
  );
  let roomId;
  if (existing.rows.length) {
    roomId = existing.rows[0].id;
    await pool.query(
      `UPDATE rooms SET
         title = $1,
         host_uuid = $2,
         host_role = 'host_only',
         status = 'open',
         question_count = $3,
         questions_json = $4::jsonb,
         free_topics_json = $5::jsonb,
         pack_id = $6,
         demo_kind = $7,
         display_fields = $8::jsonb,
         closing_steps = $9::jsonb,
         meeting_at = NULL,
         instagram_collect = false,
         free_chat_chat_enabled = $11,
         free_chat_topic_card_enabled = $11,
         free_chat_timer_minutes = 0,
         display_mode = 'mobile'
       WHERE id = $10`,
      [
        spec.title,
        DEMO_HOST_UUID,
        spec.question_count,
        JSON.stringify(questions),
        JSON.stringify(topics),
        spec.pack_id,
        spec.demo_kind,
        JSON.stringify(defaults.display_fields_default || []),
        JSON.stringify(closingSteps),
        roomId,
        chatEnabled,
      ]
    );
  } else {
    const ins = await pool.query(
      `INSERT INTO rooms
         (room_code, title, host_uuid, host_role, status, question_count,
          questions_json, free_topics_json, pack_id, demo_kind, display_fields,
          closing_steps, meeting_at, instagram_collect, free_chat_chat_enabled,
          free_chat_topic_card_enabled, free_chat_timer_minutes, display_mode)
       VALUES
         ($1, $2, $3, 'host_only', 'open', $4,
          $5::jsonb, $6::jsonb, $7, $8, $9::jsonb,
          $10::jsonb, NULL, false, $11, $11, 0, 'mobile')
       RETURNING id`,
      [
        spec.room_code,
        spec.title,
        DEMO_HOST_UUID,
        spec.question_count,
        JSON.stringify(questions),
        JSON.stringify(topics),
        spec.pack_id,
        spec.demo_kind,
        JSON.stringify(defaults.display_fields_default || []),
        JSON.stringify(closingSteps),
        chatEnabled,
      ]
    );
    roomId = ins.rows[0].id;
  }

  // room_state 초기화 — demo-ticker 가 이 state 를 매 5초 sweep
  const initialState = {
    current_tab: 'intro',
    demo_cycle_id: 1,
    demo_phase: 'idle',          // 'idle' | 'explore' | 'closing'
    demo_question_index: 0,
    demo_tick_started_at: null,
    host_active: false,
  };
  await pool.query(
    `INSERT INTO room_state (room_id, state_json, updated_at)
     VALUES ($1, $2::jsonb, NOW())
     ON CONFLICT (room_id) DO UPDATE SET state_json = EXCLUDED.state_json, updated_at = NOW()`,
    [roomId, JSON.stringify(initialState)]
  );

  return { room_id: roomId, room_code: spec.room_code, title: spec.title };
}

async function main() {
  console.log('[seed-demo] start');
  // server.js 의 initDB 와 동일 마이그레이션 실행 (idempotent).
  // 신규 컬럼 (rooms.demo_kind · member_results.cycle_id) 없으면 시드 실패하므로 필수.
  console.log('[seed-demo] running DB migrations…');
  await initDB();
  console.log('[seed-demo] migrations done');
  await upsertHostUser();
  console.log(`[seed-demo] host user upserted: uuid=${DEMO_HOST_UUID} nickname=${DEMO_HOST_NICKNAME}`);
  for (const spec of DEMO_ROOMS) {
    const r = await upsertDemoRoom(spec);
    console.log(`[seed-demo] ✓ ${r.room_code} (id=${r.room_id}) — ${r.title}`);
  }
  console.log('[seed-demo] done');
  await pool.end();
}

main().catch(err => {
  console.error('[seed-demo] FAILED', err);
  pool.end().catch(() => {});
  process.exit(1);
});

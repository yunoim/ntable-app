// routes/demo-auth.js
//
// 영구 데모방 호스트 진입 — admin.ntable.kr → app.ntable.kr 핸드오프.
//
// 흐름:
//   1) admin.ntable.kr/admin 페이지에서 super_admin (= DEMO_HOST_EMAIL) 인증 후
//      [데모 호스트 진입] 버튼 → POST /api/admin/demo-host-grant?kind=ai|ntable
//   2) 서버: HMAC-SHA256(SESSION_SECRET) 으로 서명한 60초 TTL 1회용 grant 발급.
//   3) 브라우저: location.href = `https://app.ntable.kr/{ai|demo}/host#host_grant=<token>`
//   4) app.ntable.kr 측 페이지: URL fragment 에서 grant 추출 → POST /api/demo/redeem-host-grant
//   5) 서버: 서명 + TTL + nonce 1회 검증 → 응답으로 host_uuid·nickname·room_code 반환.
//   6) 브라우저: localStorage 에 uuid·nickname 박고 host.html 로 이동.
//
// 환경변수:
//   DEMO_HOST_EMAIL      (기본: skb.yunho.im@gmail.com) — super_admin 메일 검증
//   DEMO_HOST_UUID       (기본: demo-host-001) — 강제 세팅할 호스트 식별자
//   DEMO_HOST_NICKNAME   (기본: 닉) — 호스트 화면 표시 이름
//   APP_ORIGIN           (기본: https://app.ntable.kr) — target_url 베이스
//   SESSION_SECRET                                      — HMAC 서명 키 (필수)

const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const Sentry = require('../sentry');

const SIGN_KEY = process.env.SESSION_SECRET || 'dev-secret-rotate-me';
const GRANT_TTL_MS = 60 * 1000;
const DEMO_HOST_EMAIL = (process.env.DEMO_HOST_EMAIL || 'skb.yunho.im@gmail.com').toLowerCase();
const DEMO_HOST_UUID = process.env.DEMO_HOST_UUID || 'demo-host-001';
const DEMO_HOST_NICKNAME = process.env.DEMO_HOST_NICKNAME || '닉';
const APP_ORIGIN = process.env.APP_ORIGIN || 'https://app.ntable.kr';

const VALID_KINDS = {
  ai:     { code: 'DEMOAI', path: '/ai/host' },
  ntable: { code: 'DEMONT', path: '/demo/host' },
};

let adminAuthRouter = null;
let pool = null;

router.init = (dbPool, adminAuthRef) => {
  pool = dbPool;
  adminAuthRouter = adminAuthRef || null;
};

function b64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlDecode(str) {
  str = String(str).replace(/-/g, '+').replace(/_/g, '/');
  const pad = str.length % 4;
  if (pad) str += '='.repeat(4 - pad);
  return Buffer.from(str, 'base64');
}
function sign(payloadB64) {
  return crypto.createHmac('sha256', SIGN_KEY).update(payloadB64).digest();
}
function makeGrant(kind) {
  const nonce = crypto.randomBytes(16).toString('hex');
  const exp = Date.now() + GRANT_TTL_MS;
  const payloadB64 = b64url(JSON.stringify({ kind, nonce, exp }));
  const sigB64 = b64url(sign(payloadB64));
  return { token: `${payloadB64}.${sigB64}`, nonce, exp };
}

// 사용된 nonce in-memory store — Railway 단일 인스턴스 가정.
// 인스턴스 재시작 시 store 비워지나 grant TTL 자체가 60초라 영향 미미.
const usedNonces = new Map();
const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [n, exp] of usedNonces.entries()) {
    if (exp < now) usedNonces.delete(n);
  }
}, 60 * 1000);
if (cleanupTimer.unref) cleanupTimer.unref();

function verifyGrant(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [payloadB64, sigB64] = token.split('.');
  if (!payloadB64 || !sigB64) return null;
  const expectedSig = sign(payloadB64);
  let actualSig;
  try { actualSig = b64urlDecode(sigB64); } catch { return null; }
  if (expectedSig.length !== actualSig.length) return null;
  if (!crypto.timingSafeEqual(expectedSig, actualSig)) return null;
  let payload;
  try { payload = JSON.parse(b64urlDecode(payloadB64).toString('utf-8')); } catch { return null; }
  if (!payload || typeof payload !== 'object') return null;
  if (!payload.kind || !payload.nonce || !payload.exp) return null;
  if (Date.now() > payload.exp) return null;
  if (!VALID_KINDS[payload.kind]) return null;
  if (usedNonces.has(payload.nonce)) return null;
  return payload;
}

// ── admin.ntable.kr 측 — grant 발급 ─────────────────────────────────────
// POST /api/admin/demo-host-grant   body or query: { kind: 'ai'|'ntable' }
// header: x-admin-token
router.post('/admin/demo-host-grant', async (req, res) => {
  if (!adminAuthRouter || typeof adminAuthRouter.verifyOAuthToken !== 'function') {
    return res.status(503).json({ error: 'admin_auth_not_initialized' });
  }
  const token = req.headers['x-admin-token'];
  const session = await adminAuthRouter.verifyOAuthToken(token);
  if (!session) return res.status(401).json({ error: 'invalid_session' });
  // super_admin + 본인 이메일만
  if (session.role !== 'super_admin' || (session.email || '').toLowerCase() !== DEMO_HOST_EMAIL) {
    return res.status(403).json({ error: 'forbidden' });
  }
  const kind = String(req.query.kind || (req.body && req.body.kind) || '').toLowerCase();
  if (!VALID_KINDS[kind]) return res.status(400).json({ error: 'invalid_kind' });
  const { token: grant, exp } = makeGrant(kind);
  const target_url = `${APP_ORIGIN}${VALID_KINDS[kind].path}#host_grant=${grant}`;
  res.json({ host_grant: grant, target_url, expires_at: new Date(exp).toISOString() });
});

// ── app.ntable.kr 측 — grant 사용 ───────────────────────────────────────
// POST /api/demo/redeem-host-grant   body: { host_grant }
router.post('/demo/redeem-host-grant', async (req, res) => {
  const grant = req.body && req.body.host_grant;
  const payload = verifyGrant(grant);
  if (!payload) return res.status(401).json({ error: 'invalid_or_expired_grant' });
  usedNonces.set(payload.nonce, payload.exp);
  const roomCode = VALID_KINDS[payload.kind].code;
  try {
    const r = await pool.query(
      `SELECT room_code FROM rooms WHERE room_code = $1 AND demo_kind = $2`,
      [roomCode, payload.kind]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'demo_room_not_seeded' });
    res.json({
      ok: true,
      kind: payload.kind,
      room_code: r.rows[0].room_code,
      host_uuid: DEMO_HOST_UUID,
      host_nickname: DEMO_HOST_NICKNAME,
    });
  } catch (err) {
    try { Sentry.captureException(err, { extra: { route: '/demo/redeem-host-grant' } }); } catch {}
    res.status(500).json({ error: 'db' });
  }
});

// ── 호스트 takeover toggle ─────────────────────────────────────────────
// host_active = true 이면 demo-ticker 가 sweep 스킵 → 호스트가 페이싱.
// false 면 자동 진행 재개. host.html 진입 시 true, 나갈 때 false.
// POST /api/demo/set-host-active   body: { kind, active, uuid }
router.post('/demo/set-host-active', async (req, res) => {
  const body = req.body || {};
  const kind = String(body.kind || '').toLowerCase();
  const active = body.active === true;
  const callerUuid = body.uuid || req.headers['x-user-uuid'];
  if (!VALID_KINDS[kind]) return res.status(400).json({ error: 'invalid_kind' });
  if (callerUuid !== DEMO_HOST_UUID) return res.status(403).json({ error: 'not_demo_host' });
  const roomCode = VALID_KINDS[kind].code;
  try {
    // host_active=true 일 때 host_active_at=NOW() 같이 박아서 ticker 가 timeout 판정.
    // host_active=false 면 host_active_at=null 로 리셋.
    const r = await pool.query(
      `UPDATE room_state
          SET state_json = jsonb_set(
                jsonb_set(COALESCE(state_json,'{}'::jsonb), '{host_active}', $1::jsonb, true),
                '{host_active_at}',
                CASE WHEN $1::jsonb = 'true'::jsonb THEN to_jsonb(NOW()::text) ELSE 'null'::jsonb END,
                true
              ),
              updated_at = NOW()
        WHERE room_id = (SELECT id FROM rooms WHERE room_code = $2 AND demo_kind = $3)
        RETURNING state_json`,
      [JSON.stringify(active), roomCode, kind]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'room_not_found' });
    res.json({ ok: true, state: r.rows[0].state_json });
  } catch (err) {
    try { Sentry.captureException(err, { extra: { route: '/demo/set-host-active' } }); } catch {}
    res.status(500).json({ error: 'db' });
  }
});

// ── 데모방 메타 조회 ───────────────────────────────────────────────────
// GET /api/rooms/demo?kind=ai|ntable
// → 데모방 room_code · title · pack_id · 현재 cycle/question_index 반환
router.get('/rooms/demo', async (req, res) => {
  const kind = String(req.query.kind || '').toLowerCase();
  if (!VALID_KINDS[kind]) return res.status(400).json({ error: 'invalid_kind' });
  const roomCode = VALID_KINDS[kind].code;
  try {
    const r = await pool.query(
      `SELECT r.room_code, r.title, r.pack_id, r.demo_kind, r.questions_json,
              rs.state_json
         FROM rooms r
         LEFT JOIN room_state rs ON rs.room_id = r.id
        WHERE r.room_code = $1 AND r.demo_kind = $2`,
      [roomCode, kind]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'not_seeded' });
    res.json(r.rows[0]);
  } catch (err) {
    try { Sentry.captureException(err, { extra: { route: '/rooms/demo' } }); } catch {}
    res.status(500).json({ error: 'db' });
  }
});

module.exports = router;

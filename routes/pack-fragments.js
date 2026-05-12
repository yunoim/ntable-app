// /pack/:id/:phase fragment route (2026-05-12 모듈화 Phase 2 POC).
// 클라이언트 ntPackFragment.load() 가 호출.
// fragment 파일 경로: public/packs/{pack_id}/{phase}.html → 없으면 public/packs/_default/{phase}.html → 없으면 204.
// pack_id / phase 는 safe whitelist 강제 (디렉토리 traversal 차단).
//
// 응답:
//   200 text/html  — fragment 내용
//   204 No Content — fragment 없음 (정상 skip — 클라이언트 silent fallback)
//   400            — phase / pack_id 부적합
const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();

const PACKS_ROOT = path.join(__dirname, '..', 'public', 'packs');
const ALLOWED_PHASES = ['intro', 'explore', 'free', 'ending'];
const PACK_ID_RE = /^[a-z0-9_-]{1,40}$/;

router.get('/pack/:id/:phase', (req, res) => {
  const { id, phase } = req.params;
  if (!ALLOWED_PHASES.includes(phase)) {
    return res.status(400).type('text/plain').send('invalid phase');
  }
  if (!PACK_ID_RE.test(id) && id !== '_default') {
    return res.status(400).type('text/plain').send('invalid pack_id');
  }
  const packFile = path.join(PACKS_ROOT, id, `${phase}.html`);
  const fallbackFile = path.join(PACKS_ROOT, '_default', `${phase}.html`);
  const target = fs.existsSync(packFile) ? packFile : (fs.existsSync(fallbackFile) ? fallbackFile : null);
  if (!target) {
    res.status(204).end();
    return;
  }
  // 캐싱: prod 5분, fragment 는 자주 안 바뀌므로 SWR 가능. 필요 시 worker 헤더 주입 패턴 활용.
  res.set('Cache-Control', 'public, max-age=300');
  res.sendFile(target);
});

module.exports = router;

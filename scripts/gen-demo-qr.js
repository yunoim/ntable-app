#!/usr/bin/env node
// scripts/gen-demo-qr.js
//
// 영구 데모방 QR 생성. /demo · /ai 두 URL 을 PNG(1024×1024) + SVG 로 출력.
//   - public/qr-demo.png · public/qr-demo.svg  → https://app.ntable.kr/demo
//   - public/qr-ai.png   · public/qr-ai.svg    → https://app.ntable.kr/ai
//
// EC level H (30% 복원 — 중앙 로고 삽입 여유). 색상: ntable navy on white.
// 로고 삽입은 v1 에선 미적용 (qrcode 패키지 단독으론 미지원, canvas 의존 추가 부담).
// 필요 시 v2 에서 sharp/canvas 로 후처리 가능.
//
// 사용: npm run gen:demo-qr

const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');

const PUBLIC_ORIGIN = process.env.PUBLIC_ORIGIN || 'https://app.ntable.kr';
const OUT_DIR = path.join(__dirname, '..', 'public');

const TARGETS = [
  { name: 'demo', url: `${PUBLIC_ORIGIN}/demo`, label: 'ntable 5분 체험' },
  { name: 'ai',   url: `${PUBLIC_ORIGIN}/ai`,   label: 'AI 라이브 체험' },
];

async function gen(target) {
  const pngPath = path.join(OUT_DIR, `qr-${target.name}.png`);
  const svgPath = path.join(OUT_DIR, `qr-${target.name}.svg`);

  await QRCode.toFile(pngPath, target.url, {
    type: 'png',
    width: 1024,
    margin: 2,
    errorCorrectionLevel: 'H',
    color: { dark: '#0a0f1e', light: '#FFFFFFFF' },
  });

  const svg = await QRCode.toString(target.url, {
    type: 'svg',
    margin: 2,
    errorCorrectionLevel: 'H',
    color: { dark: '#0a0f1e', light: '#FFFFFFFF' },
  });
  fs.writeFileSync(svgPath, svg, 'utf-8');

  console.log(`[gen-demo-qr] ✓ ${target.name} (${target.label})`);
  console.log(`    → ${target.url}`);
  console.log(`    PNG: ${pngPath}`);
  console.log(`    SVG: ${svgPath}`);
}

async function main() {
  if (!fs.existsSync(OUT_DIR)) {
    throw new Error('public dir not found: ' + OUT_DIR);
  }
  console.log(`[gen-demo-qr] PUBLIC_ORIGIN=${PUBLIC_ORIGIN}`);
  for (const t of TARGETS) await gen(t);
  console.log('[gen-demo-qr] done');
}

main().catch(err => {
  console.error('[gen-demo-qr] FAILED', err);
  process.exit(1);
});

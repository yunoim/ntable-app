# ntable-app

소셜 모임 퍼실리테이션 SaaS (오프라인·온라인·하이브리드). 모임장이 할 일(아이스브레이킹·대화 유도·결과 정리)을 앱이 대신 수행.

- 배포: Railway (GitHub push → 자동)
- 도메인: https://app.ntable.kr
- 랜딩: https://ntable.kr (별도 레포 `ntable-landing`)
- 스택: Node.js · Express · PostgreSQL · WebSocket

## 브랜드 가이드

ntable 의 공식 태그라인·톤앤매너·표기 규칙은 [`docs/brand/ntable-brand-guide.md`](docs/brand/ntable-brand-guide.md) 에서 관리됨. 원본은 Notion.

- 랜딩·앱 화면 카피 작성 시 참조
- 노션 진행 보고·릴리스 노트 작성 시 톤 기준
- 신규 기능 마이크로카피 설계 시 예시 활용

카피 상수는 [`docs/brand/brand.json`](docs/brand/brand.json) 에 구조화 저장 (tagline · cta · error_copy · series · tone). 런타임 로드용이 아니라 하드코딩 시 기준값 참조용.

## 프로젝트 문서

- [`CLAUDE.md`](CLAUDE.md) — Claude Code 에이전트용 규칙·DB 스키마·WS 이벤트
- [`docs/brand/ntable-brand-guide.md`](docs/brand/ntable-brand-guide.md) — 브랜드 자산 (태그라인·톤·시리즈 구조)

## 영구 데모방 운영

`feat/demo-room` 이후 두 종류의 **영구 데모방** 이 운영됨. 발표·영업·블로그·강의 도입부에 동일 QR/URL 재사용.

| URL | room_code | 용도 | 진행 모드 |
|---|---|---|---|
| `https://app.ntable.kr/demo` | `DEMONT` | ntable 5분 체험 (홍보) | 글로벌 클록 자동 진행 (75초/문항, 5문항 사이클) |
| `https://app.ntable.kr/ai`   | `DEMOAI` | AI 강의 도입부 (라이브) | 호스트(닉)가 핸드폰으로 직접 페이싱 |

### 시드 + QR

```bash
# 1) DB 시드 (idempotent — 반복 실행 안전)
npm run seed:demo

# 2) QR 이미지 생성 → public/qr-demo.{png,svg} · public/qr-ai.{png,svg}
npm run gen:demo-qr
```

### 호스트 진입

`admin.ntable.kr/admin` 로그인 (Google OAuth, `admin_users` super_admin) → 대시보드 상단 **[🤖 AI 강의 데모 호스트로 진입]** 또는 **[🍽 ntable 홍보 데모 takeover]** 클릭. 60초 1회용 HMAC grant 발급 → `app.ntable.kr/{ai,demo}/host` 로 자동 이동 → `host.html` 진입.

- `set-host-active` → `room_state.host_active=true` 토글 시 자동진행 ticker 일시정지.
- 호스트가 30분 이상 활동 없으면 자동으로 host_active 풀리고 ticker 재개 (env: `DEMO_HOST_ACTIVE_TIMEOUT_SEC`).

### 환경변수

| 키 | 기본값 | 설명 |
|---|---|---|
| `DEMO_HOST_EMAIL` | `skb.yunho.im@gmail.com` | super_admin 메일 검증 (grant 발급 자격) |
| `DEMO_HOST_UUID` | `demo-host-001` | 데모 호스트 식별자 (시드·redeem 양쪽 일치 필요) |
| `DEMO_HOST_NICKNAME` | `닉` | 호스트 화면 표시 이름 |
| `APP_ORIGIN` | `https://app.ntable.kr` | grant target_url 베이스 |
| `DEMO_TICK_INTERVAL_MS` | `5000` | ticker sweep 주기 |
| `DEMO_EXPLORE_SECONDS` | `75` | 문항당 자동 진행 시간 |
| `DEMO_CLOSING_SECONDS` | `10` | 사이클 결과 표시 시간 |
| `DEMO_HOST_ACTIVE_TIMEOUT_SEC` | `1800` | 호스트 idle timeout (자동 ticker 재개) |
| `DEMO_TICKER_ENABLED` | `1` | `0` 으로 ticker 비활성화 |

### 데이터 모델

- `rooms.demo_kind` (`NULL` / `'ai'` / `'ntable'`) — 데모방 분기 단일 컬럼.
- `member_results.cycle_id` (default 0) — UNIQUE `(uuid, room_id, cycle_id)`. 24시간 사이클 반복 시에도 결과 영구 보존. 일반 방은 cycle_id=0 으로 zero regression.
- `room_state.state_json` 데모 필드: `demo_cycle_id` · `demo_question_index` · `demo_tick_started_at` · `host_active` · `host_active_at`.
- 만료 cron 회피: 시드 시 `meeting_at=NULL` · `status='open'` 영구 유지. retention cron 은 `demo_kind IS NULL` 가드.

### 정책 (PACK_DEFAULTS)

두 데모 팩 모두 `mvp_enabled=false`, `match_pairs_enabled=false`, `insta_exchange_enabled=false`, `skip_free_chat=true`. 동료끼리 매칭·인스타 교환 거부감 + 무인 노출 위험 차단. wizard 는 닉네임 + 이모지만 (10초 온보딩).

# ntable-app — 태스크 관리

> 배치 단위로 묶인 태스크 목록. 각 태스크는 독립 커밋 + main 직접 push.
> 완료된 배치 1~3 은 `git log --oneline --grep="T-[0-9]"` 로 역조회.

---

## BATCH 4 — Microcopy & UX Polish

**목표**: `brand.json` v1.2.0 을 런타임 로드해 전 페이지 카피를 치환. 하드코딩 제거 → 브랜드 가이드 단일 소스화 완성.

**선행조건 (완료)**:
- `brand.json` v1.2.0 (5 블록 신설: `buttons`·`wizard`·`empty_states`·`toasts`·`series.*.examples`) — 커밋 `847c025`
- `docs/brand/ntable-brand-guide.md` §8 v1.2.0 확장 테이블
- Notion 원본(`349eff09-d942-8155-bcba-c3cc83dd9a2e`) 동기화

**공통 제약**:
- `brand.json` 절대 수정 금지 (세션1 에서 확정)
- 작업 브랜치 생성 금지, `main` 직접 push
- PR 생성 금지
- 각 태스크 개별 커밋. 커밋 prefix: `feat(T-NN):` · `copy(T-NN):` · `refactor(T-NN):` 적절히
- 신규 CSS 클래스 최소화, 기존 `components.css` 디자인 토큰 재사용

---

### T-18 · 런타임 로더 구현 · `feat(T-18)`

**작업**:
- `public/js/brand.js` 신규. export: `loadBrand()`, `t(path, vars)`
- `t()` 는 점 경로 지원 (`"wizard.nickname.q"`), `{변수}` 템플릿 치환 지원
- 캐시: 첫 호출만 fetch, 이후 메모리 재사용
- `brand.json` 이 `public/` 아래에 있어 `/brand.json` 으로 접근 가능한지 확인. 없으면 `public/brand.json` 으로 복사 또는 서버 라우트 추가

**검증**:
- 브라우저 콘솔에서 `await loadBrand()` → 객체 반환 확인
- `t("buttons.open_room")` → `"모임 열기"` 반환
- `t("toasts.welcome_guest", {nick: "테스트"})` → `"테스트 님, 환영해요 🎉"` 반환

---

### T-19 · 위저드 라벨·헬퍼 치환 (join.html) · `copy(T-19)`

**작업**:
- 7개 필드(nickname/birth_year/industry/mbti/instagram/interest/region) 모두 `data-copy="wizard.{field}.q"` 로 라벨
- 헬퍼 `<small class="helper">` 없으면 추가, `data-copy="wizard.{field}.helper"` 연결
- placeholder 치환 필드: nickname, instagram (wizard 에 placeholder 정의된 필드만)

**검증**:
- `join.html` DOM 에서 모든 필드 라벨이 `brand.json` 의 `wizard.{field}.q` 와 일치
- 헬퍼 텍스트 모두 렌더링됨

---

### T-20 · 에러·토스트 전면 정비 · `copy(T-20)`

**작업**:
- `error_copy.*` 하드코딩 문자열 전부 `t()` 로 교체
- `toasts.*` 신규 도입 지점:
  - 게스트 입장 성공 → `t("toasts.welcome_guest", {nick})`
  - 방 생성 완료 → `t("toasts.room_opened")`
  - 호스트 화면 멤버 입장 → `t("toasts.member_joined", {nick})`
  - share-card 생성/완료 → `t("toasts.image_preparing")` → `t("toasts.image_saved")`
  - WebSocket 재연결 → `t("toasts.ws_reconnecting")`
- `nickname_taken` 에러는 응답 payload 의 `nick` 을 변수로 렌더

**검증**:
- `grep -r "이미 사용 중인 닉네임" public/` → **0 건**
- 실제 재연결 시나리오에서 토스트 표시

---

### T-21 · 빈 상태 카피 · `feat(T-21)`

**작업**: `host.html`, `presenter.html`, `guest.html` 에서 아래 영역 식별 후 적용
- 참가자 0명 → `t("empty_states.no_members")`
- 채팅 0개 → `t("empty_states.no_messages")`
- 투표 진행 중 0표 → `t("empty_states.no_votes")`
- 매칭 0건 → `t("empty_states.no_matches")`
- 다음 액티비티 대기 → `t("empty_states.waiting_host")`

**검증**:
- `host.html` 에 참가자 0명 상태 시 `"QR을 스캔하면..."` 메시지 표시

---

### T-22 · 킷 라벨 확장 (create.html) · `feat(T-22)`

**작업**:
- 5개 카드: icon + label (제목 1줄) + examples (3개 칩)
- examples 는 작은 gray chip 형태로 카드 하단
- 칩 렌더 루프: `series[id].examples.forEach(ex => chip(ex))`

**검증**:
- `create.html` 5개 카드에 examples 칩 3개씩 렌더

---

### T-23 · 버튼 라벨 정비 · `copy(T-23)`

**작업**: `buttons.*` 적용
- login hero CTA → `buttons.open_room`
- join code 입력 후 → `buttons.join_code`
- 위저드 중간 → `buttons.wizard_next`
- 위저드 마지막 → `buttons.wizard_done`
- share-card → `buttons.share_result`, `buttons.save_image`
- 에러 재시도 → `buttons.retry`

**검증**:
- `login.html` 의 새 모임 버튼 라벨 = `"모임 열기"`
- 위저드 마지막 스텝 버튼 = `"모임에 들어가기"`

---

### 종료 포맷

모든 push 성공 후 커밋 해시 목록 + 각 태스크 상태(✓/✗) 만 보고. 사용자가 로컬 pull 후 실기기 테스트 예정.

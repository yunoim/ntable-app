// ntable 공통 '내 정보 기억' 플로팅 토글
// 로그인 상태(OAuth)와 무관하게 모든 주요 페이지(create/join/host/guest/result/insta-exchange/survey)에 주입.
// localStorage.login_remember 를 직접 토글 — true 면 닉네임·프로필을 localStorage 에 보관, false 면 세션마다 새로 입력.
// login.html 은 자체 토글이 있어 중복 주입 스킵. auth-header.js pill 과 동일 우상단이지만 분리된 컴포넌트.

(function () {
  if (document.getElementById('loginToggle')) return;           // login 페이지는 자체 토글 사용
  if (document.getElementById('ntRememberToggle')) return;      // 중복 방지

  const KEY = 'login_remember';
  const read = () => { try { return localStorage.getItem(KEY) === 'true'; } catch (_) { return false; } };
  const write = (v) => { try { localStorage.setItem(KEY, v ? 'true' : 'false'); } catch (_) {} };

  // 호스트 페이지처럼 전용 슬롯이 있으면 그 안에 인라인으로 배치 (더보기·방코드 사이).
  // 슬롯이 없으면 우상단 플로팅 (phase-bar 있으면 아래로).
  const hostSlot = document.getElementById('host-remember-slot');
  const hasPhaseBar = !!document.getElementById('phase-bar');

  const style = document.createElement('style');
  style.textContent = `
    .nt-remember-toggle {
      position: fixed;
      top: calc(${hasPhaseBar ? 76 : 10}px + env(safe-area-inset-top));
      right: max(14px, calc((100vw - 1100px) / 2 + 14px));
      z-index: 9998;
      display: inline-flex; align-items: center; gap: 8px;
      padding: 7px 12px 7px 10px;
      background: rgba(14,22,40,0.92);
      backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
      border: 1px solid rgba(212,168,67,0.35);
      border-radius: 999px;
      font-family: 'DM Sans','Noto Sans KR','Apple SD Gothic Neo',sans-serif;
      font-size: 11px;
      color: rgba(245,242,236,0.85);
      box-shadow: 0 2px 8px rgba(0,0,0,0.22);
      cursor: pointer;
      user-select: none;
      letter-spacing: 0.02em;
      transition: border-color 0.18s;
    }
    .nt-remember-toggle.nt-rt-inline {
      position: static;
      top: auto; right: auto;
      padding: 5px 10px 5px 8px;
      font-size: 10.5px;
      box-shadow: none;
      background: rgba(14,22,40,0.55);
      border-color: rgba(212,168,67,0.3);
    }
    .nt-remember-toggle:hover { border-color: rgba(212,168,67,0.6); }
    .nt-rt-knob {
      display: inline-block;
      width: 26px; height: 14px;
      border-radius: 999px;
      background: rgba(255,255,255,0.18);
      position: relative;
      transition: background 0.18s;
      flex-shrink: 0;
    }
    .nt-rt-knob::after {
      content: '';
      position: absolute;
      top: 2px; left: 2px;
      width: 10px; height: 10px;
      border-radius: 50%;
      background: #fff;
      transition: transform 0.18s;
    }
    .nt-remember-toggle.on .nt-rt-knob { background: #7ee8a2; }
    .nt-remember-toggle.on .nt-rt-knob::after { transform: translateX(12px); }
    .nt-remember-toggle.on { color: #d5f5dd; }
    .nt-rt-label { white-space: nowrap; }
    @media (max-width: 360px) {
      .nt-remember-toggle { padding: 6px 10px 6px 8px; font-size: 10.5px; }
      .nt-rt-label { letter-spacing: 0; }
    }
  `;
  document.head.appendChild(style);

  const wrap = document.createElement('button');
  wrap.type = 'button';
  wrap.id = 'ntRememberToggle';
  wrap.className = hostSlot ? 'nt-remember-toggle nt-rt-inline' : 'nt-remember-toggle';
  wrap.setAttribute('role', 'switch');
  wrap.setAttribute('aria-label', '내 정보 기억하기');
  // 인라인 모드(호스트 상단)는 공간 좁으니 라벨 생략
  wrap.innerHTML = hostSlot
    ? `<span class="nt-rt-knob" aria-hidden="true"></span><span class="nt-rt-label" style="font-size:10px;">기억</span>`
    : `<span class="nt-rt-knob" aria-hidden="true"></span><span class="nt-rt-label">내 정보 기억</span>`;
  const apply = () => {
    const on = read();
    wrap.classList.toggle('on', on);
    wrap.setAttribute('aria-checked', on ? 'true' : 'false');
    wrap.title = on ? '내 정보 기억하기 ON — 닉·프로필을 이 기기에 보관' : '내 정보 기억하기 OFF — 세션마다 새로 입력';
  };
  wrap.addEventListener('click', () => {
    write(!read());
    apply();
  });
  apply();
  // DOM 준비 후 주입 — hostSlot 있으면 그 안, 없으면 body 우상단 플로팅
  const mount = () => {
    const target = hostSlot || document.body;
    if (target) target.appendChild(wrap);
  };
  if (document.body) mount();
  else document.addEventListener('DOMContentLoaded', mount);
})();

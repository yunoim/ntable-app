/**
 * Samsung Internet 웹사이트 다크 모드 경고 배너
 *
 * 삼성인터넷의 "웹사이트 다크 모드" 기능이 OS 다크모드를 따라갈 때,
 * 우리가 선언한 color-scheme: only dark 를 무시하고 페이지에 색상 반전 필터를 씌움.
 * 결과: 노란색(#e8b84b, #d4a843) 계열이 빨간색/분홍 계열로 hue-shift 됨.
 *
 * 브라우저 렌더링 레이어 단의 문제라 CSS로 100% 차단 불가.
 * 사용자가 삼성인터넷 설정에서 해당 옵션을 끄는 것 외에 해결 방법이 없어서,
 * 삼성인터넷 + 의심 신호 감지 시 1회성(영구 dismiss 가능) 배너로 안내.
 */
(function () {
  'use strict';

  const UA = navigator.userAgent || '';
  const isSamsung = /SamsungBrowser/i.test(UA);
  if (!isSamsung) return;

  const DISMISS_KEY = 'ntable_samsung_dark_warn_dismissed';
  try {
    if (localStorage.getItem(DISMISS_KEY) === '1') return;
  } catch (_) {}

  function mount() {
    if (document.getElementById('ntable-samsung-dark-warn')) return;

    const banner = document.createElement('div');
    banner.id = 'ntable-samsung-dark-warn';
    banner.setAttribute('role', 'note');
    banner.style.cssText = [
      'position:fixed',
      'left:0',
      'right:0',
      'bottom:0',
      'z-index:99999',
      'padding:12px 14px',
      'padding-bottom:calc(12px + env(safe-area-inset-bottom))',
      'background:#1a1208',
      'border-top:1px solid rgba(232,184,75,0.45)',
      'color:#f5d98a',
      'font-family:inherit',
      'font-size:12.5px',
      'line-height:1.55',
      'letter-spacing:0.01em',
      'box-shadow:0 -8px 24px rgba(0,0,0,0.35)',
      'display:flex',
      'gap:10px',
      'align-items:flex-start',
    ].join(';');

    const msg = document.createElement('div');
    msg.style.flex = '1';
    msg.style.minWidth = '0';
    msg.innerHTML =
      '<strong style="color:#f0ca60;font-weight:700;">색상이 이상하게 보이시나요?</strong><br>' +
      '삼성인터넷 <b>설정 → 보기 → 다크 모드 → 끄기</b> 로 바꾸면 정상적으로 보여요. ' +
      '(OS 다크모드와는 별개 옵션)';

    const close = document.createElement('button');
    close.type = 'button';
    close.setAttribute('aria-label', '안내 닫기');
    close.textContent = '×';
    close.style.cssText = [
      'flex-shrink:0',
      'width:28px',
      'height:28px',
      'background:transparent',
      'border:1px solid rgba(232,184,75,0.35)',
      'border-radius:50%',
      'color:#f0ca60',
      'font-size:18px',
      'line-height:1',
      'cursor:pointer',
      'font-family:inherit',
      'padding:0',
    ].join(';');
    close.addEventListener('click', () => {
      try {
        localStorage.setItem(DISMISS_KEY, '1');
      } catch (_) {}
      banner.remove();
    });

    banner.appendChild(msg);
    banner.appendChild(close);
    document.body.appendChild(banner);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
})();

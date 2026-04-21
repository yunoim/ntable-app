// twemoji-brand.js — T-13 (2026-04-22)
// 브랜드 핵심 위치에만 Twemoji SVG 적용 — OS별 이모지 렌더 차이로 인한 브랜드 일관성 저하 방지.
// 사용법: 대상 요소에 `data-twe` 속성 추가 → 자동 파싱 + 동적 콘텐츠 MutationObserver 로 재파싱.
// 동적 JS 렌더 후 수동 훅: `window.twBrandParse(el)`.
// 본문·채팅·게스트 입력 이모지는 OS 기본 유지 (페이로드 절감).

(function () {
  var CDN = 'https://cdn.jsdelivr.net/npm/twemoji@14.0.2/dist/twemoji.min.js';
  var OPTS = {
    folder: 'svg',
    ext: '.svg',
    base: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/',
    className: 'tw-emoji'
  };

  var style = document.createElement('style');
  style.textContent = 'img.tw-emoji{height:1em;width:1em;margin:0 .05em;vertical-align:-0.12em;display:inline-block}';
  document.head.appendChild(style);

  function parseEl(el) {
    if (!window.twemoji || !el) return;
    try { window.twemoji.parse(el, OPTS); } catch (_) {}
  }

  function parseAll() {
    if (!window.twemoji) return;
    var targets = document.querySelectorAll('[data-twe]');
    for (var i = 0; i < targets.length; i++) parseEl(targets[i]);
  }

  window.twBrandParse = parseEl;

  // 동적 콘텐츠 대응 — data-twe 자손 mutation 감지 후 디바운스 재파싱
  var pending = new Set();
  var scheduler = null;
  function schedule(el) {
    pending.add(el);
    if (scheduler) return;
    scheduler = setTimeout(function () {
      scheduler = null;
      pending.forEach(parseEl);
      pending.clear();
    }, 20);
  }

  function isOwnMutation(m) {
    if (m.type !== 'childList') return false;
    for (var i = 0; i < m.addedNodes.length; i++) {
      var n = m.addedNodes[i];
      if (n.nodeType === 1 && n.classList && n.classList.contains('tw-emoji')) continue;
      return false;
    }
    return m.addedNodes.length > 0;
  }

  function startObserver() {
    var observer = new MutationObserver(function (muts) {
      if (!window.twemoji) return;
      for (var i = 0; i < muts.length; i++) {
        var m = muts[i];
        if (isOwnMutation(m)) continue;
        var t = m.target;
        while (t && t !== document.body && t.nodeType === 1) {
          if (t.hasAttribute && t.hasAttribute('data-twe')) {
            schedule(t);
            break;
          }
          t = t.parentNode;
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  function load() {
    var s = document.createElement('script');
    s.src = CDN;
    s.async = true;
    s.onload = function () {
      parseAll();
      startObserver();
    };
    s.onerror = function () {
      console.warn('[twemoji-brand] CDN load failed — falling back to OS emojis');
    };
    document.head.appendChild(s);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', load);
  } else {
    load();
  }
})();

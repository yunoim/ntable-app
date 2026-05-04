// pg 에러를 구조화 로깅 + Sentry 캡처 + 정규화 500 응답으로 통합.
// 모든 라우트의 generic-500 catch에서 공유.
//
// 사용:
//   const { logDbError } = require('./_db-errors');
//   try { ... } catch (err) {
//     logDbError(res, 'POST /api/foo', err, { uuid, room_code });
//   }
//
// 주의: 에러 서브타입 분기(예: `if (err.code === '23505')`)가 있으면
// 그 분기를 먼저 유지하고, 일반 500 leg에서만 호출할 것.

const Sentry = require('@sentry/node');

// 로깅 + Sentry 캡처만 — 응답은 호출 측에서 결정.
// 라우트가 기존 클라이언트 호환 응답 포맷(예: 'INTERNAL_ERROR')을 유지해야 할 때 사용.
function captureDbError(label, err, ctx) {
  const pgFields = {
    code: err && err.code,
    detail: err && err.detail,
    constraint: err && err.constraint,
    routine: err && err.routine,
    table: err && err.table,
    message: err && err.message,
  };
  console.error(`[${label}] db error:`, pgFields, 'ctx:', ctx);
  try {
    Sentry.captureException(err, { extra: { route: label, ...pgFields, ctx } });
  } catch (_) {}
  return pgFields;
}

// 로깅 + Sentry + 정규화 500 응답 (`{ error: 'db error', code: <SQLSTATE> }`).
// 신규/관측 우선 라우트의 generic-500 catch 표준.
function logDbError(res, label, err, ctx) {
  const pgFields = captureDbError(label, err, ctx);
  if (!res.headersSent) {
    res.status(500).json({ error: 'db error', code: pgFields.code || null });
  }
}

module.exports = { captureDbError, logDbError };

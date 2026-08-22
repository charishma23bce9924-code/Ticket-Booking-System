/**
 * Wraps an async Express route handler so any thrown error / rejected
 * promise is forwarded to next(err) instead of becoming an unhandled
 * rejection that crashes the whole Node process. Apply this to every
 * route handler, even ones that already have their own try/catch, as a
 * safety net for anything the try/catch didn't anticipate (e.g. a Prisma
 * validation error from a schema/query mismatch).
 */
function asyncHandler(fn) {
  return function (req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = asyncHandler;

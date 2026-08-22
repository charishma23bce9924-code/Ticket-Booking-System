const { verifyToken } = require('../utils/auth');

function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }
  const token = header.split(' ')[1];
  try {
    const decoded = verifyToken(token);
    req.user = decoded; // { id, role, email, name }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden: insufficient role' });
    }
    next();
  };
}

// Optional auth: attaches req.user if token present, but doesn't fail if absent
function optionalAuth(req, res, next) {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    try {
      req.user = verifyToken(header.split(' ')[1]);
    } catch (err) {
      // ignore invalid token for optional auth
    }
  }
  next();
}

module.exports = { requireAuth, requireRole, optionalAuth };

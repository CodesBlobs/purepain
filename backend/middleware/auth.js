const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'purepain-dev-secret-change-in-prod';

function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    req.user = jwt.verify(header.slice(7), JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

function requireParent(req, res, next) {
  if (req.user.account_type !== 'parent') {
    return res.status(403).json({ error: 'Parent account required' });
  }
  next();
}

function requireStudent(req, res, next) {
  if (req.user.account_type !== 'student') {
    return res.status(403).json({ error: 'Student account required' });
  }
  next();
}

module.exports = { requireAuth, requireParent, requireStudent, JWT_SECRET };

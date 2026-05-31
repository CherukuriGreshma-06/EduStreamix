const jwt = require('jsonwebtoken');

function envValue(...names) {
  for (const name of names) {
    const value = process.env[name];

    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return '';
}

function getAuthConfig() {
  return {
    cookieName: envValue('AUTH_COOKIE_NAME') || 'session_token',
    jwtSecret: envValue('JWT_SECRET', 'ACCESS_TOKEN_SECRET'),
  };
}

function wantsJson(req) {
  return req.xhr || req.path.startsWith('/api') || req.accepts(['html', 'json']) === 'json';
}

function authMiddleware(req, res, next) {
  const config = getAuthConfig();
  const token = req.cookies?.[config.cookieName];

  if (!token || !config.jwtSecret) {
    if (wantsJson(req)) {
      return res.status(401).json({ error: 'Payment required' });
    }

    return res.redirect('/payment');
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret);

    if (decoded.access !== true) {
      throw new Error('Payment token does not grant access');
    }

    req.user = decoded;
    return next();
  } catch (error) {
    res.clearCookie(config.cookieName);

    if (wantsJson(req)) {
      return res.status(401).json({ error: 'Payment required' });
    }

    return res.redirect('/payment');
  }
}

module.exports = authMiddleware;

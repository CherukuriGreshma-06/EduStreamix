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

    return res.status(402).render('payment', {
      amount: Number(envValue('PAYMENT_AMOUNT_INR', 'RAZORPAY_AMOUNT') || 1),
      currency: envValue('PAYMENT_CURRENCY') || 'INR',
    });
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret);

    if (!decoded.paid) {
      throw new Error('Payment token is not marked as paid');
    }

    req.user = decoded;
    return next();
  } catch (error) {
    res.clearCookie(config.cookieName);

    if (wantsJson(req)) {
      return res.status(401).json({ error: 'Payment required' });
    }

    return res.status(402).render('payment', {
      amount: Number(envValue('PAYMENT_AMOUNT_INR', 'RAZORPAY_AMOUNT') || 1),
      currency: envValue('PAYMENT_CURRENCY') || 'INR',
    });
  }
}

module.exports = authMiddleware;

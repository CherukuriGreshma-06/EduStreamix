const crypto = require('crypto');
const express = require('express');
const jwt = require('jsonwebtoken');
const Razorpay = require('razorpay');

const router = express.Router();

function envValue(...names) {
  for (const name of names) {
    const value = process.env[name];

    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return '';
}

function getPaymentConfig() {
  const amountInRupees = Number(envValue('PAYMENT_AMOUNT_INR', 'RAZORPAY_AMOUNT') || 10);
  const safeAmount = Number.isFinite(amountInRupees) && amountInRupees > 0 ? amountInRupees : 10;

  return {
    keyId: envValue('RAZORPAY_KEY_ID', 'RAZORPAY_KEY'),
    keySecret: envValue('RAZORPAY_KEY_SECRET', 'RAZORPAY_SECRET'),
    jwtSecret: envValue('JWT_SECRET', 'ACCESS_TOKEN_SECRET'),
    currency: envValue('PAYMENT_CURRENCY') || 'INR',
    amountInRupees: safeAmount,
    amountInPaise: Math.round(safeAmount * 100),
    cookieName: envValue('AUTH_COOKIE_NAME') || 'session_token',
    allowQrSimulation: envValue('ALLOW_QR_PAYMENT_SIMULATION') === 'true',
  };
}

function getRazorpayClient(config) {
  if (!config.keyId || !config.keySecret) {
    const error = new Error('Payment is not configured. Add Razorpay keys in .env and restart the server.');
    error.statusCode = 503;
    throw error;
  }

  return new Razorpay({
    key_id: config.keyId,
    key_secret: config.keySecret,
  });
}

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000,
  };
}

function hasValidAccessToken(req, config) {
  const token = req.cookies?.[config.cookieName];

  if (!token || !config.jwtSecret) {
    return false;
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    return decoded?.access === true;
  } catch (_) {
    return false;
  }
}

function issueAccessToken(res, config, extraPayload = {}) {
  if (!config.jwtSecret) {
    const error = new Error('JWT_SECRET is not configured');
    error.statusCode = 500;
    throw error;
  }

  const token = jwt.sign(
    {
      user: 'paid_user',
      access: true,
      ...extraPayload,
    },
    config.jwtSecret,
    { expiresIn: '30d' }
  );

  res.cookie(config.cookieName, token, cookieOptions());
}

function verifyRazorpayPayment(config, paymentDetails) {
  const {
    razorpay_order_id: orderId,
    razorpay_payment_id: paymentId,
    razorpay_signature: signature,
  } = paymentDetails || {};

  if (!orderId || !paymentId || !signature) {
    const error = new Error('Missing payment details');
    error.statusCode = 400;
    throw error;
  }

  if (!config.keySecret) {
    const error = new Error('Payment verification is not configured');
    error.statusCode = 500;
    throw error;
  }

  const expectedSignature = crypto
    .createHmac('sha256', config.keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');

  if (expectedSignature !== signature) {
    const error = new Error('Invalid payment signature');
    error.statusCode = 400;
    throw error;
  }

  return { orderId, paymentId };
}

function completePayment(req, res) {
  const config = getPaymentConfig();

  try {
    const payment = req.body?.qrPayment === true && config.allowQrSimulation
      ? { orderId: `qr_${Date.now()}`, paymentId: `simulated_${Date.now()}` }
      : verifyRazorpayPayment(config, req.body);

    issueAccessToken(res, config, {
      paymentId: payment.paymentId,
      orderId: payment.orderId,
    });

    return res.json({ success: true, redirectUrl: '/landing' });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      error: error.message || 'Unable to complete payment',
    });
  }
}

router.get('/', (req, res) => {
  const config = getPaymentConfig();

  if (hasValidAccessToken(req, config)) {
    return res.redirect('/landing');
  }

  res.render('payment', {
    amount: config.amountInRupees,
    currency: config.currency,
  });
});

router.post('/create-order', async (req, res) => {
  try {
    const config = getPaymentConfig();

    if (hasValidAccessToken(req, config)) {
      return res.json({ redirectUrl: '/landing' });
    }

    const razorpay = getRazorpayClient(config);

    const order = await razorpay.orders.create({
      amount: config.amountInPaise,
      currency: config.currency,
      receipt: `edustreamix_${Date.now()}`,
      notes: {
        product: 'EduStreamix site access',
      },
    });

    return res.json({
      key: config.keyId,
      amount: order.amount,
      currency: order.currency,
      orderId: order.id,
      displayAmount: config.amountInRupees,
    });
  } catch (error) {
    const statusCode = error.statusCode || error.status || 502;
    const message = error.error?.description || error.message || 'Unable to create payment order';

    console.error('Razorpay order creation failed:', message);
    return res.status(statusCode).json({ error: message });
  }
});

router.post('/success', completePayment);
router.post('/verify-payment', completePayment);

module.exports = router;

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
  const amountInRupees = Number(envValue('PAYMENT_AMOUNT_INR', 'RAZORPAY_AMOUNT') || 1);
  const safeAmount = Number.isFinite(amountInRupees) && amountInRupees > 0 ? amountInRupees : 1;

  return {
    keyId: envValue('RAZORPAY_KEY_ID', 'RAZORPAY_KEY'),
    keySecret: envValue('RAZORPAY_KEY_SECRET', 'RAZORPAY_SECRET'),
    jwtSecret: envValue('JWT_SECRET', 'ACCESS_TOKEN_SECRET'),
    currency: envValue('PAYMENT_CURRENCY') || 'INR',
    amountInRupees: safeAmount,
    amountInPaise: Math.round(safeAmount * 100),
    cookieName: envValue('AUTH_COOKIE_NAME') || 'session_token',
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
    maxAge: 7 * 24 * 60 * 60 * 1000,
  };
}

router.get('/', (req, res) => {
  const config = getPaymentConfig();
  res.render('payment', {
    amount: config.amountInRupees,
    currency: config.currency,
  });
});

router.post('/create-order', async (req, res) => {
  try {
    const config = getPaymentConfig();
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

router.post('/verify-payment', (req, res) => {
  const config = getPaymentConfig();
  const {
    razorpay_order_id: orderId,
    razorpay_payment_id: paymentId,
    razorpay_signature: signature,
  } = req.body;

  if (!orderId || !paymentId || !signature) {
    return res.status(400).json({ success: false, error: 'Missing payment details' });
  }

  if (!config.keySecret || !config.jwtSecret) {
    return res.status(500).json({ success: false, error: 'Payment verification is not configured' });
  }

  const expectedSignature = crypto
    .createHmac('sha256', config.keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');

  if (expectedSignature !== signature) {
    return res.status(400).json({ success: false, error: 'Invalid payment signature' });
  }

  const token = jwt.sign(
    {
      paid: true,
      paymentId,
      orderId,
    },
    config.jwtSecret,
    { expiresIn: '7d' }
  );

  res.cookie(config.cookieName, token, cookieOptions());
  return res.json({ success: true, redirectUrl: '/' });
});

module.exports = router;

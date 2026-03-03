const express = require('express');
const router = express.Router();
const Stripe = require('stripe');
const { poolPromise, sql } = require('../../config/db');
const { protect, restrictTo } = require('../../middleware/auth');
const { audit } = require('../../middleware/audit');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-06-20',
});

// Both superadmin and admin can manage billing.
// Admin is restricted to their own school_id (from JWT), superadmin can specify any.
const billingAuth = [protect, restrictTo('superadmin', 'admin')];

// For admin requests, resolve school_id from their JWT if not provided in body
const resolveSchoolId = (req) => {
  if (req.user.role === 'admin') return req.user.school_id;
  return req.body.school_id;
};

router.post('/create-customer', ...billingAuth, audit('create_customer', 'school'), async (req, res) => {
  const school_id = resolveSchoolId(req);
  const { email, name } = req.body;
  if (!school_id) return res.status(400).json({ message: 'school_id is required' });
  try {
    const pool = await poolPromise;

    const existing = await pool.request()
      .input('school_id', sql.Int, school_id)
      .query('SELECT stripe_customer_id FROM stripe_customers WHERE school_id = @school_id');

    if (existing.recordset.length) {
      return res.json({ customerId: existing.recordset[0].stripe_customer_id });
    }

    const customer = await stripe.customers.create({
      email,
      name,
      metadata: { school_id: String(school_id) },
    });

    await pool.request()
      .input('school_id', sql.Int, school_id)
      .input('stripe_customer_id', sql.VarChar(100), customer.id)
      .query(`
        INSERT INTO stripe_customers (school_id, stripe_customer_id)
        VALUES (@school_id, @stripe_customer_id)
      `);

    res.json({ customerId: customer.id });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/create-subscription', ...billingAuth, audit('create_subscription', 'school'), async (req, res) => {
  const school_id = resolveSchoolId(req);
  const { price_id } = req.body;
  if (!school_id) return res.status(400).json({ message: 'school_id is required' });
  try {
    const pool = await poolPromise;
    const custRes = await pool.request()
      .input('school_id', sql.Int, school_id)
      .query('SELECT stripe_customer_id FROM stripe_customers WHERE school_id = @school_id');

    if (!custRes.recordset.length) {
      return res.status(400).json({ message: 'Stripe customer not found' });
    }

    const customerId = custRes.recordset[0].stripe_customer_id;
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: price_id }],
      payment_behavior: 'default_incomplete',
      expand: ['latest_invoice.payment_intent'],
    });

    await pool.request()
      .input('school_id', sql.Int, school_id)
      .input('stripe_subscription_id', sql.VarChar(100), subscription.id)
      .input('status', sql.VarChar(30), subscription.status)
      .input('current_period_start', sql.DateTime, new Date(subscription.current_period_start * 1000))
      .input('current_period_end', sql.DateTime, new Date(subscription.current_period_end * 1000))
      .query(`
        INSERT INTO subscriptions (school_id, stripe_subscription_id, status, current_period_start, current_period_end)
        VALUES (@school_id, @stripe_subscription_id, @status, @current_period_start, @current_period_end)
      `);

    res.json({
      subscriptionId: subscription.id,
      clientSecret: subscription.latest_invoice?.payment_intent?.client_secret || null,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/portal', ...billingAuth, audit('billing_portal', 'school'), async (req, res) => {
  const school_id = resolveSchoolId(req);
  const { return_url } = req.body;
  if (!school_id) return res.status(400).json({ message: 'school_id is required' });
  try {
    const pool = await poolPromise;
    const custRes = await pool.request()
      .input('school_id', sql.Int, school_id)
      .query('SELECT stripe_customer_id FROM stripe_customers WHERE school_id = @school_id');

    if (!custRes.recordset.length) {
      return res.status(400).json({ message: 'Stripe customer not found' });
    }

    const customerId = custRes.recordset[0].stripe_customer_id;
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: return_url || 'http://localhost:3000',
    });

    res.json({ url: session.url });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/webhook', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.rawBody || req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET || ''
    );
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    const pool = await poolPromise;
    if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.created') {
      const sub = event.data.object;
      await pool.request()
        .input('stripe_subscription_id', sql.VarChar(100), sub.id)
        .input('status', sql.VarChar(30), sub.status)
        .input('current_period_start', sql.DateTime, new Date(sub.current_period_start * 1000))
        .input('current_period_end', sql.DateTime, new Date(sub.current_period_end * 1000))
        .query(`
          UPDATE subscriptions
          SET status = @status,
              current_period_start = @current_period_start,
              current_period_end = @current_period_end,
              updated_at = GETDATE()
          WHERE stripe_subscription_id = @stripe_subscription_id
        `);
    }
    res.json({ received: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;

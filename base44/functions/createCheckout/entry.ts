import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import Stripe from 'npm:stripe@14.21.0';

Deno.serve(async (req) => {
  try {
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));
    const base44 = createClientFromRequest(req);
    const { price_id, success_url, cancel_url } = await req.json();

    // Try to get user email for prefill (optional — app is public)
    let customerEmail;
    try {
      const user = await base44.auth.me();
      if (user?.email) customerEmail = user.email;
    } catch (_) {}

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: price_id, quantity: 1 }],
      success_url: success_url || 'https://echo-dj-flow.base44.app/?premium=success',
      cancel_url: cancel_url || 'https://echo-dj-flow.base44.app/?premium=cancelled',
      ...(customerEmail ? { customer_email: customerEmail } : {}),
      metadata: {
        base44_app_id: Deno.env.get('BASE44_APP_ID'),
      },
    });

    return Response.json({ url: session.url });
  } catch (error) {
    console.error('Checkout error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
import { NextRequest, NextResponse } from "next/server";
import { getRazorpay, razorpayPlanIdFor } from "@/lib/razorpay";
import { auth } from "@/lib/auth";

/**
 * POST /api/billing/subscribe — create a Razorpay subscription for the
 * signed-in user's chosen plan. Mirrors CrawlMind's proven Razorpay flow.
 * Body: { plan: "HOBBY" | "PRO" | "ENTERPRISE" }
 * Returns Razorpay subscription id + the client key id for checkout.
 */
export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) {
    return NextResponse.json({ error: { code: "unauthorized", message: "Not signed in" } }, { status: 401 });
  }

  let plan = "PRO";
  try {
    const body = await req.json();
    if (typeof body.plan === "string") plan = body.plan;
  } catch {
    /* default PRO */
  }

  if (!["HOBBY", "PRO", "ENTERPRISE"].includes(plan)) {
    return NextResponse.json(
      { error: { code: "bad_request", message: "Valid plan required: HOBBY, PRO, ENTERPRISE" } },
      { status: 400 },
    );
  }

  const planId = razorpayPlanIdFor(plan);
  if (!planId) {
    return NextResponse.json(
      {
        error: {
          code: "plan_not_configured",
          message: "Razorpay plan not configured yet. Set RAZORPAY_<PLAN>_PLAN_ID in env.",
        },
      },
      { status: 501 },
    );
  }

  try {
    // Razorpay subscriptions.create with an explicit plan + notes (userId/plan/email).
    const razorpay = getRazorpay();
    const subscription = await razorpay.subscriptions.create({
      plan_id: planId,
      total_count: 12, // 12 monthly cycles (1 year)
      quantity: 1,
      customer_notify: 1,
      notes: {
        userId: session.user.id,
        plan,
        email: session.user.email,
      },
    });

    return NextResponse.json({
      subscriptionId: subscription.id,
      orderId: subscription.id,
      keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
      amount: subscription.total_count,
    });
  } catch (err) {
    console.error("Razorpay Subscribe Error:", err);
    return NextResponse.json(
      { error: { code: "subscribe_failed", message: "Failed to create subscription" } },
      { status: 500 },
    );
  }
}

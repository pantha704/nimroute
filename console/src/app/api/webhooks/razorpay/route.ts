import { NextRequest, NextResponse } from "next/server";
import { validateWebhookSignature } from "razorpay/dist/utils/razorpay-utils";
import { prisma } from "@/lib/prisma";

/**
 * Razorpay webhook — verifies signature, then updates the user's plan on
 * subscription activate / cancel / halt. Mirrors CrawlMind's proven pattern.
 */
export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("x-razorpay-signature");
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

  if (!signature || !secret) {
    return NextResponse.json({ error: "Missing signature or webhook secret" }, { status: 400 });
  }

  let valid = false;
  try {
    valid = validateWebhookSignature(body, signature, secret);
  } catch {
    valid = false;
  }
  if (!valid) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const event = JSON.parse(body);
  const sub = event.payload?.subscription?.entity;

  switch (event.event) {
    case "subscription.activated":
    case "subscription.completed": {
      const userId = sub?.notes?.userId;
      const plan = sub?.notes?.plan;
      if (sub?.id && userId && plan && ["HOBBY", "PRO", "ENTERPRISE"].includes(plan)) {
        await prisma.user.update({
          where: { id: userId },
          data: {
            plan: plan as "HOBBY" | "PRO" | "ENTERPRISE",
            razorpaySubscriptionId: sub.id,
          },
        });
      }
      break;
    }
    case "subscription.cancelled":
    case "subscription.halted": {
      if (sub?.id) {
        await prisma.user.updateMany({
          where: { razorpaySubscriptionId: sub.id },
          data: { plan: "HOBBY", razorpaySubscriptionId: null },
        });
      }
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ received: true });
}

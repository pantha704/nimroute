import Razorpay from "razorpay";

/**
 * Lazy Razorpay client — only constructed on first use so that Next.js
 * build-time page data collection doesn't fail when RAZORPAY_* env vars
 * are absent (e.g. during `next build`).
 */
let _razorpay: Razorpay | null = null;

export function getRazorpay(): Razorpay {
  if (_razorpay) return _razorpay;
  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;
  if (!key_id || !key_secret) {
    throw new Error("RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET not configured");
  }
  _razorpay = new Razorpay({ key_id, key_secret });
  return _razorpay;
}

/** PlanId -> Razorpay Plan IDs (create these in the Razorpay dashboard). */
export const PLAN_IDS = {
  HOBBY: process.env.RAZORPAY_HOBBY_PLAN_ID || "",
  PRO: process.env.RAZORPAY_PRO_PLAN_ID || "",
  ENTERPRISE: process.env.RAZORPAY_ENTERPRISE_PLAN_ID || "",
} as const;

/** Look up a Razorpay plan ID for a console plan, returning "" if unconfigured. */
export function razorpayPlanIdFor(plan: string): string {
  return (PLAN_IDS as Record<string, string>)[plan] || "";
}

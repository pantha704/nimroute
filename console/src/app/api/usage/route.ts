import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/usage — per-team usage + cost from the UsageSync metering table.
 * Groups by day for chart-friendly series. Degrades gracefully (empty) if the
 * usage-sync worker hasn't run yet (LiteLLM spend DB not configured).
 */
export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) {
    return NextResponse.json({ error: { code: "unauthorized", message: "Not signed in" } }, { status: 401 });
  }

  const team = await prisma.team.findFirst({ where: { ownerId: session.user.id } });
  if (!team) {
    return NextResponse.json({
      totals: { tokensIn: 0, tokensOut: 0, cost: 0, requests: 0 },
      daily: [],
      cacheHitRate: null,
    });
  }

  const rows = await prisma.usageSync.findMany({
    where: { teamId: team.id },
    orderBy: { periodStart: "asc" },
  });

  const totals = rows.reduce(
    (acc, r) => {
      acc.tokensIn += r.tokensIn;
      acc.tokensOut += r.tokensOut;
      acc.cost += r.cost;
      return acc;
    },
    { tokensIn: 0, tokensOut: 0, cost: 0 },
  );

  // Group by day
  const byDay = new Map<
    string,
    { tokensIn: number; tokensOut: number; cost: number; requests: number }
  >();
  for (const r of rows) {
    const day = r.periodStart.toISOString().slice(0, 10);
    const cur = byDay.get(day) ?? { tokensIn: 0, tokensOut: 0, cost: 0, requests: 0 };
    cur.tokensIn += r.tokensIn;
    cur.tokensOut += r.tokensOut;
    cur.cost += r.cost;
    cur.requests += 1;
    byDay.set(day, cur);
  }

  const daily = [...byDay.entries()].map(([date, v]) => ({ date, ...v }));

  return NextResponse.json({
    totals: { ...totals, requests: rows.length },
    daily,
    cacheHitRate: null, // TBD once Redis cache metrics surface
  });
}

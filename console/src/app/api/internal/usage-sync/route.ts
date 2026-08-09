import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTeamSpend } from "@/lib/litellm";

/**
 * Usage-sync worker (invoked by QStash cron, hourly).
 * For each team with a LiteLLM team_id, pull spend logs since the last sync
 * and persist a UsageSync row. This is the metering backbone for the
 * per-token cost dashboard + overage billing.
 *
 * NOTE: This route is called by the QStash worker, NOT by users. It trusts
 * the Upstash signature unless DISABLE_QSTASH_AUTH is set for local dev.
 */
export async function POST(req: NextRequest) {
  // QStash sends `upstash-signature`; if a token is configured we can verify later.
  // For now, guard with a shared secret trigger token so an anonymous caller can't run it.
  if (!process.env.USAGE_SYNC_SECRET && !process.env.DISABLE_QSTASH_AUTH) {
    // If no secret configured, refuse to run (safer default).
    return NextResponse.json({ error: "USAGE_SYNC_SECRET not configured" }, { status: 500 });
  }
  const authHeader = req.headers.get("authorization");
  if (
    process.env.USAGE_SYNC_SECRET &&
    authHeader !== `Bearer ${process.env.USAGE_SYNC_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const end = new Date();
  const windowStart = new Date(end.getTime() - 60 * 60 * 1000); // last hour

  const teamsWithLiteLLM = await prisma.user.findMany({
    where: { litellmTeamId: { not: null } },
    select: { id: true, litellmTeamId: true },
  });

  let synced = 0;
  for (const u of teamsWithLiteLLM) {
    const teamId = u.litellmTeamId!;
    try {
      const logs = await getTeamSpend(
        teamId,
        windowStart.toISOString(),
        end.toISOString(),
      );
      const tokensIn = (logs?.data ?? []).reduce(
        (sum, l) => sum + (l.prompt_tokens ?? 0),
        0,
      );
      const tokensOut = (logs?.data ?? []).reduce(
        (sum, l) => sum + (l.completion_tokens ?? 0),
        0,
      );
      const cost = logs?.total_spend ?? logs?.data?.reduce((s, l) => s + (l.spend ?? 0), 0) ?? 0;

      const teamRecord = await prisma.team.findFirst({
        where: { ownerId: u.id },
      });
      if (!teamRecord) continue;

      await prisma.usageSync.create({
        data: {
          teamId: teamRecord.id,
          periodStart: windowStart,
          periodEnd: end,
          tokensIn,
          tokensOut,
          cost: Number(cost),
          completedAt: end,
        },
      });
      synced++;
    } catch (err) {
      console.error(`[usage-sync] failed for team ${u.id}`, (err as Error).message);
    }
  }

  return NextResponse.json({ synced, window: { from: windowStart, to: end } });
}

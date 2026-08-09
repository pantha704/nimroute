import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createVirtualKey, listTeamKeys, revokeVirtualKey } from "@/lib/litellm";

/** Resolve the signed-in user from the request, or null. */
async function getUser(req: Request) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    return session?.user?.id ? session.user : null;
  } catch {
    return null;
  }
}

const FORBIDDEN = () => NextResponse.json({ error: { code: "unauthorized", message: "Not signed in" } }, { status: 401 });

/** POST /api/keys — create a new LiteLLM virtual key for the signed-in user. */
export async function POST(req: Request) {
  const user = await getUser(req);
  if (!user) return FORBIDDEN();

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
  if (!dbUser?.litellmTeamId) {
    return NextResponse.json(
      { error: { code: "no_team", message: "No LiteLLM team provisioned; must re-signup" } },
      { status: 409 },
    );
  }

  let body: { name?: string } = {};
  try {
    body = await req.json();
  } catch {
    /* default */
  }
  const name = body.name?.trim().slice(0, 60) || "Default key";

  // Resolve the user's team first so the note is created with the correct teamId atomically.
  const team = await prisma.team.findFirst({ where: { ownerId: user.id } });
  if (!team) {
    return NextResponse.json(
      { error: { code: "no_team", message: "No team record found; complete signup first" } },
      { status: 409 },
    );
  }

  try {
    const { key, key_id } = await createVirtualKey(dbUser.litellmTeamId, name, 50);
    if (!key_id) throw new Error("LiteLLM did not return key_id");
    const note = await prisma.apiKeyNote.create({
      data: {
        teamId: team.id,
        userId: user.id,
        liteLLMKeyId: key_id,
        prefix: key.slice(0, 12),
        name,
      },
    });
    return NextResponse.json(
      { key, key_id, id: note.id, name, prefix: key.slice(0, 12) },
      { status: 201 },
    );
  } catch (err) {
    return NextResponse.json(
      { error: { code: "provision_failed", message: (err as Error).message } },
      { status: 502 },
    );
  }
}

/** GET /api/keys — list keys (masked) for the signed-in user. */
export async function GET(req: Request) {
  const user = await getUser(req);
  if (!user) return FORBIDDEN();

  const team = await prisma.team.findFirst({ where: { ownerId: user.id } });
  if (!team) return NextResponse.json({ keys: [] });

  const notes = await prisma.apiKeyNote.findMany({
    where: { teamId: team.id },
    orderBy: { createdAt: "desc" },
  });

  let live: Record<string, number> = {};
  if (user.id) {
    const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
    if (dbUser?.litellmTeamId) {
      try {
        const keys = await listTeamKeys(dbUser.litellmTeamId);
        for (const k of keys) if (k.key_id) live[k.key_id] = k.budget ?? 0;
      } catch {
        /* live spend optional */
      }
    }
  }

  return NextResponse.json({
    keys: notes.map((n) => ({
      id: n.id,
      keyId: n.liteLLMKeyId,
      name: n.name,
      prefix: n.prefix,
      revokedAt: n.revokedAt,
      createdAt: n.createdAt,
      budget: live[n.liteLLMKeyId] ?? 0,
    })),
  });
}

/** DELETE /api/keys?keyId=<liteLLMKeyId> — revoke a virtual key. */
export async function DELETE(req: Request) {
  const user = await getUser(req);
  if (!user) return FORBIDDEN();

  const url = new URL(req.url);
  const keyId = url.searchParams.get("keyId");
  if (!keyId) return NextResponse.json({ error: { code: "bad_request", message: "keyId required" } }, { status: 400 });

  const note = await prisma.apiKeyNote.findUnique({ where: { liteLLMKeyId: keyId } });
  if (!note) {
    return NextResponse.json({ error: { code: "not_found", message: "Key not found" } }, { status: 404 });
  }
  const team = await prisma.team.findUnique({ where: { id: note.teamId } });
  if (!team || team.ownerId !== user.id) return FORBIDDEN();

  try {
    await revokeVirtualKey(keyId);
  } catch {
    /* proceed to mark revoked */
  }
  await prisma.apiKeyNote.update({ where: { id: note.id }, data: { revokedAt: new Date() } });
  return NextResponse.json({ ok: true });
}

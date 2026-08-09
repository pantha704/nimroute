import { betterAuth } from "better-auth";
import { prisma } from "./prisma";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { createTeamForUser } from "./litellm";

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  baseURL: process.env.AUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },
  // On sign-up, provision the LiteLLM team so the new user owns the org.
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          try {
            const teamId = await createTeamForUser(user.id, "HOBBY");
            await prisma.team.create({
              data: { name: `${user.name ?? user.email}'s team`, ownerId: user.id },
            });
            // Persist the LiteLLM team_id against the user for key provisioning.
            await prisma.user.update({
              where: { id: user.id },
              data: { litellmTeamId: teamId },
            });
          } catch (err) {
            console.error("[provision] failed to create LiteLLM team for", user.email, (err as Error).message);
          }
        },
      },
    },
  },
});

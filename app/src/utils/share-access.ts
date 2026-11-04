import { createLongplayServer } from "@tinkerlandai/longplay-sdk/server";
import { ForbiddenError, InternalError } from "../error";

export type ShareAccess = "disabled" | "allowed" | "denied" | "unavailable";

/** Resolve only the authenticated owner's access; never trust user.plan or a request Customer ID. */
export async function readShareAccess(
  userId: string,
  env: Record<string, string | undefined> = process.env,
  createClient = createLongplayServer,
): Promise<ShareAccess> {
  if (!env.LONGPLAY_SHARE_FEATURE_ID) return "disabled";
  if (!env.LONGPLAY_BASE_URL || !env.LONGPLAY_SECRET_KEY || !env.LONGPLAY_APP_ID ||
      !["sandbox", "live"].includes(env.LONGPLAY_ENVIRONMENT ?? "")) return "unavailable";
  try {
    const client = createClient({
      baseUrl: env.LONGPLAY_BASE_URL,
      apiKey: env.LONGPLAY_SECRET_KEY,
      scope: { projectId: env.LONGPLAY_APP_ID, environment: env.LONGPLAY_ENVIRONMENT as "sandbox" | "live" },
      timeoutMs: 3000,
    });
    const { customer } = await client.getOrCreateCustomer({ externalUserId: `aggregator:user:${userId}` });
    const { check } = await client.checkEntitlement({ customerId: customer.id,
      requirement: { internal_feature_id: env.LONGPLAY_SHARE_FEATURE_ID, quantity: "1", properties: {} } });
    if (check.kind !== "access") return "unavailable";
    return check.allowed ? "allowed" : "denied";
  } catch {
    return "unavailable";
  }
}

/** Call with a count read while holding the owner's SQL row lock. Existing links are never revoked. */
export function requireShareSlot(activeCount: number, access: ShareAccess): void {
  if (access === "disabled" || activeCount < 1 || access === "allowed") return;
  if (access === "unavailable") throw new InternalError("Could not verify paid sharing access. Try again later.");
  throw new ForbiddenError("The free plan includes one active share link.", undefined, "SHARE_PLAN_REQUIRED");
}

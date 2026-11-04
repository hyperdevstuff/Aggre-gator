import { describe, expect, it } from "bun:test";
import { readShareAccess, requireShareSlot } from "../../utils/share-access";
import { ForbiddenError, InternalError } from "../../error";

const env = { LONGPLAY_SHARE_FEATURE_ID: "11111111-1111-4111-8111-111111111111",
  LONGPLAY_BASE_URL: "https://billing.invalid", LONGPLAY_SECRET_KEY: "server-only",
  LONGPLAY_APP_ID: "app", LONGPLAY_ENVIRONMENT: "sandbox" };

describe("optional paid share admission", () => {
  it("does not initialize billing in the default deployment", async () => {
    expect(await readShareAccess("owner", {}, () => { throw new Error("must not initialize"); })).toBe("disabled");
    expect(() => requireShareSlot(20, "disabled")).not.toThrow();
  });
  it("keeps the first free slot available during billing failure", () => {
    expect(() => requireShareSlot(0, "unavailable")).not.toThrow();
    expect(() => requireShareSlot(1, "unavailable")).toThrow(InternalError);
    expect(() => requireShareSlot(1, "denied")).toThrow(ForbiddenError);
    expect(() => requireShareSlot(20, "allowed")).not.toThrow();
  });
  it("maps only the authenticated owner and configured Feature", async () => {
    let externalUserId = "";
    let requirement: unknown;
    const fake = (() => ({
      getOrCreateCustomer: async (input: { externalUserId: string }) => {
        externalUserId = input.externalUserId; return { customer: { id: "customer" } };
      },
      checkEntitlement: async (input: unknown) => { requirement = input; return { check: { kind: "access", allowed: true } }; },
    })) as unknown as Parameters<typeof readShareAccess>[2];
    expect(await readShareAccess("verified-owner", env, fake)).toBe("allowed");
    expect(externalUserId).toBe("aggregator:user:verified-owner");
    expect(requirement).toEqual({ customerId: "customer", requirement: {
      internal_feature_id: env.LONGPLAY_SHARE_FEATURE_ID, quantity: "1", properties: {},
    } });
  });
  it("does not treat a metered balance as an atomic share reservation", async () => {
    const fake = (() => ({ getOrCreateCustomer: async () => ({ customer: { id: "customer" } }),
      checkEntitlement: async () => ({ check: { kind: "metered", allowed: true } }) })) as unknown as Parameters<typeof readShareAccess>[2];
    expect(await readShareAccess("owner", env, fake)).toBe("unavailable");
    expect(await readShareAccess("owner", { LONGPLAY_SHARE_FEATURE_ID: "configured" })).toBe("unavailable");
  });
});

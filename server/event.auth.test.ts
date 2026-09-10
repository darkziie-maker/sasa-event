import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createAnonymousContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("event staff access", () => {
  it("rejects anonymous dashboard access", async () => {
    const caller = appRouter.createCaller(createAnonymousContext());
    await expect(caller.event.dashboard()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("rejects anonymous redemption attempts", async () => {
    const caller = appRouter.createCaller(createAnonymousContext());
    await expect(caller.event.redeem({ registrationCode: "SASA-ABC123" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});

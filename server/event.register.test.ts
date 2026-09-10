import { beforeEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

const insertValues = vi.fn(async () => undefined);
const selectLimit = vi.fn(async () => []);

vi.mock("./db", () => ({
  getDb: vi.fn(async () => ({
    select: () => ({
      from: () => ({
        where: () => ({ limit: selectLimit }),
      }),
    }),
    insert: () => ({ values: insertValues }),
  })),
  getEventRows: vi.fn(),
}));

function createContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("event.register", () => {
  beforeEach(() => {
    insertValues.mockClear();
    selectLimit.mockClear();
  });

  it("stores a valid invitation and returns a redeemable ticket code", async () => {
    const caller = appRouter.createCaller(createContext());
    const result = await caller.event.register({
      name: "Dewi Sasa",
      department: "Marketing",
      phone: "081234567890",
    });

    expect(result.success).toBe(true);
    expect(result.name).toBe("Dewi Sasa");
    expect(result.registrationCode).toMatch(/^SASA-[A-Z0-9]{6}$/);
    expect(insertValues).toHaveBeenCalledWith(expect.objectContaining({
      name: "Dewi Sasa",
      department: "Marketing",
      phone: "081234567890",
      registrationCode: result.registrationCode,
    }));
  });

  it("rejects an incomplete invitation form", async () => {
    const caller = appRouter.createCaller(createContext());
    await expect(caller.event.register({ name: "D", department: "", phone: "1" })).rejects.toThrow();
    expect(insertValues).not.toHaveBeenCalled();
  });
});

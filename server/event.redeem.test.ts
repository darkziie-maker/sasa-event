import { beforeEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

const selectLimit = vi.fn();
const updateWhere = vi.fn(async () => undefined);
const updateSet = vi.fn(() => ({ where: updateWhere }));

vi.mock("./db", () => ({
  getDb: vi.fn(async () => ({
    select: () => ({
      from: () => ({
        where: () => ({ limit: selectLimit }),
      }),
    }),
    update: () => ({ set: updateSet }),
  })),
  getEventRows: vi.fn(),
}));

function createStaffContext(): TrpcContext {
  return {
    user: {
      id: 7,
      openId: "staff-event",
      email: "panitia@example.com",
      name: "Rina Panitia",
      loginMethod: "manus",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("event.redeem", () => {
  beforeEach(() => {
    selectLimit.mockReset();
    updateSet.mockClear();
    updateWhere.mockClear();
  });

  it("records the authenticated staff name in the redemption history", async () => {
    selectLimit
      .mockResolvedValueOnce([{
        id: 12,
        registrationCode: "SASA-ABC123",
        name: "Dewi Sasa",
        department: "Marketing",
        phone: "081234567890",
        isWinner: true,
        prizeId: 3,
        winnerAt: new Date(),
        redeemedAt: null,
        redeemedBy: null,
        createdAt: new Date(),
      }])
      .mockResolvedValueOnce([{
        id: 3,
        name: "Voucher Belanja",
        detail: "Voucher Rp250.000",
        quantity: 3,
        createdAt: new Date(),
      }]);

    const caller = appRouter.createCaller(createStaffContext());
    const result = await caller.event.redeem({ registrationCode: "sasa-abc123" });

    expect(result.success).toBe(true);
    expect(result.redeemedBy).toBe("Rina Panitia");
    expect(updateSet).toHaveBeenCalledWith(expect.objectContaining({
      redeemedAt: expect.any(Date),
      redeemedBy: "Rina Panitia",
    }));
  });
});

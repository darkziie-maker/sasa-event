import { beforeEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

const { updateWhere, updateSet, getEventRows } = vi.hoisted(() => {
  const updateWhere = vi.fn(async () => undefined);
  return {
    updateWhere,
    updateSet: vi.fn(() => ({ where: updateWhere })),
    getEventRows: vi.fn(),
  };
});

vi.mock("./db", () => ({
  getDb: vi.fn(async () => ({
    update: () => ({ set: updateSet }),
  })),
  getEventRows,
}));

const baseGuest = {
  department: "Marketing",
  phone: "081234567890",
  redeemedAt: null,
  redeemedBy: null,
  createdAt: new Date("2026-09-10T05:00:00Z"),
};

const prizes = [{
  id: 1,
  name: "Sasa Cooking Set",
  detail: "Paket alat masak pilihan",
  quantity: 2,
  createdAt: new Date("2026-09-10T05:00:00Z"),
}];

function createStaffContext(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "staff",
      name: "Panitia Event",
      email: "staff@example.com",
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

describe("event doorprize draw", () => {
  beforeEach(() => {
    updateSet.mockClear();
    updateWhere.mockClear();
    getEventRows.mockReset();
  });

  it("selects an eligible guest and persists the winner", async () => {
    const guests = [
      { ...baseGuest, id: 10, registrationCode: "SASA-FIRST1", name: "Ayu", isWinner: false, prizeId: null, winnerAt: null },
      { ...baseGuest, id: 11, registrationCode: "SASA-SECOND", name: "Budi", isWinner: false, prizeId: null, winnerAt: null },
    ];
    getEventRows.mockResolvedValue({ guestRows: guests, prizeRows: prizes });
    vi.spyOn(Math, "random").mockReturnValueOnce(0);

    const result = await appRouter.createCaller(createStaffContext()).event.draw({ prizeId: 1 });

    expect(result.winner.name).toBe("Ayu");
    expect(result.prize.name).toBe("Sasa Cooking Set");
    expect(updateSet).toHaveBeenCalledWith(expect.objectContaining({
      isWinner: true,
      prizeId: 1,
      winnerAt: expect.any(Date),
    }));
  });

  it("returns the latest winner for the external display", async () => {
    const guests = [
      { ...baseGuest, id: 10, registrationCode: "SASA-OLDER1", name: "Ayu", isWinner: true, prizeId: 1, winnerAt: new Date("2026-09-10T05:01:00Z") },
      { ...baseGuest, id: 11, registrationCode: "SASA-NEWEST", name: "Budi", department: "Finance", isWinner: true, prizeId: 1, winnerAt: new Date("2026-09-10T05:05:00Z") },
    ];
    getEventRows.mockResolvedValue({ guestRows: guests, prizeRows: prizes });

    const result = await appRouter.createCaller(createStaffContext()).event.drawDisplay();

    expect(result.latestWinner).toMatchObject({
      name: "Budi",
      department: "Finance",
      registrationCode: "SASA-NEWEST",
      prizeName: "Sasa Cooking Set",
    });
  });
});

import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import {
  createGuest,
  findGuestByCode,
  findPrizeById,
  getEventRows,
  markGuestRedeemed,
  markGuestWinner,
} from "./db";
import { TRPCError } from "@trpc/server";

const registrationInput = z.object({
  name: z.string().trim().min(2, "Nama lengkap wajib diisi").max(180),
  department: z.string().trim().min(2, "Divisi / departemen wajib diisi").max(140),
  phone: z.string().trim().min(8, "Nomor handphone belum valid").max(40),
});

const makeCode = () => `SASA-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  event: router({
    register: publicProcedure.input(registrationInput).mutation(async ({ input }) => {
      let registrationCode = makeCode();
      for (let attempt = 0; attempt < 4; attempt += 1) {
        const existing = await findGuestByCode(registrationCode);
        if (!existing) break;
        registrationCode = makeCode();
      }
      const guest = await createGuest({ ...input, registrationCode });
      return {
        success: true,
        registrationCode: guest.registrationCode,
        name: guest.name,
        createdAt: guest.createdAt.toISOString(),
      };
    }),
    dashboard: protectedProcedure.query(async () => {
      const { guestRows, prizeRows } = await getEventRows();
      const redeemed = guestRows.filter(guest => guest.redeemedAt).length;
      const winners = guestRows.filter(guest => guest.isWinner).length;
      return {
        stats: {
          totalGuests: guestRows.length,
          winners,
          redeemed,
          waitingRedeem: winners - redeemed,
        },
        drawCandidates: guestRows
          .filter(guest => !guest.isWinner)
          .map(guest => ({ id: guest.id, name: guest.name, department: guest.department })),
        recentGuests: [...guestRows]
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
          .slice(0, 8)
          .map(guest => ({
            id: guest.id,
            registrationCode: guest.registrationCode,
            name: guest.name,
            department: guest.department,
            phone: guest.phone,
            isWinner: guest.isWinner,
            redeemedAt: guest.redeemedAt,
            redeemedBy: guest.redeemedBy,
            createdAt: guest.createdAt,
          })),
        recentRedemptions: guestRows
          .filter(guest => guest.redeemedAt)
          .sort((a, b) => (b.redeemedAt?.getTime() ?? 0) - (a.redeemedAt?.getTime() ?? 0))
          .slice(0, 8)
          .map(guest => ({
            id: guest.id,
            registrationCode: guest.registrationCode,
            name: guest.name,
            department: guest.department,
            redeemedAt: guest.redeemedAt,
            redeemedBy: guest.redeemedBy,
            prizeName: prizeRows.find(prize => prize.id === guest.prizeId)?.name ?? "Hadiah doorprize",
          })),
        prizes: prizeRows.map(prize => ({
          ...prize,
          drawn: guestRows.filter(guest => guest.prizeId === prize.id).length,
        })),
      };
    }),
    drawDisplay: protectedProcedure.query(async () => {
      const { guestRows, prizeRows } = await getEventRows();
      const latestWinner = [...guestRows]
        .filter(guest => guest.isWinner && guest.prizeId && guest.winnerAt)
        .sort((a, b) => (b.winnerAt?.getTime() ?? 0) - (a.winnerAt?.getTime() ?? 0))[0];
      return {
        registered: guestRows.length,
        totalWinners: guestRows.filter(guest => guest.isWinner).length,
        latestWinner: latestWinner ? {
          name: latestWinner.name,
          department: latestWinner.department,
          registrationCode: latestWinner.registrationCode,
          winnerAt: latestWinner.winnerAt,
          prizeName: prizeRows.find(prize => prize.id === latestWinner.prizeId)?.name ?? "Hadiah doorprize",
        } : null,
      };
    }),
    draw: protectedProcedure.input(z.object({ prizeId: z.number().int().positive() })).mutation(async ({ input }) => {
      const { guestRows, prizeRows } = await getEventRows();
      const prize = prizeRows.find(row => row.id === input.prizeId);
      if (!prize) throw new TRPCError({ code: "NOT_FOUND", message: "Hadiah tidak ditemukan" });
      const drawn = guestRows.filter(guest => guest.prizeId === prize.id).length;
      if (drawn >= prize.quantity) throw new TRPCError({ code: "BAD_REQUEST", message: "Kuota hadiah ini sudah habis" });
      const eligible = guestRows.filter(guest => !guest.isWinner);
      if (!eligible.length) throw new TRPCError({ code: "BAD_REQUEST", message: "Semua undangan sudah memenangkan hadiah" });
      const winner = eligible[Math.floor(Math.random() * eligible.length)];
      await markGuestWinner(winner.id, prize.id, new Date());
      return { success: true, winner: { ...winner, isWinner: true, prizeId: prize.id }, prize };
    }),
    redeem: protectedProcedure.input(z.object({ registrationCode: z.string().trim().min(4) })).mutation(async ({ input, ctx }) => {
      const guest = await findGuestByCode(input.registrationCode.toUpperCase());
      if (!guest) throw new TRPCError({ code: "NOT_FOUND", message: "Kode registrasi tidak ditemukan" });
      if (!guest.isWinner || !guest.prizeId) throw new TRPCError({ code: "BAD_REQUEST", message: "Undangan ini belum memenangkan doorprize" });
      if (guest.redeemedAt) throw new TRPCError({ code: "BAD_REQUEST", message: "Hadiah untuk kode ini sudah diredeem" });
      const redeemedBy = ctx.user?.name?.trim() || "Panitia";
      await markGuestRedeemed(guest.id, redeemedBy, new Date());
      const prize = await findPrizeById(guest.prizeId);
      return { success: true, guest: { name: guest.name, registrationCode: guest.registrationCode }, prize, redeemedBy };
    }),
  }),
});

export type AppRouter = typeof appRouter;

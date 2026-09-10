import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { parse as parseCookieHeader } from "cookie";
import { jwtVerify } from "jose";
import { COOKIE_NAME } from "@shared/const";
import { getUserByOpenId, type UserRow } from "../db";
import { sessionSecret } from "./session";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: UserRow | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: UserRow | null = null;

  try {
    const cookies = parseCookieHeader(opts.req.headers.cookie ?? "");
    let token = cookies[COOKIE_NAME];

    if (!token) {
      const authHeader = opts.req.headers.authorization;
      if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
        token = authHeader.slice(7);
      }
    }

    if (token) {
      const { payload } = await jwtVerify(token, sessionSecret(), {
        algorithms: ["HS256"],
      });
      const openId = typeof payload.openId === "string" ? payload.openId : "";
      if (openId) {
        user = (await getUserByOpenId(openId)) ?? null;
      }
    }
  } catch (error) {
    console.error("[Context] auth failed:", error);
    // Authentication is optional for public procedures.
    user = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}

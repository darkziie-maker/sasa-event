// Local authentication routes.
//
// The original Manus template delegated login to the hosted Manus OAuth portal.
// For the on-prem / Tailscale deployment we replace that with a simple local
// sign-in that mints the same HS256 session cookie the tRPC context verifies.

import type { Express, Request, Response } from "express";
import { SignJWT } from "jose";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "./cookies";
import { sessionSecret } from "./session";
import { upsertUser } from "../db";

const STAFF_OPEN_ID = "panitia-sasa";
const STAFF_NAME = "Panitia Event";

function safeRedirect(req: Request): string {
  const redirect = req.query.redirect;
  if (typeof redirect === "string" && redirect.startsWith("/") && !redirect.startsWith("//")) {
    return redirect;
  }
  return "/";
}

export function registerOAuthRoutes(app: Express) {
  // One-click local sign-in: creates the panitia account on first use, sets the
  // session cookie, then bounces back to the requested in-app path.
  app.get("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const oauthRequired = (process.env.SASA_PASSWORD ?? "").trim();
      if (oauthRequired) {
        const provided = typeof req.query.key === "string" ? req.query.key : "";
        if (provided !== oauthRequired) {
          res
            .status(401)
            .type("html")
            .send(
              `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Login Sasa Event Hub</title>` +
                `<style>body{font-family:system-ui,sans-serif;background:#f7f8fa;color:#273049;display:grid;place-items:center;min-height:100vh;margin:0}` +
                `form{background:#fff;padding:32px;border-radius:20px;box-shadow:0 18px 50px rgba(39,48,73,.12);width:min(360px,90vw)}` +
                `h1{font-size:20px;margin:0 0 4px}p{color:#6b7280;font-size:13px;margin:0 0 20px}` +
                `input{width:100%;box-sizing:border-box;padding:12px 14px;border:1px solid #e5e8ed;border-radius:12px;font-size:15px}` +
                `button{margin-top:12px;width:100%;padding:12px;border:0;border-radius:12px;background:#e21b22;color:#fff;font-weight:800;font-size:14px;cursor:pointer}` +
                `</style></head><body><form method="get" action="/api/auth/login">` +
                `<h1>Sasa Event Hub</h1><p>Masukkan kunci akses untuk masuk.</p>` +
                `<input type="hidden" name="redirect" value="${safeRedirect(req)}">` +
                `<input type="password" name="key" placeholder="Kunci akses" autofocus>` +
                `<button type="submit">Masuk</button></form></body></html>`
            );
          return;
        }
      }

      await upsertUser({
        openId: STAFF_OPEN_ID,
        name: STAFF_NAME,
        email: null,
        loginMethod: "local",
        role: "admin",
        lastSignedIn: new Date(),
      });

      const token = await new SignJWT({
        openId: STAFF_OPEN_ID,
        appId: "sasa-event-hub",
        name: STAFF_NAME,
      })
        .setProtectedHeader({ alg: "HS256", typ: "JWT" })
        .setExpirationTime(Math.floor((Date.now() + ONE_YEAR_MS) / 1000))
        .sign(sessionSecret());

      res.cookie(COOKIE_NAME, token, {
        ...getSessionCookieOptions(req),
        maxAge: ONE_YEAR_MS,
      });

      res.redirect(302, safeRedirect(req));
    } catch (error) {
      console.error("[Auth] Local login failed", error);
      res.status(500).send("Login gagal");
    }
  });

  app.get("/api/auth/logout", (req: Request, res: Response) => {
    res.clearCookie(COOKIE_NAME, { ...getSessionCookieOptions(req), maxAge: -1 });
    res.redirect(302, "/");
  });
}

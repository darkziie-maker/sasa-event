const FALLBACK_SECRET = "sasa-event-hub-local-secret";

/** Shared HS256 secret used to sign/verify the local session cookie. */
export function sessionSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET?.trim() || FALLBACK_SECRET;
  return new TextEncoder().encode(secret);
}

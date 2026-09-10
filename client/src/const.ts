export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// Local sign-in. The hosted Manus OAuth portal is replaced by a local route that
// mints the session cookie server-side, then redirects back into the app.
export const startLogin = (redirectPath?: string) => {
  if (typeof window === "undefined") return;
  const target =
    redirectPath ?? `${window.location.pathname}${window.location.search}`;
  window.location.href = `/api/auth/login?redirect=${encodeURIComponent(target)}`;
};

/**
 * POST /api/auth/set-session
 *
 * Called by the browser immediately after a successful backend login/signup.
 * Sets the mf_auth presence cookie from the Nuxt server origin (localhost:3001)
 * so the global auth middleware can reliably read it via useCookie() on the
 * next request — avoiding cross-port cookie scoping issues with the backend.
 *
 * Security note: mf_auth is only a UI presence flag. The real session JWT
 * (mf_session, httpOnly) is always validated by the backend on every API call.
 * An attacker who manually sets mf_auth=1 would still fail all backend calls.
 */
export default defineEventHandler((event) => {
  const maxAge = 60 * 60 * 24 * 7; // 7 days — matches backend JWT expiry
  setCookie(event, 'mf_auth', '1', {
    httpOnly: false,
    sameSite: 'lax',
    path: '/',
    maxAge,
  });
  return { ok: true };
});

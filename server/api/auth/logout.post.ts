export default defineEventHandler((event) => {
  // Clear the UI presence flag so the middleware redirects immediately
  setCookie(event, "mf_auth", "", {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return { ok: true };
});

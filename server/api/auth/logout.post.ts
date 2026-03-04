export default defineEventHandler(() => {
  setCookie(event, "mf_session", "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0
  });

  return { ok: true };
});

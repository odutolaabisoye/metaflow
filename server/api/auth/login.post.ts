export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const email = typeof body?.email === "string" ? body.email.trim() : "";

  if (!email) {
    throw createError({ statusCode: 400, statusMessage: "Email is required" });
  }

  setCookie(event, "mf_session", `mock_${Buffer.from(email).toString("base64")}`, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7
  });

  return { ok: true };
});

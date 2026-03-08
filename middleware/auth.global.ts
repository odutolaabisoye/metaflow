export default defineNuxtRouteMiddleware(async (to) => {
  // Avoid SSR cookie mismatch issues; enforce auth on the client.
  if (process.server) return;

  // mf_session is httpOnly (unreadable by JS). mf_auth is the non-httpOnly
  // presence flag set by the frontend so the middleware can read it.
  const authFlag = useCookie("mf_auth", {
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7
  });
  const isLoggedIn = authFlag.value === "1";

  // Protect all /app routes — redirect to login if not authenticated
  if (to.path.startsWith("/app")) {
    if (isLoggedIn) return;
    // Fallback: if backend session cookie exists (mf_session on :4000),
    // verify via /auth/me then set mf_auth for this origin.
    const config = useRuntimeConfig();
    try {
      await $fetch(`${config.public.apiBase}/v1/auth/me`, {
        credentials: "include"
      });
      authFlag.value = "1";
      return;
    } catch {
      return navigateTo("/auth/login");
    }
  }

  // Redirect logged-in users away from auth pages to the dashboard
  if (to.path.startsWith("/auth") && isLoggedIn) {
    return navigateTo("/app");
  }
});

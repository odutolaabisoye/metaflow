export default defineNuxtRouteMiddleware((to) => {
  if (!to.path.startsWith("/app")) return;

  const session = useCookie("mf_session");
  if (!session.value) {
    return navigateTo("/auth/login");
  }
});

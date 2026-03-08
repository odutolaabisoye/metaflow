<template>
  <div>
    <!-- Header -->
    <div class="mb-8">
      <h1 class="text-2xl font-semibold tracking-tight">Welcome back</h1>
      <p class="mt-2 text-sm text-white/50">Sign in to your MetaFlow workspace.</p>
    </div>

    <!-- Google OAuth -->
    <button
      type="button"
      class="w-full flex items-center justify-center gap-3 rounded-xl border border-white/15 bg-white/[0.05] px-4 py-3 text-sm font-medium text-white/80 hover:bg-white/[0.09] hover:border-white/25 transition-all duration-200"
    >
      <svg class="w-4 h-4" viewBox="0 0 24 24">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
      </svg>
      Continue with Google
    </button>

    <!-- Divider -->
    <div class="my-6 flex items-center gap-3 text-xs text-white/25">
      <div class="h-px flex-1 bg-white/10"></div>
      or continue with email
      <div class="h-px flex-1 bg-white/10"></div>
    </div>

    <!-- Form -->
    <form class="space-y-4" @submit.prevent="submit">
      <div>
        <label class="form-label">Work email</label>
        <input
          v-model.trim="form.email"
          type="email"
          class="form-input"
          placeholder="you@brand.com"
          autocomplete="email"
        />
      </div>

      <div>
        <div class="flex items-center justify-between mb-1.5">
          <label class="form-label mb-0">Password</label>
          <NuxtLink to="/auth/forgot-password" class="text-xs text-white/40 hover:text-glow-500 transition-colors">Forgot?</NuxtLink>
        </div>
        <div class="relative">
          <input
            v-model.trim="form.password"
            :type="showPassword ? 'text' : 'password'"
            class="form-input pr-11"
            placeholder="••••••••"
            autocomplete="current-password"
          />
          <button
            type="button"
            class="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
            @click="showPassword = !showPassword"
          >
            <svg v-if="!showPassword" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"/><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
            </svg>
            <svg v-else class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88"/>
            </svg>
          </button>
        </div>
      </div>

      <label class="flex items-center gap-2.5 cursor-pointer mt-1">
        <input type="checkbox" v-model="rememberMe" class="w-4 h-4 rounded border-white/20 bg-white/5 accent-glow-500" />
        <span class="text-xs text-white/50">Keep me signed in for 30 days</span>
      </label>

      <!-- Error -->
      <div v-if="error" class="flex items-center gap-2 rounded-xl bg-ember-500/10 border border-ember-500/20 px-4 py-3">
        <svg class="w-4 h-4 text-ember-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z"/></svg>
        <p class="text-xs text-ember-400">{{ error }}</p>
      </div>

      <input type="hidden" :value="csrfToken" />

      <!-- Submit -->
      <button
        type="submit"
        :disabled="pending"
        class="w-full flex items-center justify-center gap-2 rounded-xl bg-white text-ink-950 py-3 text-sm font-semibold transition-all hover:bg-white/90 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <svg v-if="pending" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
        </svg>
        {{ pending ? 'Signing in…' : 'Sign in' }}
      </button>
    </form>

    <!-- Sign up link -->
    <p class="mt-6 text-center text-sm text-white/40">
      New to MetaFlow?
      <NuxtLink to="/auth/signup" class="font-medium text-glow-500 hover:text-glow-600 transition-colors">Create an account</NuxtLink>
    </p>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'auth' });

const config = useRuntimeConfig();
const apiBase = config.public.apiBase;

const pending = ref(false);
const error = ref('');
const csrfToken = ref('');
const showPassword = ref(false);
const rememberMe = ref(false);

const form = reactive({ email: '', password: '' });
const authFlag = useCookie('mf_auth', {
  sameSite: 'lax',
  path: '/',
  maxAge: 60 * 60 * 24 * 7,
});


const loadCsrf = async () => {
  try {
    const res = await $fetch<{ csrfToken: string }>(`${apiBase}/v1/csrf`, { credentials: 'include' });
    csrfToken.value = res.csrfToken;
  } catch {}
};

// Must run client-side so the CSRF cookie is set in the browser's cookie jar,
// not on the Nuxt SSR server where it would be unreachable during form submission.
onMounted(loadCsrf);

const submit = async () => {
  error.value = '';
  pending.value = true;
  // Refresh CSRF token if missing (e.g. page was cached without it)
  if (!csrfToken.value) await loadCsrf();
  try {
    await $fetch(`${apiBase}/v1/auth/login`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'x-csrf-token': csrfToken.value },
      body: { email: form.email, password: form.password },
    });
    // Set UI presence flag client-side so middleware can pass immediately.
    authFlag.value = '1';
    // Also ask the Nuxt server (same origin) to set mf_auth=1 in its response.
    // This guarantees the cookie is scoped to the Nuxt origin for SSR.
    await $fetch('/api/auth/set-session', { method: 'POST' }).catch(() => {});
    await navigateTo('/app');
  } catch (err: any) {
    error.value = err?.data?.message || 'Invalid email or password. Please try again.';
  } finally {
    pending.value = false;
  }
};
</script>

<template>
  <div>
    <!-- Success -->
    <div v-if="done" class="text-center py-4">
      <div class="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-lime-500/15 border border-lime-500/20">
        <svg class="w-7 h-7 text-lime-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
      </div>
      <h1 class="text-xl font-semibold">Password updated</h1>
      <p class="mt-3 text-sm text-white/50">Your password has been reset. You can now sign in with your new password.</p>
      <NuxtLink to="/auth/login" class="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-white text-ink-950 px-6 py-3 text-sm font-semibold hover:bg-white/90 transition-all">
        Go to sign in →
      </NuxtLink>
    </div>

    <!-- Invalid token -->
    <div v-else-if="!token" class="text-center py-4">
      <div class="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-ember-500/15 border border-ember-500/20">
        <svg class="w-7 h-7 text-ember-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"/></svg>
      </div>
      <h1 class="text-xl font-semibold">Invalid reset link</h1>
      <p class="mt-3 text-sm text-white/50">This link is expired or invalid. Request a new one.</p>
      <NuxtLink to="/auth/forgot-password" class="mt-5 text-sm text-glow-500 hover:text-glow-600 transition-colors">Request new link →</NuxtLink>
    </div>

    <!-- Form -->
    <div v-else>
      <div class="mb-8">
        <div class="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-glow-500/10 border border-glow-500/20">
          <svg class="w-6 h-6 text-glow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z"/></svg>
        </div>
        <h1 class="text-2xl font-semibold tracking-tight">Set a new password</h1>
        <p class="mt-2 text-sm text-white/50">Choose a strong password to secure your account.</p>
      </div>

      <form class="space-y-5" @submit.prevent="submit">
        <div>
          <label class="form-label">New password</label>
          <div class="relative">
            <input
              v-model.trim="password"
              :type="showPassword ? 'text' : 'password'"
              class="form-input pr-11"
              placeholder="Min 8 characters"
              autocomplete="new-password"
            />
            <button type="button" class="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors" @click="showPassword = !showPassword">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                <path v-if="!showPassword" stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"/><path v-if="!showPassword" stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                <path v-else stroke-linecap="round" stroke-linejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88"/>
              </svg>
            </button>
          </div>
          <div v-if="password" class="mt-2 flex gap-1">
            <div v-for="n in 4" :key="n" class="h-1 flex-1 rounded-full transition-all duration-300" :class="strength >= n ? (strength < 2 ? 'bg-ember-500' : strength < 4 ? 'bg-lime-500/70' : 'bg-lime-500') : 'bg-white/10'"></div>
          </div>
        </div>

        <div>
          <label class="form-label">Confirm new password</label>
          <input v-model.trim="confirm" :type="showPassword ? 'text' : 'password'" class="form-input" placeholder="••••••••" autocomplete="new-password" />
          <p v-if="confirm && confirm !== password" class="mt-1.5 text-xs text-ember-400">Passwords don't match</p>
        </div>

        <div v-if="error" class="flex items-center gap-2 rounded-xl bg-ember-500/10 border border-ember-500/20 px-4 py-3">
          <svg class="w-4 h-4 text-ember-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z"/></svg>
          <p class="text-xs text-ember-400">{{ error }}</p>
        </div>

        <input type="hidden" :value="csrfToken" />

        <button type="submit" :disabled="pending || (confirm.length > 0 && confirm !== password)" class="w-full flex items-center justify-center gap-2 rounded-xl bg-white text-ink-950 py-3 text-sm font-semibold hover:bg-white/90 transition-all disabled:opacity-50">
          <svg v-if="pending" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          {{ pending ? 'Resetting…' : 'Reset password' }}
        </button>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'auth' });

const route = useRoute();
const config = useRuntimeConfig();
const apiBase = config.public.apiBase;

const password = ref('');
const confirm = ref('');
const showPassword = ref(false);
const pending = ref(false);
const done = ref(false);
const error = ref('');
const csrfToken = ref('');

const token = computed(() => String(route.query.token || ''));

const strength = computed(() => {
  const p = password.value;
  if (!p || p.length < 4) return 1;
  let s = 1;
  if (p.length >= 8) s++;
  if (/[A-Z]/.test(p) && /[0-9]/.test(p)) s++;
  if (/[^A-Za-z0-9]/.test(p)) s++;
  return s;
});

const loadCsrf = async () => {
  try {
    const res = await $fetch<{ csrfToken: string }>(`${apiBase}/v1/csrf`, { credentials: 'include' });
    csrfToken.value = res.csrfToken;
  } catch {}
};

onMounted(loadCsrf);

const submit = async () => {
  error.value = '';
  pending.value = true;
  if (!csrfToken.value) await loadCsrf();
  try {
    await $fetch(`${apiBase}/v1/auth/reset`, {
      method: 'POST',
      headers: { 'x-csrf-token': csrfToken.value },
      body: { token: token.value, password: password.value },
    });
    done.value = true;
  } catch (err: any) {
    error.value = err?.data?.message || 'Reset failed. The link may have expired.';
  } finally {
    pending.value = false;
  }
};
</script>

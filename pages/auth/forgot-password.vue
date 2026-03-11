<template>
  <div>
    <NuxtLink to="/auth/login" class="inline-flex items-center gap-1.5 text-xs text-white/65 hover:text-white/70 transition-colors mb-8">
      <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"/></svg>
      Back to sign in
    </NuxtLink>

    <!-- Success -->
    <div v-if="sent" class="text-center py-4">
      <div class="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-lime-500/15 border border-lime-500/20">
        <svg class="w-7 h-7 text-lime-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"/></svg>
      </div>
      <h1 class="text-xl font-semibold">Check your inbox</h1>
      <p class="mt-3 text-sm text-white/75 leading-relaxed max-w-xs mx-auto">
        We've sent a reset link to <strong class="text-white/70">{{ email }}</strong>. It expires in 15 minutes.
      </p>
      <p class="mt-5 text-xs text-white/55">
        Didn't receive it?
        <button class="text-glow-500 hover:text-glow-600 transition-colors" @click="sent = false">Try again</button>
      </p>
    </div>

    <!-- Form -->
    <div v-else>
      <div class="mb-8">
        <div class="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-glow-500/10 border border-glow-500/20">
          <svg class="w-6 h-6 text-glow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"/></svg>
        </div>
        <h1 class="text-2xl font-semibold tracking-tight">Reset your password</h1>
        <p class="mt-2 text-sm text-white/75">Enter your email and we'll send a reset link instantly.</p>
      </div>

      <form class="space-y-5" @submit.prevent="submit">
        <div>
          <label class="form-label">Email address</label>
          <input v-model.trim="email" type="email" class="form-input" placeholder="you@brand.com" autocomplete="email" />
        </div>

        <div v-if="error" class="flex items-center gap-2 rounded-xl bg-ember-500/10 border border-ember-500/20 px-4 py-3">
          <svg class="w-4 h-4 text-ember-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z"/></svg>
          <p class="text-xs text-ember-400">{{ error }}</p>
        </div>

        <input type="hidden" :value="csrfToken" />

        <button type="submit" :disabled="pending" class="w-full flex items-center justify-center gap-2 rounded-xl bg-white text-ink-950 py-3 text-sm font-semibold hover:bg-white/90 transition-all disabled:opacity-50">
          <svg v-if="pending" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          {{ pending ? 'Sending…' : 'Send reset link' }}
        </button>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'auth' });

const config = useRuntimeConfig();
const apiBase = config.public.apiBase;

const email = ref('');
const pending = ref(false);
const sent = ref(false);
const error = ref('');
const csrfToken = ref('');

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
    await $fetch(`${apiBase}/v1/auth/forgot`, {
      method: 'POST',
      headers: { 'x-csrf-token': csrfToken.value },
      body: { email: email.value },
    });
    sent.value = true;
  } catch (err: any) {
    error.value = err?.data?.message || 'Request failed. Please try again.';
  } finally {
    pending.value = false;
  }
};
</script>

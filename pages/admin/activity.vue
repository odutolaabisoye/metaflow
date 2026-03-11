<template>
  <div class="space-y-5">
    <!-- Header -->
    <div>
      <h1 class="text-xl font-semibold text-white">Platform Activity</h1>
      <p class="text-sm text-white/65 mt-1">All audit events across every store</p>
    </div>

    <!-- Log list -->
    <div class="rounded-2xl border border-white/8 bg-white/[0.02] overflow-hidden">
      <!-- Loading skeleton -->
      <div v-if="loading" class="divide-y divide-white/6">
        <div v-for="i in 10" :key="i" class="flex items-start gap-4 px-5 py-4">
          <div class="h-7 w-7 rounded-lg bg-white/6 animate-pulse flex-shrink-0 mt-0.5"></div>
          <div class="flex-1 space-y-1.5">
            <div class="h-3 w-48 bg-white/6 rounded animate-pulse"></div>
            <div class="h-2.5 w-72 bg-white/4 rounded animate-pulse"></div>
            <div class="h-2.5 w-32 bg-white/3 rounded animate-pulse"></div>
          </div>
          <div class="h-4 w-16 bg-white/4 rounded animate-pulse"></div>
        </div>
      </div>

      <!-- Empty -->
      <div v-else-if="logs.length === 0" class="py-16 text-center">
        <svg class="w-10 h-10 text-white/45 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1">
          <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 0 1 0 3.75H5.625a1.875 1.875 0 0 1 0-3.75Z"/>
        </svg>
        <p class="text-sm text-white/55">No activity yet</p>
      </div>

      <!-- Log rows -->
      <div v-else class="divide-y divide-white/5">
        <div
          v-for="log in logs"
          :key="log.id"
          class="flex items-start gap-4 px-5 py-4 hover:bg-white/[0.02] transition-colors"
        >
          <!-- Action icon -->
          <div class="mt-0.5 h-7 w-7 flex-shrink-0 rounded-lg flex items-center justify-center" :class="tagStyle(log.action).bg">
            <svg class="w-3.5 h-3.5" :class="tagStyle(log.action).icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" :d="tagStyle(log.action).path"/>
            </svg>
          </div>

          <!-- Log detail -->
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <p class="text-sm font-medium text-white/80">{{ log.action }}</p>
              <span class="text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider" :class="platformBadge(log.store?.platform)">
                {{ (log.store?.platform ?? 'unknown').toLowerCase() }}
              </span>
            </div>
            <p v-if="log.detail" class="text-xs text-white/65 mt-0.5 truncate">{{ log.detail }}</p>
            <div class="flex items-center gap-3 mt-1">
              <NuxtLink
                v-if="log.store"
                :to="`/admin/users/${log.store.owner?.id}`"
                class="text-[10px] text-violet-400/70 hover:text-violet-400 transition-colors"
              >
                {{ log.store.owner?.email }}
              </NuxtLink>
              <span class="text-[10px] text-white/50">{{ log.store?.name }}</span>
            </div>
          </div>

          <!-- Time -->
          <div class="flex-shrink-0 text-right">
            <p class="text-xs text-white/55">{{ timeAgo(log.createdAt) }}</p>
            <p class="text-[10px] text-white/45 mt-0.5">{{ formatDate(log.createdAt) }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Load more -->
    <div v-if="nextCursor" class="text-center">
      <button
        @click="loadMore"
        :disabled="loadingMore"
        class="px-6 py-2.5 rounded-xl border border-white/10 bg-white/[0.03] text-sm text-white/75 hover:text-white/75 hover:border-white/20 disabled:opacity-40 transition-all flex items-center gap-2 mx-auto"
      >
        <svg v-if="loadingMore" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
        </svg>
        Load more
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'admin' });

const config = useRuntimeConfig();

interface ActivityLog {
  id: string; action: string; detail?: string; createdAt: string;
  store?: { id: string; name: string; platform: string; owner?: { id: string; email: string; name?: string } }
}

const loading = ref(true);
const loadingMore = ref(false);
const logs = ref<ActivityLog[]>([]);
const nextCursor = ref<string | null>(null);

async function fetchLogs(cursor?: string) {
  if (cursor) loadingMore.value = true;
  else loading.value = true;

  try {
    const params = new URLSearchParams({ limit: '50' });
    if (cursor) params.set('cursor', cursor);

    const res = await $fetch<{ ok: boolean; logs: ActivityLog[]; nextCursor: string | null }>(
      `${config.public.apiBase}/v1/admin/activity?${params}`,
      { credentials: 'include' }
    );
    if (res?.ok) {
      if (cursor) logs.value.push(...res.logs);
      else logs.value = res.logs;
      nextCursor.value = res.nextCursor;
    }
  } catch (err: any) {
    if (err?.statusCode === 403 || err?.statusCode === 401) navigateTo('/app');
  } finally {
    loading.value = false;
    loadingMore.value = false;
  }
}

function loadMore() {
  if (nextCursor.value) fetchLogs(nextCursor.value);
}

function tagStyle(action: string) {
  const a = action.toUpperCase();
  if (a.includes('SYNC')) return { bg: 'bg-sky-500/10', icon: 'text-sky-400', path: 'M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99' };
  if (a.includes('CONNECT') || a.includes('SHOPIFY') || a.includes('META') || a.includes('WOOCOMMERCE')) return { bg: 'bg-emerald-500/10', icon: 'text-emerald-400', path: 'M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244' };
  if (a.includes('DELETE') || a.includes('DISCONNECT') || a.includes('KILL')) return { bg: 'bg-red-500/10', icon: 'text-red-400', path: 'M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0' };
  if (a.includes('SCORE') || a.includes('SCALE')) return { bg: 'bg-amber-500/10', icon: 'text-amber-400', path: 'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z' };
  return { bg: 'bg-white/5', icon: 'text-white/55', path: 'M11.25 11.25l.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z' };
}

function platformBadge(platform?: string) {
  const map: Record<string, string> = {
    SHOPIFY: 'bg-emerald-500/10 text-emerald-400',
    WOOCOMMERCE: 'bg-violet-500/10 text-violet-400',
    API: 'bg-sky-500/10 text-sky-400',
  };
  return map[platform ?? ''] ?? 'bg-white/6 text-white/55';
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  });
}

onMounted(() => fetchLogs());
</script>

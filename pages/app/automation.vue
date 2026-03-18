<template>
  <div class="space-y-6">
    <div>
      <p class="text-[11px] uppercase tracking-widest text-white/65 mb-1">Workspace</p>
      <h1 class="text-2xl font-semibold tracking-tight">Automation Activity</h1>
      <p class="mt-1 text-sm text-white/75">Rule firings, score changes, and automated actions for your store.</p>
    </div>

    <!-- No store state -->
    <div v-if="!storeId" class="glass rounded-2xl p-10 text-center">
      <p class="text-sm text-white/40">No store selected — switch to a store using the sidebar</p>
    </div>

    <template v-else>
      <!-- Stats bar -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div class="glass rounded-2xl p-4 text-center">
          <p class="text-2xl font-bold text-lime-400">{{ stats.scaled }}</p>
          <p class="text-xs text-white/55 mt-1">Scaled</p>
        </div>
        <div class="glass rounded-2xl p-4 text-center">
          <p class="text-2xl font-bold text-cyan-400">{{ stats.tested }}</p>
          <p class="text-xs text-white/55 mt-1">Tested</p>
        </div>
        <div class="glass rounded-2xl p-4 text-center">
          <p class="text-2xl font-bold text-orange-400">{{ stats.risked }}</p>
          <p class="text-xs text-white/55 mt-1">Risk Flagged</p>
        </div>
        <div class="glass rounded-2xl p-4 text-center">
          <p class="text-2xl font-bold text-red-400">{{ stats.killed }}</p>
          <p class="text-xs text-white/55 mt-1">Killed</p>
        </div>
      </div>

      <!-- Loading -->
      <div v-if="loading" class="space-y-2">
        <div v-for="i in 5" :key="i" class="h-16 rounded-xl bg-white/4 animate-pulse border border-white/6"></div>
      </div>

      <!-- Events list -->
      <div v-else-if="events.length" class="glass rounded-2xl overflow-hidden">
        <div class="px-5 py-3 border-b border-white/8">
          <p class="text-xs font-semibold text-white/60 uppercase tracking-wider">Automation Events ({{ events.length }})</p>
        </div>
        <div class="divide-y divide-white/[0.04]">
          <div v-for="ev in events" :key="ev.id" class="px-5 py-3.5 flex items-start gap-3 hover:bg-white/[0.02] transition-colors">
            <!-- Icon -->
            <div class="mt-0.5 flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-xs"
              :class="ev.action === 'Budget Scaled' ? 'bg-lime-500/15 text-lime-400' : ev.action === 'Ad Paused' ? 'bg-red-500/15 text-red-400' : ev.action === 'Risk Flagged' ? 'bg-orange-500/15 text-orange-400' : 'bg-cyan-500/15 text-cyan-400'"
            >
              {{ ev.action === 'Budget Scaled' ? '↑' : ev.action === 'Ad Paused' ? '✕' : ev.action === 'Risk Flagged' ? '!' : '~' }}
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-white/85">{{ ev.action }}</p>
              <p class="text-xs text-white/55 mt-0.5 line-clamp-2">{{ ev.detail }}</p>
            </div>
            <p class="text-xs text-white/40 flex-shrink-0 mt-0.5">{{ formatDate(ev.createdAt) }}</p>
          </div>
        </div>
      </div>

      <div v-else class="glass rounded-2xl p-10 text-center">
        <p class="text-sm text-white/40">No automation events yet. Run a sync to score products and trigger automation rules.</p>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' });
useHead({ title: 'Automation Activity — MetaFlow' });

const config = useRuntimeConfig();
const activeStoreId = useState<string | null>('mf_active_store_id', () => null);
const storeId = computed(() => activeStoreId.value ?? '');

const loading = ref(false);
const allLogs = ref<any[]>([]);

const AUTOMATION_ACTIONS = new Set(['Budget Scaled', 'Ad Paused', 'Risk Flagged', 'Status Updated']);

const events = computed(() => allLogs.value.filter(l => AUTOMATION_ACTIONS.has(l.action)));

const stats = computed(() => ({
  scaled: events.value.filter(e => e.action === 'Budget Scaled').length,
  tested: events.value.filter(e => e.action === 'Status Updated').length,
  risked: events.value.filter(e => e.action === 'Risk Flagged').length,
  killed: events.value.filter(e => e.action === 'Ad Paused').length,
}));

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' +
    d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

async function loadEvents() {
  if (!storeId.value) return;
  loading.value = true;
  try {
    const res = await $fetch<any>(
      `${config.public.apiBase}/v1/audit?storeId=${storeId.value}&limit=200`,
      { credentials: 'include' }
    );
    if (res?.ok) allLogs.value = res.logs ?? [];
  } catch {} finally {
    loading.value = false;
  }
}

watch(storeId, (id) => { if (id) loadEvents(); }, { immediate: true });
</script>

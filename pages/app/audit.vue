<template>
  <div class="space-y-6">

    <!-- Page Header -->
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p class="text-[11px] uppercase tracking-widest text-white/65 mb-1">Transparency</p>
        <h1 class="text-xl sm:text-2xl font-semibold tracking-tight">Audit Log</h1>
        <p class="mt-1 text-xs sm:text-sm text-white/75">Full history of all automation actions taken by MetaFlow</p>
      </div>
      <button
        @click="downloadCsv"
        class="flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white transition-all"
      >
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"/>
        </svg>
        Download CSV
      </button>
    </div>

    <!-- Filter chips -->
    <div class="flex flex-wrap items-center gap-2">
      <button
        v-for="f in actionFilters"
        :key="f.value"
        @click="activeFilter = f.value"
        class="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-all border"
        :class="activeFilter === f.value
          ? 'bg-white/15 text-white border-white/20'
          : 'text-white/65 hover:text-white/70 border-transparent hover:border-white/10 hover:bg-white/5'"
      >
        <span v-if="f.dot" class="h-1.5 w-1.5 rounded-full" :class="f.dot"></span>
        {{ f.label }}
        <span
          v-if="f.count > 0"
          class="rounded-full px-1.5 py-0.5 text-[10px] leading-none font-semibold"
          :class="f.countClass"
        >{{ f.count }}</span>
      </button>
    </div>

    <!-- Stats row -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <div
        v-for="stat in auditStats"
        :key="stat.label"
        class="glass rounded-2xl p-4"
      >
        <p class="text-xs text-white/65">{{ stat.label }}</p>
        <p class="mt-1.5 text-xl font-semibold" :class="stat.color">{{ stat.value }}</p>
      </div>
    </div>

    <!-- Events -->
    <div class="space-y-3">

      <!-- Skeleton -->
      <template v-if="pending">
        <div v-for="i in 5" :key="i" class="h-20 rounded-2xl bg-white/5 animate-pulse" :style="{ opacity: 1 - i * 0.1 }"></div>
      </template>

      <!-- Event cards -->
      <template v-else-if="filteredEvents.length">
        <div
          v-for="event in filteredEvents"
          :key="event.id"
          class="glass rounded-2xl p-5 hover:bg-white/[0.07] transition-colors relative overflow-hidden"
        >
          <!-- Colored left accent bar -->
          <div class="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-2xl" :class="accentClass(event.variant)"></div>

          <div class="flex flex-wrap items-start justify-between gap-4 pl-2">
            <div class="flex items-start gap-4">

              <!-- Action icon -->
              <div class="flex-shrink-0 mt-0.5 h-9 w-9 rounded-xl flex items-center justify-center" :class="iconBg(event.variant)">
                <svg class="w-4 h-4" :class="iconColor(event.variant)" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" v-html="eventIcon(event.tag)"></svg>
              </div>

              <!-- Text content -->
              <div>
                <p class="font-semibold text-sm">{{ event.title }}</p>
                <p class="mt-0.5 text-xs text-white/80">{{ event.detail }}</p>
                <div v-if="event.meta" class="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-white/[0.04] border border-white/[0.07] px-2.5 py-1">
                  <svg class="w-3 h-3 text-white/55" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M6.75 7.5l3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0021 18V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v12a2.25 2.25 0 002.25 2.25z"/></svg>
                  <span class="text-xs text-white/60 font-mono">{{ event.meta }}</span>
                </div>
              </div>
            </div>

            <!-- Badge + timestamp -->
            <div class="flex flex-col items-end gap-2 flex-shrink-0">
              <span class="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold" :class="tagClass(event.variant)">
                <span class="h-1.5 w-1.5 rounded-full" :class="tagDot(event.variant)"></span>
                {{ event.tag }}
              </span>
              <span class="text-xs text-white/55">{{ event.time }}</span>
            </div>
          </div>
        </div>
      </template>

      <!-- Empty state -->
      <div v-else class="glass rounded-2xl p-16 text-center">
        <div class="mx-auto mb-4 h-12 w-12 rounded-2xl bg-white/5 flex items-center justify-center">
          <svg class="w-6 h-6 text-white/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"/>
          </svg>
        </div>
        <p class="text-sm font-medium">No audit activity yet</p>
        <p class="mt-1 text-xs text-white/75">Enable automation rules to start logging actions here.</p>
      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
import { useGlobalFilters } from "~/composables/useGlobalFilters";

const { query } = useGlobalFilters();
const activeFilter = ref('all');

const { public: { apiBase } } = useRuntimeConfig();
const { data, pending } = await useFetch(`${apiBase}/v1/audit`, {
  server: false,
  credentials: 'include',
  query
});

const events = computed(() => data.value?.events ?? []);

const scaleCount = computed(() => events.value.filter((e: any) => e.variant === 'secondary').length);
const pauseCount = computed(() => events.value.filter((e: any) => e.variant === 'destructive').length);
const infoCount  = computed(() => events.value.filter((e: any) => e.variant === 'default').length);

const actionFilters = computed(() => [
  { value: 'all',   label: 'All events',     dot: null,             count: events.value.length, countClass: 'bg-white/10 text-white/75' },
  { value: 'scale', label: 'Budget scaled',  dot: 'bg-lime-400',    count: scaleCount.value,    countClass: 'bg-lime-500/20 text-lime-400' },
  { value: 'pause', label: 'Paused / killed', dot: 'bg-ember-500',  count: pauseCount.value,    countClass: 'bg-ember-500/20 text-ember-400' },
  { value: 'info',  label: 'Informational',  dot: 'bg-glow-400',    count: infoCount.value,     countClass: 'bg-glow-500/20 text-glow-400' },
]);

const auditStats = computed(() => [
  { label: 'Total actions', value: events.value.length, color: 'text-white' },
  { label: 'Budget scaled',  value: scaleCount.value,   color: 'text-lime-400' },
  { label: 'Paused / killed', value: pauseCount.value,  color: 'text-ember-400' },
  { label: 'Info events',    value: infoCount.value,    color: 'text-glow-400' },
]);

const filteredEvents = computed(() => {
  if (activeFilter.value === 'all')   return events.value;
  if (activeFilter.value === 'scale') return events.value.filter((e: any) => e.variant === 'secondary');
  if (activeFilter.value === 'pause') return events.value.filter((e: any) => e.variant === 'destructive');
  if (activeFilter.value === 'info')  return events.value.filter((e: any) => e.variant === 'default');
  return events.value;
});

const accentClass = (variant: string) => {
  if (variant === 'secondary')   return 'bg-lime-400';
  if (variant === 'destructive') return 'bg-ember-500';
  return 'bg-glow-400';
};

const iconBg = (variant: string) => {
  if (variant === 'secondary')   return 'bg-lime-500/10';
  if (variant === 'destructive') return 'bg-ember-500/10';
  return 'bg-glow-500/10';
};

const iconColor = (variant: string) => {
  if (variant === 'secondary')   return 'text-lime-400';
  if (variant === 'destructive') return 'text-ember-400';
  return 'text-glow-400';
};

const tagClass = (variant: string) => {
  if (variant === 'secondary')   return 'bg-lime-500/15 text-lime-400 border border-lime-500/20';
  if (variant === 'destructive') return 'bg-ember-500/15 text-ember-400 border border-ember-500/20';
  return 'bg-glow-500/15 text-glow-400 border border-glow-500/20';
};

const tagDot = (variant: string) => {
  if (variant === 'secondary')   return 'bg-lime-400';
  if (variant === 'destructive') return 'bg-ember-500';
  return 'bg-glow-400';
};

const downloadCsv = () => {
  const rows = filteredEvents.value as Record<string, unknown>[];
  if (!rows.length) return;
  const headers = ['id', 'time', 'tag', 'title', 'detail', 'meta'];
  const csv = [
    headers.join(','),
    ...rows.map(r => headers.map(h => JSON.stringify(r[h] ?? '')).join(','))
  ].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `metaflow-audit-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

const eventIcon = (tag: string) => {
  const t = (tag ?? '').toLowerCase();
  if (t.includes('scale') || t.includes('budget') || t.includes('increas')) {
    return '<path stroke-linecap="round" stroke-linejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941"/>';
  }
  if (t.includes('pause') || t.includes('stop') || t.includes('kill')) {
    return '<path stroke-linecap="round" stroke-linejoin="round" d="M15.75 5.25v13.5m-7.5-13.5v13.5"/>';
  }
  if (t.includes('alert') || t.includes('warn') || t.includes('risk')) {
    return '<path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z"/>';
  }
  return '<path stroke-linecap="round" stroke-linejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"/>';
};
</script>

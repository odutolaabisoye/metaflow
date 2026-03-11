<template>
  <div class="space-y-6">
    <!-- Page header -->
    <div>
      <h1 class="text-xl font-semibold text-white">Platform Overview</h1>
      <p class="text-sm text-white/65 mt-1">Real-time metrics across all users and stores</p>
    </div>

    <!-- Stat cards -->
    <div v-if="loading" class="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <div v-for="i in 4" :key="i" class="h-28 rounded-2xl bg-white/4 animate-pulse border border-white/6"></div>
    </div>

    <div v-else class="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <div
        v-for="stat in statCards"
        :key="stat.label"
        class="relative overflow-hidden rounded-2xl border border-white/8 bg-white/[0.03] p-5"
      >
        <div class="flex items-start justify-between mb-3">
          <div class="h-9 w-9 rounded-xl flex items-center justify-center" :class="stat.iconBg">
            <svg class="w-4.5 h-4.5" :class="stat.iconColor" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
              <path stroke-linecap="round" stroke-linejoin="round" :d="stat.icon"/>
            </svg>
          </div>
        </div>
        <p class="text-2xl font-bold text-white tabular-nums">{{ stat.value }}</p>
        <p class="text-xs text-white/70 mt-0.5">{{ stat.label }}</p>
        <p v-if="stat.sub" class="text-[10px] text-white/50 mt-0.5">{{ stat.sub }}</p>
      </div>
    </div>

    <!-- Two-column: Platform breakdown + Recent signups -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">

      <!-- Platform breakdown -->
      <div class="rounded-2xl border border-white/8 bg-white/[0.03] p-5">
        <h2 class="text-sm font-semibold text-white/80 mb-4">Platform Distribution</h2>
        <div v-if="loading" class="space-y-3">
          <div v-for="i in 3" :key="i" class="h-10 rounded-xl bg-white/4 animate-pulse"></div>
        </div>
        <div v-else-if="!stats?.platformBreakdown?.length" class="py-8 text-center text-sm text-white/55">No stores yet</div>
        <div v-else class="space-y-3">
          <div v-for="p in platformBreakdownSorted" :key="p.platform" class="flex items-center gap-3">
            <div class="flex items-center gap-2 w-28 flex-shrink-0">
              <span class="inline-block h-2 w-2 rounded-full" :class="platformDot(p.platform)"></span>
              <span class="text-xs text-white/80 capitalize">{{ p.platform.toLowerCase() }}</span>
            </div>
            <div class="flex-1 h-2 rounded-full bg-white/8 overflow-hidden">
              <div
                class="h-full rounded-full transition-all duration-700"
                :class="platformBar(p.platform)"
                :style="{ width: `${(p.count / totalStores) * 100}%` }"
              ></div>
            </div>
            <span class="text-xs font-semibold text-white/70 w-6 text-right">{{ p.count }}</span>
          </div>
        </div>
      </div>

      <!-- Recent signups -->
      <div class="rounded-2xl border border-white/8 bg-white/[0.03] p-5">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-sm font-semibold text-white/80">Recent Signups</h2>
          <NuxtLink to="/admin/users" class="text-xs text-violet-400 hover:text-violet-300 transition-colors">View all →</NuxtLink>
        </div>
        <div v-if="loading" class="space-y-2.5">
          <div v-for="i in 5" :key="i" class="h-10 rounded-xl bg-white/4 animate-pulse"></div>
        </div>
        <div v-else-if="!stats?.recentUsers?.length" class="py-8 text-center text-sm text-white/55">No users yet</div>
        <div v-else class="space-y-1.5">
          <NuxtLink
            v-for="user in stats.recentUsers"
            :key="user.id"
            :to="`/admin/users/${user.id}`"
            class="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-white/[0.04] transition-colors group"
          >
            <div class="h-7 w-7 flex-shrink-0 rounded-full bg-gradient-to-br from-violet-500/30 to-indigo-600/30 border border-violet-500/20 flex items-center justify-center text-[10px] font-bold text-violet-300">
              {{ (user.name || user.email).charAt(0).toUpperCase() }}
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-xs font-medium text-white/80 truncate">{{ user.name || user.email }}</p>
              <p class="text-[10px] text-white/60 truncate">{{ user._count.stores }} store{{ user._count.stores !== 1 ? 's' : '' }}</p>
            </div>
            <div class="flex items-center gap-2 flex-shrink-0">
              <span
                v-if="user.role === 'ADMIN'"
                class="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-violet-500/15 border border-violet-500/25 text-violet-400 uppercase tracking-wider"
              >Admin</span>
              <span class="text-[10px] text-white/50">{{ timeAgo(user.createdAt) }}</span>
            </div>
          </NuxtLink>
        </div>
      </div>
    </div>

    <!-- Recent Activity -->
    <div class="rounded-2xl border border-white/8 bg-white/[0.03] p-5">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-sm font-semibold text-white/80">Recent Activity</h2>
        <NuxtLink to="/admin/activity" class="text-xs text-violet-400 hover:text-violet-300 transition-colors">View all →</NuxtLink>
      </div>
      <div v-if="loading" class="space-y-2.5">
        <div v-for="i in 6" :key="i" class="h-10 rounded-xl bg-white/4 animate-pulse"></div>
      </div>
      <div v-else-if="!stats?.recentActivity?.length" class="py-10 text-center text-sm text-white/55">No activity yet</div>
      <div v-else class="divide-y divide-white/5">
        <div
          v-for="log in stats.recentActivity"
          :key="log.id"
          class="flex items-start gap-3 py-3 first:pt-0 last:pb-0"
        >
          <!-- Tag dot -->
          <div class="mt-0.5 h-5 w-5 flex-shrink-0 rounded-md flex items-center justify-center" :class="tagStyle(log.action).bg">
            <svg class="w-3 h-3" :class="tagStyle(log.action).icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" :d="tagStyle(log.action).path"/>
            </svg>
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-xs font-medium text-white/75">{{ log.action }}</p>
            <p class="text-[10px] text-white/60 truncate mt-0.5">
              {{ log.store?.name }} · {{ log.store?.owner?.email }}
            </p>
          </div>
          <span class="text-[10px] text-white/50 flex-shrink-0 mt-0.5">{{ timeAgo(log.createdAt) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'admin' });

const config = useRuntimeConfig();

interface PlatformBreakdown { platform: string; count: number }
interface RecentUser { id: string; email: string; name?: string; role: string; createdAt: string; _count: { stores: number } }
interface ActivityLog {
  id: string; action: string; detail?: string; createdAt: string;
  store?: { id: string; name: string; platform: string; owner?: { email: string; name?: string } }
}
interface Stats {
  totalUsers: number; totalStores: number; totalProducts: number;
  totalConnections: number; adminCount: number;
  platformBreakdown: PlatformBreakdown[];
  recentUsers: RecentUser[];
  recentActivity: ActivityLog[];
}

const loading = ref(true);
const stats = ref<Stats | null>(null);

const totalStores = computed(() =>
  stats.value?.platformBreakdown.reduce((s, p) => s + p.count, 0) ?? 0
);

const platformBreakdownSorted = computed(() =>
  [...(stats.value?.platformBreakdown ?? [])].sort((a, b) => b.count - a.count)
);

const statCards = computed(() => [
  {
    label: 'Total Users',
    value: stats.value?.totalUsers ?? 0,
    sub: `${stats.value?.adminCount ?? 0} admin${(stats.value?.adminCount ?? 0) !== 1 ? 's' : ''}`,
    icon: 'M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z',
    iconBg: 'bg-violet-500/10',
    iconColor: 'text-violet-400',
  },
  {
    label: 'Total Stores',
    value: stats.value?.totalStores ?? 0,
    sub: `${totalStores.value} connected`,
    icon: 'M13.5 21v-7.5a.75.75 0 0 1 .75-.75h3a.75.75 0 0 1 .75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 0 0 3.75-.615A2.993 2.993 0 0 0 9.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 0 0 2.25 1.016c.896 0 1.7-.393 2.25-1.015a3.001 3.001 0 0 0 3.75.614m-16.5 0a3.004 3.004 0 0 1-.621-4.72L4.318 3.44A1.5 1.5 0 0 1 5.378 3h13.243a1.5 1.5 0 0 1 1.06.44l1.19 1.189a3 3 0 0 1-.621 4.72m-13.5 8.65h3.75a.75.75 0 0 0 .75-.75V13.5a.75.75 0 0 0-.75-.75H6.75a.75.75 0 0 0-.75.75v3.75c0 .415.336.75.75.75Z',
    iconBg: 'bg-indigo-500/10',
    iconColor: 'text-indigo-400',
  },
  {
    label: 'Total Products',
    value: stats.value?.totalProducts ?? 0,
    sub: 'across all stores',
    icon: 'M20.25 7.5l-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z',
    iconBg: 'bg-sky-500/10',
    iconColor: 'text-sky-400',
  },
  {
    label: 'Connections',
    value: stats.value?.totalConnections ?? 0,
    sub: 'OAuth & API integrations',
    icon: 'M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244',
    iconBg: 'bg-emerald-500/10',
    iconColor: 'text-emerald-400',
  },
]);

function platformDot(platform: string) {
  const map: Record<string, string> = {
    SHOPIFY: 'bg-emerald-400',
    WOOCOMMERCE: 'bg-violet-400',
    API: 'bg-sky-400',
  };
  return map[platform] ?? 'bg-white/30';
}

function platformBar(platform: string) {
  const map: Record<string, string> = {
    SHOPIFY: 'bg-emerald-500',
    WOOCOMMERCE: 'bg-violet-500',
    API: 'bg-sky-500',
  };
  return map[platform] ?? 'bg-white/30';
}

function tagStyle(action: string) {
  const a = action.toUpperCase();
  if (a.includes('SYNC')) return { bg: 'bg-sky-500/10', icon: 'text-sky-400', path: 'M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99' };
  if (a.includes('CONNECT') || a.includes('SHOPIFY') || a.includes('META') || a.includes('WOOCOMMERCE')) return { bg: 'bg-emerald-500/10', icon: 'text-emerald-400', path: 'M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244' };
  if (a.includes('DELETE') || a.includes('DISCONNECT') || a.includes('KILL')) return { bg: 'bg-red-500/10', icon: 'text-red-400', path: 'M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0' };
  return { bg: 'bg-white/5', icon: 'text-white/55', path: 'M11.25 11.25l.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z' };
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

onMounted(async () => {
  try {
    const res = await $fetch<{ ok: boolean; stats: Stats }>(
      `${config.public.apiBase}/v1/admin/stats`,
      { credentials: 'include' }
    );
    if (res?.ok) stats.value = res.stats;
  } catch (err: any) {
    if (err?.statusCode === 403 || err?.statusCode === 401) navigateTo('/app');
  } finally {
    loading.value = false;
  }
});
</script>

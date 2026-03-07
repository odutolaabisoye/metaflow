<template>
  <div class="min-h-screen bg-ink-950 text-white overflow-hidden">
    <div class="pointer-events-none fixed inset-0 bg-haze opacity-60" aria-hidden="true"></div>
    <div class="pointer-events-none fixed inset-0 bg-grid bg-[length:24px_24px] opacity-[0.12]" aria-hidden="true"></div>

    <div class="relative flex h-screen overflow-hidden">

      <!-- ── Sidebar ── -->
      <aside
        :class="[
          'flex-shrink-0 flex-col border-r border-white/10 bg-ink-950/95 backdrop-blur-xl transition-all duration-300 hidden lg:flex',
          sidebarOpen ? 'w-60' : 'w-[72px]',
        ]"
      >
        <!-- Logo -->
        <div class="flex h-16 items-center border-b border-white/10 px-4 gap-3 overflow-hidden">
          <NuxtLink to="/" class="flex items-center gap-3 overflow-hidden min-w-0">
            <div class="h-9 w-9 flex-shrink-0 rounded-xl bg-gradient-to-br from-glow-500 to-lime-500 flex items-center justify-center shadow-glow">
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                <path d="M2 13L8 3L14 13H2Z" stroke="white" stroke-width="1.5" stroke-linejoin="round" fill="none"/>
                <circle cx="8" cy="8" r="2" fill="white"/>
              </svg>
            </div>
            <div v-if="sidebarOpen" class="min-w-0">
              <p class="text-sm font-semibold leading-none truncate">MetaFlow</p>
              <p class="text-xs text-white/35 mt-0.5">Catalog Intelligence</p>
            </div>
          </NuxtLink>
        </div>

        <!-- Nav -->
        <nav class="flex-1 overflow-y-auto py-4 px-2 space-y-0.5">
          <p v-if="sidebarOpen" class="px-3 py-2 text-[10px] font-semibold uppercase tracking-widest text-white/25">Main</p>

          <NuxtLink
            v-for="item in nav"
            :key="item.to"
            :to="item.to"
            class="relative flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-200 group"
            :class="route.path === item.to ? 'bg-white/10 text-white' : 'text-white/45 hover:text-white hover:bg-white/5'"
          >
            <div v-if="route.path === item.to" class="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full" :style="{ background: item.color }"></div>
            <div class="h-8 w-8 flex-shrink-0 rounded-lg flex items-center justify-center transition-colors" :class="route.path === item.to ? 'bg-white/8' : 'group-hover:bg-white/5'" :style="route.path === item.to ? { color: item.color } : {}">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" v-html="item.icon"></svg>
            </div>
            <template v-if="sidebarOpen">
              <span class="flex-1 text-sm font-medium truncate">{{ item.label }}</span>
              <span v-if="item.badge" class="rounded-full px-1.5 py-0.5 text-[10px] font-semibold" :style="{ background: item.badgeBg, color: item.badgeColor }">{{ item.badge }}</span>
            </template>
            <div v-if="!sidebarOpen" class="pointer-events-none absolute left-full ml-2.5 z-50 hidden group-hover:flex items-center">
              <div class="rounded-lg bg-ink-800 border border-white/15 px-2.5 py-1.5 text-xs font-medium text-white shadow-xl whitespace-nowrap">{{ item.label }}</div>
            </div>
          </NuxtLink>

          <div class="my-3 border-t border-white/8 mx-2"></div>
          <p v-if="sidebarOpen" class="px-3 py-2 text-[10px] font-semibold uppercase tracking-widest text-white/25">Workspace</p>

          <NuxtLink
            v-for="item in navSecondary"
            :key="item.to"
            :to="item.to"
            class="relative flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-200 group"
            :class="route.path === item.to ? 'bg-white/10 text-white' : 'text-white/45 hover:text-white hover:bg-white/5'"
          >
            <div class="h-8 w-8 flex-shrink-0 rounded-lg flex items-center justify-center">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" v-html="item.icon"></svg>
            </div>
            <span v-if="sidebarOpen" class="text-sm font-medium truncate">{{ item.label }}</span>
            <div v-if="!sidebarOpen" class="pointer-events-none absolute left-full ml-2.5 z-50 hidden group-hover:flex items-center">
              <div class="rounded-lg bg-ink-800 border border-white/15 px-2.5 py-1.5 text-xs font-medium text-white shadow-xl whitespace-nowrap">{{ item.label }}</div>
            </div>
          </NuxtLink>
        </nav>

        <!-- Bottom -->
        <div class="flex-shrink-0 border-t border-white/10 p-3 space-y-2">
          <div v-if="sidebarOpen" class="rounded-xl bg-white/[0.04] border border-white/8 p-3">
            <div class="flex items-center justify-between mb-1.5">
              <p class="text-xs text-white/40">Automation</p>
              <span class="flex items-center gap-1 text-xs text-lime-400">
                <span class="h-1.5 w-1.5 rounded-full bg-lime-400 animate-pulse"></span>
                Live
              </span>
            </div>
            <p class="text-sm font-medium">4 rules running</p>
            <p class="text-xs text-white/30 mt-0.5">Last action 12m ago</p>
          </div>
          <button class="w-full flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] py-2 text-xs text-white/35 hover:text-white/60 hover:bg-white/5 transition-all" @click="sidebarOpen = !sidebarOpen">
            <svg class="w-3.5 h-3.5 transition-transform" :class="sidebarOpen ? '' : 'rotate-180'" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M18.75 19.5l-7.5-7.5 7.5-7.5m-6 15L5.25 12l7.5-7.5"/></svg>
            <span v-if="sidebarOpen" class="text-[11px]">Collapse</span>
          </button>
        </div>
      </aside>

      <!-- ── Main ── -->
      <div class="flex flex-1 flex-col min-w-0 overflow-hidden">
        <!-- Header -->
        <header class="flex-shrink-0 flex h-16 items-center justify-between border-b border-white/10 bg-ink-950/80 backdrop-blur-xl px-5 gap-4">
          <div class="flex items-center gap-3">
            <button class="lg:hidden rounded-xl border border-white/10 bg-white/5 p-2 text-white/50 hover:text-white transition-colors" @click="navOpen = !navOpen">
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"/></svg>
            </button>
            <div class="hidden sm:flex items-center gap-2 text-sm">
              <span class="text-white/30">MetaFlow</span>
              <svg class="w-3.5 h-3.5 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5"/></svg>
              <span class="font-medium text-white/80">{{ pageTitle }}</span>
            </div>
          </div>
          <div class="flex items-center gap-2.5">
            <div class="hidden md:flex items-center gap-1.5 rounded-full bg-white/5 border border-white/10 px-3 py-1.5 text-xs">
              <span class="h-1.5 w-1.5 rounded-full bg-lime-400 animate-pulse"></span>
              <span class="text-white/45">Meta sync healthy</span>
            </div>
            <select v-model="selectedRange" class="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs text-white/60 outline-none focus:border-glow-500/40 transition-colors cursor-pointer">
              <option v-for="opt in rangeOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
            </select>
            <NuxtLink to="/app/audit" class="relative h-8 w-8 rounded-xl border border-white/10 bg-white/5 flex items-center justify-center text-white/45 hover:text-white hover:bg-white/10 transition-all" title="Activity log">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"/></svg>
              <span class="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-ember-500 border border-ink-950"></span>
            </NuxtLink>
            <NuxtLink to="/app/settings" class="h-8 w-8 rounded-xl bg-gradient-to-br from-glow-500/20 to-lime-500/20 border border-white/15 flex items-center justify-center text-xs font-bold text-glow-400 hover:border-white/25 transition-all" title="Account settings">U</NuxtLink>
          </div>
        </header>

        <!-- Page content -->
        <main class="flex-1 overflow-y-auto px-6 py-7">
          <slot />
        </main>
      </div>
    </div>

    <!-- Mobile drawer -->
    <Transition name="fade">
      <div v-if="navOpen" class="fixed inset-0 z-50 flex lg:hidden">
        <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" @click="navOpen = false"></div>
        <div class="relative w-72 max-w-[85vw] bg-ink-900 flex flex-col h-full shadow-xl overflow-y-auto">
          <div class="flex items-center justify-between border-b border-white/10 h-16 px-5">
            <div class="flex items-center gap-2.5">
              <div class="h-8 w-8 rounded-xl bg-gradient-to-br from-glow-500 to-lime-500 flex items-center justify-center flex-shrink-0">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M2 13L8 3L14 13H2Z" stroke="white" stroke-width="1.5" stroke-linejoin="round" fill="none"/><circle cx="8" cy="8" r="2" fill="white"/></svg>
              </div>
              <span class="font-semibold text-sm">MetaFlow</span>
            </div>
            <button class="text-white/40 hover:text-white p-1" @click="navOpen = false">
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>
          <nav class="flex-1 p-4 space-y-0.5">
            <NuxtLink v-for="item in [...nav, ...navSecondary]" :key="item.to" :to="item.to" class="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors" :class="route.path === item.to ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white hover:bg-white/5'" @click="navOpen = false">
              <div class="h-7 w-7 rounded-lg flex items-center justify-center bg-white/5 flex-shrink-0">
                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" v-html="item.icon"></svg>
              </div>
              {{ item.label }}
            </NuxtLink>
          </nav>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { useGlobalFilters } from '~/composables/useGlobalFilters';

const route = useRoute();
const navOpen = ref(false);
const sidebarOpen = ref(true);
const { selectedRange, rangeOptions } = useGlobalFilters();

const nav = [
  {
    label: 'Dashboard', to: '/app', color: '#22d3ee',
    badge: 'Live', badgeBg: 'rgba(34,211,238,0.1)', badgeColor: '#22d3ee',
    icon: '<path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z"/>',
  },
  {
    label: 'Products', to: '/app/products', color: '#84cc16', badge: null,
    icon: '<path stroke-linecap="round" stroke-linejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z"/><path stroke-linecap="round" stroke-linejoin="round" d="M6 6h.008v.008H6V6z"/>',
  },
  {
    label: 'Audit Log', to: '/app/audit', color: '#f97316', badge: null,
    icon: '<path stroke-linecap="round" stroke-linejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z"/>',
  },
];

const navSecondary = [
  {
    label: 'Settings', to: '/app/settings',
    icon: '<path stroke-linecap="round" stroke-linejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z"/><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>',
  },
  {
    label: 'Onboarding', to: '/app/onboarding',
    icon: '<path stroke-linecap="round" stroke-linejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z"/>',
  },
];

const pageTitle = computed(() => {
  if (route.path === '/app/products') return 'Product Scoring';
  if (route.path === '/app/audit') return 'Automation Audit';
  if (route.path === '/app/settings') return 'Settings';
  if (route.path === '/app/onboarding') return 'Onboarding';
  return 'Performance Overview';
});

const pageSection = computed(() => {
  if (route.path === '/app/products') return 'Catalog Intelligence';
  if (route.path === '/app/audit') return 'Transparency';
  if (route.path === '/app/settings') return 'Workspace';
  if (route.path === '/app/onboarding') return 'Setup';
  return 'Meta Catalog Command';
});

const pageSubtitle = computed(() => {
  if (route.path === '/app/products') return 'Prioritize winners, isolate risks, and accelerate testing.';
  if (route.path === '/app/audit') return 'Every automated action with full context and rollback intent.';
  if (route.path === '/app/settings') return 'Tune rules, budgets, and notification preferences.';
  if (route.path === '/app/onboarding') return 'Connect your store, Meta Ads, and automation rules.';
  return 'Catalog-level signals, Meta performance, and AI guidance.';
});
</script>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>

<template>
  <div class="min-h-screen bg-ink-950 text-white overflow-hidden">
    <div class="pointer-events-none fixed inset-0 bg-haze opacity-40" aria-hidden="true"></div>
    <div class="pointer-events-none fixed inset-0 bg-grid bg-[length:24px_24px] opacity-[0.08]" aria-hidden="true"></div>

    <div class="relative flex h-screen overflow-hidden">

      <!-- ── Admin Sidebar ── -->
      <aside class="flex-shrink-0 flex flex-col w-60 border-r border-white/10 bg-ink-950/95 backdrop-blur-xl">

        <!-- Logo + Admin badge -->
        <div class="flex h-16 items-center border-b border-white/10 px-4 gap-3">
          <NuxtLink to="/" class="flex items-center gap-3 min-w-0">
            <div class="h-9 w-9 flex-shrink-0 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                <path d="M2 13L8 3L14 13H2Z" stroke="white" stroke-width="1.5" stroke-linejoin="round" fill="none"/>
                <circle cx="8" cy="8" r="2" fill="white"/>
              </svg>
            </div>
            <div class="min-w-0">
              <p class="text-sm font-semibold leading-none truncate">MetaFlow</p>
              <div class="flex items-center gap-1.5 mt-0.5">
                <span class="inline-flex items-center rounded-full bg-violet-500/15 border border-violet-500/30 px-1.5 py-px text-[9px] font-bold tracking-wider text-violet-400 uppercase">Admin</span>
              </div>
            </div>
          </NuxtLink>
        </div>

        <!-- Navigation -->
        <nav class="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
          <p class="px-3 py-1 text-[9px] font-bold tracking-[0.12em] uppercase text-white/50 mb-1">Platform</p>

          <NuxtLink
            v-for="item in navItems"
            :key="item.to"
            :to="item.to"
            class="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all"
            :class="isActive(item.to)
              ? 'bg-violet-500/15 text-violet-300 border border-violet-500/20'
              : 'text-white/80 hover:text-white/85 hover:bg-white/[0.04]'"
          >
            <svg class="w-4 h-4 flex-shrink-0 transition-colors" :class="isActive(item.to) ? 'text-violet-400' : 'text-white/60 group-hover:text-white/80'" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
              <path stroke-linecap="round" stroke-linejoin="round" :d="item.icon"/>
            </svg>
            <span>{{ item.label }}</span>
            <span v-if="item.badge" class="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full" :class="isActive(item.to) ? 'bg-violet-500/20 text-violet-300' : 'bg-white/8 text-white/65'">{{ item.badge }}</span>
          </NuxtLink>

          <div class="pt-3 mt-3 border-t border-white/8">
            <p class="px-3 py-1 text-[9px] font-bold tracking-[0.12em] uppercase text-white/50 mb-1">Quick links</p>
            <NuxtLink
              to="/app"
              class="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-white/80 hover:text-white/85 hover:bg-white/[0.04] transition-all"
            >
              <svg class="w-4 h-4 flex-shrink-0 text-white/60 group-hover:text-white/80" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3"/>
              </svg>
              <span>Back to App</span>
            </NuxtLink>
          </div>
        </nav>

        <!-- User footer -->
        <div class="border-t border-white/10 px-2 py-2">
          <div class="flex items-center gap-3 rounded-xl px-3 py-2.5">
            <div class="h-8 w-8 flex-shrink-0 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-xs font-bold text-white">
              {{ userInitial }}
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-xs font-medium text-white/80 truncate">{{ userName }}</p>
              <p class="text-[10px] text-white/60 truncate">Administrator</p>
            </div>
            <button
              @click="logout"
              title="Logout"
              class="flex-shrink-0 p-1.5 rounded-lg text-white/55 hover:text-white/80 hover:bg-white/8 transition-colors"
            >
              <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 9V5.25A2.25 2.25 0 0 1 10.5 3h6a2.25 2.25 0 0 1 2.25 2.25v13.5A2.25 2.25 0 0 1 16.5 21h-6a2.25 2.25 0 0 1-2.25-2.25V15M12 9l3 3m0 0-3 3m3-3H2.25"/>
              </svg>
            </button>
          </div>
        </div>
      </aside>

      <!-- ── Main content ── -->
      <main class="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <!-- Top bar -->
        <header class="flex-shrink-0 h-16 flex items-center justify-between border-b border-white/8 bg-ink-950/80 backdrop-blur-xl px-6">
          <div class="flex items-center gap-2 text-sm text-white/65">
            <span class="text-violet-400 font-medium">Admin</span>
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5"/>
            </svg>
            <span class="text-white/80">{{ currentPageTitle }}</span>
          </div>
          <div class="flex items-center gap-2">
            <div class="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></div>
            <span class="text-xs text-white/60">Live</span>
          </div>
        </header>

        <!-- Page content -->
        <div class="flex-1 p-6">
          <slot />
        </div>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
const route = useRoute();
const config = useRuntimeConfig();

const userName = ref('Admin');
const userInitial = computed(() => userName.value.charAt(0).toUpperCase());

const navItems = [
  {
    to: '/admin',
    label: 'Overview',
    icon: 'M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z',
  },
  {
    to: '/admin/users',
    label: 'Users',
    icon: 'M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z',
  },
  {
    to: '/admin/stores',
    label: 'Stores',
    icon: 'M13.5 21v-7.5a.75.75 0 0 1 .75-.75h3a.75.75 0 0 1 .75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 0 0 3.75-.615A2.993 2.993 0 0 0 9.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 0 0 2.25 1.016c.896 0 1.7-.393 2.25-1.015a3.001 3.001 0 0 0 3.75.614m-16.5 0a3.004 3.004 0 0 1-.621-4.72L4.318 3.44A1.5 1.5 0 0 1 5.378 3h13.243a1.5 1.5 0 0 1 1.06.44l1.19 1.189a3 3 0 0 1-.621 4.72m-13.5 8.65h3.75a.75.75 0 0 0 .75-.75V13.5a.75.75 0 0 0-.75-.75H6.75a.75.75 0 0 0-.75.75v3.75c0 .415.336.75.75.75Z',
  },
  {
    to: '/admin/activity',
    label: 'Activity',
    icon: 'M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 0 1 0 3.75H5.625a1.875 1.875 0 0 1 0-3.75Z',
  },
  {
    to: '/admin/meta-debug',
    label: 'Meta Debug',
    icon: 'M11.42 15.17 17.25 21A2.652 2.652 0 0 0 21 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 1 1-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 0 0 4.486-6.336l-3.276 3.277a3.004 3.004 0 0 1-2.25-2.25l3.276-3.276a4.5 4.5 0 0 0-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437 1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008Z',
    badge: 'debug',
  },
];

const pageMap: Record<string, string> = {
  '/admin': 'Overview',
  '/admin/users': 'Users',
  '/admin/stores': 'Stores',
  '/admin/activity': 'Activity',
  '/admin/meta-debug': 'Meta Debug',
};

const currentPageTitle = computed(() => {
  const path = route.path;
  if (path.startsWith('/admin/users/')) return 'User Detail';
  return pageMap[path] ?? 'Admin';
});

function isActive(to: string) {
  if (to === '/admin') return route.path === '/admin';
  return route.path.startsWith(to);
}

// Fetch current admin user info
onMounted(async () => {
  try {
    const res = await $fetch<{ ok: boolean; user: { name?: string; email: string; role: string } }>(
      `${config.public.apiBase}/v1/auth/me`,
      { credentials: 'include' }
    );
    if (res?.ok && res.user) {
      userName.value = res.user.name || res.user.email.split('@')[0];
    }
  } catch {
    // session expired — redirect to login
    navigateTo('/auth/login');
  }
});

async function logout() {
  try {
    await $fetch(`${config.public.apiBase}/v1/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    });
  } catch {}
  // Clear frontend flag cookies
  const authFlag = useCookie('mf_auth');
  const roleFlag = useCookie('mf_role');
  authFlag.value = null;
  roleFlag.value = null;
  navigateTo('/auth/login');
}
</script>

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
              <p class="text-xs text-white/75 mt-0.5">Catalog Intelligence</p>
            </div>
          </NuxtLink>
        </div>

        <!-- ── Store Switcher ── (always visible) -->
        <div class="px-2 py-2 border-b border-white/8">

          <!-- No stores yet: prompt to connect -->
          <NuxtLink
            v-if="allStores.length === 0"
            to="/app/onboarding"
            class="relative group/cta w-full flex items-center gap-2.5 rounded-xl border border-dashed border-white/12 px-2.5 py-2 text-white/65 hover:text-white/80 hover:border-white/20 hover:bg-white/[0.03] transition-colors"
            :class="sidebarOpen ? '' : 'justify-center'"
          >
            <div class="h-8 w-8 flex-shrink-0 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.015a3.001 3.001 0 003.75.614m-16.5 0a3.004 3.004 0 01-.621-4.72L4.318 3.44A1.5 1.5 0 015.378 3h13.243a1.5 1.5 0 011.06.44l1.19 1.189a3 3 0 01-.621 4.72m-13.5 8.65h3.75a.75.75 0 00.75-.75V13.5a.75.75 0 00-.75-.75H6.75a.75.75 0 00-.75.75v3.75c0 .415.336.75.75.75z"/>
              </svg>
            </div>
            <template v-if="sidebarOpen">
              <div class="flex-1 min-w-0">
                <p class="text-xs font-semibold truncate">Connect a store</p>
                <p class="text-[10px] leading-none mt-0.5 text-white/65 truncate">Set up your first business</p>
              </div>
              <svg class="w-3 h-3 flex-shrink-0 text-white/45" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5"/>
              </svg>
            </template>
            <!-- Collapsed tooltip -->
            <div
              v-if="!sidebarOpen"
              class="pointer-events-none absolute left-full ml-2.5 top-1/2 -translate-y-1/2 z-50 hidden group-hover/cta:flex items-center"
            >
              <div class="rounded-lg bg-ink-800 border border-white/15 px-2.5 py-1.5 text-xs font-medium text-white shadow-xl whitespace-nowrap">
                Connect a store
              </div>
            </div>
          </NuxtLink>

          <!-- Has stores: switcher -->
          <div v-else class="relative group" ref="storeSwitcherRef">
            <!-- Trigger button -->
            <button
              @click="storeSwitcherOpen = !storeSwitcherOpen"
              class="w-full flex items-center gap-2.5 rounded-xl px-2.5 py-2 hover:bg-white/5 transition-colors cursor-pointer"
              :class="sidebarOpen ? '' : 'justify-center'"
            >
              <!-- Store avatar (coloured letter) -->
              <div
                class="h-8 w-8 flex-shrink-0 rounded-lg flex items-center justify-center text-xs font-bold"
                :style="{ background: storeStyle(activeStore?.platform).bg, color: storeStyle(activeStore?.platform).color }"
              >
                {{ activeStore?.name?.charAt(0)?.toUpperCase() ?? '?' }}
              </div>
              <!-- Expanded: name + platform + chevron -->
              <template v-if="sidebarOpen">
                <div class="flex-1 min-w-0 text-left">
                  <p class="text-sm font-semibold text-white/90 leading-none mb-0.5 truncate">
                    {{ activeStore?.name ?? 'Select store' }}
                  </p>
                  <div class="flex items-center gap-1.5">
                    <span class="h-1.5 w-1.5 rounded-full flex-shrink-0" :class="syncStatusClass(activeStore?.lastSyncStatus)"></span>
                    <p class="text-[11px] text-white/75 leading-none truncate">
                      {{ activeStore?.lastSyncStatus === 'RUNNING' ? 'Syncing…' : `Synced ${timeAgo(activeStore?.lastSyncAt)}` }}
                    </p>
                  </div>
                </div>
                <svg
                  class="w-3.5 h-3.5 text-white/50 flex-shrink-0 transition-transform duration-200"
                  :class="storeSwitcherOpen ? 'rotate-180' : ''"
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/>
                </svg>
              </template>
            </button>

            <!-- Collapsed: tooltip on hover -->
            <div
              v-if="!sidebarOpen"
              class="pointer-events-none absolute left-full ml-2.5 top-1/2 -translate-y-1/2 z-50 hidden group-hover:flex items-center"
            >
              <div class="rounded-lg bg-ink-800 border border-white/15 px-2.5 py-1.5 text-xs font-medium text-white shadow-xl whitespace-nowrap">
                {{ activeStore?.name ?? 'Select store' }}
              </div>
            </div>

            <!-- Dropdown (expanded mode only) -->
            <Transition name="dropdown">
              <div
                v-if="storeSwitcherOpen && sidebarOpen"
                class="absolute left-0 right-0 top-full mt-1 z-50 rounded-xl border border-white/15 bg-ink-900/98 backdrop-blur-xl shadow-2xl overflow-hidden"
              >
                <!-- Store list -->
                <div class="p-1 max-h-52 overflow-y-auto">
                  <button
                    v-for="store in allStores"
                    :key="store.id"
                    @click="switchStore(store)"
                    class="w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors"
                    :class="store.id === activeStore?.id ? 'bg-white/8' : 'hover:bg-white/5'"
                  >
                    <div
                      class="h-7 w-7 flex-shrink-0 rounded-md flex items-center justify-center text-[11px] font-bold"
                      :style="{ background: storeStyle(store.platform).bg, color: storeStyle(store.platform).color }"
                    >
                      {{ store.name.charAt(0).toUpperCase() }}
                    </div>
                    <div class="flex-1 min-w-0">
                      <p
                        class="text-xs font-medium leading-none mb-0.5 truncate"
                        :class="store.id === activeStore?.id ? 'text-white' : 'text-white/80'"
                      >
                        {{ store.name }}
                      </p>
                      <p class="text-[10px] text-white/70 capitalize leading-none truncate">
                        {{ store.platform.toLowerCase() }}{{ store._count?.products != null ? ` · ${store._count.products} products` : '' }}
                      </p>
                    </div>
                    <!-- Active checkmark -->
                    <svg
                      v-if="store.id === activeStore?.id"
                      class="w-3.5 h-3.5 text-glow-400 flex-shrink-0"
                      fill="currentColor" viewBox="0 0 20 20"
                    >
                      <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                    </svg>
                  </button>
                </div>
                <!-- Add another store -->
                <div class="border-t border-white/8 p-1">
                  <NuxtLink
                    to="/app/onboarding"
                    @click="storeSwitcherOpen = false"
                    class="flex items-center gap-2 rounded-lg px-2.5 py-2 text-[11px] font-medium text-white/65 hover:text-white/70 hover:bg-white/5 transition-colors"
                  >
                    <svg class="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/>
                    </svg>
                    Add another store
                  </NuxtLink>
                </div>
              </div>
            </Transition>
          </div>

        </div>

        <!-- Nav -->
        <nav class="flex-1 overflow-y-auto py-4 px-2 space-y-0.5">
          <p v-if="sidebarOpen" class="px-3 py-2 text-[10px] font-semibold uppercase tracking-widest text-white/60">Main</p>

          <NuxtLink
            v-for="item in nav"
            :key="item.to"
            :to="item.to"
            class="relative flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-200 group"
            :class="[
              item.locked ? 'opacity-50 cursor-default' : '',
              route.path === item.to ? 'bg-white/10 text-white' : 'text-white/70 hover:text-white hover:bg-white/5',
            ]"
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
              <div class="rounded-lg bg-ink-800 border border-white/15 px-2.5 py-1.5 text-xs font-medium text-white shadow-xl whitespace-nowrap">
                {{ item.label }}{{ item.locked ? ' — SCALE plan' : '' }}
              </div>
            </div>
          </NuxtLink>

          <div class="my-3 border-t border-white/8 mx-2"></div>
          <p v-if="sidebarOpen" class="px-3 py-2 text-[10px] font-semibold uppercase tracking-widest text-white/60">Workspace</p>

          <NuxtLink
            v-for="item in navSecondary"
            :key="item.to"
            :to="item.to"
            class="relative flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-200 group"
            :class="route.path === item.to ? 'bg-white/10 text-white' : 'text-white/70 hover:text-white hover:bg-white/5'"
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
              <p class="text-xs text-white/80">Automation</p>
              <span class="flex items-center gap-1 text-xs text-lime-400">
                <span class="h-1.5 w-1.5 rounded-full bg-lime-400 animate-pulse"></span>
                Live
              </span>
            </div>
            <p class="text-sm font-medium">4 rules running</p>
            <p class="text-xs text-white/70 mt-0.5">Last action 12m ago</p>
          </div>
          <button class="w-full flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] py-2 text-xs text-white/75 hover:text-white hover:bg-white/5 transition-all" @click="sidebarOpen = !sidebarOpen">
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
            <button class="lg:hidden rounded-xl border border-white/10 bg-white/5 p-2 text-white/75 hover:text-white transition-colors" @click="navOpen = !navOpen">
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"/></svg>
            </button>
            <div class="hidden sm:flex items-center gap-2 text-sm">
              <span class="text-white/70">MetaFlow</span>
              <svg class="w-3.5 h-3.5 text-white/45" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5"/></svg>
              <span class="font-medium text-white/80">{{ pageTitle }}</span>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <!-- Sync status pill — hidden on small mobile -->
            <div
              v-if="activeStore"
              class="hidden sm:flex items-center gap-1.5 rounded-full bg-white/5 border border-white/10 px-3 py-1.5 text-xs"
              :title="activeStore.lastSyncError ?? undefined"
            >
              <span class="h-1.5 w-1.5 rounded-full" :class="syncStatusClass(activeStore.lastSyncStatus)"></span>
              <span class="text-white/70 hidden md:inline">
                <template v-if="activeStore.lastSyncStatus === 'RUNNING'">Syncing…</template>
                <template v-else-if="activeStore.lastSyncStatus === 'ERROR'">Sync error</template>
                <template v-else-if="activeStore.lastSyncAt">{{ timeAgo(activeStore.lastSyncAt) }}</template>
                <template v-else>Not synced</template>
              </span>
            </div>
            <!-- Mobile date range button -->
            <button
              class="md:hidden rounded-xl border border-white/10 bg-white/5 p-2 text-white/75 hover:text-white transition-colors"
              @click="rangeOpen = !rangeOpen"
              title="Date range"
            >
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3M4 11h16M6 5h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V7a2 2 0 012-2z"/>
              </svg>
            </button>
            <!-- Date range — hidden on mobile, shown from md up -->
            <div class="hidden md:flex items-center gap-2">
              <select v-model="selectedRange" class="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs text-white/80 outline-none focus:border-glow-500/40 transition-colors cursor-pointer">
                <option v-for="opt in rangeOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
              </select>
              <template v-if="isCustom">
                <input v-model="customStart" type="date"
                  class="rounded-xl border border-white/10 bg-white/[0.05] px-2.5 py-1 text-xs text-white/70 outline-none focus:border-glow-500/40 transition-colors w-[130px]"/>
                <span class="text-xs text-white/60">→</span>
                <input v-model="customEnd" type="date"
                  class="rounded-xl border border-white/10 bg-white/[0.05] px-2.5 py-1 text-xs text-white/70 outline-none focus:border-glow-500/40 transition-colors w-[130px]"/>
              </template>
            </div>
            <NuxtLink to="/app/audit" class="relative h-8 w-8 rounded-xl border border-white/10 bg-white/5 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-all" title="Activity log">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"/></svg>
              <span class="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-ember-500 border border-ink-950"></span>
            </NuxtLink>
            <!-- Profile dropdown -->
            <div class="relative" ref="profileRef">
              <button
                @click="profileOpen = !profileOpen"
                class="h-8 w-8 rounded-xl bg-gradient-to-br from-glow-500/20 to-lime-500/20 border border-white/15 flex items-center justify-center text-xs font-bold text-glow-400 hover:border-white/25 transition-all"
                title="Account"
              >
                {{ userInitial }}
              </button>

              <Transition name="dropdown">
                <div v-if="profileOpen" class="absolute right-0 top-10 z-50 w-60 rounded-2xl border border-white/15 bg-ink-900/95 backdrop-blur-xl shadow-2xl overflow-hidden">
                  <!-- User info header -->
                  <div class="px-4 py-3 border-b border-white/10">
                    <div class="flex items-center gap-3">
                      <div class="h-9 w-9 rounded-xl bg-gradient-to-br from-glow-500/25 to-lime-500/25 flex items-center justify-center text-sm font-bold text-glow-400 flex-shrink-0">
                        {{ userInitial }}
                      </div>
                      <div class="min-w-0">
                        <p class="text-sm font-semibold truncate">{{ user?.name || 'Account' }}</p>
                        <p class="text-xs text-white/80 truncate">{{ user?.email || '' }}</p>
                      </div>
                    </div>
                  </div>
                  <!-- Actions -->
                  <div class="p-1.5 space-y-0.5">
                    <NuxtLink
                      to="/app/settings"
                      @click="profileOpen = false"
                      class="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-white/80 hover:text-white hover:bg-white/5 transition-colors"
                    >
                      <svg class="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z"/><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                      Profile & Settings
                    </NuxtLink>
                    <div class="h-px bg-white/8 mx-1 my-0.5"></div>
                    <button
                      @click="logout"
                      :disabled="loggingOut"
                      class="w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-ember-400 hover:text-ember-300 hover:bg-ember-500/5 transition-colors disabled:opacity-50"
                    >
                      <svg v-if="!loggingOut" class="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9"/></svg>
                      <svg v-else class="w-4 h-4 flex-shrink-0 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                      Sign out
                    </button>
                  </div>
                </div>
              </Transition>
            </div>
          </div>
        </header>

        <!-- Page content -->
        <main class="flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-7">
          <slot />
        </main>
      </div>
    </div>

    <!-- Mobile drawer -->
    <Teleport to="body">
      <Transition name="fade">
        <div v-if="navOpen" @click="navOpen = false" class="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"></div>
      </Transition>
      <Transition name="slide-left">
        <div v-if="navOpen" class="lg:hidden fixed inset-y-0 left-0 z-50 w-72 bg-ink-900 border-r border-white/[0.07] flex flex-col overflow-y-auto shadow-xl">
          <!-- Header -->
          <div class="flex items-center justify-between border-b border-white/10 h-16 px-5 flex-shrink-0">
            <div class="flex items-center gap-2.5">
              <div class="h-8 w-8 rounded-xl bg-gradient-to-br from-glow-500 to-lime-500 flex items-center justify-center flex-shrink-0">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M2 13L8 3L14 13H2Z" stroke="white" stroke-width="1.5" stroke-linejoin="round" fill="none"/><circle cx="8" cy="8" r="2" fill="white"/></svg>
              </div>
              <span class="font-semibold text-sm">MetaFlow</span>
            </div>
            <button class="text-white/65 hover:text-white p-1" @click="navOpen = false">
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>

          <!-- Mobile store switcher -->
          <div class="flex-shrink-0 border-b border-white/8 p-3">
            <p class="text-[10px] font-semibold uppercase tracking-widest text-white/45 mb-2 px-1">Store</p>
            <!-- No stores yet -->
            <NuxtLink v-if="allStores.length === 0" to="/app/onboarding" @click="navOpen = false"
              class="flex items-center gap-2.5 rounded-xl border border-dashed border-white/12 px-3 py-2.5 text-white/65 hover:text-white/80 transition-colors">
              <div class="h-7 w-7 flex-shrink-0 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg>
              </div>
              <span class="text-xs font-medium">Connect a store</span>
            </NuxtLink>
            <!-- Store list (always visible on mobile, no dropdown needed) -->
            <div v-else class="space-y-1">
              <button
                v-for="store in allStores"
                :key="store.id"
                @click="switchStore(store); navOpen = false"
                class="w-full flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors"
                :class="store.id === activeStore?.id ? 'bg-white/8' : 'hover:bg-white/5'"
              >
                <div class="h-8 w-8 flex-shrink-0 rounded-lg flex items-center justify-center text-xs font-bold"
                  :style="{ background: storeStyle(store.platform).bg, color: storeStyle(store.platform).color }">
                  {{ store.name.charAt(0).toUpperCase() }}
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-medium truncate" :class="store.id === activeStore?.id ? 'text-white' : 'text-white/80'">{{ store.name }}</p>
                  <p class="text-[10px] text-white/50 capitalize truncate">{{ store.platform.toLowerCase() }}</p>
                </div>
                <svg v-if="store.id === activeStore?.id" class="w-3.5 h-3.5 text-glow-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                </svg>
              </button>
              <NuxtLink to="/app/onboarding" @click="navOpen = false"
                class="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-white/50 hover:text-white/70 hover:bg-white/5 transition-colors">
                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg>
                Add another store
              </NuxtLink>
            </div>
          </div>

          <!-- Mobile date range -->
          <div class="border-b border-white/8 px-4 py-3">
            <p class="text-[10px] font-semibold uppercase tracking-widest text-white/45 mb-2">Date range</p>
            <div class="space-y-2">
              <select v-model="selectedRange" class="w-full rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 text-xs text-white outline-none focus:border-glow-500/40 transition-all">
                <option v-for="opt in rangeOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
              </select>
              <div v-if="isCustom" class="grid grid-cols-2 gap-2">
                <input v-model="customStart" type="date"
                  class="rounded-xl border border-white/10 bg-white/[0.05] px-2.5 py-2 text-xs text-white/70 outline-none focus:border-glow-500/40 transition-colors"/>
                <input v-model="customEnd" type="date"
                  class="rounded-xl border border-white/10 bg-white/[0.05] px-2.5 py-2 text-xs text-white/70 outline-none focus:border-glow-500/40 transition-colors"/>
              </div>
            </div>
          </div>

          <!-- Nav links -->
          <nav class="flex-1 p-4 space-y-0.5">
            <p class="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-white/45">Main</p>
            <NuxtLink v-for="item in nav" :key="item.to" :to="item.to"
              class="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors"
              :class="[
                item.locked ? 'opacity-50' : '',
                route.path === item.to ? 'bg-white/10 text-white' : 'text-white/75 hover:text-white hover:bg-white/5',
              ]"
              @click="navOpen = false">
              <div class="h-7 w-7 rounded-lg flex items-center justify-center bg-white/5 flex-shrink-0" :style="route.path === item.to ? { color: item.color } : {}">
                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" v-html="item.icon"></svg>
              </div>
              <span class="flex-1">{{ item.label }}</span>
              <span v-if="item.badge" class="rounded-full px-1.5 py-0.5 text-[10px] font-semibold" :style="{ background: item.badgeBg, color: item.badgeColor }">{{ item.badge }}</span>
            </NuxtLink>
            <div class="my-2 border-t border-white/8"></div>
            <p class="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-white/45">Workspace</p>
            <NuxtLink v-for="item in navSecondary" :key="item.to" :to="item.to"
              class="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors"
              :class="route.path === item.to ? 'bg-white/10 text-white' : 'text-white/75 hover:text-white hover:bg-white/5'"
              @click="navOpen = false">
              <div class="h-7 w-7 rounded-lg flex items-center justify-center bg-white/5 flex-shrink-0">
                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" v-html="item.icon"></svg>
              </div>
              {{ item.label }}
            </NuxtLink>
          </nav>
        </div>
      </Transition>
    </Teleport>

    <!-- Mobile date range popover -->
    <Teleport to="body">
      <Transition name="fade">
        <div v-if="rangeOpen" @click="rangeOpen = false" class="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"></div>
      </Transition>
      <Transition name="slide-up">
        <div v-if="rangeOpen" class="md:hidden fixed left-4 right-4 bottom-6 z-50 rounded-2xl border border-white/15 bg-ink-900/95 backdrop-blur-xl shadow-2xl overflow-hidden">
          <div class="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <p class="text-sm font-medium">Date range</p>
            <button class="text-white/60 hover:text-white" @click="rangeOpen = false">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>
          <div class="p-4 space-y-3">
            <select v-model="selectedRange" class="w-full rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 text-xs text-white outline-none focus:border-glow-500/40 transition-all">
              <option v-for="opt in rangeOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
            </select>
            <div v-if="isCustom" class="grid grid-cols-2 gap-2">
              <input v-model="customStart" type="date"
                class="rounded-xl border border-white/10 bg-white/[0.05] px-2.5 py-2 text-xs text-white/70 outline-none focus:border-glow-500/40 transition-colors"/>
              <input v-model="customEnd" type="date"
                class="rounded-xl border border-white/10 bg-white/[0.05] px-2.5 py-2 text-xs text-white/70 outline-none focus:border-glow-500/40 transition-colors"/>
            </div>
            <button class="w-full rounded-xl border border-white/10 bg-white/[0.06] py-2 text-xs text-white/80 hover:text-white hover:bg-white/10 transition-colors" @click="rangeOpen = false">
              Done
            </button>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { useGlobalFilters } from '~/composables/useGlobalFilters';

const route = useRoute();
const config = useRuntimeConfig();
const navOpen = ref(false);
const rangeOpen = ref(false);

// Close mobile nav on route change
watch(route, () => { navOpen.value = false; rangeOpen.value = false; });
const sidebarOpen = ref(true);
const profileOpen = ref(false);
const loggingOut = ref(false);
const profileRef = ref<HTMLElement | null>(null);
const { selectedRange, rangeOptions, customStart, customEnd, isCustom } = useGlobalFilters();

// ── User profile & store state ────────────────────────────────────────────────
const user = ref<{ id: string; email: string; name: string | null; role?: string; plan?: string } | null>(null);
const planCookie = useCookie<string | null>('mf_plan', { path: '/', sameSite: 'lax' });
// Use useState so settings.vue can update this after a disconnect
const hasStore = useState<boolean>('mf_has_store', () => false);

// ── Store switcher ────────────────────────────────────────────────────────────
interface StoreInfo {
  id: string;
  name: string;
  platform: string;
  connections: { id: string; provider: string; updatedAt?: string }[];
  _count?: { products: number };
  lastSyncAt?: string | null;
  lastSyncStatus?: string;
  lastSyncError?: string | null;
  lastSyncProvider?: string | null;
}

const allStores = useState<StoreInfo[]>('mf_stores', () => []);

// Persist the selected store across page refreshes via a 30-day cookie
const activeStoreIdCookie = useCookie<string | null>('mf_store_id', { path: '/', maxAge: 60 * 60 * 24 * 30 });
const activeStoreId = useState<string | null>('mf_active_store_id', () => activeStoreIdCookie.value ?? null);
const activeStore = computed(() =>
  allStores.value.find(s => s.id === activeStoreId.value) ?? allStores.value[0] ?? null
);
const storeSwitcherOpen = ref(false);
const storeSwitcherRef = ref<HTMLElement | null>(null);

// Platform colour coding for store avatars
const PLATFORM_STYLES: Record<string, { bg: string; color: string }> = {
  SHOPIFY:     { bg: 'rgba(150,191,72,0.18)',  color: '#96BF48' },
  WOOCOMMERCE: { bg: 'rgba(127,84,179,0.18)',  color: '#9B72CF' },
  API:         { bg: 'rgba(34,211,238,0.15)',   color: '#22d3ee' },
};
function storeStyle(platform?: string | null) {
  return PLATFORM_STYLES[platform ?? ''] ?? { bg: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.45)' };
}

/** Human-readable "Xh ago" / "Xm ago" relative time */
function timeAgo(iso?: string | null): string {
  if (!iso) return 'Never';
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return 'Just now';
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  return `${Math.floor(ms / 86_400_000)}d ago`;
}

/** Sync status dot colour */
function syncStatusClass(status?: string): string {
  if (status === 'RUNNING') return 'bg-amber-400 animate-pulse';
  if (status === 'SUCCESS') return 'bg-lime-400';
  if (status === 'ERROR')   return 'bg-ember-500';
  return 'bg-white/20'; // IDLE / unknown
}
function switchStore(store: StoreInfo) {
  activeStoreId.value = store.id;
  activeStoreIdCookie.value = store.id;
  storeSwitcherOpen.value = false;
  // Reflect the switch in the URL immediately — shareable and survives hard refresh
  navigateTo({ path: route.path, query: { ...route.query, store: store.id } }, { replace: true });
}

const userInitial = computed(() => {
  if (user.value?.name) return user.value.name.charAt(0).toUpperCase();
  if (user.value?.email) return user.value.email.charAt(0).toUpperCase();
  return '?';
});

// ── Store refresh helper ──────────────────────────────────────────────────────
async function refreshStores() {
  const res = await $fetch<{ ok: boolean; stores: StoreInfo[] }>(
    `${config.public.apiBase}/v1/stores`,
    { credentials: 'include' }
  ).catch(() => null);
  if (res?.ok) {
    allStores.value = res.stores;
    hasStore.value = res.stores.length > 0;
    // Resolution priority: ?store= URL param → persisted cookie → first store
    const urlStoreId = route.query.store as string | undefined;
    const preferredId = urlStoreId || activeStoreId.value;
    const isValid = res.stores.some(s => s.id === preferredId);
    if (isValid && preferredId) {
      activeStoreId.value = preferredId;
      activeStoreIdCookie.value = preferredId;
    } else if (res.stores.length > 0) {
      activeStoreId.value = res.stores[0].id;
      activeStoreIdCookie.value = res.stores[0].id;
    } else {
      activeStoreId.value = null;
      activeStoreIdCookie.value = null;
    }
  }
}

onMounted(async () => {
  // Fetch user + stores in parallel — both needed before rendering nav
  await Promise.all([
    $fetch<{ ok: boolean; user: { id: string; email: string; name: string | null; role?: string } }>(
      `${config.public.apiBase}/v1/auth/me`,
      { credentials: 'include' }
    ).then(res => {
      if (res.ok) {
        user.value = res.user;
        // Sync plan cookie so middleware and sidebar stay in sync
        if ((res.user as any).plan) planCookie.value = (res.user as any).plan;
      }
    }).catch(() => {}),
    refreshStores(),
  ]);

  // Sync active store into the URL on initial load if not already present
  if (activeStoreId.value && !route.query.store) {
    navigateTo({ path: route.path, query: { ...route.query, store: activeStoreId.value } }, { replace: true });
  }

  // On every in-app navigation: keep ?store= in the URL and refresh stores
  // when returning from onboarding (a new store may have been created)
  watch(() => route.path, (newPath, oldPath) => {
    // Refresh store list after completing onboarding
    if (oldPath === '/app/onboarding' && newPath !== '/app/onboarding') {
      refreshStores();
    }
    // Auto-append ?store= so the URL always reflects the active business.
    // Uses replace so navigating between pages doesn't pollute browser history.
    if (newPath.startsWith('/app') && activeStoreId.value && !route.query.store) {
      navigateTo(
        { path: newPath, query: { ...route.query, store: activeStoreId.value } },
        { replace: true }
      );
    }
  });

  // Close dropdowns when clicking outside
  const handleClickOutside = (e: MouseEvent) => {
    if (profileRef.value && !profileRef.value.contains(e.target as Node)) {
      profileOpen.value = false;
    }
    if (storeSwitcherRef.value && !storeSwitcherRef.value.contains(e.target as Node)) {
      storeSwitcherOpen.value = false;
    }
  };
  document.addEventListener('mousedown', handleClickOutside);
  onUnmounted(() => document.removeEventListener('mousedown', handleClickOutside));
});

// ── Logout ───────────────────────────────────────────────────────────────────
const authFlag = useCookie('mf_auth', { sameSite: 'lax', path: '/', maxAge: 0 });

const logout = async () => {
  loggingOut.value = true;
  profileOpen.value = false;
  try {
    // Clear the real JWT session on the backend
    await $fetch(`${config.public.apiBase}/v1/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    }).catch(() => {});
    // Clear the Nuxt-side presence cookie
    await $fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
  } finally {
    authFlag.value = null;
    await navigateTo('/auth/login');
  }
};

// Analytics visibility: show for SCALE plan or ADMIN role
const showAnalytics = computed(() =>
  user.value?.role === 'ADMIN' || planCookie.value?.toUpperCase() === 'SCALE' ||  planCookie.value?.toUpperCase() === 'GRANDFATHERED'
);

const ANALYTICS_ICON = '<path stroke-linecap="round" stroke-linejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"/>';

const nav = computed(() => [
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
    label: 'Analytics',
    to: showAnalytics.value ? '/app/analytics/products' : '/app/settings?upgrade=analytics',
    color: '#f97316',
    // Show a "SCALE" badge when the feature is locked so non-SCALE users can see
    // that Analytics exists and understand what plan they need — rather than just
    // having the item disappear silently.
    badge:     showAnalytics.value ? null : 'SCALE',
    badgeBg:   showAnalytics.value ? undefined : 'rgba(249,115,22,0.15)',
    badgeColor: showAnalytics.value ? undefined : '#f97316',
    locked: !showAnalytics.value,
    icon: ANALYTICS_ICON,
  },
  {
    label: 'Automation', to: '/app/automation', color: '#22d3ee', badge: null,
    icon: '<path stroke-linecap="round" stroke-linejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"/>',
  },
  {
    label: 'Audit Log', to: '/app/audit', color: '#f97316', badge: null,
    icon: '<path stroke-linecap="round" stroke-linejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z"/>',
  },
]);

const SETTINGS_ICON = '<path stroke-linecap="round" stroke-linejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z"/><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>';
const ONBOARDING_ICON = '<path stroke-linecap="round" stroke-linejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z"/>';
// Shield-check icon for the Admin link
const ADMIN_ICON = '<path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.955 11.955 0 0 0 3 10.499c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.533-.386-2.977-1.07-4.244A11.959 11.959 0 0 1 12 2.714Z"/>';

// Show Onboarding in the nav only while no store is connected.
// Once a store exists (onboarding completed), the link disappears.
// If the store/connection is later removed, it reappears automatically.
// Admin link is visible only for users with the ADMIN role.
const navSecondary = computed(() => [
  { label: 'Settings', to: '/app/settings', icon: SETTINGS_ICON },
  ...(!hasStore.value ? [{ label: 'Onboarding', to: '/app/onboarding', icon: ONBOARDING_ICON }] : []),
  ...(user.value?.role === 'ADMIN' ? [{ label: 'Admin', to: '/admin', icon: ADMIN_ICON }] : []),
]);

const pageTitle = computed(() => {
  if (route.path === '/app/products') return 'Product Scoring';
  if (route.path === '/app/automation') return 'Automation Activity';
  if (route.path === '/app/audit') return 'Automation Audit';
  if (route.path === '/app/settings') return 'Settings';
  if (route.path === '/app/onboarding') return 'Onboarding';
  if (route.path === '/app/analytics/products') return 'Products Analytics';
  if (route.path === '/app/analytics/meta') return 'Meta Analytics';
  return 'Performance Overview';
});

const pageSection = computed(() => {
  if (route.path === '/app/products') return 'Catalog Intelligence';
  if (route.path === '/app/automation') return 'Automation';
  if (route.path === '/app/audit') return 'Transparency';
  if (route.path === '/app/settings') return 'Workspace';
  if (route.path === '/app/onboarding') return 'Setup';
  return 'Meta Catalog Command';
});

const pageSubtitle = computed(() => {
  if (route.path === '/app/products') return 'Prioritize winners, isolate risks, and accelerate testing.';
  if (route.path === '/app/automation') return 'Rule firings, score changes, and automated actions for your catalog.';
  if (route.path === '/app/audit') return 'Every automated action with full context and rollback intent.';
  if (route.path === '/app/settings') return 'Tune rules, budgets, and notification preferences.';
  if (route.path === '/app/onboarding') return 'Connect your store, Meta Ads, and automation rules.';
  return 'Catalog-level signals, Meta performance, and AI guidance.';
});
</script>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

.dropdown-enter-active { transition: opacity 0.15s ease, transform 0.15s ease; }
.dropdown-leave-active { transition: opacity 0.1s ease, transform 0.1s ease; }
.dropdown-enter-from, .dropdown-leave-to { opacity: 0; transform: translateY(-6px) scale(0.97); }

.slide-left-enter-active,
.slide-left-leave-active {
  transition: transform 0.25s ease;
}
.slide-left-enter-from,
.slide-left-leave-to {
  transform: translateX(-100%);
}

.slide-up-enter-active,
.slide-up-leave-active {
  transition: transform 0.2s ease, opacity 0.2s ease;
}
.slide-up-enter-from,
.slide-up-leave-to {
  transform: translateY(12px);
  opacity: 0;
}
</style>

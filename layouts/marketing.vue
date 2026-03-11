<template>
  <div class="min-h-screen bg-ink-950 text-white overflow-x-hidden">
    <!-- Fixed background effects -->
    <div class="pointer-events-none fixed inset-0 bg-haze opacity-80" aria-hidden="true"></div>
    <div class="pointer-events-none fixed inset-0 bg-grid bg-[length:24px_24px] opacity-20" aria-hidden="true"></div>

    <div class="relative">
      <!-- ── Sticky Navigation ── -->
      <header
        :class="[
          'sticky top-0 z-50 transition-all duration-300',
          scrolled ? 'bg-ink-950/90 backdrop-blur-xl border-b border-white/10' : 'bg-transparent'
        ]"
      >
        <div class="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-6">

          <!-- Logo -->
          <NuxtLink to="/" class="flex items-center gap-2.5 flex-shrink-0">
            <div class="h-9 w-9 rounded-xl bg-gradient-to-br from-glow-500 to-lime-500 flex items-center justify-center shadow-glow">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M2 13L8 3L14 13H2Z" stroke="white" stroke-width="1.5" stroke-linejoin="round" fill="none"/>
                <circle cx="8" cy="8" r="2" fill="white"/>
              </svg>
            </div>
            <span class="text-base font-semibold tracking-tight">MetaFlow</span>
          </NuxtLink>

          <!-- Desktop nav -->
          <nav class="hidden md:flex items-center gap-1 flex-1 justify-center">

            <!-- Workflows dropdown -->
            <div
              class="relative"
              @mouseenter="activeMenu = 'workflows'"
              @mouseleave="activeMenu = null"
            >
              <button class="flex items-center gap-1 rounded-lg px-3 py-2 text-sm text-white/70 hover:text-white transition-colors">
                Workflows
                <svg class="w-3 h-3 opacity-60 mt-0.5" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5">
                  <path d="M3 4.5l3 3 3-3"/>
                </svg>
              </button>
              <div v-show="activeMenu === 'workflows'" class="absolute top-full left-1/2 -translate-x-1/2 pt-3 w-64">
                <div class="glass rounded-2xl p-2 shadow-card border border-white/15">
                  <NuxtLink
                    to="/analytics"
                    class="flex items-start gap-3 rounded-xl p-3 hover:bg-white/5 transition-colors"
                    @click="activeMenu = null"
                  >
                    <div class="mt-0.5 h-8 w-8 rounded-lg bg-glow-500/10 flex items-center justify-center flex-shrink-0">
                      <svg class="w-4 h-4 text-glow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
                      </svg>
                    </div>
                    <div>
                      <p class="text-sm font-medium text-white">Analytics</p>
                      <p class="text-xs text-white/75 mt-0.5">Cross-channel reporting</p>
                    </div>
                  </NuxtLink>
                  <NuxtLink
                    to="/optimization"
                    class="flex items-start gap-3 rounded-xl p-3 hover:bg-white/5 transition-colors"
                    @click="activeMenu = null"
                  >
                    <div class="mt-0.5 h-8 w-8 rounded-lg bg-lime-500/10 flex items-center justify-center flex-shrink-0">
                      <svg class="w-4 h-4 text-lime-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>
                      </svg>
                    </div>
                    <div>
                      <p class="text-sm font-medium text-white">Optimization</p>
                      <p class="text-xs text-white/75 mt-0.5">Auto-scale your winners</p>
                    </div>
                  </NuxtLink>
                  <NuxtLink
                    to="/ai-ads"
                    class="flex items-start gap-3 rounded-xl p-3 hover:bg-white/5 transition-colors"
                    @click="activeMenu = null"
                  >
                    <div class="mt-0.5 h-8 w-8 rounded-lg bg-ember-500/10 flex items-center justify-center flex-shrink-0">
                      <svg class="w-4 h-4 text-ember-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2h-2"/>
                      </svg>
                    </div>
                    <div>
                      <p class="text-sm font-medium text-white">AI Ads</p>
                      <p class="text-xs text-white/75 mt-0.5">Intelligent recommendations</p>
                    </div>
                  </NuxtLink>
                </div>
              </div>
            </div>

            <NuxtLink to="/pricing" class="rounded-lg px-3 py-2 text-sm text-white/70 hover:text-white transition-colors">Pricing</NuxtLink>
            <NuxtLink to="/about" class="rounded-lg px-3 py-2 text-sm text-white/70 hover:text-white transition-colors">About</NuxtLink>
          </nav>

          <!-- Right side actions -->
          <div class="hidden md:flex items-center gap-3 flex-shrink-0">
            <NuxtLink to="/auth/login" class="rounded-lg px-3 py-2 text-sm text-white/70 hover:text-white transition-colors">
              Sign in
            </NuxtLink>
            <NuxtLink to="/auth/signup" class="btn-gradient">
              Start free →
            </NuxtLink>
          </div>

          <!-- Mobile hamburger -->
          <button
            class="md:hidden rounded-xl border border-white/10 bg-white/5 p-2 text-white/70 hover:text-white transition-colors"
            aria-label="Toggle menu"
            @click="mobileOpen = !mobileOpen"
          >
            <svg v-if="!mobileOpen" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16"/>
            </svg>
            <svg v-else class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
      </header>

      <!-- ── Mobile drawer ── -->
      <Transition name="fade">
        <div v-if="mobileOpen" class="fixed inset-0 z-40 md:hidden">
          <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" @click="mobileOpen = false"></div>
          <div class="absolute right-0 top-0 h-full w-80 max-w-[85vw] bg-ink-900 shadow-xl overflow-y-auto flex flex-col">
            <div class="flex items-center justify-between border-b border-white/10 px-6 py-5 flex-shrink-0">
              <div class="flex items-center gap-2">
                <div class="h-8 w-8 rounded-lg bg-gradient-to-br from-glow-500 to-lime-500"></div>
                <span class="font-semibold text-sm">MetaFlow</span>
              </div>
              <button class="text-white/80 hover:text-white transition-colors" @click="mobileOpen = false">
                <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>
            <nav class="p-5 flex-1 space-y-1">
              <p class="text-xs uppercase tracking-widest text-white/55 px-2 mb-3">Workflows</p>
              <NuxtLink to="/analytics" class="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors" @click="mobileOpen = false">
                <div class="h-7 w-7 rounded-lg bg-glow-500/10 flex items-center justify-center flex-shrink-0">
                  <svg class="w-3.5 h-3.5 text-glow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10"/></svg>
                </div>
                Analytics
              </NuxtLink>
              <NuxtLink to="/optimization" class="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors" @click="mobileOpen = false">
                <div class="h-7 w-7 rounded-lg bg-lime-500/10 flex items-center justify-center flex-shrink-0">
                  <svg class="w-3.5 h-3.5 text-lime-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/></svg>
                </div>
                Optimization
              </NuxtLink>
              <NuxtLink to="/ai-ads" class="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors" @click="mobileOpen = false">
                <div class="h-7 w-7 rounded-lg bg-ember-500/10 flex items-center justify-center flex-shrink-0">
                  <svg class="w-3.5 h-3.5 text-ember-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2h-2"/></svg>
                </div>
                AI Ads
              </NuxtLink>
              <div class="my-4 border-t border-white/10"></div>
              <NuxtLink to="/pricing" class="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors" @click="mobileOpen = false">Pricing</NuxtLink>
              <NuxtLink to="/about" class="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors" @click="mobileOpen = false">About</NuxtLink>
            </nav>
            <div class="px-5 pb-8 space-y-3">
              <NuxtLink to="/auth/login" class="block w-full rounded-xl border border-white/15 px-4 py-3 text-center text-sm text-white/80 hover:bg-white/5 transition-colors" @click="mobileOpen = false">Sign in</NuxtLink>
              <NuxtLink to="/auth/signup" class="block w-full rounded-xl bg-glow-500/20 border border-glow-500/30 px-4 py-3 text-center text-sm font-semibold text-glow-500 transition-colors hover:bg-glow-500/30" @click="mobileOpen = false">Start free →</NuxtLink>
            </div>
          </div>
        </div>
      </Transition>

      <!-- ── Page content ── -->
      <slot />

      <!-- ── Footer ── -->
      <footer class="border-t border-white/10 mt-20">
        <div class="mx-auto max-w-7xl px-6 pt-16 pb-10">
          <div class="grid grid-cols-2 gap-10 lg:grid-cols-[1.5fr_1fr_1fr_1fr_1fr]">

            <!-- Brand -->
            <div class="col-span-2 lg:col-span-1">
              <div class="flex items-center gap-2.5">
                <div class="h-9 w-9 rounded-xl bg-gradient-to-br from-glow-500 to-lime-500 flex items-center justify-center">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M2 13L8 3L14 13H2Z" stroke="white" stroke-width="1.5" stroke-linejoin="round" fill="none"/>
                    <circle cx="8" cy="8" r="2" fill="white"/>
                  </svg>
                </div>
                <span class="font-semibold">MetaFlow</span>
              </div>
              <p class="mt-4 text-sm text-white/75 leading-relaxed max-w-52">
                Product-level intelligence for Meta catalog ads. Score, optimize, and scale every SKU.
              </p>
              <div class="mt-5 flex gap-3">
                <a href="#" class="h-8 w-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors" aria-label="Twitter">
                  <svg class="w-4 h-4 text-white/80" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.259 5.63 5.905-5.63z"/></svg>
                </a>
                <a href="#" class="h-8 w-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors" aria-label="LinkedIn">
                  <svg class="w-4 h-4 text-white/80" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                </a>
                <a href="#" class="h-8 w-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors" aria-label="YouTube">
                  <svg class="w-4 h-4 text-white/80" fill="currentColor" viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                </a>
              </div>
            </div>

            <!-- Product -->
            <div>
              <p class="text-xs font-semibold uppercase tracking-widest text-white/60 mb-5">Product</p>
              <ul class="space-y-3.5 text-sm">
                <li><NuxtLink to="/analytics" class="text-white/80 hover:text-white transition-colors">Analytics</NuxtLink></li>
                <li><NuxtLink to="/optimization" class="text-white/80 hover:text-white transition-colors">Optimization</NuxtLink></li>
                <li><NuxtLink to="/ai-ads" class="text-white/80 hover:text-white transition-colors">AI Ads</NuxtLink></li>
                <li><NuxtLink to="/pricing" class="text-white/80 hover:text-white transition-colors">Pricing</NuxtLink></li>
                <li><NuxtLink to="/app" class="text-white/80 hover:text-white transition-colors">Dashboard</NuxtLink></li>
              </ul>
            </div>

            <!-- Company -->
            <div>
              <p class="text-xs font-semibold uppercase tracking-widest text-white/60 mb-5">Company</p>
              <ul class="space-y-3.5 text-sm">
                <li><NuxtLink to="/about" class="text-white/80 hover:text-white transition-colors">About Us</NuxtLink></li>
                <li><a href="#" class="text-white/80 hover:text-white transition-colors">Blog</a></li>
                <li><a href="#" class="text-white/80 hover:text-white transition-colors">Careers</a></li>
                <li><a href="#" class="text-white/80 hover:text-white transition-colors">Partners</a></li>
                <li><a href="#" class="text-white/80 hover:text-white transition-colors">Press</a></li>
              </ul>
            </div>

            <!-- Resources -->
            <div>
              <p class="text-xs font-semibold uppercase tracking-widest text-white/60 mb-5">Resources</p>
              <ul class="space-y-3.5 text-sm">
                <li><a href="#" class="text-white/80 hover:text-white transition-colors">Documentation</a></li>
                <li><a href="#" class="text-white/80 hover:text-white transition-colors">Case Studies</a></li>
                <li><a href="#" class="text-white/80 hover:text-white transition-colors">API Reference</a></li>
                <li><a href="#" class="text-white/80 hover:text-white transition-colors">Changelog</a></li>
                <li><a href="#" class="text-white/80 hover:text-white transition-colors">Status</a></li>
              </ul>
            </div>

            <!-- Legal -->
            <div>
              <p class="text-xs font-semibold uppercase tracking-widest text-white/60 mb-5">Legal</p>
              <ul class="space-y-3.5 text-sm">
                <li><a href="#" class="text-white/80 hover:text-white transition-colors">Privacy Policy</a></li>
                <li><a href="#" class="text-white/80 hover:text-white transition-colors">Terms of Service</a></li>
                <li><a href="#" class="text-white/80 hover:text-white transition-colors">Cookie Policy</a></li>
                <li><a href="#" class="text-white/80 hover:text-white transition-colors">Security</a></li>
                <li><a href="#" class="text-white/80 hover:text-white transition-colors">GDPR</a></li>
              </ul>
            </div>
          </div>

          <!-- Bottom bar -->
          <div class="mt-14 flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-8">
            <p class="text-xs text-white/60">© 2026 MetaFlow Technologies, Inc. All rights reserved.</p>
            <div class="flex flex-wrap items-center gap-5 text-xs text-white/60">
              <span class="flex items-center gap-1.5">
                <span class="h-1.5 w-1.5 rounded-full bg-lime-500 animate-pulse"></span>
                All systems operational
              </span>
              <span>Meta Marketing Partner</span>
              <span>SOC 2 Type II</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  </div>
</template>

<script setup lang="ts">
const mobileOpen = ref(false);
const activeMenu = ref<string | null>(null);
const scrolled = ref(false);

if (process.client) {
  const onScroll = () => { scrolled.value = window.scrollY > 20; };
  window.addEventListener('scroll', onScroll, { passive: true });
  onBeforeUnmount(() => window.removeEventListener('scroll', onScroll));
}
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>

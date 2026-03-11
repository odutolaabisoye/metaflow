<template>
  <div class="min-h-screen bg-ink-950 text-white flex overflow-hidden">

    <!-- ── Left branded panel ── -->
    <div class="hidden lg:flex flex-col w-[460px] xl:w-[500px] flex-shrink-0 relative overflow-hidden border-r border-white/10">
      <!-- Background layers -->
      <div class="absolute inset-0 bg-gradient-to-br from-glow-500/10 via-ink-900/80 to-lime-500/8"></div>
      <div class="absolute inset-0 bg-grid bg-[length:24px_24px] opacity-[0.12]"></div>
      <!-- Glow orbs -->
      <div class="absolute -top-40 -left-20 h-80 w-80 rounded-full bg-glow-500/15 blur-[80px]"></div>
      <div class="absolute bottom-20 right-0 h-60 w-60 rounded-full bg-lime-500/10 blur-[80px]"></div>

      <div class="relative flex flex-col h-full p-10">

        <!-- Logo -->
        <NuxtLink to="/" class="flex items-center gap-2.5 flex-shrink-0">
          <div class="h-9 w-9 rounded-xl bg-gradient-to-br from-glow-500 to-lime-500 flex items-center justify-center shadow-glow">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M2 13L8 3L14 13H2Z" stroke="white" stroke-width="1.5" stroke-linejoin="round" fill="none"/>
              <circle cx="8" cy="8" r="2" fill="white"/>
            </svg>
          </div>
          <span class="font-semibold text-base">MetaFlow</span>
        </NuxtLink>

        <!-- Center content -->
        <div class="flex-1 flex flex-col justify-center mt-12">
          <h2 class="text-3xl font-semibold leading-tight tracking-tight">
            Catalog intelligence<br/>
            <span class="text-gradient">that actually scales.</span>
          </h2>
          <p class="mt-4 text-sm text-white/80 leading-relaxed max-w-xs">
            Score every SKU, scale every winner, stop every loser. All on autopilot — every single day.
          </p>

          <!-- Feature list -->
          <ul class="mt-8 space-y-4">
            <li v-for="feat in features" :key="feat.title" class="flex items-start gap-3">
              <div class="h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0" :style="{ background: feat.bg }">
                <svg class="w-4 h-4" :style="{ color: feat.color }" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" v-html="feat.icon"></svg>
              </div>
              <div>
                <p class="text-sm font-medium">{{ feat.title }}</p>
                <p class="text-xs text-white/70 mt-0.5">{{ feat.desc }}</p>
              </div>
            </li>
          </ul>

          <!-- Mini stats card -->
          <div class="mt-8 glass rounded-2xl p-4 border border-white/10">
            <div class="flex items-center justify-between mb-3">
              <p class="text-xs text-white/75">Live catalog snapshot</p>
              <span class="flex items-center gap-1.5 text-xs text-lime-400">
                <span class="h-1.5 w-1.5 rounded-full bg-lime-400 animate-pulse"></span>
                Live
              </span>
            </div>
            <div class="grid grid-cols-3 gap-3 text-center">
              <div>
                <p class="text-lg font-semibold text-gradient">6.4×</p>
                <p class="text-xs text-white/65 mt-0.5">ROAS</p>
              </div>
              <div>
                <p class="text-lg font-semibold text-gradient">86</p>
                <p class="text-xs text-white/65 mt-0.5">Scaling SKUs</p>
              </div>
              <div>
                <p class="text-lg font-semibold text-gradient">$124k</p>
                <p class="text-xs text-white/65 mt-0.5">Today</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Testimonial -->
        <div class="flex-shrink-0 border-t border-white/10 pt-6">
          <p class="text-sm italic text-white/80 leading-relaxed">
            "MetaFlow cut our catalog management from 4 hours to 15 minutes a week. Best decision we made."
          </p>
          <div class="mt-3 flex items-center gap-2.5">
            <div class="h-7 w-7 rounded-full bg-glow-500/20 flex items-center justify-center text-xs font-semibold text-glow-400">AO</div>
            <div>
              <p class="text-xs font-medium text-white/70">Adaeze Okafor</p>
              <p class="text-xs text-white/60">Growth Manager · Lagos</p>
            </div>
          </div>
        </div>

      </div>
    </div>

    <!-- ── Right form panel ── -->
    <div class="flex-1 flex flex-col items-center justify-center px-6 py-12 bg-ink-950">
      <!-- Mobile-only logo -->
      <div class="lg:hidden mb-10 flex flex-col items-center gap-3">
        <NuxtLink to="/" class="flex items-center gap-2.5">
          <div class="h-9 w-9 rounded-xl bg-gradient-to-br from-glow-500 to-lime-500 flex items-center justify-center shadow-glow">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M2 13L8 3L14 13H2Z" stroke="white" stroke-width="1.5" stroke-linejoin="round" fill="none"/>
              <circle cx="8" cy="8" r="2" fill="white"/>
            </svg>
          </div>
          <span class="font-semibold">MetaFlow</span>
        </NuxtLink>
      </div>

      <div class="w-full max-w-[420px]">
        <slot />
      </div>

      <!-- Footer -->
      <div class="mt-10 text-xs text-white/50 text-center">
        <NuxtLink to="/" class="hover:text-white/75 transition-colors">← Back to MetaFlow.io</NuxtLink>
        <span class="mx-3">·</span>
        <a href="#" class="hover:text-white/75 transition-colors">Privacy</a>
        <span class="mx-3">·</span>
        <a href="#" class="hover:text-white/75 transition-colors">Terms</a>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
const features = [
  {
    title: 'Product scoring engine',
    desc: 'ROAS, CTR, margin & inventory scored daily',
    icon: '<path stroke-linecap="round" stroke-linejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10"/>',
    bg: 'rgba(34,211,238,0.1)', color: '#22d3ee'
  },
  {
    title: 'Smart budget automation',
    desc: 'Winners scale, losers pause — automatically',
    icon: '<path stroke-linecap="round" stroke-linejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>',
    bg: 'rgba(132,204,22,0.1)', color: '#84cc16'
  },
  {
    title: 'AI-powered insights',
    desc: 'Plain-English recommendations every morning',
    icon: '<path stroke-linecap="round" stroke-linejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18"/>',
    bg: 'rgba(249,115,22,0.1)', color: '#f97316'
  },
];
</script>

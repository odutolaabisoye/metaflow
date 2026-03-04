<template>
  <div>

    <!-- ── Hero ── -->
    <section class="relative mx-auto w-full max-w-7xl px-6 pt-16 pb-8 text-center">
      <div class="glow-orb w-[500px] h-[300px] left-1/2 -translate-x-1/2 -top-20 bg-lime-500/12"></div>
      <span class="section-badge mb-5">
        <svg class="w-3.5 h-3.5 text-lime-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/></svg>
        Optimization Workflows
      </span>
      <h1 class="mx-auto mt-4 max-w-3xl text-5xl font-semibold leading-[1.1] tracking-tight sm:text-6xl">
        Set it and watch<br/>
        <span class="text-gradient">it optimize.</span>
      </h1>
      <p class="mx-auto mt-6 max-w-2xl text-lg text-white/55 leading-relaxed">
        From product scoring to auto-scaling, MetaFlow runs your entire catalog optimization
        autonomously — so you focus on strategy, not spreadsheets.
      </p>
      <div class="mt-8 flex flex-wrap justify-center gap-4">
        <NuxtLink to="/auth/signup" class="btn-gradient btn-gradient-lg">Start free — 14 days</NuxtLink>
        <NuxtLink to="/analytics" class="inline-flex items-center gap-2 rounded-full border border-white/15 px-6 py-3.5 text-sm font-medium text-white/80 hover:bg-white/5 transition-colors">
          See Analytics
        </NuxtLink>
      </div>
    </section>

    <!-- ── Rules builder mockup ── -->
    <section class="mx-auto w-full max-w-7xl px-6 py-8">
      <div class="glass rounded-3xl overflow-hidden border border-white/15 shadow-glow-lg">
        <div class="flex items-center gap-2 border-b border-white/10 bg-white/[0.02] px-5 py-3">
          <div class="flex gap-1.5">
            <div class="h-2.5 w-2.5 rounded-full bg-ember-500/50"></div>
            <div class="h-2.5 w-2.5 rounded-full bg-lime-500/50"></div>
            <div class="h-2.5 w-2.5 rounded-full bg-glow-500/50"></div>
          </div>
          <div class="ml-3 rounded-lg bg-white/5 px-3 py-1 text-xs text-white/30 flex-1 max-w-sm">
            app.metaflow.io/optimization
          </div>
          <span class="text-xs text-lime-400 flex items-center gap-1.5">
            <span class="h-1.5 w-1.5 rounded-full bg-lime-400 animate-pulse"></span>
            4 rules running
          </span>
        </div>
        <div class="p-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div v-for="rule in heroRules" :key="rule.name" class="rounded-2xl border p-4" :class="rule.active ? 'bg-white/[0.05] border-white/15' : 'bg-white/[0.02] border-white/8 opacity-60'">
            <div class="flex items-start justify-between">
              <div class="h-9 w-9 rounded-xl flex items-center justify-center" :style="{ background: rule.iconBg }">
                <svg class="w-4 h-4" :style="{ color: rule.iconColor }" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" v-html="rule.icon"></svg>
              </div>
              <div class="h-5 w-9 rounded-full flex items-center px-0.5 flex-shrink-0 cursor-pointer" :class="rule.active ? 'bg-lime-500/30 justify-end' : 'bg-white/10 justify-start'">
                <div class="h-4 w-4 rounded-full" :class="rule.active ? 'bg-lime-400' : 'bg-white/30'"></div>
              </div>
            </div>
            <p class="mt-3 text-sm font-semibold">{{ rule.name }}</p>
            <p class="mt-1 text-xs text-white/50">{{ rule.desc }}</p>
            <div class="mt-3 rounded-lg bg-white/5 px-2.5 py-1.5 text-xs text-white/40">
              {{ rule.trigger }}
            </div>
          </div>
        </div>
        <!-- Automation log -->
        <div class="px-6 pb-6">
          <div class="rounded-2xl bg-white/[0.03] border border-white/8 p-4">
            <p class="text-xs text-white/50 mb-3">Recent automation actions</p>
            <div class="space-y-2">
              <div v-for="log in automationLog" :key="log.msg" class="flex items-center gap-3 text-xs">
                <span class="text-white/35 w-16 flex-shrink-0">{{ log.time }}</span>
                <span class="h-1.5 w-1.5 rounded-full flex-shrink-0" :style="{ background: log.color }"></span>
                <span class="text-white/65">{{ log.msg }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ── Feature: Product Scoring ── -->
    <section class="mx-auto w-full max-w-7xl px-6 py-16">
      <div class="grid items-center gap-12 lg:grid-cols-2">
        <div class="space-y-5">
          <span class="section-badge"><span class="h-1.5 w-1.5 rounded-full bg-glow-500"></span> Product Scoring</span>
          <h2 class="text-3xl font-semibold">A composite score<br/>for every SKU</h2>
          <p class="text-white/60 leading-relaxed">
            MetaFlow's scoring engine evaluates 5 signals for every product: ROAS, CTR, conversion rate, gross margin, and inventory velocity. One score. Total clarity on where to invest.
          </p>
          <ul class="space-y-3">
            <li v-for="p in scoringPoints" :key="p" class="flex items-start gap-3 text-sm text-white/70">
              <svg class="w-4 h-4 text-glow-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
              {{ p }}
            </li>
          </ul>
        </div>
        <div class="feature-card">
          <div class="mb-5 flex items-center justify-between">
            <p class="text-sm font-medium">Catalog performance snapshot</p>
            <span class="text-xs text-white/40">1,284 SKUs</span>
          </div>
          <!-- Score distribution -->
          <div class="grid grid-cols-3 gap-3 mb-4">
            <div v-for="tier in scoreTiers" :key="tier.label" class="rounded-xl p-3 text-center border" :class="tier.cls">
              <p class="text-xl font-semibold">{{ tier.count }}</p>
              <p class="text-xs mt-1 opacity-70">{{ tier.label }}</p>
            </div>
          </div>
          <div class="space-y-2.5">
            <div v-for="sku in topSkus" :key="sku.name" class="flex items-center gap-3">
              <div class="flex-1">
                <div class="flex justify-between text-xs mb-1.5">
                  <span class="text-white/65">{{ sku.name }}</span>
                  <span class="font-medium">{{ sku.score }}/100</span>
                </div>
                <div class="h-1.5 rounded-full bg-white/8">
                  <div class="h-1.5 rounded-full" :style="{ width: sku.score + '%', background: sku.color }"></div>
                </div>
              </div>
              <span class="text-xs px-2 py-0.5 rounded-full" :class="sku.score >= 80 ? 'bg-lime-500/15 text-lime-400' : sku.score >= 50 ? 'bg-glow-500/15 text-glow-400' : 'bg-ember-500/15 text-ember-400'">
                {{ sku.score >= 80 ? 'Scale' : sku.score >= 50 ? 'Hold' : 'Pause' }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ── Feature: Auto-scale rules ── -->
    <section class="mx-auto w-full max-w-7xl px-6 py-16">
      <div class="grid items-center gap-12 lg:grid-cols-2">
        <div class="feature-card order-2 lg:order-1 space-y-4">
          <p class="text-sm font-medium">Rule builder</p>
          <div class="rounded-2xl bg-white/[0.04] border border-white/10 p-4 space-y-3">
            <p class="text-xs text-white/50 uppercase tracking-widest">When</p>
            <div class="grid grid-cols-3 gap-2">
              <div class="rounded-lg bg-white/8 px-3 py-2 text-xs text-white/70 text-center cursor-pointer ring-1 ring-glow-500/50">ROAS</div>
              <div class="rounded-lg bg-white/5 px-3 py-2 text-xs text-white/40 text-center cursor-pointer">≥</div>
              <div class="rounded-lg bg-white/8 px-3 py-2 text-xs text-white/70 text-center cursor-pointer">5.0×</div>
            </div>
            <div class="flex items-center gap-2">
              <div class="h-px flex-1 bg-white/10"></div>
              <span class="text-xs text-white/30">AND</span>
              <div class="h-px flex-1 bg-white/10"></div>
            </div>
            <div class="grid grid-cols-3 gap-2">
              <div class="rounded-lg bg-white/8 px-3 py-2 text-xs text-white/70 text-center">For</div>
              <div class="rounded-lg bg-white/8 px-3 py-2 text-xs text-white/70 text-center">3+</div>
              <div class="rounded-lg bg-white/8 px-3 py-2 text-xs text-white/70 text-center">days</div>
            </div>
            <p class="text-xs text-white/50 uppercase tracking-widest mt-2">Then</p>
            <div class="rounded-xl bg-lime-500/10 border border-lime-500/20 px-3 py-2.5 text-sm text-lime-400 flex items-center gap-2">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/></svg>
              Increase budget by 25%
            </div>
          </div>
          <div class="rounded-2xl bg-glow-500/8 border border-glow-500/20 p-4">
            <p class="text-xs text-glow-400 font-medium mb-1">This rule would have fired 14 times last month</p>
            <p class="text-xs text-white/55">Estimated additional revenue: +$28,400</p>
          </div>
        </div>
        <div class="space-y-5 order-1 lg:order-2">
          <span class="section-badge"><span class="h-1.5 w-1.5 rounded-full bg-lime-500"></span> Automation Rules</span>
          <h2 class="text-3xl font-semibold">Visual rules.<br/>Zero-code automation.</h2>
          <p class="text-white/60 leading-relaxed">
            Build sophisticated budget automation rules without writing a single line of code.
            Scale winners, pause losers, protect inventory — all automatically.
          </p>
          <ul class="space-y-3">
            <li v-for="p in rulesPoints" :key="p" class="flex items-start gap-3 text-sm text-white/70">
              <svg class="w-4 h-4 text-lime-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
              {{ p }}
            </li>
          </ul>
        </div>
      </div>
    </section>

    <!-- ── CTA ── -->
    <section class="mx-auto w-full max-w-7xl px-6 pb-10">
      <div class="relative overflow-hidden rounded-3xl border border-lime-500/20 bg-gradient-to-br from-lime-500/10 via-ink-800/50 to-glow-500/10 p-12 text-center">
        <h2 class="text-3xl font-semibold">Start optimizing your catalog today.</h2>
        <p class="mt-3 text-white/55 max-w-lg mx-auto">14-day free trial. No credit card. Connect in under 2 minutes.</p>
        <div class="mt-6 flex flex-wrap justify-center gap-4">
          <NuxtLink to="/auth/signup" class="btn-gradient">Start free →</NuxtLink>
          <NuxtLink to="/ai-ads" class="inline-flex items-center gap-2 rounded-full border border-white/15 px-5 py-2.5 text-sm text-white/75 hover:bg-white/5 transition-colors">See AI Ads →</NuxtLink>
        </div>
      </div>
    </section>

  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'marketing' });

const heroRules = [
  { name: 'Scale Winners', desc: 'Boost budget when ROAS exceeds threshold', trigger: 'ROAS ≥ 5× for 3 days → +25% budget', active: true, iconBg: 'rgba(132,204,22,0.12)', iconColor: '#84cc16', icon: '<path stroke-linecap="round" stroke-linejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>' },
  { name: 'Stop Loss', desc: 'Pause ads before they drain budget', trigger: 'ROAS < 1.5× for 3d → pause campaign', active: true, iconBg: 'rgba(249,115,22,0.12)', iconColor: '#f97316', icon: '<path stroke-linecap="round" stroke-linejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15"/>' },
  { name: 'Inventory Guard', desc: 'Pause ads when stock runs critically low', trigger: 'Stock < 7 days → pause & alert', active: true, iconBg: 'rgba(34,211,238,0.12)', iconColor: '#22d3ee', icon: '<path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z"/>' },
  { name: 'Revive', desc: 'Re-test paused SKUs when restocked', trigger: 'New stock + ROAS was ≥ 3× → reactivate', active: false, iconBg: 'rgba(255,255,255,0.05)', iconColor: 'rgba(255,255,255,0.3)', icon: '<path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"/>' },
];

const automationLog = [
  { time: '2m ago', msg: 'Running Shoe Pro: budget increased +25% (ROAS 7.2× for 4 days)', color: '#84cc16' },
  { time: '1h ago', msg: 'Gym Gloves Set: paused — ROAS 1.2× for 3 consecutive days', color: '#f97316' },
  { time: '3h ago', msg: 'Yoga Mat Ultra: inventory alert — 6 days of stock remaining', color: '#22d3ee' },
  { time: '6h ago', msg: 'Resistance Bands: revived — restocked, previous ROAS was 4.1×', color: '#84cc16' },
];

const scoringPoints = [
  'Daily scoring update for every product in your catalog',
  'Five-signal composite: ROAS, CTR, CVR, margin, inventory',
  'Segment by score tier: Scale / Hold / Pause',
  'Compare any SKU against catalog benchmarks',
];

const scoreTiers = [
  { label: 'Scale (80+)', count: 86, cls: 'bg-lime-500/8 border-lime-500/20 text-lime-400' },
  { label: 'Hold (40–79)', count: 834, cls: 'bg-glow-500/8 border-glow-500/20 text-glow-400' },
  { label: 'Pause (<40)', count: 364, cls: 'bg-ember-500/8 border-ember-500/20 text-ember-400' },
];

const topSkus = [
  { name: 'Running Shoe Pro', score: 92, color: '#84cc16' },
  { name: 'Yoga Mat Ultra', score: 78, color: '#22d3ee' },
  { name: 'Water Bottle XL', score: 61, color: '#22d3ee' },
  { name: 'Gym Bag Pro', score: 44, color: '#f97316' },
  { name: 'Gym Gloves Set', score: 28, color: '#f97316' },
];

const rulesPoints = [
  'If/then logic builder with 20+ trigger conditions',
  'Budget changes, pause, resume, and ad set moves',
  'Backtest any rule against your historical data',
  'Audit trail of every automated action taken',
];
</script>

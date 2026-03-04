<template>
  <div>

    <!-- ── Hero ── -->
    <section class="relative mx-auto w-full max-w-7xl px-6 pt-16 pb-8 text-center">
      <div class="glow-orb w-[500px] h-[300px] left-1/2 -translate-x-1/2 -top-20 bg-glow-500/12"></div>
      <span class="section-badge mb-5">
        <svg class="w-3.5 h-3.5 text-glow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10"/></svg>
        Analytics Workflows
      </span>
      <h1 class="mx-auto mt-4 max-w-3xl text-5xl font-semibold leading-[1.1] tracking-tight sm:text-6xl">
        See everything.<br/>
        <span class="text-gradient">Across every channel.</span>
      </h1>
      <p class="mx-auto mt-6 max-w-2xl text-lg text-white/55 leading-relaxed">
        One unified analytics view for Meta Ads, Shopify, WooCommerce, and beyond.
        Real-time data. Product-level precision. No more switching between dashboards.
      </p>
      <div class="mt-8 flex flex-wrap justify-center gap-4">
        <NuxtLink to="/auth/signup" class="btn-gradient btn-gradient-lg">Start free — 14 days</NuxtLink>
        <NuxtLink to="/pricing" class="inline-flex items-center gap-2 rounded-full border border-white/15 px-6 py-3.5 text-sm font-medium text-white/80 hover:bg-white/5 transition-colors">
          See pricing
        </NuxtLink>
      </div>
    </section>

    <!-- ── Dashboard hero mockup ── -->
    <section class="mx-auto w-full max-w-7xl px-6 py-8">
      <div class="relative glass rounded-3xl overflow-hidden border border-white/15 shadow-glow-lg">
        <!-- Browser bar -->
        <div class="flex items-center gap-2 border-b border-white/10 bg-white/[0.02] px-5 py-3">
          <div class="flex gap-1.5">
            <div class="h-2.5 w-2.5 rounded-full bg-ember-500/50"></div>
            <div class="h-2.5 w-2.5 rounded-full bg-lime-500/50"></div>
            <div class="h-2.5 w-2.5 rounded-full bg-glow-500/50"></div>
          </div>
          <div class="ml-3 rounded-lg bg-white/5 px-3 py-1 text-xs text-white/30 flex-1 max-w-sm">
            app.metaflow.io/analytics
          </div>
        </div>

        <!-- Chart section -->
        <div class="p-6 grid gap-5 lg:grid-cols-[1fr_320px]">
          <!-- Main chart area -->
          <div>
            <div class="mb-4 flex items-center justify-between">
              <div>
                <p class="text-xs text-white/50 mb-1">Revenue attributed · Last 30 days</p>
                <p class="text-3xl font-semibold">$487,240</p>
                <p class="text-sm text-lime-400 mt-1 flex items-center gap-1">
                  <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25"/></svg>
                  +32.8% vs prior period
                </p>
              </div>
              <div class="flex gap-2">
                <button v-for="range in ['7d','30d','90d']" :key="range" :class="['rounded-lg px-3 py-1.5 text-xs transition-colors', range === '30d' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/70']">{{ range }}</button>
              </div>
            </div>
            <!-- Simulated chart bars -->
            <div class="relative h-48 flex items-end gap-1.5">
              <div v-for="(bar, i) in chartBars" :key="i" class="flex-1 rounded-t-md transition-all" :style="{ height: bar.h + '%', background: bar.color, opacity: i === chartBars.length - 1 ? 1 : 0.6 }"></div>
            </div>
            <div class="mt-3 flex justify-between text-xs text-white/25">
              <span>Oct 1</span><span>Oct 8</span><span>Oct 15</span><span>Oct 22</span><span>Oct 30</span>
            </div>
          </div>

          <!-- Side metrics -->
          <div class="space-y-3">
            <div v-for="metric in sideMetrics" :key="metric.label" class="rounded-2xl bg-white/[0.04] border border-white/10 p-4">
              <p class="text-xs text-white/50">{{ metric.label }}</p>
              <p class="text-xl font-semibold mt-1">{{ metric.value }}</p>
              <div class="mt-2 flex items-center gap-1 text-xs" :class="metric.trend > 0 ? 'text-lime-400' : 'text-ember-400'">
                <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                  <path stroke-linecap="round" stroke-linejoin="round" :d="metric.trend > 0 ? 'M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25' : 'M19.5 4.5l-15 15m0 0h11.25m-11.25 0V8.25'"/>
                </svg>
                {{ Math.abs(metric.trend) }}% vs last period
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ── Feature 1: Live cross-channel ── -->
    <section class="mx-auto w-full max-w-7xl px-6 py-16">
      <div class="grid items-center gap-12 lg:grid-cols-2">
        <div class="space-y-5">
          <span class="section-badge"><span class="h-1.5 w-1.5 rounded-full bg-glow-500"></span> Live Data</span>
          <h2 class="text-3xl font-semibold">All your channels.<br/>One clean view.</h2>
          <p class="text-white/60 leading-relaxed">Meta Ads, Google, Shopify, WooCommerce, GA4, and Klaviyo data unified into one dashboard. No more tab-switching. No more manual reconciliation.</p>
          <ul class="space-y-3">
            <li v-for="p in livePoints" :key="p" class="flex items-start gap-3 text-sm text-white/70">
              <svg class="w-4 h-4 text-glow-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
              {{ p }}
            </li>
          </ul>
        </div>
        <div class="feature-card space-y-3">
          <p class="text-sm font-medium mb-4">Connected sources</p>
          <div v-for="src in dataSources" :key="src.name" class="flex items-center justify-between py-2.5 border-b border-white/8 last:border-0">
            <div class="flex items-center gap-3">
              <div class="h-8 w-8 rounded-lg flex items-center justify-center text-xs font-bold" :style="{ background: src.bg }">{{ src.abbr }}</div>
              <div>
                <p class="text-sm font-medium">{{ src.name }}</p>
                <p class="text-xs text-white/40">{{ src.sub }}</p>
              </div>
            </div>
            <span class="flex items-center gap-1.5 text-xs text-lime-400">
              <span class="h-1.5 w-1.5 rounded-full bg-lime-400"></span>
              Synced
            </span>
          </div>
        </div>
      </div>
    </section>

    <!-- ── Feature 2: Product attribution ── -->
    <section class="mx-auto w-full max-w-7xl px-6 py-16">
      <div class="grid items-center gap-12 lg:grid-cols-2">
        <div class="feature-card order-2 lg:order-1 space-y-3">
          <div class="flex items-center justify-between mb-3">
            <p class="text-sm font-medium">SKU-level attribution</p>
            <span class="text-xs text-white/40">30-day window</span>
          </div>
          <div v-for="sku in attributedSkus" :key="sku.name" class="flex items-center gap-3 py-2">
            <div class="w-36 flex-shrink-0">
              <p class="text-xs text-white/70 truncate">{{ sku.name }}</p>
            </div>
            <div class="flex-1 h-2 rounded-full bg-white/8">
              <div class="h-2 rounded-full" :style="{ width: sku.pct + '%', background: sku.color }"></div>
            </div>
            <div class="w-20 text-right">
              <p class="text-xs font-medium text-white">{{ sku.revenue }}</p>
              <p class="text-xs text-white/40">{{ sku.roas }}× ROAS</p>
            </div>
          </div>
        </div>
        <div class="space-y-5 order-1 lg:order-2">
          <span class="section-badge"><span class="h-1.5 w-1.5 rounded-full bg-lime-500"></span> Attribution</span>
          <h2 class="text-3xl font-semibold">Know exactly which SKU<br/>drives every dollar</h2>
          <p class="text-white/60 leading-relaxed">Stop guessing. MetaFlow's product-level attribution model maps every Meta conversion back to the exact SKU that drove it — across all your campaigns.</p>
          <ul class="space-y-3">
            <li v-for="p in attributionPoints" :key="p" class="flex items-start gap-3 text-sm text-white/70">
              <svg class="w-4 h-4 text-lime-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
              {{ p }}
            </li>
          </ul>
        </div>
      </div>
    </section>

    <!-- ── Feature 3: Forecasting ── -->
    <section class="mx-auto w-full max-w-7xl px-6 py-16">
      <div class="grid items-center gap-12 lg:grid-cols-2">
        <div class="space-y-5">
          <span class="section-badge"><span class="h-1.5 w-1.5 rounded-full bg-ember-500"></span> Forecasting</span>
          <h2 class="text-3xl font-semibold">Predict before<br/>problems happen</h2>
          <p class="text-white/60 leading-relaxed">MetaFlow's forecasting engine analyzes 90 days of trend data to project revenue, ROAS, and inventory risk — so you're never caught off guard.</p>
          <ul class="space-y-3">
            <li v-for="p in forecastPoints" :key="p" class="flex items-start gap-3 text-sm text-white/70">
              <svg class="w-4 h-4 text-ember-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
              {{ p }}
            </li>
          </ul>
        </div>
        <div class="feature-card space-y-4">
          <p class="text-sm font-medium">30-day revenue forecast</p>
          <div class="grid grid-cols-2 gap-3">
            <div class="rounded-2xl bg-white/[0.04] border border-white/10 p-4 text-center">
              <p class="text-xs text-white/50">Expected revenue</p>
              <p class="text-2xl font-semibold mt-1 text-gradient">$520k</p>
              <p class="text-xs text-white/35 mt-1">+6.7% vs last month</p>
            </div>
            <div class="rounded-2xl bg-white/[0.04] border border-white/10 p-4 text-center">
              <p class="text-xs text-white/50">Projected ROAS</p>
              <p class="text-2xl font-semibold mt-1 text-gradient">6.8×</p>
              <p class="text-xs text-white/35 mt-1">Based on 90d trend</p>
            </div>
          </div>
          <div class="rounded-2xl bg-ember-500/8 border border-ember-500/20 p-4">
            <p class="text-xs text-ember-400 font-medium mb-1.5">Risk Alert</p>
            <p class="text-xs text-white/65">3 SKUs projected to run out of stock within 10 days at current ad velocity.</p>
          </div>
          <div class="rounded-2xl bg-lime-500/8 border border-lime-500/20 p-4">
            <p class="text-xs text-lime-400 font-medium mb-1.5">Opportunity</p>
            <p class="text-xs text-white/65">Holiday season trend detected — 8 seasonal SKUs should be activated in the next 7 days.</p>
          </div>
        </div>
      </div>
    </section>

    <!-- ── CTA ── -->
    <section class="mx-auto w-full max-w-7xl px-6 pb-10">
      <div class="relative overflow-hidden rounded-3xl border border-glow-500/20 bg-gradient-to-br from-glow-500/10 via-ink-800/50 to-lime-500/10 p-12 text-center">
        <h2 class="text-3xl font-semibold">Start seeing your full picture today.</h2>
        <p class="mt-3 text-white/55 max-w-lg mx-auto">Connect in 2 minutes. No credit card. 14-day free trial.</p>
        <div class="mt-6 flex flex-wrap justify-center gap-4">
          <NuxtLink to="/auth/signup" class="btn-gradient">Start free → </NuxtLink>
          <NuxtLink to="/pricing" class="inline-flex items-center gap-2 rounded-full border border-white/15 px-5 py-2.5 text-sm text-white/75 hover:bg-white/5 transition-colors">See plans</NuxtLink>
        </div>
      </div>
    </section>

  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'marketing' });

const chartBars = Array.from({ length: 30 }, (_, i) => ({
  h: 30 + Math.sin(i * 0.4) * 20 + Math.random() * 25,
  color: i >= 25 ? '#22d3ee' : i >= 20 ? '#84cc16' : 'rgba(255,255,255,0.15)',
}));

const sideMetrics = [
  { label: 'Total ROAS', value: '6.4×', trend: 18.2 },
  { label: 'Total CTR', value: '3.2%', trend: 5.1 },
  { label: 'Avg CPC', value: '$0.84', trend: -8.4 },
  { label: 'Conversions', value: '5,821', trend: 22.7 },
];

const livePoints = [
  'Real-time sync from Meta, Google, Shopify, WooCommerce',
  'Unified ROAS, CTR, revenue, and conversion rate view',
  'Custom date ranges and comparison periods',
  'Exportable to CSV or Google Sheets in one click',
];

const dataSources = [
  { name: 'Meta Ads', sub: 'All campaigns · Last sync 2m ago', abbr: 'M', bg: 'rgba(24,119,242,0.2)' },
  { name: 'Shopify', sub: '1,284 products · 30d revenue', abbr: 'S', bg: 'rgba(149,191,71,0.2)' },
  { name: 'Google Ads', sub: 'Shopping + search campaigns', abbr: 'G', bg: 'rgba(234,67,53,0.2)' },
  { name: 'GA4', sub: 'Web analytics · goals linked', abbr: 'GA', bg: 'rgba(251,188,5,0.2)' },
  { name: 'Klaviyo', sub: 'Email revenue attribution', abbr: 'K', bg: 'rgba(34,211,238,0.2)' },
];

const attributedSkus = [
  { name: 'Running Shoe Pro', pct: 88, revenue: '$48,200', roas: '7.2', color: '#84cc16' },
  { name: 'Yoga Mat Ultra', pct: 72, revenue: '$31,540', roas: '5.4', color: '#22d3ee' },
  { name: 'Water Bottle XL', pct: 54, revenue: '$18,900', roas: '3.8', color: '#22d3ee' },
  { name: 'Gym Bag Pro', pct: 40, revenue: '$12,400', roas: '2.9', color: '#f97316' },
  { name: 'Resistance Bands', pct: 28, revenue: '$8,100', roas: '1.9', color: '#f97316' },
];

const attributionPoints = [
  'Multi-touch attribution across Meta and Google',
  'First-click, last-click, or data-driven models',
  'Revenue mapped to individual product variants',
  'Blended ROAS across all paid channels',
];

const forecastPoints = [
  'Revenue forecasts updated daily from trend signals',
  'Inventory depletion alerts before stockouts',
  'Seasonal opportunity detection using historical data',
  'Confidence intervals shown for all projections',
];
</script>

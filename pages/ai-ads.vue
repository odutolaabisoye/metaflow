<template>
  <div>

    <!-- ── Hero ── -->
    <section class="relative mx-auto w-full max-w-7xl px-6 pt-16 pb-8 text-center">
      <div class="glow-orb w-[500px] h-[300px] left-1/2 -translate-x-1/2 -top-20 bg-ember-500/10"></div>
      <span class="section-badge mb-5">
        <svg class="w-3.5 h-3.5 text-ember-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2h-2"/></svg>
        AI Ads Intelligence
      </span>
      <h1 class="mx-auto mt-4 max-w-3xl text-5xl font-semibold leading-[1.1] tracking-tight sm:text-6xl">
        Your AI co-pilot<br/>
        <span class="text-gradient">for Meta catalog ads.</span>
      </h1>
      <p class="mx-auto mt-6 max-w-2xl text-lg text-white/80 leading-relaxed">
        Actionable intelligence, not just dashboards. MetaFlow's AI reads your full catalog data and tells you
        exactly what to do next — in plain English, every single day.
      </p>
      <div class="mt-8 flex flex-wrap justify-center gap-4">
        <NuxtLink to="/auth/signup" class="btn-gradient btn-gradient-lg">Start free — 14 days</NuxtLink>
        <NuxtLink to="/optimization" class="inline-flex items-center gap-2 rounded-full border border-white/15 px-6 py-3.5 text-sm font-medium text-white/80 hover:bg-white/5 transition-colors">
          See Optimization
        </NuxtLink>
      </div>
    </section>

    <!-- ── AI Chat mockup ── -->
    <section class="mx-auto w-full max-w-7xl px-6 py-8">
      <div class="glass rounded-3xl overflow-hidden border border-white/15 shadow-glow-lg">
        <div class="flex items-center gap-2 border-b border-white/10 bg-white/[0.02] px-5 py-3">
          <div class="flex gap-1.5">
            <div class="h-2.5 w-2.5 rounded-full bg-ember-500/50"></div>
            <div class="h-2.5 w-2.5 rounded-full bg-lime-500/50"></div>
            <div class="h-2.5 w-2.5 rounded-full bg-glow-500/50"></div>
          </div>
          <div class="ml-3 rounded-lg bg-white/5 px-3 py-1 text-xs text-white/55 flex-1 max-w-sm">
            app.metaflow.io/ai
          </div>
        </div>
        <div class="p-6 grid gap-6 lg:grid-cols-[1fr_360px]">
          <!-- Daily insights panel -->
          <div class="space-y-4">
            <div class="flex items-center gap-3 mb-2">
              <div class="h-9 w-9 rounded-xl bg-gradient-to-br from-ember-500/20 to-glow-500/20 border border-ember-500/20 flex items-center justify-center">
                <svg class="w-5 h-5 text-ember-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18"/></svg>
              </div>
              <div>
                <p class="text-sm font-medium">MetaFlow AI · Daily Briefing</p>
                <p class="text-xs text-white/65">Updated 6 hours ago</p>
              </div>
            </div>
            <div v-for="insight in aiInsights" :key="insight.title" class="rounded-2xl border p-4" :class="insight.type === 'action' ? 'bg-glow-500/6 border-glow-500/20' : insight.type === 'warning' ? 'bg-ember-500/6 border-ember-500/20' : insight.type === 'success' ? 'bg-lime-500/6 border-lime-500/20' : 'bg-white/[0.04] border-white/10'">
              <div class="flex items-start justify-between gap-3 mb-2">
                <p class="text-sm font-semibold">{{ insight.title }}</p>
                <span class="flex-shrink-0 text-xs px-2.5 py-0.5 rounded-full font-medium" :class="insight.type === 'action' ? 'bg-glow-500/15 text-glow-400' : insight.type === 'warning' ? 'bg-ember-500/15 text-ember-400' : insight.type === 'success' ? 'bg-lime-500/15 text-lime-400' : 'bg-white/10 text-white/75'">
                  {{ insight.tag }}
                </span>
              </div>
              <p class="text-xs text-white/80 leading-relaxed">{{ insight.body }}</p>
              <button v-if="insight.cta" class="mt-3 text-xs font-medium flex items-center gap-1.5 transition-colors" :class="insight.type === 'action' ? 'text-glow-400 hover:text-glow-500' : 'text-lime-400 hover:text-lime-500'">
                {{ insight.cta }}
                <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"/></svg>
              </button>
            </div>
          </div>
          <!-- AI Chat panel -->
          <div class="flex flex-col gap-3">
            <p class="text-xs text-white/70 mb-1">Ask MetaFlow AI anything</p>
            <div class="flex-1 space-y-3">
              <div v-for="msg in chatMessages" :key="msg.text" :class="['rounded-2xl p-3.5 text-sm', msg.user ? 'bg-white/8 border border-white/10 ml-6' : 'bg-glow-500/8 border border-glow-500/15 mr-4']">
                <p class="text-xs font-medium mb-1.5" :class="msg.user ? 'text-white/75' : 'text-glow-400'">{{ msg.user ? 'You' : 'MetaFlow AI' }}</p>
                <p class="text-white/75 leading-relaxed text-xs">{{ msg.text }}</p>
              </div>
            </div>
            <div class="rounded-2xl bg-white/5 border border-white/15 flex items-center gap-2 px-4 py-2.5">
              <input type="text" placeholder="Ask about your catalog…" class="flex-1 bg-transparent text-xs text-white/80 placeholder-white/30 outline-none" readonly/>
              <button class="h-6 w-6 rounded-lg bg-glow-500/20 flex items-center justify-center flex-shrink-0">
                <svg class="w-3 h-3 text-glow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"/></svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ── Feature: SKU-level insights ── -->
    <section class="mx-auto w-full max-w-7xl px-6 py-16">
      <div class="grid items-center gap-12 lg:grid-cols-2">
        <div class="space-y-5">
          <span class="section-badge"><span class="h-1.5 w-1.5 rounded-full bg-glow-500"></span> SKU Intelligence</span>
          <h2 class="text-3xl font-semibold">Recommendations<br/>you can trust</h2>
          <p class="text-white/80 leading-relaxed">
            Every recommendation comes with a clear explanation. Not just "pause this SKU" — but exactly why,
            with the data to back it up. One-click apply for every action.
          </p>
          <ul class="space-y-3">
            <li v-for="p in insightPoints" :key="p" class="flex items-start gap-3 text-sm text-white/70">
              <svg class="w-4 h-4 text-glow-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
              {{ p }}
            </li>
          </ul>
        </div>
        <div class="feature-card space-y-3">
          <p class="text-sm font-medium mb-4">SKU intelligence card</p>
          <div class="rounded-2xl bg-white/[0.04] border border-white/10 p-4">
            <div class="flex items-center justify-between mb-3">
              <p class="text-sm font-semibold">Running Shoe Pro</p>
              <span class="rounded-full bg-lime-500/15 px-2.5 py-0.5 text-xs text-lime-400 font-medium">Score: 92</span>
            </div>
            <div class="grid grid-cols-3 gap-2 mb-3">
              <div class="text-center"><p class="text-lg font-semibold">7.2×</p><p class="text-xs text-white/65">ROAS</p></div>
              <div class="text-center"><p class="text-lg font-semibold">4.1%</p><p class="text-xs text-white/65">CTR</p></div>
              <div class="text-center"><p class="text-lg font-semibold">62%</p><p class="text-xs text-white/65">Margin</p></div>
            </div>
            <div class="rounded-xl bg-glow-500/8 border border-glow-500/20 p-3">
              <p class="text-xs text-glow-400 font-medium mb-1">AI Recommendation</p>
              <p class="text-xs text-white/65">This SKU has maintained ROAS > 6× for 7 consecutive days with strong margin. Move to a dedicated scale campaign and increase daily budget by 40%.</p>
              <button class="mt-2 text-xs text-glow-400 flex items-center gap-1 hover:text-glow-500">Apply recommendation <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"/></svg></button>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ── Feature: Predictive modeling ── -->
    <section class="mx-auto w-full max-w-7xl px-6 py-16">
      <div class="grid items-center gap-12 lg:grid-cols-2">
        <div class="feature-card order-2 lg:order-1 space-y-4">
          <p class="text-sm font-medium">ROAS trajectory prediction</p>
          <!-- Simulated chart -->
          <div class="relative h-40 flex items-end gap-1">
            <div v-for="(b, i) in predBars" :key="i" class="flex-1 rounded-t-sm" :style="{ height: b.h + '%', background: b.predicted ? 'rgba(34,211,238,0.25)' : 'rgba(34,211,238,0.6)', border: b.predicted ? '1px dashed rgba(34,211,238,0.3)' : 'none' }"></div>
          </div>
          <div class="flex items-center gap-4 text-xs text-white/65">
            <span class="flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded bg-glow-500/60"></span>Actual ROAS</span>
            <span class="flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded border border-dashed border-glow-500/40"></span>Predicted</span>
          </div>
          <div class="rounded-2xl bg-glow-500/8 border border-glow-500/20 p-4">
            <p class="text-xs text-glow-400 font-medium">Prediction: Next 14 days</p>
            <p class="text-2xl font-semibold mt-1">7.8× <span class="text-sm font-normal text-white/75">avg ROAS</span></p>
            <p class="text-xs text-white/80 mt-1">Based on seasonal trend and current trajectory. Confidence: 82%.</p>
          </div>
        </div>
        <div class="space-y-5 order-1 lg:order-2">
          <span class="section-badge"><span class="h-1.5 w-1.5 rounded-full bg-ember-500"></span> Predictive Intelligence</span>
          <h2 class="text-3xl font-semibold">Know tomorrow's<br/>ROAS today</h2>
          <p class="text-white/80 leading-relaxed">
            MetaFlow's predictive model analyzes 90 days of historical data to forecast ROAS trajectories for every SKU.
            Allocate budget to the future, not just the past.
          </p>
          <ul class="space-y-3">
            <li v-for="p in predictPoints" :key="p" class="flex items-start gap-3 text-sm text-white/70">
              <svg class="w-4 h-4 text-ember-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
              {{ p }}
            </li>
          </ul>
        </div>
      </div>
    </section>

    <!-- ── CTA ── -->
    <section class="mx-auto w-full max-w-7xl px-6 pb-10">
      <div class="relative overflow-hidden rounded-3xl border border-ember-500/20 bg-gradient-to-br from-ember-500/10 via-ink-800/50 to-glow-500/10 p-12 text-center">
        <h2 class="text-3xl font-semibold">Let AI handle the thinking.<br/>You handle the growth.</h2>
        <p class="mt-3 text-white/80 max-w-lg mx-auto">14-day free trial. No credit card. Connect in under 2 minutes.</p>
        <div class="mt-6 flex flex-wrap justify-center gap-4">
          <NuxtLink to="/auth/signup" class="btn-gradient">Start free →</NuxtLink>
          <NuxtLink to="/pricing" class="inline-flex items-center gap-2 rounded-full border border-white/15 px-5 py-2.5 text-sm text-white/75 hover:bg-white/5 transition-colors">See pricing →</NuxtLink>
        </div>
      </div>
    </section>

  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'marketing' });

const aiInsights = [
  { title: 'Scale opportunity: 9 SKUs ready', body: 'Running Shoe Pro, Yoga Mat Ultra, and 7 more SKUs have maintained ROAS > 5.5× for 5+ days. Move them to a dedicated scale campaign to unlock more spend.', type: 'action', tag: 'High Priority', cta: 'Apply to all 9 SKUs' },
  { title: 'Inventory risk: 3 SKUs critical', body: 'Water Bottle XL, Gym Bag Pro, and Resistance Bands each have < 6 days of stock at current ad velocity. Ads will pause automatically in 3 days if no restock.', type: 'warning', tag: 'Warning', cta: 'Review inventory' },
  { title: 'ROAS recovery detected', body: 'Gym Gloves Set (paused 12 days ago) now shows recovering trend after discount. Recommended to test with $15/day budget.', type: 'success', tag: 'Opportunity', cta: 'Re-activate test' },
  { title: 'Weekly catalog summary', body: 'Catalog ROAS improved 18% week-over-week. Budget efficiency up 12%. 86 SKUs actively scaling.', type: 'neutral', tag: 'Summary', cta: null },
];

const chatMessages = [
  { user: true, text: 'Why did my ROAS drop on Thursday?' },
  { user: false, text: 'Thursday\'s ROAS dropped from 6.4× to 4.1× due to three compounding factors: (1) Yoga Mat Ultra ran out of stock mid-day, removing your highest-performing SKU from auctions; (2) CPMs increased 28% on Thursday due to platform-wide competition; (3) Water Bottle XL\'s CTR declined after 6 days of the same creative. I\'ve queued three recommendations to address each issue.' },
];

const insightPoints = [
  'Plain-English explanation for every recommendation',
  'Data citations: the exact signals that triggered the insight',
  'One-click "Apply" to execute the recommended action',
  'Historical accuracy score shown for each prediction type',
];

const predBars = [
  ...Array.from({ length: 14 }, (_, i) => ({ h: 50 + Math.sin(i * 0.6) * 15 + Math.random() * 10, predicted: false })),
  ...Array.from({ length: 14 }, (_, i) => ({ h: 60 + Math.sin(i * 0.4) * 10 + 5, predicted: true })),
];

const predictPoints = [
  'Per-SKU ROAS trajectory forecast for the next 14 days',
  'Seasonal trend detection from 12-month historical data',
  'Budget allocation recommendations based on predictions',
  'Confidence intervals so you know when to trust the model',
];
</script>

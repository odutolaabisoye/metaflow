<template>
  <div>

    <!-- ═══════════════════════════════════════
         HERO
    ═══════════════════════════════════════ -->
    <section class="relative mx-auto w-full max-w-7xl px-6 pt-16 pb-8 text-center">
      <!-- Glow orbs -->
      <div class="glow-orb w-[500px] h-[400px] left-1/2 -translate-x-1/2 -top-32 bg-glow-500/15"></div>

      <!-- Badge -->
      <div class="inline-flex items-center gap-2 rounded-full border border-glow-500/25 bg-glow-500/10 px-4 py-1.5 text-xs font-medium text-glow-500 mb-6">
        <span class="h-1.5 w-1.5 rounded-full bg-glow-500 animate-pulse"></span>
        Meta Ads Intelligence Platform · Now in beta
      </div>

      <!-- Headline -->
      <h1 class="mx-auto max-w-4xl text-5xl font-semibold leading-[1.1] tracking-tight sm:text-6xl lg:text-7xl">
        Turn every SKU into a
        <br class="hidden sm:block"/>
        <span class="text-gradient">Meta ads profit center</span>
      </h1>

      <!-- Subheadline -->
      <p class="mx-auto mt-6 max-w-2xl text-lg text-white/60 leading-relaxed">
        MetaFlow scores your entire product catalog on ROAS, CTR, margin, and inventory velocity.
        Winners scale automatically. Budget moves where it matters. Every day.
      </p>

      <!-- CTAs -->
      <div class="mt-8 flex flex-wrap items-center justify-center gap-4">
        <NuxtLink to="/auth/signup" class="btn-gradient btn-gradient-lg">
          Start free — 14 days
        </NuxtLink>
        <NuxtLink
          to="/app"
          class="inline-flex items-center gap-2 rounded-full border border-white/15 px-6 py-3.5 text-sm font-medium text-white/80 hover:bg-white/5 transition-colors"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z"/>
          </svg>
          Watch demo
        </NuxtLink>
      </div>

      <!-- Trust line -->
      <p class="mt-6 text-xs text-white/40 flex flex-wrap justify-center items-center gap-x-4 gap-y-2">
        <span class="flex items-center gap-1.5"><svg class="w-3 h-3 text-lime-500" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg> No credit card required</span>
        <span class="flex items-center gap-1.5"><svg class="w-3 h-3 text-lime-500" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg> Shopify + WooCommerce ready</span>
        <span class="flex items-center gap-1.5"><svg class="w-3 h-3 text-lime-500" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg> Meta Partner verified</span>
      </p>

      <!-- Product mockup -->
      <div class="relative mx-auto mt-14 max-w-4xl">
        <!-- Glow beneath mockup -->
        <div class="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-glow-500/10 to-transparent rounded-full blur-3xl"></div>

        <!-- Browser chrome -->
        <div class="relative glass rounded-3xl overflow-hidden shadow-glow-lg border border-white/15">
          <!-- Browser bar -->
          <div class="flex items-center gap-2 border-b border-white/10 bg-white/[0.02] px-4 py-3">
            <div class="flex gap-1.5">
              <div class="h-2.5 w-2.5 rounded-full bg-ember-500/50"></div>
              <div class="h-2.5 w-2.5 rounded-full bg-lime-500/50"></div>
              <div class="h-2.5 w-2.5 rounded-full bg-glow-500/50"></div>
            </div>
            <div class="ml-3 flex-1 max-w-64 rounded-lg bg-white/5 px-3 py-1 text-xs text-white/30">
              app.metaflow.io/dashboard
            </div>
            <div class="flex items-center gap-1.5 rounded-full bg-lime-500/10 px-2.5 py-1 text-xs text-lime-400">
              <span class="h-1.5 w-1.5 rounded-full bg-lime-400 animate-pulse"></span>
              Live sync
            </div>
          </div>

          <!-- Dashboard content -->
          <div class="p-5 grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            <!-- Stat cards -->
            <div class="rounded-2xl bg-white/[0.04] border border-white/10 p-4">
              <p class="text-xs text-white/50 mb-1.5">Today's Revenue</p>
              <p class="text-2xl font-semibold text-white">$124,280</p>
              <div class="mt-2 flex items-center gap-1 text-xs text-lime-400">
                <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25"/></svg>
                +28.4% vs yesterday
              </div>
            </div>
            <div class="rounded-2xl bg-white/[0.04] border border-white/10 p-4">
              <p class="text-xs text-white/50 mb-1.5">Catalog ROAS</p>
              <p class="text-2xl font-semibold text-white">6.4×</p>
              <div class="mt-2 flex items-center gap-1 text-xs text-lime-400">
                <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25"/></svg>
                +1.2× this week
              </div>
            </div>
            <div class="rounded-2xl bg-white/[0.04] border border-white/10 p-4">
              <p class="text-xs text-white/50 mb-1.5">Active SKUs</p>
              <p class="text-2xl font-semibold text-white">86 / 210</p>
              <div class="mt-2 flex items-center gap-1 text-xs text-white/40 text-xs">
                <span class="h-1.5 w-1.5 rounded-full bg-glow-500"></span>
                Scoring running
              </div>
            </div>
            <div class="rounded-2xl bg-glow-500/10 border border-glow-500/20 p-4">
              <p class="text-xs text-glow-500 font-medium mb-1.5">AI says</p>
              <p class="text-sm text-white leading-snug">Move 9 SKUs into a dedicated high-ROAS ad set</p>
              <button class="mt-3 text-xs text-glow-500 hover:text-glow-600 transition-colors flex items-center gap-1">
                Apply now <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"/></svg>
              </button>
            </div>
          </div>

          <!-- SKU performance bars -->
          <div class="px-5 pb-5">
            <div class="rounded-2xl bg-white/[0.03] border border-white/8 p-4 space-y-2.5">
              <div class="flex items-center justify-between mb-3">
                <p class="text-xs font-medium text-white/70">Top performing SKUs</p>
                <span class="text-xs text-white/40">Scored by ROAS · CTR · Margin</span>
              </div>
              <div v-for="sku in skus" :key="sku.name" class="flex items-center gap-3">
                <div class="w-28 flex-shrink-0">
                  <p class="text-xs text-white/70 truncate">{{ sku.name }}</p>
                </div>
                <div class="flex-1 rounded-full bg-white/5 h-2">
                  <div class="h-2 rounded-full transition-all" :style="{ width: sku.score + '%', background: sku.color }"></div>
                </div>
                <div class="w-16 text-right">
                  <span class="text-xs font-medium" :style="{ color: sku.color }">{{ sku.roas }}× ROAS</span>
                </div>
                <span :class="['text-xs px-2 py-0.5 rounded-full font-medium', sku.badge === 'Scale' ? 'bg-lime-500/15 text-lime-400' : sku.badge === 'Watch' ? 'bg-ember-500/15 text-ember-400' : 'bg-white/10 text-white/50']">
                  {{ sku.badge }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ═══════════════════════════════════════
         INTEGRATION STRIP
    ═══════════════════════════════════════ -->
    <section class="mx-auto w-full max-w-7xl px-6 py-10">
      <div class="glass rounded-2xl px-8 py-5 border border-white/10">
        <p class="text-center text-xs text-white/40 uppercase tracking-widest mb-5">Works with your stack</p>
        <div class="flex flex-wrap items-center justify-center gap-8">
          <div v-for="brand in integrations" :key="brand.name" class="flex items-center gap-2 text-white/40 hover:text-white/70 transition-colors">
            <div class="h-7 w-7 rounded-lg flex items-center justify-center" :style="{ background: brand.bg }">
              <span class="text-xs font-bold text-white">{{ brand.abbr }}</span>
            </div>
            <span class="text-sm font-medium">{{ brand.name }}</span>
          </div>
        </div>
      </div>
    </section>

    <!-- ═══════════════════════════════════════
         STATS
    ═══════════════════════════════════════ -->
    <section class="mx-auto w-full max-w-7xl px-6 py-16">
      <div class="grid gap-px rounded-3xl overflow-hidden border border-white/10 sm:grid-cols-3">
        <div v-for="stat in stats" :key="stat.label" class="bg-white/[0.03] hover:bg-white/[0.06] transition-colors px-10 py-10 text-center">
          <p class="text-5xl font-semibold tracking-tight text-gradient stat-number">{{ stat.value }}</p>
          <p class="mt-2 text-sm text-white/60">{{ stat.label }}</p>
          <p class="mt-1 text-xs text-white/35">{{ stat.sub }}</p>
        </div>
      </div>
    </section>

    <!-- ═══════════════════════════════════════
         FEATURE BLOCKS
    ═══════════════════════════════════════ -->
    <section id="features" class="mx-auto w-full max-w-7xl px-6 py-8">
      <div class="text-center mb-16">
        <p class="section-title mb-3">How it works</p>
        <h2 class="text-4xl font-semibold">One platform.<br class="sm:hidden"/> Every catalog move.</h2>
      </div>

      <!-- Feature 1: Product Intelligence -->
      <div class="grid items-center gap-12 lg:grid-cols-2 mb-24">
        <div class="space-y-5">
          <span class="section-badge">
            <span class="h-1.5 w-1.5 rounded-full bg-glow-500"></span>
            Product Intelligence
          </span>
          <h3 class="text-3xl font-semibold leading-tight">Score every SKU,<br/>every single day</h3>
          <p class="text-white/60 leading-relaxed">
            Every product in your catalog gets a daily performance score based on ROAS, click-through rate,
            conversion rate, gross margin, and inventory velocity. One clear score. Total clarity.
          </p>
          <ul class="space-y-3">
            <li v-for="item in feature1Points" :key="item" class="flex items-start gap-3 text-sm text-white/70">
              <svg class="w-4 h-4 text-glow-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
              {{ item }}
            </li>
          </ul>
          <NuxtLink to="/analytics" class="inline-flex items-center gap-2 text-sm text-glow-500 hover:text-glow-600 transition-colors font-medium">
            Explore Analytics →
          </NuxtLink>
        </div>
        <!-- Mockup -->
        <div class="glass rounded-3xl p-5 border border-white/15 shadow-card">
          <div class="mb-4 flex items-center justify-between">
            <p class="text-sm font-medium">Product Score Breakdown</p>
            <span class="rounded-full bg-glow-500/10 px-2.5 py-1 text-xs text-glow-500">Auto-updated</span>
          </div>
          <div class="space-y-3">
            <div v-for="metric in scoreMetrics" :key="metric.label" class="space-y-1.5">
              <div class="flex justify-between text-xs">
                <span class="text-white/60">{{ metric.label }}</span>
                <span class="font-medium">{{ metric.val }}</span>
              </div>
              <div class="h-1.5 rounded-full bg-white/10">
                <div class="h-1.5 rounded-full" :style="{ width: metric.pct + '%', background: metric.color }"></div>
              </div>
            </div>
          </div>
          <div class="mt-5 rounded-2xl bg-white/[0.04] border border-white/10 p-4 text-center">
            <p class="text-3xl font-semibold text-gradient">92</p>
            <p class="text-xs text-white/50 mt-1">Overall product score · Top 5%</p>
          </div>
        </div>
      </div>

      <!-- Feature 2: Budget Allocation (reversed) -->
      <div class="grid items-center gap-12 lg:grid-cols-2 mb-24">
        <!-- Mockup first on desktop -->
        <div class="glass rounded-3xl p-5 border border-white/15 shadow-card order-2 lg:order-1">
          <div class="mb-4 flex items-center justify-between">
            <p class="text-sm font-medium">Budget Automation Rules</p>
            <span class="flex items-center gap-1.5 text-xs text-lime-400"><span class="h-1.5 w-1.5 rounded-full bg-lime-400 animate-pulse"></span>Running</span>
          </div>
          <div class="space-y-2.5">
            <div v-for="rule in automationRules" :key="rule.name" class="flex items-center justify-between rounded-xl bg-white/[0.04] border border-white/8 px-4 py-3">
              <div class="flex items-center gap-3">
                <div class="h-8 w-8 rounded-lg flex items-center justify-center" :style="{ background: rule.iconBg }">
                  <svg class="w-4 h-4" :style="{ color: rule.iconColor }" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" v-html="rule.icon"></svg>
                </div>
                <div>
                  <p class="text-sm font-medium">{{ rule.name }}</p>
                  <p class="text-xs text-white/45">{{ rule.desc }}</p>
                </div>
              </div>
              <div class="h-5 w-9 rounded-full flex items-center px-0.5 flex-shrink-0" :class="rule.active ? 'bg-lime-500/30 justify-end' : 'bg-white/10 justify-start'">
                <div class="h-4 w-4 rounded-full" :class="rule.active ? 'bg-lime-400' : 'bg-white/30'"></div>
              </div>
            </div>
          </div>
        </div>
        <div class="space-y-5 order-1 lg:order-2">
          <span class="section-badge">
            <span class="h-1.5 w-1.5 rounded-full bg-lime-500"></span>
            Smart Automation
          </span>
          <h3 class="text-3xl font-semibold leading-tight">Budget follows winners<br/>automatically</h3>
          <p class="text-white/60 leading-relaxed">
            Set your rules once. MetaFlow watches every SKU around the clock and moves budget
            to where it works hardest — no spreadsheets, no manual adjustments, no wasted spend.
          </p>
          <ul class="space-y-3">
            <li v-for="item in feature2Points" :key="item" class="flex items-start gap-3 text-sm text-white/70">
              <svg class="w-4 h-4 text-lime-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
              {{ item }}
            </li>
          </ul>
          <NuxtLink to="/optimization" class="inline-flex items-center gap-2 text-sm text-lime-500 hover:text-lime-600 transition-colors font-medium">
            Explore Optimization →
          </NuxtLink>
        </div>
      </div>

      <!-- Feature 3: AI Recommendations -->
      <div class="grid items-center gap-12 lg:grid-cols-2">
        <div class="space-y-5">
          <span class="section-badge">
            <span class="h-1.5 w-1.5 rounded-full bg-ember-500"></span>
            AI Intelligence
          </span>
          <h3 class="text-3xl font-semibold leading-tight">Know what to do<br/>before you ask</h3>
          <p class="text-white/60 leading-relaxed">
            Plain-English recommendations for every SKU, every day. MetaFlow's AI reads your full
            catalog data and tells you exactly what to do next — and why.
          </p>
          <ul class="space-y-3">
            <li v-for="item in feature3Points" :key="item" class="flex items-start gap-3 text-sm text-white/70">
              <svg class="w-4 h-4 text-ember-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
              {{ item }}
            </li>
          </ul>
          <NuxtLink to="/ai-ads" class="inline-flex items-center gap-2 text-sm text-ember-500 hover:text-ember-600 transition-colors font-medium">
            Explore AI Ads →
          </NuxtLink>
        </div>
        <!-- Mockup -->
        <div class="glass rounded-3xl p-5 border border-white/15 shadow-card space-y-3">
          <div class="flex items-center gap-3 mb-4">
            <div class="h-8 w-8 rounded-xl bg-gradient-to-br from-ember-500/20 to-glow-500/20 flex items-center justify-center border border-ember-500/20">
              <svg class="w-4 h-4 text-ember-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2h-2"/></svg>
            </div>
            <div>
              <p class="text-sm font-medium">MetaFlow AI</p>
              <p class="text-xs text-white/40">3 new insights today</p>
            </div>
          </div>
          <div v-for="insight in aiInsights" :key="insight.title" class="rounded-2xl border p-4 space-y-1" :class="insight.type === 'action' ? 'bg-glow-500/5 border-glow-500/20' : insight.type === 'warning' ? 'bg-ember-500/5 border-ember-500/20' : 'bg-white/[0.04] border-white/10'">
            <div class="flex items-start justify-between gap-2">
              <p class="text-sm font-medium">{{ insight.title }}</p>
              <span class="flex-shrink-0 text-xs px-2 py-0.5 rounded-full" :class="insight.type === 'action' ? 'bg-glow-500/15 text-glow-400' : insight.type === 'warning' ? 'bg-ember-500/15 text-ember-400' : 'bg-white/10 text-white/50'">
                {{ insight.tag }}
              </span>
            </div>
            <p class="text-xs text-white/55">{{ insight.body }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- ═══════════════════════════════════════
         HOW IT WORKS
    ═══════════════════════════════════════ -->
    <section id="workflow" class="mx-auto w-full max-w-7xl px-6 py-20">
      <div class="text-center mb-14">
        <p class="section-title mb-3">Setup</p>
        <h2 class="text-4xl font-semibold">Up and running in minutes</h2>
        <p class="mt-4 text-white/55 max-w-xl mx-auto">Connect your store, connect your ads account, and MetaFlow handles the rest.</p>
      </div>
      <div class="grid gap-6 sm:grid-cols-3">
        <div v-for="(step, i) in steps" :key="step.title" class="feature-card relative">
          <div class="mb-5 flex items-center gap-3">
            <div class="h-10 w-10 rounded-xl flex items-center justify-center text-sm font-semibold border" :style="{ background: step.bg, borderColor: step.border, color: step.color }">
              {{ i + 1 }}
            </div>
            <div class="flex-1 h-px bg-white/10" v-if="i < steps.length - 1"></div>
          </div>
          <h3 class="text-lg font-semibold mb-2">{{ step.title }}</h3>
          <p class="text-sm text-white/55 leading-relaxed">{{ step.desc }}</p>
        </div>
      </div>
    </section>

    <!-- ═══════════════════════════════════════
         TESTIMONIALS
    ═══════════════════════════════════════ -->
    <section class="mx-auto w-full max-w-7xl px-6 py-8">
      <div class="text-center mb-12">
        <p class="section-title mb-3">Social proof</p>
        <h2 class="text-4xl font-semibold">Trusted by catalog-first brands</h2>
      </div>
      <div class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <div v-for="review in testimonials" :key="review.name" class="feature-card space-y-4">
          <!-- Stars -->
          <div class="flex gap-1">
            <svg v-for="n in 5" :key="n" class="w-4 h-4 text-lime-400" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
            </svg>
          </div>
          <p class="text-sm text-white/80 leading-relaxed">"{{ review.quote }}"</p>
          <div class="flex items-center gap-3 pt-2 border-t border-white/10">
            <div class="h-9 w-9 rounded-full flex items-center justify-center text-xs font-semibold" :style="{ background: review.avatarBg }">
              {{ review.initials }}
            </div>
            <div>
              <p class="text-sm font-medium">{{ review.name }}</p>
              <p class="text-xs text-white/45">{{ review.role }}</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ═══════════════════════════════════════
         PRICING TEASER
    ═══════════════════════════════════════ -->
    <section id="pricing" class="mx-auto w-full max-w-7xl px-6 py-20">
      <div class="text-center mb-12">
        <p class="section-title mb-3">Pricing</p>
        <h2 class="text-4xl font-semibold">Plans that scale with your catalog</h2>
        <p class="mt-4 text-white/55">Start free. Scale when you're ready. Cancel anytime.</p>
      </div>
      <div class="grid gap-5 sm:grid-cols-3">
        <div v-for="plan in plans" :key="plan.name" class="feature-card relative" :class="plan.featured ? 'border-glow-500/30 shadow-glow' : ''">
          <div v-if="plan.featured" class="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-glow-500/20 border border-glow-500/30 px-3 py-1 text-xs font-medium text-glow-400">Most Popular</div>
          <p class="text-sm text-white/60">{{ plan.name }}</p>
          <div class="mt-3 flex items-baseline gap-1">
            <span class="text-4xl font-semibold">${{ plan.price }}</span>
            <span class="text-sm text-white/50">/ mo</span>
          </div>
          <p class="text-xs text-white/40 mt-1">{{ plan.sub }}</p>
          <ul class="mt-5 space-y-2.5">
            <li v-for="feat in plan.features" :key="feat" class="flex items-center gap-2.5 text-sm text-white/65">
              <svg class="w-4 h-4 text-lime-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
              {{ feat }}
            </li>
          </ul>
          <div class="mt-6">
            <NuxtLink
              to="/auth/signup"
              :class="[
                'block w-full rounded-full py-2.5 text-sm font-medium text-center transition-colors',
                plan.featured
                  ? 'bg-glow-500/20 border border-glow-500/30 text-glow-400 hover:bg-glow-500/30'
                  : 'border border-white/15 text-white/80 hover:bg-white/5'
              ]"
            >
              {{ plan.cta }}
            </NuxtLink>
          </div>
        </div>
      </div>
      <div class="mt-6 text-center">
        <NuxtLink to="/pricing" class="text-sm text-white/50 hover:text-white transition-colors">
          See full pricing & feature comparison →
        </NuxtLink>
      </div>
    </section>

    <!-- ═══════════════════════════════════════
         BOTTOM CTA
    ═══════════════════════════════════════ -->
    <section class="mx-auto w-full max-w-7xl px-6 pb-10">
      <div class="relative overflow-hidden rounded-3xl border border-glow-500/20 bg-gradient-to-br from-glow-500/10 via-ink-800/50 to-lime-500/10 p-12 text-center">
        <div class="glow-orb w-[400px] h-[300px] left-1/2 -translate-x-1/2 top-0 bg-glow-500/15 -z-0"></div>
        <div class="relative">
          <h2 class="text-4xl font-semibold">You're one catalog audit<br/>away from better ROAS.</h2>
          <p class="mt-4 text-white/55 max-w-lg mx-auto">Start your free 14-day trial. Connect your Meta Ads and Shopify store in 2 minutes. No credit card required.</p>
          <div class="mt-8 flex flex-wrap justify-center gap-4">
            <NuxtLink to="/auth/signup" class="btn-gradient btn-gradient-lg">
              Start free — 14 days
            </NuxtLink>
            <NuxtLink to="/app" class="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-6 py-3.5 text-sm font-medium text-white/80 hover:bg-white/10 transition-colors">
              View live dashboard
            </NuxtLink>
          </div>
          <p class="mt-4 text-xs text-white/35">Shopify · WooCommerce · Meta Ads · No credit card required</p>
        </div>
      </div>
    </section>

  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'marketing' });

const skus = [
  { name: 'Running Shoe Pro', score: 92, roas: 7.2, color: '#84cc16', badge: 'Scale' },
  { name: 'Yoga Mat Ultra', score: 78, roas: 5.4, color: '#22d3ee', badge: 'Scale' },
  { name: 'Water Bottle XL', score: 61, roas: 3.8, color: '#22d3ee', badge: 'Hold' },
  { name: 'Gym Gloves Set', score: 38, roas: 1.9, color: '#f97316', badge: 'Watch' },
];

const integrations = [
  { name: 'Meta Ads', abbr: 'M', bg: 'rgba(24, 119, 242, 0.25)' },
  { name: 'Shopify', abbr: 'S', bg: 'rgba(149, 191, 71, 0.25)' },
  { name: 'WooCommerce', abbr: 'W', bg: 'rgba(150, 88, 169, 0.25)' },
  { name: 'Google Ads', abbr: 'G', bg: 'rgba(234, 67, 53, 0.25)' },
  { name: 'GA4', abbr: 'GA', bg: 'rgba(251, 188, 5, 0.25)' },
  { name: 'Klaviyo', abbr: 'K', bg: 'rgba(34, 211, 238, 0.25)' },
];

const stats = [
  { value: '$2.8B+', label: 'Catalog revenue attributed', sub: 'Across all connected stores' },
  { value: '94%', label: 'Average ROAS improvement', sub: 'Within 60 days of activation' },
  { value: '12M+', label: 'SKUs scored weekly', sub: 'Real-time performance data' },
];

const scoreMetrics = [
  { label: 'ROAS', val: '7.2×', pct: 90, color: '#84cc16' },
  { label: 'CTR', val: '3.8%', pct: 76, color: '#22d3ee' },
  { label: 'Conversion Rate', val: '4.2%', pct: 84, color: '#22d3ee' },
  { label: 'Gross Margin', val: '62%', pct: 62, color: '#f97316' },
  { label: 'Inventory Velocity', val: 'High', pct: 88, color: '#84cc16' },
];

const automationRules = [
  { name: 'Scale Winners', desc: 'ROAS > 5× → increase budget 20%', active: true, iconBg: 'rgba(132,204,22,0.1)', iconColor: '#84cc16', icon: '<path stroke-linecap="round" stroke-linejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>' },
  { name: 'Stop Loss', desc: 'ROAS < 1.5× for 3 days → pause', active: true, iconBg: 'rgba(249,115,22,0.1)', iconColor: '#f97316', icon: '<path stroke-linecap="round" stroke-linejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/>' },
  { name: 'Inventory Alert', desc: 'Stock < 7 days → pause ads', active: true, iconBg: 'rgba(34,211,238,0.1)', iconColor: '#22d3ee', icon: '<path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z"/>' },
  { name: 'Revive', desc: 'Paused + new inventory → test again', active: false, iconBg: 'rgba(255,255,255,0.05)', iconColor: 'rgba(255,255,255,0.4)', icon: '<path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"/>' },
];

const feature1Points = [
  'Five-signal composite score updated every 24 hours',
  'Compare any SKU against catalog average or top performers',
  'Inventory risk flagged before it hurts your ads',
];

const feature2Points = [
  'Visual rule builder — no code required',
  'Auto-move SKUs between Meta ad sets in real time',
  'Full audit trail of every automated action',
];

const feature3Points = [
  'Natural language insights: "Why did ROAS drop?"',
  'Predictive ROAS modeling using 90-day trends',
  'One-click apply for every AI recommendation',
];

const aiInsights = [
  { title: 'Scale opportunity detected', body: 'Running Shoe Pro has maintained ROAS > 6× for 7 days. Move to dedicated scale campaign.', type: 'action', tag: 'Action' },
  { title: 'Inventory risk alert', body: 'Yoga Mat Ultra has 5 days of stock remaining. Pausing ads in 2 days unless restocked.', type: 'warning', tag: 'Warning' },
  { title: 'New audience match', body: 'Your top 3 SKUs share high overlap with "fitness enthusiasts 25-34". Consider dedicated set.', type: 'info', tag: 'Insight' },
];

const steps = [
  { title: 'Connect your store', desc: 'Install the MetaFlow app on Shopify or WooCommerce in one click. Your catalog syncs instantly.', bg: 'rgba(34,211,238,0.1)', border: 'rgba(34,211,238,0.2)', color: '#22d3ee' },
  { title: 'Link Meta Ads', desc: 'Connect your Meta Business account. MetaFlow maps every SKU to its ad performance automatically.', bg: 'rgba(132,204,22,0.1)', border: 'rgba(132,204,22,0.2)', color: '#84cc16' },
  { title: 'Let the AI optimize', desc: 'MetaFlow scores your catalog, identifies winners, and starts optimizing within 24 hours.', bg: 'rgba(249,115,22,0.1)', border: 'rgba(249,115,22,0.2)', color: '#f97316' },
];

const testimonials = [
  { quote: 'MetaFlow cut our catalog management time from 4 hours to 15 minutes. We actually understand which products are worth advertising now.', name: 'Adaeze Okafor', role: 'Growth Manager · Lagos', initials: 'AO', avatarBg: 'rgba(34,211,238,0.2)' },
  { quote: "We went from 2.1× to 5.8× ROAS in 6 weeks. The product scoring changed everything — we stopped guessing and started knowing.", name: 'James Harrison', role: 'Founder · London', initials: 'JH', avatarBg: 'rgba(132,204,22,0.2)' },
  { quote: 'The inventory alerts saved our best Black Friday SKUs. Genuinely saved Christmas. Could not recommend MetaFlow more.', name: 'Sarah Chen', role: 'Operations Lead · New York', initials: 'SC', avatarBg: 'rgba(249,115,22,0.2)' },
];

const plans = [
  {
    name: 'Starter',
    price: 49,
    sub: 'Up to 500 SKUs · 1 store',
    featured: false,
    cta: 'Start free trial',
    features: ['Product scoring dashboard', 'Daily AI insights', '1 Meta Ads account', 'Email support'],
  },
  {
    name: 'Growth',
    price: 149,
    sub: 'Up to 2,000 SKUs · 3 stores',
    featured: true,
    cta: 'Start free trial',
    features: ['Everything in Starter', 'Automation rules (unlimited)', 'AI recommendations', 'Priority support'],
  },
  {
    name: 'Scale',
    price: 399,
    sub: 'Unlimited SKUs · Unlimited stores',
    featured: false,
    cta: 'Talk to sales',
    features: ['Everything in Growth', 'Dedicated ad set automation', 'Team seats + audit logs', 'Slack & WhatsApp support'],
  },
];
</script>

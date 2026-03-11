<template>
  <div>

    <!-- ── Hero ── -->
    <section class="relative overflow-hidden pt-32 pb-16">
      <div class="absolute inset-0 bg-gradient-to-b from-glow-500/8 via-transparent to-transparent pointer-events-none"></div>
      <div class="absolute top-0 left-1/2 -translate-x-1/2 h-80 w-80 rounded-full bg-glow-500/12 blur-[100px] pointer-events-none"></div>

      <div class="mx-auto max-w-3xl px-6 text-center">
        <div class="section-badge mb-6">
          <span class="h-1.5 w-1.5 rounded-full bg-lime-400"></span>
          Simple, honest pricing
        </div>
        <h1 class="text-5xl sm:text-6xl font-semibold tracking-tight leading-[1.1]">
          Start free.<br/>
          <span class="text-gradient">Scale as you grow.</span>
        </h1>
        <p class="mt-5 text-lg text-white/75 max-w-xl mx-auto">
          No hidden fees, no per-seat pricing. One flat rate for your entire team and catalog.
        </p>

        <!-- Billing toggle -->
        <div class="mt-8 inline-flex items-center gap-1 rounded-2xl border border-white/15 bg-white/5 p-1.5">
          <button
            @click="annual = false"
            class="rounded-xl px-5 py-2 text-sm font-medium transition-all"
            :class="!annual ? 'bg-white text-ink-950' : 'text-white/75 hover:text-white'"
          >
            Monthly
          </button>
          <button
            @click="annual = true"
            class="flex items-center gap-2 rounded-xl px-5 py-2 text-sm font-medium transition-all"
            :class="annual ? 'bg-white text-ink-950' : 'text-white/75 hover:text-white'"
          >
            Annual
            <span class="rounded-full px-2 py-0.5 text-[10px] font-semibold" :class="annual ? 'bg-lime-500/20 text-lime-600' : 'bg-lime-500/15 text-lime-400'">
              2 months free
            </span>
          </button>
        </div>
      </div>
    </section>

    <!-- ── Plans ── -->
    <section class="py-8 pb-20">
      <div class="mx-auto max-w-5xl px-6">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div
            v-for="plan in plans"
            :key="plan.name"
            class="relative rounded-3xl p-7 flex flex-col transition-all duration-300"
            :class="plan.featured
              ? 'border border-glow-500/30 bg-gradient-to-b from-glow-500/10 to-transparent'
              : 'glass hover:bg-white/[0.07]'"
          >
            <!-- Popular badge -->
            <div v-if="plan.featured" class="absolute -top-3.5 left-1/2 -translate-x-1/2">
              <span class="rounded-full bg-gradient-to-r from-glow-500 to-lime-500 px-4 py-1.5 text-xs font-semibold text-ink-950">
                Most popular
              </span>
            </div>

            <!-- Plan header -->
            <div>
              <div class="flex items-center gap-2.5 mb-4">
                <div class="h-8 w-8 rounded-xl flex items-center justify-center" :style="{ background: plan.iconBg }">
                  <svg class="w-4 h-4" :style="{ color: plan.iconColor }" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" v-html="plan.icon"></svg>
                </div>
                <p class="font-semibold">{{ plan.name }}</p>
              </div>
              <p class="text-sm text-white/75 leading-relaxed">{{ plan.desc }}</p>
            </div>

            <!-- Price -->
            <div class="mt-6 flex items-end gap-1.5">
              <span class="text-4xl font-bold tracking-tight">
                ${{ annual ? plan.annualPrice : plan.monthlyPrice }}
              </span>
              <span class="text-white/65 mb-1.5 text-sm">/ month</span>
            </div>
            <p v-if="annual" class="mt-1 text-xs text-lime-400">
              ${{ plan.annualPrice * 12 }}/yr · saves ${{ (plan.monthlyPrice - plan.annualPrice) * 12 }}
            </p>

            <!-- CTA -->
            <NuxtLink
              to="/auth/signup"
              class="mt-6 flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-all"
              :class="plan.featured
                ? 'bg-white text-ink-950 hover:bg-white/90'
                : 'border border-white/15 bg-white/5 hover:bg-white/10'"
            >
              {{ plan.cta }}
            </NuxtLink>

            <!-- Divider -->
            <div class="my-6 border-t border-white/10"></div>

            <!-- Features -->
            <ul class="space-y-3 flex-1">
              <li v-for="feat in plan.features" :key="feat" class="flex items-start gap-2.5 text-sm">
                <svg class="w-4 h-4 mt-0.5 flex-shrink-0 text-lime-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/>
                </svg>
                <span class="text-white/65">{{ feat }}</span>
              </li>
            </ul>

            <!-- Glow for featured -->
            <div v-if="plan.featured" class="absolute bottom-0 left-1/2 -translate-x-1/2 h-24 w-48 bg-glow-500/15 blur-[60px] pointer-events-none rounded-full"></div>
          </div>
        </div>

        <!-- Enterprise row -->
        <div class="mt-5 glass rounded-3xl p-6 flex flex-col sm:flex-row items-center justify-between gap-5">
          <div class="flex items-center gap-4">
            <div class="h-10 w-10 rounded-xl bg-violet-500/10 flex items-center justify-center flex-shrink-0">
              <svg class="w-5 h-5 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21"/>
              </svg>
            </div>
            <div>
              <p class="font-semibold">Enterprise</p>
              <p class="text-sm text-white/75 mt-0.5">Custom SKU limits, SSO, dedicated CSM, SLA, and white-glove onboarding for high-volume brands.</p>
            </div>
          </div>
          <a href="mailto:hello@metaflow.io" class="flex-shrink-0 flex items-center gap-2 rounded-xl border border-white/20 bg-white/8 px-6 py-2.5 text-sm font-semibold hover:bg-white/12 transition-all whitespace-nowrap">
            Talk to sales →
          </a>
        </div>
      </div>
    </section>

    <!-- ── Feature Comparison ── -->
    <section class="py-20 border-t border-white/8">
      <div class="mx-auto max-w-5xl px-6">
        <div class="text-center mb-12">
          <div class="section-badge mb-4 mx-auto w-fit">Full comparison</div>
          <h2 class="text-3xl font-semibold">Everything in one place.</h2>
        </div>

        <div class="glass rounded-3xl overflow-hidden">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-white/10">
                <th class="text-left px-6 py-4 font-medium text-white/75 w-1/2">Feature</th>
                <th class="text-center px-4 py-4 font-medium text-white/75">Starter</th>
                <th class="text-center px-4 py-4 font-semibold text-glow-400">Growth</th>
                <th class="text-center px-4 py-4 font-medium text-white/75">Scale</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-white/[0.05]">
              <tr v-for="row in comparisonRows" :key="row.feature" class="hover:bg-white/[0.02] transition-colors">
                <td class="px-6 py-3.5 text-white/65">{{ row.feature }}</td>
                <td class="text-center px-4 py-3.5">
                  <span v-if="row.starter === true" class="text-lime-400">✓</span>
                  <span v-else-if="row.starter === false" class="text-white/45">—</span>
                  <span v-else class="text-white/65 text-xs">{{ row.starter }}</span>
                </td>
                <td class="text-center px-4 py-3.5 bg-glow-500/[0.03]">
                  <span v-if="row.growth === true" class="text-lime-400">✓</span>
                  <span v-else-if="row.growth === false" class="text-white/45">—</span>
                  <span v-else class="text-glow-400 text-xs font-medium">{{ row.growth }}</span>
                </td>
                <td class="text-center px-4 py-3.5">
                  <span v-if="row.scale === true" class="text-lime-400">✓</span>
                  <span v-else-if="row.scale === false" class="text-white/45">—</span>
                  <span v-else class="text-white/65 text-xs">{{ row.scale }}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>

    <!-- ── FAQ ── -->
    <section class="py-20">
      <div class="mx-auto max-w-3xl px-6">
        <div class="text-center mb-12">
          <div class="section-badge mb-4 mx-auto w-fit">FAQ</div>
          <h2 class="text-3xl font-semibold">Common questions.</h2>
        </div>

        <div class="space-y-3">
          <div
            v-for="(faq, i) in faqs"
            :key="i"
            class="glass rounded-2xl overflow-hidden"
          >
            <button
              class="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-white/[0.04] transition-colors"
              @click="openFaq = openFaq === i ? null : i"
            >
              <p class="font-medium text-sm pr-4">{{ faq.q }}</p>
              <svg
                class="w-4 h-4 flex-shrink-0 text-white/65 transition-transform duration-200"
                :class="openFaq === i ? 'rotate-180' : ''"
                fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"
              >
                <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/>
              </svg>
            </button>
            <div v-if="openFaq === i" class="px-6 pb-5 text-sm text-white/80 leading-relaxed border-t border-white/8">
              <p class="pt-4">{{ faq.a }}</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ── Social proof ── -->
    <section class="py-16 border-t border-white/8">
      <div class="mx-auto max-w-5xl px-6">
        <p class="text-center text-sm text-white/60 mb-10">Trusted by 340+ e-commerce brands worldwide</p>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div v-for="t in testimonials" :key="t.name" class="glass rounded-2xl p-5">
            <div class="flex gap-0.5 mb-3">
              <svg v-for="s in 5" :key="s" class="w-3.5 h-3.5 text-lime-400" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
              </svg>
            </div>
            <p class="text-sm text-white/80 italic leading-relaxed">"{{ t.quote }}"</p>
            <div class="mt-4 flex items-center gap-2.5">
              <div class="h-7 w-7 rounded-full flex items-center justify-center text-xs font-semibold" :style="{ background: t.bg, color: t.color }">{{ t.initials }}</div>
              <div>
                <p class="text-xs font-semibold">{{ t.name }}</p>
                <p class="text-xs text-white/60">{{ t.title }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ── CTA ── -->
    <section class="py-20">
      <div class="mx-auto max-w-3xl px-6 text-center">
        <div class="glass rounded-3xl p-12 relative overflow-hidden">
          <div class="absolute -top-20 -right-20 h-56 w-56 rounded-full bg-glow-500/15 blur-[80px] pointer-events-none"></div>
          <div class="absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-lime-500/10 blur-[80px] pointer-events-none"></div>
          <div class="relative">
            <h2 class="text-3xl sm:text-4xl font-semibold">14 days free.<br/><span class="text-gradient">No credit card needed.</span></h2>
            <p class="mt-4 text-white/75 max-w-sm mx-auto text-sm">Connect your store in under 5 minutes. Your first scored catalog report lands tomorrow morning.</p>
            <div class="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
              <NuxtLink to="/auth/signup" class="btn-gradient-lg">
                Start free trial →
              </NuxtLink>
              <a href="mailto:hello@metaflow.io" class="flex items-center gap-2 rounded-full border border-white/20 px-7 py-3.5 text-sm font-semibold hover:bg-white/5 transition-all">
                Talk to sales
              </a>
            </div>
            <p class="mt-5 text-xs text-white/55">No credit card · Cancel anytime · Setup in 5 minutes</p>
          </div>
        </div>
      </div>
    </section>

  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'marketing' });

useHead({ title: 'Pricing — MetaFlow' });

const annual = ref(true);
const openFaq = ref<number | null>(null);

const plans = [
  {
    name: 'Starter',
    desc: 'Perfect for emerging brands testing catalog intelligence for the first time.',
    monthlyPrice: 49,
    annualPrice: 39,
    cta: 'Start free trial',
    featured: false,
    iconBg: 'rgba(34,211,238,0.1)',
    iconColor: '#22d3ee',
    icon: '<path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"/>',
    features: [
      'Up to 250 SKUs scored daily',
      'Meta Ads + Shopify sync',
      'ROAS, CTR & margin scoring',
      '3 automation rules',
      'Email reports (weekly)',
      '30-day audit log',
      'Email support',
    ],
  },
  {
    name: 'Growth',
    desc: 'For scaling brands that need full automation and daily scoring across their whole catalog.',
    monthlyPrice: 149,
    annualPrice: 119,
    cta: 'Start free trial',
    featured: true,
    iconBg: 'rgba(132,204,22,0.15)',
    iconColor: '#84cc16',
    icon: '<path stroke-linecap="round" stroke-linejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941"/>',
    features: [
      'Up to 2,500 SKUs scored daily',
      'All channel integrations',
      'Full 8-factor scoring model',
      'Unlimited automation rules',
      'AI morning briefing (daily)',
      'Full audit log history',
      'Priority support + Slack',
      'Advanced filtering & export',
    ],
  },
  {
    name: 'Scale',
    desc: 'High-volume catalogs, multiple stores, and teams that need the full MetaFlow platform.',
    monthlyPrice: 399,
    annualPrice: 319,
    cta: 'Start free trial',
    featured: false,
    iconBg: 'rgba(249,115,22,0.1)',
    iconColor: '#f97316',
    icon: '<path stroke-linecap="round" stroke-linejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"/>',
    features: [
      'Up to 10,000 SKUs scored daily',
      'Multi-store support (up to 5)',
      'Custom scoring weights',
      'API access',
      'AI insights + predictive modeling',
      'Dedicated success manager',
      'Custom reporting & dashboards',
      'Team seats (up to 10)',
    ],
  },
];

const comparisonRows = [
  { feature: 'SKUs scored daily',           starter: '250',          growth: '2,500',          scale: '10,000' },
  { feature: 'Channel integrations',         starter: 'Meta + Shopify', growth: 'All channels',  scale: 'All channels' },
  { feature: 'Automation rules',             starter: '3',            growth: 'Unlimited',      scale: 'Unlimited' },
  { feature: 'Daily scoring frequency',      starter: false,          growth: true,             scale: true },
  { feature: 'AI morning briefing',          starter: false,          growth: true,             scale: true },
  { feature: 'Predictive modeling',          starter: false,          growth: false,            scale: true },
  { feature: 'Multi-store support',          starter: false,          growth: false,            scale: 'Up to 5' },
  { feature: 'API access',                   starter: false,          growth: false,            scale: true },
  { feature: 'Custom scoring weights',       starter: false,          growth: false,            scale: true },
  { feature: 'Audit log',                    starter: '30 days',      growth: 'Unlimited',      scale: 'Unlimited' },
  { feature: 'CSV export',                   starter: true,           growth: true,             scale: true },
  { feature: 'Team seats',                   starter: '2',            growth: '5',              scale: '10' },
  { feature: 'Dedicated success manager',    starter: false,          growth: false,            scale: true },
  { feature: 'Support',                      starter: 'Email',        growth: 'Priority + Slack', scale: 'Dedicated CSM' },
];

const faqs = [
  {
    q: 'How does the 14-day free trial work?',
    a: 'Start your trial with full access to the Growth plan — no credit card required. After 14 days, choose a plan or cancel. Your data stays intact if you upgrade later.',
  },
  {
    q: 'Can I change plans after I sign up?',
    a: 'Yes. You can upgrade or downgrade at any time. Upgrades take effect immediately; downgrades apply at the start of your next billing cycle.',
  },
  {
    q: 'What counts as a "scored SKU"?',
    a: 'A scored SKU is any active product variant in your connected catalog that MetaFlow evaluates against our 8-factor scoring model during a daily scoring run.',
  },
  {
    q: 'Which integrations are included?',
    a: 'Meta Ads, Shopify, WooCommerce, Google Analytics 4, and Klaviyo. We add new integrations regularly — all are included at no extra cost.',
  },
  {
    q: 'Is my data secure?',
    a: 'MetaFlow uses read-only OAuth connections to your ad accounts and stores. We never store raw credentials, all data is encrypted at rest and in transit, and we\'re SOC 2 Type II compliant.',
  },
  {
    q: 'Do you offer refunds?',
    a: 'We offer a full refund within 7 days of your first paid charge if you\'re not happy — no questions asked. Just email hello@metaflow.io.',
  },
];

const testimonials = [
  {
    name: 'Adaeze Okafor',
    title: 'Growth Manager · Lagos',
    initials: 'AO',
    bg: 'rgba(34,211,238,0.2)',
    color: '#22d3ee',
    quote: 'MetaFlow cut our catalog management from 4 hours to 15 minutes a week. The Growth plan pays for itself in the first week.',
  },
  {
    name: 'Marcus Webb',
    title: 'Founder · Toronto',
    initials: 'MW',
    bg: 'rgba(132,204,22,0.2)',
    color: '#84cc16',
    quote: 'The daily AI briefing alone is worth the subscription. I wake up knowing exactly what to do — no spreadsheets, no guesswork.',
  },
  {
    name: 'Soo-Jin Park',
    title: 'Head of Acquisition · Seoul',
    initials: 'SP',
    bg: 'rgba(249,115,22,0.2)',
    color: '#f97316',
    quote: 'We scaled from $80k to $340k monthly on Meta in 90 days after implementing MetaFlow\'s budget automation rules. The ROI is insane.',
  },
];
</script>

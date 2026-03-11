<template>
  <div>

    <!-- ── Hero ── -->
    <section class="relative overflow-hidden pt-32 pb-20">
      <div class="absolute inset-0 bg-gradient-to-br from-glow-500/8 via-transparent to-lime-500/5 pointer-events-none"></div>
      <div class="absolute -top-40 left-1/3 h-96 w-96 rounded-full bg-glow-500/10 blur-[120px] pointer-events-none"></div>

      <div class="mx-auto max-w-5xl px-6 text-center">
        <div class="section-badge mb-6">
          <span class="h-1.5 w-1.5 rounded-full bg-glow-400 animate-pulse"></span>
          Our story
        </div>
        <h1 class="text-5xl sm:text-6xl font-semibold tracking-tight leading-[1.1]">
          We built the tool<br/>
          <span class="text-gradient">we always needed.</span>
        </h1>
        <p class="mt-6 text-lg text-white/80 max-w-2xl mx-auto leading-relaxed">
          MetaFlow started as a spreadsheet nightmare. After managing 3,000+ SKU catalogs manually, we knew there had to be a smarter way. Now every brand we work with scales without spreadsheets.
        </p>
      </div>
    </section>

    <!-- ── Stats ── -->
    <section class="py-16">
      <div class="mx-auto max-w-5xl px-6">
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div v-for="stat in stats" :key="stat.label" class="glass rounded-3xl p-6 text-center">
            <p class="text-3xl font-semibold text-gradient">{{ stat.value }}</p>
            <p class="mt-2 text-sm text-white/70">{{ stat.label }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- ── Mission ── -->
    <section class="py-20">
      <div class="mx-auto max-w-5xl px-6">
        <div class="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <div class="section-badge mb-5">Our mission</div>
            <h2 class="text-3xl sm:text-4xl font-semibold leading-tight">
              Catalog intelligence<br/>
              <span class="text-gradient">for every brand.</span>
            </h2>
            <p class="mt-5 text-white/80 leading-relaxed">
              We believe every e-commerce brand — whether you're doing $50k or $5M a month — deserves the same automated intelligence that the world's largest retailers use. MetaFlow levels the playing field.
            </p>
            <p class="mt-4 text-white/80 leading-relaxed">
              Our scoring engine runs every night, evaluating each product across ROAS, CTR, margin, and inventory velocity. By morning, you know exactly which SKUs to scale, which to hold, and which to cut.
            </p>

            <div class="mt-8 space-y-4">
              <div v-for="value in values" :key="value.title" class="flex items-start gap-4">
                <div class="h-8 w-8 flex-shrink-0 rounded-lg flex items-center justify-center" :style="{ background: value.bg }">
                  <svg class="w-4 h-4" :style="{ color: value.color }" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" v-html="value.icon"></svg>
                </div>
                <div>
                  <p class="text-sm font-semibold">{{ value.title }}</p>
                  <p class="text-xs text-white/70 mt-0.5">{{ value.desc }}</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Visual: metric card mockup -->
          <div class="relative">
            <div class="glass rounded-3xl p-6 border border-white/10">
              <div class="flex items-center justify-between mb-5">
                <p class="text-sm font-semibold">Catalog health snapshot</p>
                <span class="flex items-center gap-1.5 text-xs text-lime-400">
                  <span class="h-1.5 w-1.5 rounded-full bg-lime-400 animate-pulse"></span>
                  Live
                </span>
              </div>
              <div class="space-y-3">
                <div v-for="sku in mockSkus" :key="sku.name" class="flex items-center gap-3">
                  <div class="h-8 w-8 rounded-lg bg-white/5 border border-white/10 flex-shrink-0 overflow-hidden">
                    <div class="h-full w-full" :style="{ background: sku.color + '22' }"></div>
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center justify-between mb-1">
                      <p class="text-xs font-medium truncate">{{ sku.name }}</p>
                      <span class="text-xs font-mono ml-2" :class="sku.scoreColor">{{ sku.score }}</span>
                    </div>
                    <div class="h-1.5 rounded-full bg-white/10">
                      <div class="h-full rounded-full" :style="{ width: sku.score + '%', background: sku.color }"></div>
                    </div>
                  </div>
                  <span class="text-xs font-semibold rounded-lg px-2 py-0.5 flex-shrink-0" :class="sku.badgeClass">{{ sku.badge }}</span>
                </div>
              </div>
              <div class="mt-5 pt-4 border-t border-white/10 flex items-center justify-between">
                <p class="text-xs text-white/65">Last scored 2 hours ago</p>
                <p class="text-xs text-glow-400">94 SKUs analyzed →</p>
              </div>
            </div>
            <!-- Glow effect -->
            <div class="absolute -bottom-8 left-1/2 -translate-x-1/2 h-32 w-48 bg-glow-500/20 blur-[60px] pointer-events-none"></div>
          </div>
        </div>
      </div>
    </section>

    <!-- ── Timeline ── -->
    <section class="py-20 border-y border-white/8">
      <div class="mx-auto max-w-3xl px-6">
        <div class="text-center mb-12">
          <div class="section-badge mb-4 mx-auto w-fit">How we got here</div>
          <h2 class="text-3xl font-semibold">From spreadsheets to<br/><span class="text-gradient">intelligent automation.</span></h2>
        </div>
        <div class="relative">
          <!-- Timeline line -->
          <div class="absolute left-4 top-2 bottom-2 w-px bg-white/10"></div>
          <div class="space-y-10">
            <div v-for="(item, i) in timeline" :key="i" class="relative flex gap-6 pl-12">
              <div class="absolute left-0 top-1 h-8 w-8 rounded-full border border-white/15 bg-ink-950 flex items-center justify-center text-xs font-semibold text-glow-400">
                {{ item.year.slice(-2) }}
              </div>
              <div>
                <p class="text-xs text-white/80 mb-1">{{ item.year }}</p>
                <p class="font-semibold text-sm">{{ item.title }}</p>
                <p class="mt-1 text-sm text-white/75">{{ item.desc }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ── Team ── -->
    <section class="py-24">
      <div class="mx-auto max-w-5xl px-6">
        <div class="text-center mb-14">
          <div class="section-badge mb-4 mx-auto w-fit">The team</div>
          <h2 class="text-3xl sm:text-4xl font-semibold">People behind<br/><span class="text-gradient">the product.</span></h2>
          <p class="mt-4 text-white/75 max-w-lg mx-auto text-sm">Former performance marketers, engineers, and data scientists who lived the problem first.</p>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          <div v-for="person in team" :key="person.name" class="glass rounded-3xl p-6 hover:bg-white/[0.07] transition-colors">
            <div class="h-12 w-12 rounded-2xl flex items-center justify-center text-base font-bold mb-4" :style="{ background: person.bg, color: person.color }">
              {{ person.initials }}
            </div>
            <p class="font-semibold">{{ person.name }}</p>
            <p class="text-xs text-glow-400 mt-0.5">{{ person.role }}</p>
            <p class="mt-3 text-sm text-white/75 leading-relaxed">{{ person.bio }}</p>
            <div class="mt-4 flex items-center gap-1.5">
              <span v-for="tag in person.tags" :key="tag" class="rounded-lg bg-white/5 border border-white/8 px-2 py-0.5 text-xs text-white/65">{{ tag }}</span>
            </div>
          </div>
        </div>

        <!-- Hiring CTA -->
        <div class="mt-10 glass rounded-3xl p-6 flex flex-col sm:flex-row items-center justify-between gap-5">
          <div>
            <p class="font-semibold">We're growing.</p>
            <p class="text-sm text-white/75 mt-0.5">We're hiring engineers, designers, and growth experts who love hard problems.</p>
          </div>
          <a href="#" class="flex-shrink-0 flex items-center gap-2 rounded-xl border border-white/20 bg-white/8 px-5 py-2.5 text-sm font-medium hover:bg-white/12 transition-all whitespace-nowrap">
            View open roles →
          </a>
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
            <h2 class="text-3xl sm:text-4xl font-semibold">Ready to scale<br/><span class="text-gradient">your catalog?</span></h2>
            <p class="mt-4 text-white/75 max-w-md mx-auto">Join hundreds of brands who've automated their catalog intelligence with MetaFlow.</p>
            <div class="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
              <NuxtLink to="/auth/signup" class="btn-gradient-lg">
                Start free trial →
              </NuxtLink>
              <NuxtLink to="/pricing" class="flex items-center gap-2 rounded-full border border-white/20 px-7 py-3.5 text-sm font-semibold hover:bg-white/5 transition-all">
                See pricing
              </NuxtLink>
            </div>
          </div>
        </div>
      </div>
    </section>

  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'marketing' });

useHead({ title: 'About — MetaFlow' });

const stats = [
  { value: '2.4M+', label: 'SKUs scored daily' },
  { value: '340+',  label: 'Brands on MetaFlow' },
  { value: '$480M', label: 'Ad spend optimized' },
  { value: '6.4×',  label: 'Average ROAS lift' },
];

const values = [
  {
    title: 'Transparency first',
    desc: 'Every score is explainable. No black boxes.',
    icon: '<path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"/><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>',
    bg: 'rgba(34,211,238,0.1)', color: '#22d3ee',
  },
  {
    title: 'Speed over perfection',
    desc: 'Daily scores mean you react in hours, not weeks.',
    icon: '<path stroke-linecap="round" stroke-linejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"/>',
    bg: 'rgba(132,204,22,0.1)', color: '#84cc16',
  },
  {
    title: 'Built for operators',
    desc: 'Designed by people who actually ran ad accounts.',
    icon: '<path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"/>',
    bg: 'rgba(249,115,22,0.1)', color: '#f97316',
  },
];

const mockSkus = [
  { name: 'Ceramic Mug Set', score: 87, color: '#84cc16', scoreColor: 'text-lime-400', badge: 'SCALE', badgeClass: 'bg-lime-500/15 text-lime-400' },
  { name: 'Canvas Tote XL', score: 62, color: '#22d3ee', scoreColor: 'text-glow-400', badge: 'TEST', badgeClass: 'bg-glow-500/15 text-glow-400' },
  { name: 'Phone Stand Pro', score: 41, color: '#f97316', scoreColor: 'text-ember-400', badge: 'HOLD', badgeClass: 'bg-ember-500/15 text-ember-400' },
  { name: 'Bamboo Pen Set', score: 18, color: '#a78bfa', scoreColor: 'text-violet-400', badge: 'KILL', badgeClass: 'bg-violet-500/15 text-violet-400' },
];

const timeline = [
  { year: '2021', title: 'The problem', desc: 'Our founders spent 4+ hours weekly managing 2,500 SKUs in spreadsheets. There had to be a better way.' },
  { year: '2022', title: 'First prototype', desc: 'A weekend hack that automatically pulled Meta and Shopify data into a unified scoring model. It worked.' },
  { year: '2023', title: 'Early access', desc: '12 beta brands onboarded. Average catalog management time dropped from hours to minutes.' },
  { year: '2024', title: 'MetaFlow launches', desc: 'Full platform launch with automated budget rules, AI recommendations, and daily scoring for every SKU.' },
  { year: '2025', title: 'AI insights layer', desc: 'Plain-English morning reports, predictive modeling, and multi-channel attribution added to the platform.' },
];

const team = [
  {
    name: 'Kwame Asante',
    role: 'Co-founder & CEO',
    initials: 'KA',
    bio: 'Former performance lead at a $40M DTC brand. Built catalog management tools internally for 3 years before going full-time on MetaFlow.',
    bg: 'rgba(34,211,238,0.15)', color: '#22d3ee',
    tags: ['DTC', 'Meta Ads', 'Strategy'],
  },
  {
    name: 'Priya Nair',
    role: 'Co-founder & CTO',
    initials: 'PN',
    bio: 'ML engineer with 8 years in recommendation systems. Designed the scoring engine that powers MetaFlow\'s daily catalog intelligence.',
    bg: 'rgba(132,204,22,0.15)', color: '#84cc16',
    tags: ['ML', 'Python', 'Data'],
  },
  {
    name: 'Tomás Reyes',
    role: 'Head of Product',
    initials: 'TR',
    bio: 'Previously at Shopify and a Series B ad-tech startup. Obsessed with simplifying complex workflows into elegant UX.',
    bg: 'rgba(249,115,22,0.15)', color: '#f97316',
    tags: ['Product', 'UX', 'Growth'],
  },
  {
    name: 'Amara Diallo',
    role: 'Head of Growth',
    initials: 'AD',
    bio: 'Scaled two SaaS companies from 0 to $1M ARR. Manages all things marketing, partnerships, and customer success at MetaFlow.',
    bg: 'rgba(139,92,246,0.15)', color: '#a78bfa',
    tags: ['SaaS', 'GTM', 'Partnerships'],
  },
  {
    name: 'Lena Hoffmann',
    role: 'Senior Engineer',
    initials: 'LH',
    bio: 'Full-stack engineer who built the real-time sync pipeline connecting Meta, Shopify, and Google Ads into MetaFlow\'s unified data layer.',
    bg: 'rgba(34,211,238,0.1)', color: '#22d3ee',
    tags: ['Node.js', 'Nuxt', 'APIs'],
  },
  {
    name: 'Javier Cruz',
    role: 'Customer Success',
    initials: 'JC',
    bio: 'Former agency media buyer. Helps brands onboard, configure automation rules, and get to first ROAS lift within their first 14 days.',
    bg: 'rgba(132,204,22,0.1)', color: '#84cc16',
    tags: ['Onboarding', 'Media Buy', 'Support'],
  },
];
</script>

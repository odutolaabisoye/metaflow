<template>
  <!-- Backdrop -->
  <Teleport to="body">
    <Transition name="sidekick-backdrop">
      <div
        v-if="product"
        class="fixed inset-0 z-40 bg-ink-950/70 backdrop-blur-sm"
        @click="$emit('close')"
      ></div>
    </Transition>

    <!-- Panel -->
    <Transition name="sidekick-panel">
      <div
        v-if="product"
        class="fixed right-0 top-0 bottom-0 z-50 w-full max-w-[480px] flex flex-col bg-[#0e121a] border-l border-white/10 overflow-y-auto"
        role="dialog"
        aria-modal="true"
        :aria-label="product.title"
      >
        <!-- Header -->
        <div class="flex items-center justify-between px-6 py-4 border-b border-white/8 flex-shrink-0">
          <div class="flex items-center gap-3">
            <span
              class="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold"
              :class="badgeClass(product.category)"
            >
              <span class="h-1.5 w-1.5 rounded-full" :class="badgeDot(product.category)"></span>
              {{ product.category }}
            </span>
            <span class="text-xs font-mono text-white/65">{{ product.sku }}</span>
          </div>
          <button
            @click="$emit('close')"
            class="h-8 w-8 flex items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/65 hover:text-white hover:bg-white/10 transition-all"
            aria-label="Close"
          >
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <!-- Product image + title -->
        <div class="px-6 pt-5 pb-4 flex-shrink-0">
          <div class="relative w-full aspect-[16/9] rounded-2xl overflow-hidden border border-white/10 bg-white/5 mb-4">
            <img
              :src="product.imageUrl"
              :alt="product.title"
              class="w-full h-full object-cover"
              loading="lazy"
            />
            <!-- View product link -->
            <a
              :href="product.productUrl"
              target="_blank"
              rel="noopener"
              class="absolute top-3 right-3 flex items-center gap-1.5 rounded-lg bg-black/60 backdrop-blur-sm border border-white/15 px-2.5 py-1.5 text-xs font-medium text-white/80 hover:text-white hover:bg-black/80 transition-all"
            >
              View product
              <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"/>
              </svg>
            </a>
          </div>
          <h2 class="text-lg font-semibold leading-snug">{{ product.title }}</h2>

          <!-- Score bar -->
          <div class="mt-3 flex items-center gap-3">
            <div class="flex items-center gap-1.5">
              <span class="text-xs text-white/70">Score</span>
              <span class="font-mono text-sm font-bold" :class="scoreColor(product.score)">{{ product.score }}</span>
            </div>
            <div class="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
              <div
                class="h-full rounded-full transition-all duration-700"
                :style="{ width: product.score + '%' }"
                :class="scoreBarColor(product.score)"
              ></div>
            </div>
          </div>
        </div>

        <!-- Performance chart -->
        <div class="px-6 mb-2 flex-shrink-0">
          <div class="flex items-center justify-between mb-2">
            <h3 class="text-xs text-white/65 uppercase tracking-widest font-medium">Performance</h3>
            <span class="text-[10px] text-white/45 font-mono">daily · 30d</span>
          </div>
          <!-- Loading skeleton -->
          <div v-if="historyLoading" class="rounded-2xl border border-white/8 bg-white/[0.02] px-4 pt-3 pb-4">
            <div class="flex gap-1 mb-3">
              <div class="h-6 w-16 rounded-lg bg-white/8 animate-pulse"></div>
              <div class="h-6 w-12 rounded-lg bg-white/5 animate-pulse"></div>
              <div class="h-6 w-12 rounded-lg bg-white/5 animate-pulse"></div>
            </div>
            <div class="h-[156px] w-full rounded-xl bg-white/[0.04] animate-pulse relative overflow-hidden">
              <!-- Fake chart line shimmer -->
              <svg class="absolute inset-0 w-full h-full opacity-20" viewBox="0 0 432 156" preserveAspectRatio="none">
                <polyline
                  points="0,100 60,80 120,90 180,60 240,70 300,40 360,55 432,35"
                  fill="none"
                  stroke="rgba(255,255,255,0.3)"
                  stroke-width="2"
                />
              </svg>
            </div>
          </div>
          <!-- Chart -->
          <div v-else-if="product.history?.length" class="rounded-2xl border border-white/8 bg-white/[0.02] px-4 pt-3 pb-2">
            <PerformanceChart :data="product.history" />
          </div>
          <!-- No data -->
          <div v-else class="rounded-2xl border border-white/8 bg-white/[0.02] flex flex-col items-center justify-center py-8 gap-2">
            <svg class="w-8 h-8 text-white/25" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"/>
            </svg>
            <p class="text-xs text-white/45">No performance data yet</p>
            <p class="text-[10px] text-white/30">Sync your store to populate history</p>
          </div>
        </div>

        <!-- Divider -->
        <div class="mx-6 my-4 h-px bg-white/8 flex-shrink-0"></div>

        <!-- Blended ROAS hero -->
        <div class="mx-6 mb-4 rounded-2xl border border-glow-500/20 bg-glow-500/[0.06] p-4 flex-shrink-0">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-xs text-glow-400/70 font-medium uppercase tracking-widest mb-0.5">Blended ROAS</p>
              <p class="text-3xl font-bold text-glow-400">{{ Number(product.blendedRoas).toFixed(2) }}×</p>
              <p class="text-xs text-white/65 mt-1">Total revenue / total ad spend</p>
            </div>
            <div class="text-right">
              <p class="text-xs text-white/60 mb-1">Meta ROAS</p>
              <p class="text-xl font-semibold">{{ Number(product.roas).toFixed(2) }}×</p>
              <p class="text-xs text-white/60 mt-1">Meta ads only</p>
            </div>
          </div>
          <!-- Blended vs Meta bar -->
          <div class="mt-4">
            <div class="flex justify-between text-xs text-white/60 mb-1.5">
              <span>Meta</span>
              <span>Organic / Other</span>
            </div>
            <div class="h-2 rounded-full bg-white/10 overflow-hidden flex">
              <div
                class="h-full bg-[#1877F2] rounded-l-full transition-all duration-700"
                :style="{ width: metaShare + '%' }"
              ></div>
              <div
                class="h-full bg-lime-500/60 rounded-r-full transition-all duration-700"
                :style="{ width: (100 - metaShare) + '%' }"
              ></div>
            </div>
            <div class="flex justify-between text-xs mt-1.5">
              <span class="text-[#6aadff]">{{ metaShare.toFixed(0) }}%</span>
              <span class="text-lime-400/70">{{ (100 - metaShare).toFixed(0) }}%</span>
            </div>
          </div>
        </div>

        <!-- Key metrics grid -->
        <div class="mx-6 mb-4 grid grid-cols-2 gap-3 flex-shrink-0">
          <div class="rounded-xl border border-white/8 bg-white/[0.03] p-3.5">
            <p class="text-xs text-white/65 mb-1">Revenue</p>
            <p class="text-base font-semibold">{{ formatMoney(product.revenue) }}</p>
          </div>
          <div class="rounded-xl border border-white/8 bg-white/[0.03] p-3.5">
            <p class="text-xs text-white/65 mb-1">Ad Spend</p>
            <p class="text-base font-semibold">{{ formatMoney(product.spend) }}</p>
          </div>
          <div class="rounded-xl border border-white/8 bg-white/[0.03] p-3.5">
            <p class="text-xs text-white/65 mb-1">Gross Margin</p>
            <p class="text-base font-semibold" :class="product.margin >= 30 ? 'text-lime-400' : product.margin >= 20 ? 'text-glow-400' : 'text-ember-400'">
              {{ product.margin }}%
            </p>
          </div>
          <div class="rounded-xl border border-white/8 bg-white/[0.03] p-3.5">
            <p class="text-xs text-white/65 mb-1">Velocity</p>
            <p class="text-base font-semibold">{{ product.velocity }}×</p>
          </div>
        </div>

        <!-- Divider -->
        <div class="mx-6 mb-4 h-px bg-white/8 flex-shrink-0"></div>

        <!-- Traffic details -->
        <div class="px-6 mb-4 flex-shrink-0">
          <h3 class="text-xs text-white/65 uppercase tracking-widest font-medium mb-3">Traffic</h3>
          <div class="space-y-2.5">
            <div class="flex items-center justify-between rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3">
              <div class="flex items-center gap-2.5">
                <div class="h-7 w-7 rounded-lg bg-white/8 flex items-center justify-center">
                  <svg class="w-3.5 h-3.5 text-white/75" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"/>
                    <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                  </svg>
                </div>
                <span class="text-sm text-white/65">Impressions</span>
              </div>
              <span class="font-mono text-sm font-medium">{{ formatNumber(product.impressions) }}</span>
            </div>
            <div class="flex items-center justify-between rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3">
              <div class="flex items-center gap-2.5">
                <div class="h-7 w-7 rounded-lg bg-white/8 flex items-center justify-center">
                  <svg class="w-3.5 h-3.5 text-white/75" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M15.042 21.672L13.684 16.6m0 0l-2.51 2.225.569-9.47 5.227 7.917-3.286-.672zm-7.518-.267A8.25 8.25 0 1120.25 10.5M8.288 14.212A5.25 5.25 0 1117.25 10.5"/>
                  </svg>
                </div>
                <span class="text-sm text-white/65">Clicks</span>
              </div>
              <span class="font-mono text-sm font-medium">{{ formatNumber(product.clicks) }}</span>
            </div>
            <div class="flex items-center justify-between rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3">
              <div class="flex items-center gap-2.5">
                <div class="h-7 w-7 rounded-lg bg-white/8 flex items-center justify-center">
                  <svg class="w-3.5 h-3.5 text-white/75" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75z"/>
                    <path stroke-linecap="round" stroke-linejoin="round" d="M9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625z"/>
                    <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"/>
                  </svg>
                </div>
                <span class="text-sm text-white/65">CTR</span>
              </div>
              <span class="font-mono text-sm font-medium text-glow-400">{{ product.ctr }}%</span>
            </div>
          </div>
        </div>

        <!-- Conversion details -->
        <div class="px-6 mb-6 flex-shrink-0">
          <h3 class="text-xs text-white/65 uppercase tracking-widest font-medium mb-3">Conversions</h3>
          <div class="rounded-2xl border border-lime-500/15 bg-lime-500/[0.04] p-4">
            <div class="grid grid-cols-2 gap-4">
              <div>
                <p class="text-xs text-white/65 mb-1">Total Conversions</p>
                <p class="text-xl font-bold text-lime-400">{{ formatNumber(product.conversions) }}</p>
              </div>
              <div>
                <p class="text-xs text-white/65 mb-1">Conv. Rate</p>
                <p class="text-xl font-bold text-lime-400">{{ product.conversionRate }}%</p>
              </div>
            </div>
            <!-- Funnel bar -->
            <div class="mt-4 space-y-1.5">
              <div class="flex justify-between text-xs text-white/60 mb-2">
                <span>Funnel</span>
                <span>{{ formatNumber(product.impressions) }} → {{ formatNumber(product.clicks) }} → {{ formatNumber(product.conversions) }}</span>
              </div>
              <div class="flex items-center gap-1.5">
                <span class="text-xs text-white/60 w-24 text-right">Impressions</span>
                <div class="flex-1 h-1.5 rounded-full bg-white/10">
                  <div class="h-full rounded-full bg-white/25" style="width: 100%"></div>
                </div>
              </div>
              <div class="flex items-center gap-1.5">
                <span class="text-xs text-white/60 w-24 text-right">Clicks</span>
                <div class="flex-1 h-1.5 rounded-full bg-white/10">
                  <div class="h-full rounded-full bg-glow-400/60" :style="{ width: clickRate + '%' }"></div>
                </div>
              </div>
              <div class="flex items-center gap-1.5">
                <span class="text-xs text-white/60 w-24 text-right">Conversions</span>
                <div class="flex-1 h-1.5 rounded-full bg-white/10">
                  <div class="h-full rounded-full bg-lime-400/70" :style="{ width: convFunnelWidth + '%' }"></div>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
interface HistoryPoint {
  date: string
  revenue: number
  roas: number
  spend: number
}

interface Product {
  id: string
  title: string
  sku: string
  score: number
  roas: number
  blendedRoas: number
  ctr: number
  margin: number
  velocity: number
  category: string
  spend: number
  revenue: number
  impressions: number
  clicks: number
  conversions: number
  conversionRate: number
  imageUrl: string
  productUrl: string
  history?: HistoryPoint[]
}

const props = defineProps<{
  product: Product | null
  currency?: string
  historyLoading?: boolean
}>()

defineEmits<{
  close: []
}>()

const currency = computed(() => props.currency ?? 'USD')

const formatMoney = (value: number) => new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: currency.value,
  maximumFractionDigits: 0,
}).format(value)

const formatNumber = (value: number) => new Intl.NumberFormat('en-US').format(value)

// Meta revenue share estimate based on roas vs blendedRoas ratio
const metaShare = computed(() => {
  if (!props.product) return 70
  const p = props.product
  if (p.blendedRoas <= 0) return 70
  const share = Math.round((p.roas / Math.max(p.blendedRoas, 0.1)) * 100)
  return Math.min(Math.max(share, 20), 95)
})

const clickRate = computed(() => {
  if (!props.product || !props.product.impressions) return 0
  return Math.min((props.product.clicks / props.product.impressions) * 100 * 10, 100)
})

const convFunnelWidth = computed(() => {
  if (!props.product || !props.product.impressions) return 0
  return Math.min((props.product.conversions / props.product.impressions) * 100 * 50, 100)
})

const scoreColor = (score: number) => {
  if (score >= 75) return 'text-lime-400'
  if (score >= 50) return 'text-glow-400'
  if (score >= 25) return 'text-ember-400'
  return 'text-white/65'
}

const scoreBarColor = (score: number) => {
  if (score >= 75) return 'bg-lime-400'
  if (score >= 50) return 'bg-glow-400'
  if (score >= 25) return 'bg-ember-400'
  return 'bg-white/30'
}

const badgeClass = (category: string) => {
  if (category === 'SCALE') return 'bg-lime-500/15 text-lime-400 border border-lime-500/20'
  if (category === 'TEST') return 'bg-glow-500/15 text-glow-400 border border-glow-500/20'
  if (category === 'KILL') return 'bg-ember-500/15 text-ember-400 border border-ember-500/20'
  return 'bg-violet-500/15 text-violet-400 border border-violet-500/20'
}

const badgeDot = (category: string) => {
  if (category === 'SCALE') return 'bg-lime-400'
  if (category === 'TEST') return 'bg-glow-400'
  if (category === 'KILL') return 'bg-ember-500'
  return 'bg-violet-400'
}
</script>

<style scoped>
.sidekick-backdrop-enter-active,
.sidekick-backdrop-leave-active {
  transition: opacity 0.25s ease;
}
.sidekick-backdrop-enter-from,
.sidekick-backdrop-leave-to {
  opacity: 0;
}

.sidekick-panel-enter-active,
.sidekick-panel-leave-active {
  transition: transform 0.3s cubic-bezier(0.32, 0.72, 0, 1);
}
.sidekick-panel-enter-from,
.sidekick-panel-leave-to {
  transform: translateX(100%);
}
</style>

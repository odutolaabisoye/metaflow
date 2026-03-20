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
              :src="thumbUrl(product.imageUrl, 600)"
              :alt="product.title"
              class="w-full h-full object-cover"
              loading="lazy"
              @error="(e) => { const t = e.target as HTMLImageElement; if (t.src !== product.imageUrl) t.src = product.imageUrl || '' }"
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
            <span class="text-[10px] text-white/45 font-mono">{{ rangeLabel }}</span>
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
            <PerformanceChart
              :data="product.history"
              :currency="currency"
              :range-start="rangeStart"
              :range-end="rangeEnd"
              @range-change="onChartRangeChange"
            />
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
              <div class="flex items-center gap-1.5 mb-0.5">
                <p class="text-xs text-glow-400/70 font-medium uppercase tracking-widest">Blended ROAS</p>
                <MetricTip>Actual WooCommerce store revenue ÷ Meta ad spend. Uses real orders — not Meta's attribution model. This is the most honest ROAS.</MetricTip>
              </div>
              <p class="text-3xl font-bold text-glow-400">{{ displayBlendedRoas }}×</p>
              <p class="text-xs text-white/65 mt-1">Store revenue / ad spend</p>
            </div>
            <div class="text-right">
              <div class="flex items-center justify-end gap-1.5 mb-1">
                <MetricTip side="left">Revenue Meta attributes to this product's ads via omni_purchase ÷ spend. Can differ significantly from store revenue due to attribution modelling.</MetricTip>
                <p class="text-xs text-white/60">Meta ROAS</p>
              </div>
              <p class="text-xl font-semibold">{{ displayMetaRoas }}×</p>
              <p class="text-xs text-white/60 mt-1">Meta-attributed only</p>
            </div>
          </div>
          <!-- Blended vs Meta bar -->
          <div class="mt-4">
            <div class="flex justify-between text-xs text-white/60 mb-1.5">
              <span class="flex items-center gap-1">
                Meta-attributed
                <MetricTip>Share of total ROAS explained by Meta's omni_purchase attribution. 100% = all revenue is Meta-attributed; 0% = Meta claims no revenue but store sees orders.</MetricTip>
              </span>
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
          <!-- Store Revenue -->
          <div class="rounded-xl border border-white/8 bg-white/[0.03] p-3.5">
            <div class="flex items-center gap-1 mb-1">
              <p class="text-xs text-white/65">Store Revenue</p>
              <MetricTip>Actual revenue from WooCommerce orders containing this product. Source of truth — no attribution models, just real purchases.</MetricTip>
            </div>
            <p class="text-base font-semibold text-lime-400">{{ formatMoney(displayRevenue) }}</p>
          </div>
          <!-- Meta Revenue -->
          <div class="rounded-xl border border-white/8 bg-white/[0.03] p-3.5">
            <div class="flex items-center gap-1 mb-1">
              <p class="text-xs text-white/65">Meta Revenue</p>
              <MetricTip>Purchase value Meta attributes to this product's ads via omni_purchase — their canonical, deduplicated conversion metric. Zero means Meta's attribution window didn't credit a direct product purchase.</MetricTip>
            </div>
            <p class="text-base font-semibold text-sky-400">{{ displayMetaRevenue > 0 ? formatMoney(displayMetaRevenue) : '—' }}</p>
          </div>
          <!-- Ad Spend -->
          <div class="rounded-xl border border-white/8 bg-white/[0.03] p-3.5">
            <div class="flex items-center gap-1 mb-1">
              <p class="text-xs text-white/65">Ad Spend</p>
              <MetricTip>Total amount spent on Meta ads for this product in the selected period. Converted from the ad account's billing currency to your store currency.</MetricTip>
            </div>
            <p class="text-base font-semibold">{{ formatMoney(displaySpend) }}</p>
          </div>
          <!-- Gross Margin -->
          <div class="rounded-xl border border-white/8 bg-white/[0.03] p-3.5">
            <div class="flex items-center gap-1 mb-1">
              <p class="text-xs text-white/65">Gross Margin</p>
              <MetricTip>Estimated profit margin after cost of goods. ≥30% is healthy (lime), 20–30% is moderate (amber), below 20% is thin (red). Set per-product in your catalogue.</MetricTip>
            </div>
            <p class="text-base font-semibold" :class="displayMarginPct >= 30 ? 'text-lime-400' : displayMarginPct >= 20 ? 'text-glow-400' : 'text-ember-400'">
              {{ displayMarginPct.toFixed(1) }}%
            </p>
          </div>
          <!-- Velocity -->
          <div class="rounded-xl border border-white/8 bg-white/[0.03] p-3.5">
            <div class="flex items-center gap-1 mb-1">
              <p class="text-xs text-white/65">Velocity</p>
              <MetricTip>Average daily revenue rate relative to the product's 30-day baseline. A higher velocity means this product is selling faster than its historical average.</MetricTip>
            </div>
            <p class="text-base font-semibold">{{ Number(product.velocity).toFixed(1) }}×</p>
          </div>
          <!-- Conv Rate -->
          <div class="rounded-xl border border-white/8 bg-white/[0.03] p-3.5">
            <div class="flex items-center gap-1 mb-1">
              <p class="text-xs text-white/65">Conv. Rate</p>
              <MetricTip>Conversions ÷ clicks — the % of people who clicked this product's ad and were attributed a purchase by Meta's omni_purchase metric.</MetricTip>
            </div>
            <p class="text-base font-semibold text-lime-400">{{ displayConvRatePct }}%</p>
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
                <MetricTip>How many times this product's ad was shown in Meta's network (Facebook, Instagram, Audience Network). One person seeing the same ad 3× = 3 impressions.</MetricTip>
              </div>
              <span class="font-mono text-sm font-medium">{{ formatNumber(displayImpressions) }}</span>
            </div>
            <div class="flex items-center justify-between rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3">
              <div class="flex items-center gap-2.5">
                <div class="h-7 w-7 rounded-lg bg-white/8 flex items-center justify-center">
                  <svg class="w-3.5 h-3.5 text-white/75" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M15.042 21.672L13.684 16.6m0 0l-2.51 2.225.569-9.47 5.227 7.917-3.286-.672zm-7.518-.267A8.25 8.25 0 1120.25 10.5M8.288 14.212A5.25 5.25 0 1117.25 10.5"/>
                  </svg>
                </div>
                <span class="text-sm text-white/65">Clicks</span>
                <MetricTip>Total link clicks on this product's ads. Includes clicks to your website or Meta's onsite checkout. Used to compute CTR and conversion rate.</MetricTip>
              </div>
              <span class="font-mono text-sm font-medium">{{ formatNumber(displayClicks) }}</span>
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
                <MetricTip>Click-through rate = clicks ÷ impressions. DPA (Dynamic Product Ad) benchmark: 1–2% is solid. Below 0.5% suggests the creative or product image needs work.</MetricTip>
              </div>
              <span class="font-mono text-sm font-medium text-glow-400">{{ displayCtrPct }}%</span>
            </div>
          </div>
        </div>

        <!-- Conversion details -->
        <div class="px-6 mb-4 flex-shrink-0">
          <div class="flex items-center gap-2 mb-3">
            <h3 class="text-xs text-white/65 uppercase tracking-widest font-medium">Conversions</h3>
            <MetricTip>Based on Meta's omni_purchase metric — their canonical, deduplicated attribution. A customer who clicked this product's ad and later purchased it (within 7-day click / 1-day view window) counts as 1 conversion.</MetricTip>
          </div>
          <div class="rounded-2xl border border-lime-500/15 bg-lime-500/[0.04] p-4">
            <div class="grid grid-cols-2 gap-4">
              <div>
                <div class="flex items-center gap-1 mb-1">
                  <p class="text-xs text-white/65">omni_purchase</p>
                  <MetricTip>Meta's unified purchase count for this product. Uses omni_purchase — deduplicated across pixel, onsite, and app — to avoid counting the same purchase twice.</MetricTip>
                </div>
                <p class="text-xl font-bold text-lime-400">{{ formatNumber(displayConversions) }}</p>
              </div>
              <div>
                <div class="flex items-center gap-1 mb-1">
                  <p class="text-xs text-white/65">Session Purchases</p>
                  <MetricTip>onsite_web_purchase count — purchases that happened in a Meta session where this product's ad was shown. May include purchases of OTHER products clicked after seeing this ad.</MetricTip>
                </div>
                <p class="text-xl font-bold text-sky-400/80">{{ formatNumber(displayOnsitePurchases) }}</p>
              </div>
            </div>
            <!-- Funnel bar — Impressions → Clicks → ATC → Checkout → Purchase -->
            <div class="mt-4 space-y-1.5">
              <div class="flex justify-between text-xs text-white/60 mb-2">
                <span>Ad Funnel</span>
                <span class="font-mono text-[10px]">{{ formatNumber(displayImpressions) }} → {{ formatNumber(displayClicks) }} → {{ formatNumber(displayAddToCartOmni) }} → {{ formatNumber(displayConversions) }}</span>
              </div>
              <div class="flex items-center gap-1.5">
                <span class="text-xs text-white/60 w-24 text-right">Impressions</span>
                <div class="flex-1 h-1.5 rounded-full bg-white/10">
                  <div class="h-full rounded-full bg-white/25" style="width: 100%"></div>
                </div>
                <span class="text-[10px] text-white/40 font-mono w-12 text-right">{{ formatNumber(displayImpressions) }}</span>
              </div>
              <div class="flex items-center gap-1.5">
                <span class="text-xs text-white/60 w-24 text-right">Clicks</span>
                <div class="flex-1 h-1.5 rounded-full bg-white/10">
                  <div class="h-full rounded-full bg-glow-400/60" :style="{ width: clickRate + '%' }"></div>
                </div>
                <span class="text-[10px] text-white/40 font-mono w-12 text-right">{{ formatNumber(displayClicks) }}</span>
              </div>
              <div class="flex items-center gap-1.5">
                <span class="text-xs text-white/60 w-24 text-right">Add to Cart</span>
                <div class="flex-1 h-1.5 rounded-full bg-white/10">
                  <div class="h-full rounded-full bg-amber-400/60" :style="{ width: atcFunnelWidth + '%' }"></div>
                </div>
                <span class="text-[10px] text-white/40 font-mono w-12 text-right">{{ formatNumber(displayAddToCartOmni) }}</span>
              </div>
              <div class="flex items-center gap-1.5">
                <span class="text-xs text-white/60 w-24 text-right">Checkout</span>
                <div class="flex-1 h-1.5 rounded-full bg-white/10">
                  <div class="h-full rounded-full bg-orange-400/60" :style="{ width: coFunnelWidth + '%' }"></div>
                </div>
                <span class="text-[10px] text-white/40 font-mono w-12 text-right">{{ formatNumber(displayCheckoutOmni) }}</span>
              </div>
              <div class="flex items-center gap-1.5">
                <span class="text-xs text-white/60 w-24 text-right">Purchases</span>
                <div class="flex-1 h-1.5 rounded-full bg-white/10">
                  <div class="h-full rounded-full bg-lime-400/70" :style="{ width: convFunnelWidth + '%' }"></div>
                </div>
                <span class="text-[10px] text-white/40 font-mono w-12 text-right">{{ formatNumber(displayConversions) }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Add to Cart / Checkout detail -->
        <div class="px-6 mb-6 flex-shrink-0">
          <div class="flex items-center gap-2 mb-3">
            <h3 class="text-xs text-white/65 uppercase tracking-widest font-medium">Funnel Events</h3>
            <MetricTip>Meta returns two variants for each event: Omni (all channels — pixel + onsite + app, deduplicated) and Site (website pixel only). Omni is the headline number.</MetricTip>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <!-- Add to Cart -->
            <div class="rounded-xl border border-amber-500/15 bg-amber-500/[0.04] p-3.5">
              <div class="flex items-center gap-1 mb-2">
                <p class="text-xs text-amber-400/80 font-medium">Add to Cart</p>
                <MetricTip>omni_add_to_cart — deduplicated adds-to-cart across all Meta channels. Includes pixel, onsite (Instagram/Facebook shop), and app events.</MetricTip>
              </div>
              <p class="text-2xl font-bold text-amber-400">{{ formatNumber(displayAddToCartOmni) }}</p>
              <p class="text-[10px] text-white/35 mt-1">omni · <span class="font-mono">{{ formatNumber(displayAddToCart) }}</span> site-only</p>
            </div>
            <!-- Checkout Initiated -->
            <div class="rounded-xl border border-orange-500/15 bg-orange-500/[0.04] p-3.5">
              <div class="flex items-center gap-1 mb-2">
                <p class="text-xs text-orange-400/80 font-medium">Checkout Started</p>
                <MetricTip>omni_initiated_checkout — people who started checkout across all Meta channels after seeing this product's ad. High checkout drop-off may signal price or UX issues.</MetricTip>
              </div>
              <p class="text-2xl font-bold text-orange-400">{{ formatNumber(displayCheckoutOmni) }}</p>
              <p class="text-[10px] text-white/35 mt-1">omni · <span class="font-mono">{{ formatNumber(displayCheckoutInitiated) }}</span> site-only</p>
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
  metaRevenue: number
  roas: number
  blendedRoas: number
  spend: number
  ctr: number
  margin: number
  velocity: number
  impressions: number
  clicks: number
  conversions: number
  conversionRate: number
  onsitePurchases?: number   // onsite_web_purchase session count (may be different product)
  addToCart?: number
  addToCartOmni?: number
  checkoutInitiated?: number
  checkoutInitiatedOmni?: number
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
  metaRevenue?: number
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
  /** ISO date string (YYYY-MM-DD) matching the global date filter start */
  rangeStart?: string
  /** ISO date string (YYYY-MM-DD) matching the global date filter end */
  rangeEnd?: string
}>()

defineEmits<{
  close: []
}>()

const currency = computed(() => props.currency ?? 'USD')

// Map currency codes to the locale that produces native symbols (e.g. NGN → ₦)
const CURRENCY_LOCALE: Record<string, string> = {
  NGN: 'en-NG', GBP: 'en-GB', EUR: 'de-DE', JPY: 'ja-JP',
  AUD: 'en-AU', CAD: 'en-CA', INR: 'en-IN', ZAR: 'en-ZA',
  GHS: 'en-GH', KES: 'sw-KE', EGP: 'ar-EG', MAD: 'ar-MA',
}
const currencyLocale = computed(() => CURRENCY_LOCALE[currency.value] ?? 'en-US')

const formatMoney = (value: number) => new Intl.NumberFormat(currencyLocale.value, {
  style: 'currency',
  currency: currency.value,
  maximumFractionDigits: 0,
}).format(value)

/**
 * Generates a smaller image URL for known CDN patterns.
 * WordPress: inserts -{size}x{size} before the extension.
 * Shopify: inserts _{size}x{size} before the extension.
 * Falls back to the original URL on error via @error handler.
 */
function thumbUrl(url: string | null | undefined, size = 600): string {
  if (!url) return ''
  try {
    const u = new URL(url)
    if (u.pathname.startsWith('/s/files/') || u.hostname.includes('cdn.shopify.com')) {
      return url.replace(/(\.\w{2,5})(\?.*)?$/, `_${size}x${size}$1$2`)
    }
    if (u.pathname.includes('/wp-content/uploads/')) {
      return url.replace(/(\.\w{2,5})(\?.*)?$/, `-${size}x${size}$1$2`)
    }
    return url
  } catch {
    return url || ''
  }
}

const formatNumber = (value: number) => new Intl.NumberFormat('en-US').format(value)

// ── Chart range tracking ───────────────────────────────────────────────────────
// chartRange mirrors the zoom pill selected in PerformanceChart (7D / 14D / 30D).
// Only meaningful when the global range is wide (30d / 90d) and pills are visible.
const chartRange = ref('30D')

function onChartRangeChange(range: string) {
  chartRange.value = range
}

// Reset range when a new product is opened
watch(() => props.product?.id, () => { chartRange.value = '30D' })

/** Number of calendar days in the provided date range. */
const globalRangeDays = computed(() => {
  if (!props.rangeStart || !props.rangeEnd) return 30
  const s = new Date(props.rangeStart + 'T00:00:00')
  const e = new Date(props.rangeEnd   + 'T00:00:00')
  return Math.max(1, Math.round((e.getTime() - s.getTime()) / 86_400_000) + 1)
})

/** Human-readable label for the chart header */
const rangeLabel = computed(() => {
  if (!props.rangeStart || !props.rangeEnd) return `daily · ${chartRange.value.toLowerCase()}`
  const days = globalRangeDays.value
  if (days === 1) {
    // Format as "Mar 5"
    const [y, m, d] = props.rangeStart.split('-').map(Number)
    const label = new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    return `daily · ${label}`
  }
  return `daily · ${days}d`
})

/** Extract YYYY-MM-DD from any date string (strips time/zone portion). */
function toDateStr(d: string): string { return d.slice(0, 10) }

// ── Aggregated metrics for the active date window ─────────────────────────────
const rangeMetrics = computed(() => {
  const history = props.product?.history
  if (!history?.length) return null

  // Step 1: filter to the global date range
  let slice = props.rangeStart && props.rangeEnd
    ? history.filter(d => {
        const ds = toDateStr(d.date)
        return ds >= props.rangeStart! && ds <= props.rangeEnd!
      })
    : [...history]

  // Step 2: apply zoom pill when the window is wide enough (mirrors chart logic)
  if (globalRangeDays.value > 14) {
    const pillDays = chartRange.value === '7D' ? 7 : chartRange.value === '14D' ? 14 : 30
    if (slice.length > pillDays) {
      slice = slice.slice(-pillDays)
    }
  }

  const n = slice.length || 1

  const totalRevenue            = slice.reduce((s, d) => s + (d.revenue ?? 0), 0)
  const totalMetaRevenue        = slice.reduce((s, d) => s + (d.metaRevenue ?? 0), 0)
  const totalSpend              = slice.reduce((s, d) => s + (d.spend ?? 0), 0)
  const totalImpressions        = slice.reduce((s, d) => s + (d.impressions ?? 0), 0)
  const totalClicks             = slice.reduce((s, d) => s + (d.clicks ?? 0), 0)
  const totalConversions        = slice.reduce((s, d) => s + (d.conversions ?? 0), 0)
  const totalAddToCart          = slice.reduce((s, d) => s + (d.addToCart ?? 0), 0)
  const totalAddToCartOmni      = slice.reduce((s, d) => s + (d.addToCartOmni ?? 0), 0)
  const totalCheckout           = slice.reduce((s, d) => s + (d.checkoutInitiated ?? 0), 0)
  const totalCheckoutOmni       = slice.reduce((s, d) => s + (d.checkoutInitiatedOmni ?? 0), 0)
  // Weighted avg margin (weight by revenue)
  const avgMargin = totalRevenue > 0
    ? slice.reduce((s, d) => s + (d.margin ?? 0) * (d.revenue ?? 0), 0) / totalRevenue
    : slice.reduce((s, d) => s + (d.margin ?? 0), 0) / n

  return {
    revenue:              totalRevenue,
    metaRevenue:          totalMetaRevenue,
    spend:                totalSpend,
    impressions:          totalImpressions,
    clicks:               totalClicks,
    conversions:          totalConversions,
    addToCart:            totalAddToCart,
    addToCartOmni:        totalAddToCartOmni,
    checkoutInitiated:    totalCheckout,
    checkoutInitiatedOmni: totalCheckoutOmni,
    ctr:            totalImpressions > 0 ? totalClicks / totalImpressions : 0,
    conversionRate: totalClicks > 0 ? totalConversions / totalClicks : 0,
    // Blended ROAS = actual store revenue / Meta spend (the honest number)
    blendedRoas:    totalSpend > 0 ? totalRevenue / totalSpend : 0,
    // Meta ROAS = Meta-attributed revenue / Meta spend
    metaRoas:       totalSpend > 0 && totalMetaRevenue > 0 ? totalMetaRevenue / totalSpend : 0,
    margin:         avgMargin,
  }
})

// ── Display values: prefer rangeMetrics (when history loaded), else product prop ──
const displayRevenue     = computed(() => rangeMetrics.value?.revenue     ?? props.product?.revenue     ?? 0)
const displayMetaRevenue = computed(() => rangeMetrics.value?.metaRevenue ?? props.product?.metaRevenue ?? 0)
const displaySpend       = computed(() => rangeMetrics.value?.spend       ?? props.product?.spend       ?? 0)
const displayImpressions = computed(() => rangeMetrics.value?.impressions ?? props.product?.impressions ?? 0)
const displayClicks      = computed(() => rangeMetrics.value?.clicks      ?? props.product?.clicks      ?? 0)
const displayConversions = computed(() => rangeMetrics.value?.conversions ?? props.product?.conversions ?? 0)
const displayAddToCart          = computed(() => rangeMetrics.value?.addToCart            ?? 0)
const displayAddToCartOmni      = computed(() => rangeMetrics.value?.addToCartOmni         ?? 0)
const displayCheckoutInitiated  = computed(() => rangeMetrics.value?.checkoutInitiated     ?? 0)
const displayCheckoutOmni       = computed(() => rangeMetrics.value?.checkoutInitiatedOmni ?? 0)

// onsite_web_purchase session count — sum from history if loaded
const displayOnsitePurchases = computed(() => {
  const history = props.product?.history
  if (!history?.length) return 0
  let slice = props.rangeStart && props.rangeEnd
    ? history.filter(d => { const ds = toDateStr(d.date); return ds >= props.rangeStart! && ds <= props.rangeEnd! })
    : [...history]
  if (globalRangeDays.value > 14) {
    const pillDays = chartRange.value === '7D' ? 7 : chartRange.value === '14D' ? 14 : 30
    if (slice.length > pillDays) slice = slice.slice(-pillDays)
  }
  return slice.reduce((s, d) => s + (d.onsitePurchases ?? 0), 0)
})
// Stored as decimal (0.025 = 2.5%), multiply × 100 for display
const displayCtrPct      = computed(() => ((rangeMetrics.value?.ctr      ?? props.product?.ctr      ?? 0) * 100).toFixed(2))
const displayConvRatePct = computed(() => ((rangeMetrics.value?.conversionRate ?? props.product?.conversionRate ?? 0) * 100).toFixed(2))
// Stored as decimal (0.35 = 35%), multiply × 100 for display
const displayMarginPct   = computed(() => (rangeMetrics.value?.margin ?? props.product?.margin ?? 0) * 100)
const displayBlendedRoas = computed(() => (rangeMetrics.value?.blendedRoas ?? Number(props.product?.blendedRoas) ?? 0).toFixed(2))
// Meta ROAS = metaRevenue / spend (computed from aggregated history window)
const displayMetaRoas = computed(() => {
  const spd = displaySpend.value
  const meta = displayMetaRevenue.value
  return spd > 0 && meta > 0 ? (meta / spd).toFixed(2) : '0.00'
})

// ── Meta share bar ─────────────────────────────────────────────────────────────
const metaShare = computed(() => {
  const blended = rangeMetrics.value?.blendedRoas ?? Number(props.product?.blendedRoas ?? 0)
  const meta    = Number(props.product?.roas ?? 0)
  if (blended <= 0) return 70
  const share = Math.round((meta / Math.max(blended, 0.1)) * 100)
  return Math.min(Math.max(share, 20), 95)
})

const clickRate = computed(() => {
  const imp = displayImpressions.value
  const clk = displayClicks.value
  if (!imp) return 0
  return Math.min((clk / imp) * 100 * 10, 100)
})

const atcFunnelWidth = computed(() => {
  const imp = displayImpressions.value
  const atc = displayAddToCartOmni.value
  if (!imp) return 0
  return Math.min((atc / imp) * 100 * 20, 100)
})

const coFunnelWidth = computed(() => {
  const imp = displayImpressions.value
  const co  = displayCheckoutOmni.value
  if (!imp) return 0
  return Math.min((co / imp) * 100 * 30, 100)
})

const convFunnelWidth = computed(() => {
  const imp = displayImpressions.value
  const con = displayConversions.value
  if (!imp) return 0
  return Math.min((con / imp) * 100 * 50, 100)
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

// ── MetricTip — inline tooltip pill ──────────────────────────────────────────
// Usage in template: <MetricTip>Explain what this metric means.</MetricTip>
// Optional prop:     <MetricTip side="left"> — flips tooltip to open right-to-left
const MetricTip = defineComponent({
  props: { side: { type: String, default: 'center' } },
  setup(props, { slots }) {
    const show = ref(false)
    return () => h('span', {
      class: 'relative inline-flex items-center shrink-0',
      onMouseenter: () => { show.value = true },
      onMouseleave: () => { show.value = false },
    }, [
      // The ? badge
      h('span', {
        class: 'h-3.5 w-3.5 rounded-full bg-white/10 flex items-center justify-center text-[9px] font-bold text-white/40 hover:bg-white/20 hover:text-white/70 transition-all cursor-help select-none leading-none',
      }, '?'),
      // Tooltip bubble — only rendered when hovered
      show.value ? h('div', {
        class: [
          'absolute bottom-full mb-2 z-[200] w-56 rounded-xl',
          'bg-[#0d1017] border border-white/12 shadow-2xl px-3 py-2.5',
          'text-[11px] text-white/75 leading-relaxed whitespace-normal',
          props.side === 'left'  ? 'right-0'
          : props.side === 'right' ? 'left-0'
          : 'left-1/2 -translate-x-1/2',
        ].join(' '),
      }, [
        slots.default?.(),
        // Caret arrow
        h('div', {
          class: [
            'absolute top-full w-0 h-0',
            'border-l-[5px] border-r-[5px] border-t-[5px]',
            'border-l-transparent border-r-transparent border-t-[#0d1017]',
            props.side === 'left'  ? 'right-2'
            : props.side === 'right' ? 'left-2'
            : 'left-1/2 -translate-x-1/2',
          ].join(' '),
        }),
      ]) : null,
    ])
  },
})
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

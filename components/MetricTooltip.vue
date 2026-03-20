<template>
  <span class="metric-tooltip-wrap group inline-flex items-center gap-0.5">
    <slot />
    <span
      v-if="tip"
      ref="triggerRef"
      class="metric-tooltip-trigger relative inline-flex items-center"
      @mouseenter="open"
      @mouseleave="close"
      @focusin="open"
      @focusout="close"
    >
      <!-- ? pill — visible on parent hover -->
      <button
        type="button"
        :aria-label="label"
        class="ml-0.5 h-4 w-4 rounded-full border border-white/20 bg-white/[0.06] text-[9px] font-bold text-white/50 hover:bg-white/10 hover:text-white/80 hover:border-white/35 transition-all flex-shrink-0 flex items-center justify-center opacity-0 group-hover:opacity-100 focus:opacity-100 focus:outline-none"
      >?</button>

      <!-- Tooltip bubble — teleported to body to escape overflow:hidden containers -->
      <Teleport to="body">
        <Transition name="metric-tip">
          <div
            v-if="show"
            :style="tipStyle"
            class="fixed z-[9999] w-56 rounded-xl border border-white/10 bg-ink-900/95 backdrop-blur-md px-3 py-2.5 shadow-2xl pointer-events-none"
          >
            <!-- Arrow -->
            <div class="absolute left-1/2 -translate-x-1/2 -bottom-1.5 h-3 w-3 rotate-45 rounded-sm border-r border-b border-white/10 bg-ink-900/95"></div>
            <p class="text-[11px] font-semibold text-white/90 mb-0.5">{{ label }}</p>
            <p class="text-[11px] text-white/60 leading-relaxed">{{ tip }}</p>
          </div>
        </Transition>
      </Teleport>
    </span>
  </span>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';

const props = defineProps<{
  metric: string;
}>();

const show = ref(false);
const triggerRef = ref<HTMLElement | null>(null);
const tipStyle = ref<Record<string, string>>({});

function updatePosition() {
  if (!triggerRef.value) return;
  const rect = triggerRef.value.getBoundingClientRect();
  tipStyle.value = {
    top: `${rect.top - 8}px`,
    left: `${rect.left + rect.width / 2}px`,
    transform: 'translate(-50%, -100%)',
  };
}

function open() {
  updatePosition();
  show.value = true;
}
function close() {
  show.value = false;
}

// ─── Metric definitions ────────────────────────────────────────────────────
const METRICS: Record<string, { label: string; tip: string }> = {
  revenue: {
    label: 'Revenue (Store)',
    tip: 'Total revenue from orders recorded by your store (Shopify / WooCommerce). Includes all sales channels, not just Meta.',
  },
  metaRevenue: {
    label: 'Meta Revenue',
    tip: 'Revenue Meta attributes to your ads via their conversion tracking. May differ from store revenue due to attribution windows.',
  },
  spend: {
    label: 'Ad Spend',
    tip: 'Total amount spent on Meta Ads (Facebook & Instagram) for this product or campaign during the selected period.',
  },
  roas: {
    label: 'ROAS',
    tip: 'Return On Ad Spend — Meta Revenue ÷ Ad Spend. A 2× ROAS means every ₦1 spent returned ₦2 in Meta-attributed revenue.',
  },
  ctr: {
    label: 'CTR',
    tip: 'Click-Through Rate — percentage of ad impressions that resulted in a click (Clicks ÷ Impressions × 100). Higher is better.',
  },
  impressions: {
    label: 'Impressions',
    tip: 'The total number of times your ad was displayed to someone on Facebook or Instagram, including repeat views.',
  },
  clicks: {
    label: 'Clicks',
    tip: 'Total clicks on your Meta ads. Includes link clicks, page likes, and other interactions depending on your campaign type.',
  },
  score: {
    label: 'Performance Score',
    tip: 'MetaFlow composite score (0–100) calculated daily from ROAS, CTR, revenue velocity, and stock health. ≥80 = Scale, 50–79 = Test, <50 = Risk.',
  },
  category: {
    label: 'Category',
    tip: 'AI-assigned product tier: SCALE (top performers to increase budget), TEST (promising, needs more data), RISK (watch closely), KILL (cut or pause).',
  },
  velocity: {
    label: 'Velocity',
    tip: 'Rate of revenue growth over the last 7 days compared to the prior 7-day period. Positive means accelerating sales.',
  },
  cpm: {
    label: 'CPM',
    tip: 'Cost Per Mille — how much you pay per 1,000 impressions. A key indicator of how competitive your target audience is.',
  },
  cpc: {
    label: 'CPC',
    tip: 'Cost Per Click — average spend per ad click (Ad Spend ÷ Clicks). Lower CPC with good ROAS signals efficient ads.',
  },
  blendedRoas: {
    label: 'Blended ROAS',
    tip: 'Store revenue (all channels) ÷ total Meta Ad Spend. Accounts for organic + assisted sales, giving a truer picture of profitability.',
  },
  conversionRate: {
    label: 'Conversion Rate',
    tip: 'Percentage of ad clicks that resulted in a purchase. Calculated as Orders ÷ Clicks × 100.',
  },
  addToCart: {
    label: 'Add to Cart',
    tip: 'Number of times users added a product to cart after seeing your ad. "Omni" (top) includes all channels; "site" (below) is website-only pixel events.',
  },
  checkoutInitiated: {
    label: 'Checkout Initiated',
    tip: 'Number of times users started the checkout process after seeing your ad. "Omni" (top) includes all channels; "site" (below) is website-only pixel events.',
  },
};

const entry = computed(() => METRICS[props.metric] ?? null);
const label = computed(() => entry.value?.label ?? props.metric);
const tip   = computed(() => entry.value?.tip   ?? '');
</script>

<style scoped>
.metric-tip-enter-active,
.metric-tip-leave-active {
  transition: opacity 0.12s ease, margin-top 0.12s ease;
}
.metric-tip-enter-from,
.metric-tip-leave-to {
  opacity: 0;
  margin-top: 4px;
}
.metric-tip-enter-to,
.metric-tip-leave-from {
  opacity: 1;
  margin-top: 0;
}
</style>

<template>
  <div class="space-y-5">

    <!-- Page header -->
    <div class="flex flex-wrap items-start justify-between gap-3 mb-1">
      <div>
        <p class="text-[11px] uppercase tracking-widest text-white/80 mb-1">Meta Catalog Command</p>
        <h1 class="text-xl sm:text-2xl font-semibold tracking-tight">Performance Overview</h1>
        <p class="mt-1 text-xs sm:text-sm text-white/85">Catalog-level signals, Meta performance, and AI guidance.</p>
      </div>
      <div class="hidden md:flex items-center gap-2">
        <span class="text-xs text-white/75">{{ new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) }}</span>
      </div>
    </div>

    <!-- Stat cards -->
    <div v-if="pending" class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <div v-for="n in 4" :key="n" class="h-28 rounded-2xl bg-white/5 animate-pulse"></div>
    </div>
    <div v-else class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <div
        v-for="stat in statCards"
        :key="stat.label"
        class="rounded-2xl border border-white/10 bg-white/[0.04] p-4 sm:p-5 hover:bg-white/[0.06] transition-colors cursor-default"
      >
        <div class="flex items-start justify-between mb-3">
          <p class="text-xs text-white/80 font-medium">
            <MetricTooltip :metric="stat.metric">{{ stat.label }}</MetricTooltip>
          </p>
          <div class="h-7 w-7 rounded-lg flex items-center justify-center flex-shrink-0" :style="{ background: stat.iconBg }">
            <svg class="w-3.5 h-3.5" :style="{ color: stat.iconColor }" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" v-html="stat.icon"></svg>
          </div>
        </div>
        <p class="text-2xl font-semibold tracking-tight">{{ stat.value }}</p>
        <div class="mt-2 flex items-center gap-1.5">
          <span class="flex items-center gap-1 text-xs font-medium" :class="stat.trendUp ? 'text-lime-400' : 'text-ember-400'">
            <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" :d="stat.trendUp ? 'M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25' : 'M19.5 4.5l-15 15m0 0h11.25m-11.25 0V8.25'"/>
            </svg>
            {{ stat.trend }}
          </span>
          <span class="text-xs text-white/70">{{ stat.trendLabel }}</span>
        </div>
        <!-- Mini sparkline bars -->
        <div v-if="stat.spark?.length" class="mt-3 flex items-end gap-0.5 h-8">
          <div
            v-for="(b, i) in stat.spark"
            :key="i"
            class="flex-1 rounded-sm"
            :style="{ height: b + '%', background: stat.iconColor, opacity: i === stat.spark.length - 1 ? 1 : 0.3 + (i / stat.spark.length) * 0.4 }"
          ></div>
        </div>
      </div>
    </div>

    <!-- Empty state -->
    <div v-if="!pending && !hasData" class="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center">
      <p class="text-sm font-medium">No performance data yet.</p>
      <p class="mt-1 text-xs text-white/75">Run a sync to pull your first 30 days of catalog metrics.</p>
      <NuxtLink to="/app/products" class="mt-3 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-3 py-1.5 text-xs text-white/80 hover:text-white hover:bg-white/10 transition-colors">
        Go to Products
      </NuxtLink>
    </div>

    <!-- Main grid -->
    <div class="grid gap-5 xl:grid-cols-[1fr_340px]">

      <!-- Left -->
      <div class="space-y-5">

        <!-- Revenue chart -->
        <div class="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
          <div class="flex items-center justify-between mb-5">
            <div>
              <p class="text-xs text-white/85 uppercase tracking-widest mb-1">Revenue Flight</p>
              <h2 class="text-lg font-semibold">Catalog momentum</h2>
            </div>
            <div class="flex items-center gap-3 text-xs text-white/85">
              <span class="flex items-center gap-1.5"><span class="h-2 w-2 rounded-sm bg-glow-500/70 flex-shrink-0"></span>Revenue</span>
              <span class="flex items-center gap-1.5"><span class="h-2 w-2 rounded-sm bg-lime-500/70 flex-shrink-0"></span>Trend</span>
            </div>
          </div>
          <div v-if="chartData.length" class="flex items-end gap-1 h-44">
            <div
              v-for="(bar, i) in chartData"
              :key="i"
              class="flex-1 rounded-t-sm relative group/bar cursor-default transition-opacity hover:opacity-100"
              :style="{ height: bar.h + '%', background: `linear-gradient(to top, rgba(34,211,238,0.65), rgba(132,204,22,0.35))`, opacity: 0.7 }"
            >
              <div class="absolute -top-9 left-1/2 -translate-x-1/2 hidden group-hover/bar:block z-10 pointer-events-none">
                <div class="rounded-lg bg-ink-800 border border-white/15 px-2.5 py-1.5 text-xs text-white shadow-xl whitespace-nowrap">{{ bar.label }}</div>
              </div>
            </div>
          </div>
          <div v-else class="h-44 rounded-xl border border-white/10 bg-white/[0.02] flex items-center justify-center text-xs text-white/80">
            No trend data yet.
          </div>
          <div v-if="chartLabels.length" class="mt-2 flex justify-between text-xs text-white/65">
            <span v-for="l in chartLabels" :key="l">{{ l }}</span>
          </div>
          <div class="mt-5 grid grid-cols-3 gap-3 border-t border-white/8 pt-5">
            <div v-for="a in attributionRows" :key="a.label" class="text-center">
              <p class="text-xs text-white/75 mb-1">
                <MetricTooltip v-if="a.metric" :metric="a.metric">{{ a.label }}</MetricTooltip>
                <template v-else>{{ a.label }}</template>
              </p>
              <p class="text-base font-semibold">{{ a.value }}</p>
            </div>
          </div>
        </div>

        <!-- AI Guidance -->
        <div class="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
          <div class="flex items-center justify-between mb-4">
            <div>
              <p class="text-xs text-white/85 uppercase tracking-widest mb-1">AI Guidance</p>
              <h2 class="text-lg font-semibold">Today's priority actions</h2>
            </div>
            <NuxtLink to="/app/products" class="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/85 hover:text-white/70 hover:bg-white/5 transition-all">
              <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z"/></svg>
              View all
            </NuxtLink>
          </div>

          <div v-if="pending" class="space-y-3">
            <div v-for="n in 3" :key="n" class="h-16 rounded-xl bg-white/5 animate-pulse"></div>
          </div>
          <div v-else class="space-y-2.5">
            <div
              v-for="item in aiGuidance"
              :key="item.id"
              class="flex items-start justify-between gap-3 rounded-xl border p-4 hover:bg-white/[0.02] transition-colors"
              :class="item.variant === 'secondary' ? 'border-lime-500/18 bg-lime-500/[0.03]' : item.variant === 'destructive' ? 'border-ember-500/18 bg-ember-500/[0.03]' : 'border-white/10 bg-white/[0.03]'"
            >
              <div class="flex items-start gap-3">
                <div class="mt-0.5 h-7 w-7 rounded-lg flex items-center justify-center flex-shrink-0" :class="item.variant === 'secondary' ? 'bg-lime-500/12' : item.variant === 'destructive' ? 'bg-ember-500/12' : 'bg-glow-500/12'">
                  <svg class="w-3.5 h-3.5" :class="item.variant === 'secondary' ? 'text-lime-400' : item.variant === 'destructive' ? 'text-ember-400' : 'text-glow-400'" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                    <path v-if="item.variant === 'secondary'" stroke-linecap="round" stroke-linejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>
                    <path v-else-if="item.variant === 'destructive'" stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z"/>
                    <path v-else stroke-linecap="round" stroke-linejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18"/>
                  </svg>
                </div>
                <div>
                  <p class="text-sm font-medium">{{ item.title }}</p>
                  <p class="text-xs text-white/80 mt-0.5 leading-relaxed">{{ item.detail }}</p>
                </div>
              </div>
              <div class="flex-shrink-0 flex items-center gap-2">
                <span class="text-xs px-2 py-0.5 rounded-full font-medium" :class="item.variant === 'secondary' ? 'bg-lime-500/12 text-lime-400' : item.variant === 'destructive' ? 'bg-ember-500/12 text-ember-400' : 'bg-glow-500/12 text-glow-400'">
                  {{ item.tag }}
                </span>
                <NuxtLink
                  :to="item.variant === 'secondary' ? '/app/products?category=SCALE' : item.variant === 'destructive' ? '/app/products?category=KILL' : '/app/products'"
                  class="text-xs text-white/85 hover:text-glow-400 transition-colors font-medium"
                >Apply →</NuxtLink>
              </div>
            </div>
            <div v-if="!aiGuidance.length" class="rounded-xl border border-white/10 p-6 text-center">
              <p class="text-sm font-medium">No AI guidance yet.</p>
              <p class="mt-1 text-xs text-white/80">We'll surface recommendations after your first sync.</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Right column -->
      <div class="space-y-5">

        <!-- Sync health -->
        <div class="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div class="flex items-center justify-between mb-3">
            <div>
              <p class="text-xs text-white/85 uppercase tracking-widest mb-1">Sync Health</p>
              <h3 class="text-base font-semibold">Meta sync status</h3>
            </div>
            <NuxtLink to="/app/audit" class="text-xs text-white/70 hover:text-glow-400 transition-colors">Audit log →</NuxtLink>
          </div>
          <div v-if="pending" class="h-16 rounded-xl bg-white/5 animate-pulse"></div>
          <div v-else class="space-y-2">
            <p class="text-sm text-white/80 font-medium">
              {{ syncSummaryDate }}
            </p>
            <p class="text-xs text-white/65" v-if="syncHealth?.metaSummary?.detail">
              {{ syncHealth.metaSummary.detail }}
            </p>
            <p v-else class="text-xs text-white/50">No sync summary yet. Run a sync to capture matching diagnostics.</p>
            <div v-if="syncHealth?.metaSummary?.metadata" class="grid grid-cols-2 gap-2 text-xs mt-2">
              <div class="rounded-lg border border-white/8 bg-white/[0.03] px-3 py-2">
                <p class="text-white/45">Matched</p>
                <p class="text-white/80 font-mono">{{ syncHealth.metaSummary.metadata.matched ?? '—' }}</p>
              </div>
              <div class="rounded-lg border border-white/8 bg-white/[0.03] px-3 py-2">
                <p class="text-white/45">Unmatched spend</p>
                <p class="text-white/80 font-mono">{{ fmtCurrency(syncHealth.metaSummary.metadata.unmatchedSpend, syncHealth.metaSummary.metadata.currency) }}</p>
              </div>
            </div>
            <div v-if="syncHealth?.metaUnmatched?.metadata?.unmatchedCount" class="text-xs text-ember-300 mt-2">
              {{ syncHealth.metaUnmatched.metadata.unmatchedCount }} catalog items unmatched.
            </div>
          </div>
        </div>

        <!-- Automation status -->
        <div class="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div class="flex items-center justify-between mb-4">
            <div>
              <p class="text-xs text-white/85 uppercase tracking-widest mb-1">Automation</p>
              <h3 class="text-base font-semibold">Rules firing now</h3>
            </div>
            <NuxtLink to="/app/settings" class="text-xs text-white/70 hover:text-glow-400 transition-colors">Manage →</NuxtLink>
          </div>
          <div v-if="pending" class="space-y-2">
            <div v-for="n in 3" :key="n" class="h-8 rounded-xl bg-white/5 animate-pulse"></div>
          </div>
          <div v-else class="space-y-2">
            <div v-for="rule in automation.liveRules" :key="rule.label" class="flex items-center justify-between rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2.5">
              <div class="flex items-center gap-2.5">
                <span class="h-2 w-2 rounded-full flex-shrink-0" :class="rule.variant === 'secondary' ? 'bg-lime-400' : rule.variant === 'destructive' ? 'bg-ember-400' : 'bg-glow-400'"></span>
                <span class="text-sm">{{ rule.label }}</span>
              </div>
              <span class="text-xs px-2 py-0.5 rounded-full" :class="rule.variant === 'secondary' ? 'bg-lime-500/10 text-lime-400' : rule.variant === 'destructive' ? 'bg-ember-500/10 text-ember-400' : 'bg-white/8 text-white/85'">
                {{ rule.status }}
              </span>
            </div>
            <div v-if="!automation.liveRules.length" class="rounded-xl border border-white/10 p-4 text-center text-xs text-white/75">
              No rules active. Enable automation in Settings.
            </div>
          </div>
        </div>

        <!-- Activity feed -->
        <div class="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div class="flex items-center justify-between mb-4">
            <div>
              <p class="text-xs text-white/85 uppercase tracking-widest mb-1">Activity</p>
              <h3 class="text-base font-semibold">Recent actions</h3>
            </div>
            <NuxtLink to="/app/audit" class="text-xs text-white/70 hover:text-glow-400 transition-colors">Full log →</NuxtLink>
          </div>
          <div v-if="pending" class="space-y-3">
            <div v-for="n in 4" :key="n" class="h-12 rounded-xl bg-white/5 animate-pulse"></div>
          </div>
          <div v-else class="space-y-3">
            <div v-for="item in automation.recentActivity" :key="item.title" class="flex items-start gap-3">
              <div class="mt-0.5 h-6 w-6 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                <svg class="w-3 h-3 text-white/75" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"/></svg>
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium truncate">{{ item.title }}</p>
                <p class="text-xs text-white/75 mt-0.5">{{ item.detail }}</p>
              </div>
              <span class="text-xs text-white/65 flex-shrink-0 mt-0.5">{{ item.time }}</span>
            </div>
            <div v-if="!automation.recentActivity.length" class="text-center p-4 text-xs text-white/75">
              No automation actions yet.
            </div>
          </div>
        </div>

        <!-- ROI Impact Summary -->
        <div class="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div class="flex items-center justify-between mb-4">
            <div>
              <p class="text-xs text-white/85 uppercase tracking-widest mb-1">ROI Impact</p>
              <h3 class="text-base font-semibold">Spend &amp; revenue outcomes</h3>
            </div>
            <NuxtLink to="/app/products" class="text-xs text-white/70 hover:text-glow-400 transition-colors">Products →</NuxtLink>
          </div>
          <div v-if="roiLoading" class="space-y-3">
            <div v-for="n in 2" :key="n" class="h-14 rounded-xl bg-white/5 animate-pulse"></div>
          </div>
          <div v-else-if="roi" class="space-y-3">
            <!-- Spend shielded -->
            <div class="rounded-xl border border-ember-500/18 bg-ember-500/[0.04] px-4 py-3.5">
              <div class="flex items-start justify-between gap-2">
                <div>
                  <p class="text-[10px] text-ember-400/80 uppercase tracking-widest">Ad spend at risk</p>
                  <p class="text-xl font-bold text-ember-400 mt-0.5">{{ formatCurrency(roi.killSpend) }}</p>
                </div>
                <div class="h-8 w-8 rounded-lg bg-ember-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <svg class="w-4 h-4 text-ember-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 5.25v13.5m-7.5-13.5v13.5"/>
                  </svg>
                </div>
              </div>
              <p class="text-xs text-white/55 mt-1.5">Spend on {{ roi.killCount }} KILL product{{ roi.killCount === 1 ? '' : 's' }} — consider pausing</p>
            </div>
            <!-- Revenue protected -->
            <div class="rounded-xl border border-lime-500/18 bg-lime-500/[0.04] px-4 py-3.5">
              <div class="flex items-start justify-between gap-2">
                <div>
                  <p class="text-[10px] text-lime-400/80 uppercase tracking-widest">Revenue protected</p>
                  <p class="text-xl font-bold text-lime-400 mt-0.5">{{ formatCurrency(roi.scaleRevenue) }}</p>
                </div>
                <div class="h-8 w-8 rounded-lg bg-lime-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <svg class="w-4 h-4 text-lime-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941"/>
                  </svg>
                </div>
              </div>
              <p class="text-xs text-white/55 mt-1.5">Revenue from {{ roi.scaleCount }} SCALE product{{ roi.scaleCount === 1 ? '' : 's' }} — maintain budget</p>
            </div>
            <!-- Distribution bar -->
            <div class="space-y-1.5">
              <p class="text-[10px] text-white/65 uppercase tracking-widest">Distribution</p>
              <div class="flex rounded-full overflow-hidden h-2 gap-px">
                <div v-if="roi.scaleCount" class="bg-lime-400 transition-all" :style="{ flex: roi.scaleCount }" :title="`${roi.scaleCount} Scale`"></div>
                <div v-if="roi.testCount"  class="bg-glow-400 transition-all"  :style="{ flex: roi.testCount  }" :title="`${roi.testCount} Test`"></div>
                <div v-if="roi.riskCount"  class="bg-violet-400 transition-all" :style="{ flex: roi.riskCount  }" :title="`${roi.riskCount} Risk`"></div>
                <div v-if="roi.killCount"  class="bg-ember-500 transition-all" :style="{ flex: roi.killCount  }" :title="`${roi.killCount} Kill`"></div>
              </div>
              <div class="flex flex-wrap gap-x-3 gap-y-1">
                <span v-if="roi.scaleCount" class="flex items-center gap-1 text-[10px] text-white/75"><span class="h-1.5 w-1.5 rounded-full bg-lime-400"></span>{{ roi.scaleCount }} Scale</span>
                <span v-if="roi.testCount"  class="flex items-center gap-1 text-[10px] text-white/75"><span class="h-1.5 w-1.5 rounded-full bg-glow-400"></span>{{ roi.testCount }} Test</span>
                <span v-if="roi.riskCount"  class="flex items-center gap-1 text-[10px] text-white/75"><span class="h-1.5 w-1.5 rounded-full bg-violet-400"></span>{{ roi.riskCount }} Risk</span>
                <span v-if="roi.killCount"  class="flex items-center gap-1 text-[10px] text-white/75"><span class="h-1.5 w-1.5 rounded-full bg-ember-500"></span>{{ roi.killCount }} Kill</span>
              </div>
            </div>
          </div>
          <div v-else class="text-center py-6 text-xs text-white/55">
            Sync your store to see ROI impact.
          </div>
        </div>

        <!-- Quick links -->
        <div class="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p class="text-xs text-white/75 uppercase tracking-widest mb-3">Quick access</p>
          <div class="grid grid-cols-2 gap-2">
            <NuxtLink v-for="link in quickLinks" :key="link.to" :to="link.to" class="flex items-center gap-2 rounded-xl bg-white/[0.04] border border-white/8 px-3 py-2.5 text-xs font-medium text-white/80 hover:text-white hover:bg-white/8 hover:border-white/15 transition-all">
              <svg class="w-3.5 h-3.5 flex-shrink-0" :style="{ color: link.color }" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" v-html="link.icon"></svg>
              {{ link.label }}
            </NuxtLink>
          </div>
        </div>

      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useGlobalFilters } from '~/composables/useGlobalFilters';

const { query, selectedRange } = useGlobalFilters();
const { public: { apiBase } } = useRuntimeConfig();
const { data, pending } = await useFetch(`${apiBase}/v1/dashboard`, {
  server: false,
  credentials: 'include',
  query
});

// ROI impact data
interface RoiData {
  killSpend: number; scaleRevenue: number;
  killCount: number; scaleCount: number;
  testCount: number; riskCount: number;
  totalSpend: number; totalRevenue: number;
}
const roi = ref<RoiData | null>(null);
const roiLoading = ref(true);

const CURRENCY_LOCALE: Record<string, string> = {
  NGN: 'en-NG', GBP: 'en-GB', EUR: 'de-DE', JPY: 'ja-JP',
  AUD: 'en-AU', CAD: 'en-CA', INR: 'en-IN', ZAR: 'en-ZA',
  GHS: 'en-GH', KES: 'sw-KE', EGP: 'ar-EG', MAD: 'ar-MA',
};
function formatCurrency(val: number): string {
  const cur = (data.value as any)?.currency ?? 'USD';
  const locale = CURRENCY_LOCALE[cur] ?? 'en-US';
  try {
    if (val >= 1_000_000) {
      return new Intl.NumberFormat(locale, { style: 'currency', currency: cur, notation: 'compact', maximumFractionDigits: 1 }).format(val);
    }
    if (val >= 1_000) {
      return new Intl.NumberFormat(locale, { style: 'currency', currency: cur, notation: 'compact', maximumFractionDigits: 1 }).format(val);
    }
    return new Intl.NumberFormat(locale, { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format(val);
  } catch {
    return `$${val.toLocaleString()}`;
  }
}

function fmtCurrency(val?: number, currency?: string): string {
  if (val == null) return '—';
  const cur = (currency ?? (data.value as any)?.currency ?? 'USD').toUpperCase();
  const locale = CURRENCY_LOCALE[cur] ?? 'en-US';
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency: cur, maximumFractionDigits: 2 }).format(val);
  } catch {
    return `${val.toFixed(2)} ${cur}`;
  }
}

async function fetchRoi() {
  roiLoading.value = true;
  try {
    const res = await $fetch<{ ok: boolean; roi: RoiData | null }>(
      `${apiBase}/v1/analytics/roi`,
      { credentials: 'include', query: { range: selectedRange.value } }
    );
    if (res?.ok) roi.value = res.roi;
  } catch {}
  roiLoading.value = false;
}

// Redirect to onboarding if no stores are connected
onMounted(async () => {
  fetchRoi();
  try {
    const res = await $fetch<{ ok: boolean; stores: any[] }>(`${apiBase}/v1/stores`, {
      credentials: 'include',
    });
    if (Array.isArray(res?.stores) && res.stores.length === 0) {
      navigateTo('/app/onboarding');
    }
  } catch { /* network error — leave user on dashboard */ }
});

watch(selectedRange, () => fetchRoi());

const dashboard = computed(() => data.value ?? {});
const hasData = computed(() => {
  const s: any = dashboard.value?.stats ?? {};
  const roas = s.roas?.value ?? '--';
  const blended = s.blendedRoas?.value ?? '--';
  const active = typeof s.activeSKUs?.value === 'number' ? s.activeSKUs.value : s.activeProducts?.value ?? 0;
  return roas !== '--' || blended !== '--' || (active ?? 0) > 0;
});

const stats = computed(() => {
  const s: any = dashboard.value?.stats ?? {};
  return {
    roas: s.roas ?? { value: '--', delta: '' },
    blendedRoas: s.blendedRoas ?? { value: '--', delta: '' },
    activeProducts: s.activeSKUs ?? s.activeProducts ?? { value: '--', detail: '' },
    inventoryRisk: s.inventoryRisk ?? { value: '--', detail: '' }
  };
});

const attribution = computed(() => {
  const a: any = dashboard.value?.attribution ?? {};
  return {
    topCategory: a.topCategory ?? '--',
    avgCtr: a.avgCtr ?? '--',
    conversionRate: a.conversionRate ?? '--'
  };
});

const aiGuidance = computed(() => dashboard.value?.aiGuidance ?? []);
const automation = computed(() => dashboard.value?.automation ?? { liveRules: [], recentActivity: [] });
const syncHealth = computed(() => dashboard.value?.syncHealth ?? null);
const syncSummaryDate = computed(() => {
  const dt = syncHealth.value?.metaSummary?.createdAt;
  if (!dt) return syncHealth.value?.lastSyncAt ? `Last sync: ${new Date(syncHealth.value.lastSyncAt).toLocaleString()}` : 'No sync yet';
  return `Meta sync: ${new Date(dt).toLocaleString()}`;
});

const statCards = computed(() => [
  { metric: 'roas', label: 'Meta ROAS', value: stats.value.roas.value, trend: stats.value.roas.delta || '+0%', trendLabel: 'vs last period', trendUp: true, icon: '<path stroke-linecap="round" stroke-linejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941"/>', iconBg: 'rgba(34,211,238,0.1)', iconColor: '#22d3ee' },
  { metric: 'roas', label: 'Blended ROAS', value: stats.value.blendedRoas?.value ?? '--', trend: stats.value.blendedRoas?.delta || 'All channels', trendLabel: '', trendUp: true, icon: '<path stroke-linecap="round" stroke-linejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5"/>', iconBg: 'rgba(132,204,22,0.1)', iconColor: '#84cc16' },
  { metric: 'score', label: 'Active SKUs', value: stats.value.activeProducts.value, trend: stats.value.activeProducts.detail || stats.value.activeProducts.delta || '', trendLabel: '', trendUp: true, icon: '<path stroke-linecap="round" stroke-linejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z"/>', iconBg: 'rgba(139,92,246,0.1)', iconColor: '#a78bfa' },
  { metric: 'category', label: 'Inventory Risk', value: stats.value.inventoryRisk.value, trend: stats.value.inventoryRisk.detail || stats.value.inventoryRisk.delta || '', trendLabel: '', trendUp: false, icon: '<path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z"/>', iconBg: 'rgba(249,115,22,0.1)', iconColor: '#f97316' },
]);

const chartData = computed(() => {
  const series = (dashboard.value as any)?.trend?.series;
  if (!Array.isArray(series)) return [];
  return series.map((point: any) => {
    if (typeof point === "number") return { h: point, label: "" };
    if (point && typeof point === "object") {
      const h = Number(point.value ?? point.h ?? 0);
      const label = typeof point.label === "string" ? point.label : "";
      return { h, label };
    }
    return { h: 0, label: "" };
  });
});

const chartLabels = computed(() => {
  const labels = (dashboard.value as any)?.trend?.labels;
  return Array.isArray(labels) ? labels : [];
});

const attributionRows = computed(() => [
  { metric: 'category', label: 'Top category', value: attribution.value.topCategory },
  { metric: 'ctr', label: 'Avg CTR', value: attribution.value.avgCtr },
  { metric: 'ctr', label: 'Conv. rate', value: attribution.value.conversionRate },
]);

const quickLinks = [
  { label: 'Products', to: '/app/products', color: '#84cc16', icon: '<path stroke-linecap="round" stroke-linejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z"/>' },
  { label: 'Audit Log', to: '/app/audit', color: '#f97316', icon: '<path stroke-linecap="round" stroke-linejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z"/>' },
  { label: 'Settings', to: '/app/settings', color: '#22d3ee', icon: '<path stroke-linecap="round" stroke-linejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z"/><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>' },
  { label: 'Onboarding', to: '/app/onboarding', color: '#a78bfa', icon: '<path stroke-linecap="round" stroke-linejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z"/>' },
];
</script>

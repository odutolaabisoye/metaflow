<template>
  <div class="performance-chart">

    <!-- Toggle pills — click to show/hide individual lines -->
    <div class="flex items-center gap-1 mb-2 flex-wrap">
      <button
        v-for="line in LINES"
        :key="line.key"
        @click="toggleLine(line.key)"
        class="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all duration-150"
        :class="activeLines.has(line.key)
          ? 'bg-white/10 text-white'
          : 'text-white/35 hover:text-white/55 hover:bg-white/5'"
        :title="line.hint"
      >
        <span
          class="h-1.5 w-1.5 rounded-full transition-colors"
          :style="activeLines.has(line.key)
            ? { background: line.color }
            : { background: 'rgba(255,255,255,0.2)' }"
        ></span>
        {{ line.label }}
      </button>

      <!-- Zoom pills -->
      <div v-if="showRangePills" class="ml-auto flex gap-0.5">
        <button
          v-for="r in visibleRanges"
          :key="r"
          @click="setRange(r)"
          class="rounded px-1.5 py-0.5 text-[10px] font-medium transition-all"
          :class="activeRange === r ? 'bg-white/10 text-white/80' : 'text-white/55 hover:text-white/75'"
        >{{ r }}</button>
      </div>
    </div>

    <!-- ── Values bar ───────────────────────────────────────────────────────────
         Shows date + all active metric values at the hovered/pinned point.
         Replaces a floating tooltip — never gets clipped by overflow.
         Click any point on the chart to pin; click again or press Esc to unpin.
    -->
    <div class="mb-2 h-[38px] flex items-center">
      <Transition name="valbar">
        <div
          v-if="activeIdx >= 0 && slicedData.length > 0"
          key="active"
          class="w-full flex items-center gap-3 rounded-lg bg-white/[0.04] border border-white/8 px-3 py-1.5"
        >
          <!-- Date -->
          <span class="text-[10px] font-mono text-white/45 shrink-0">
            {{ slicedData[activeIdx]?.dateLabel }}
          </span>
          <!-- Divider -->
          <span class="h-3 w-px bg-white/10 shrink-0"></span>
          <!-- One value per active line -->
          <div class="flex items-center gap-3 flex-1 flex-wrap">
            <div
              v-for="lp in linePoints"
              :key="'val-' + lp.key"
              class="flex items-center gap-1.5"
            >
              <span class="h-1.5 w-1.5 rounded-full shrink-0" :style="{ background: lp.color }"></span>
              <span class="text-[11px] font-mono font-semibold" :style="{ color: lp.color }">
                {{ formatVal(activeIdx, lp.key, lp.unit) }}
              </span>
            </div>
          </div>
          <!-- Pin indicator -->
          <span
            v-if="pinnedIdx >= 0"
            class="text-[9px] text-white/30 shrink-0 cursor-pointer hover:text-white/60 transition-colors"
            @click.stop="pinnedIdx = -1"
            title="Click to unpin"
          >✕ unpin</span>
        </div>
        <!-- Placeholder so the bar height is reserved even when idle -->
        <div v-else key="idle" class="w-full flex items-center px-3 py-1.5">
          <span class="text-[10px] text-white/20">Hover or click the chart to inspect a date</span>
        </div>
      </Transition>
    </div>

    <!-- Chart area — hover updates values bar, click pins it -->
    <div
      class="relative select-none cursor-crosshair"
      ref="chartEl"
      @mousemove="onMouseMove"
      @mouseleave="onMouseLeave"
      @click="onClick"
    >
      <svg
        :viewBox="`0 0 ${W} ${H}`"
        preserveAspectRatio="none"
        class="w-full overflow-visible"
        :style="{ height: H + 'px' }"
      >
        <defs>
          <linearGradient
            v-for="line in activeLineConfigs"
            :key="'grad-' + line.key"
            :id="gradId(line.key)"
            x1="0" y1="0" x2="0" y2="1"
          >
            <stop offset="0%"   :stop-color="line.color" :stop-opacity="singleLineActive ? 0.20 : 0.08" />
            <stop offset="100%" :stop-color="line.color" stop-opacity="0" />
          </linearGradient>
        </defs>

        <!-- Grid lines -->
        <line
          v-for="(_, i) in 4"
          :key="i"
          :x1="PAD_L"
          :y1="PAD_T + (chartH / 3) * i"
          :x2="W - PAD_R"
          :y2="PAD_T + (chartH / 3) * i"
          stroke="rgba(255,255,255,0.055)"
          stroke-width="1"
        />

        <!-- Area fill — only when single line -->
        <path
          v-if="singleLineActive && linePoints[0]?.points.length > 1"
          :d="areaPath(linePoints[0].points)"
          :fill="`url(#${gradId(linePoints[0].key)})`"
        />

        <!-- Lines -->
        <template v-for="lp in linePoints" :key="'line-' + lp.key">
          <path
            v-if="lp.points.length > 1"
            :d="smoothPath(lp.points)"
            fill="none"
            :stroke="lp.color"
            :stroke-width="singleLineActive ? 1.75 : 1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <circle
            v-if="lp.points.length === 1"
            :cx="lp.points[0].x"
            :cy="lp.points[0].y"
            r="4"
            :fill="lp.color"
          />
        </template>

        <!-- Crosshair + dots at active index -->
        <template v-if="activeIdx >= 0 && activeIdx < slicedData.length">
          <!-- Vertical crosshair line -->
          <line
            :x1="hoverX"
            :y1="PAD_T"
            :x2="hoverX"
            :y2="PAD_T + chartH"
            :stroke="pinnedIdx >= 0 ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.12)'"
            stroke-width="1"
            :stroke-dasharray="pinnedIdx >= 0 ? '' : '3 3'"
          />
          <!-- Dot per line at the active point — v-for and v-if on SEPARATE elements
               (Vue 3: v-if has higher priority than v-for on the same element,
               so lp would be undefined when v-if is evaluated — split them) -->
          <template v-for="lp in linePoints" :key="'dot-' + lp.key">
            <circle
              v-if="activeIdx < lp.points.length"
              :cx="lp.points[activeIdx].x"
              :cy="lp.points[activeIdx].y"
              :r="pinnedIdx >= 0 ? 4.5 : 3.5"
              :fill="lp.color"
              stroke="#0e121a"
              :stroke-width="pinnedIdx >= 0 ? 2.5 : 2"
            />
          </template>
        </template>

        <!-- X-axis date labels -->
        <text
          v-for="label in xLabels"
          :key="label.idx"
          :x="label.x"
          :y="H - 2"
          text-anchor="middle"
          fill="rgba(255,255,255,0.25)"
          font-size="9"
          font-family="ui-monospace, monospace"
        >{{ label.text }}</text>
      </svg>

      <!-- Y-axis value labels (right side, absolute) -->
      <div
        class="absolute right-0 top-0 flex flex-col justify-between pointer-events-none"
        :style="{ height: (PAD_T + chartH) + 'px', top: PAD_T + 'px' }"
      >
        <span class="text-[9px] font-mono text-white/40 leading-none">{{ formatY(yScale.max) }}</span>
        <span class="text-[9px] font-mono text-white/40 leading-none">{{ formatY(yScale.mid) }}</span>
        <span class="text-[9px] font-mono text-white/40 leading-none">{{ formatY(yScale.min) }}</span>
      </div>
    </div>

    <!-- Mixed-unit notice — shown when money + ROAS lines are both active -->
    <p v-if="mixedUnits" class="mt-1 text-[9px] text-white/30 text-center">
      Lines normalised to their own range when mixing revenue + ROAS scales
    </p>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, getCurrentInstance } from 'vue'
import { useEventListener } from '@vueuse/core'

export interface HistoryPoint {
  date: string
  revenue: number       // WooCommerce store revenue
  metaRevenue: number   // Meta omni_purchase-attributed revenue
  blendedRoas: number   // store revenue / Meta spend
  roas: number          // Meta ROAS (kept for compat)
  spend: number
}

type LineKey  = 'revenue' | 'metaRevenue' | 'blendedRoas' | 'spend'
type LineUnit = 'money' | 'roas'

interface LineConfig {
  key:   LineKey
  label: string
  color: string
  unit:  LineUnit
  hint:  string
}

const LINES: LineConfig[] = [
  {
    key:   'revenue',
    label: 'Store Rev',
    color: '#a3e635',
    unit:  'money',
    hint:  'Actual WooCommerce revenue for this product',
  },
  {
    key:   'metaRevenue',
    label: 'Meta Rev',
    color: '#38bdf8',
    unit:  'money',
    hint:  'Revenue Meta attributes via omni_purchase (their attribution model)',
  },
  {
    key:   'blendedRoas',
    label: 'ROAS',
    color: '#fbbf24',
    unit:  'roas',
    hint:  'Blended ROAS = store revenue ÷ ad spend (most honest metric)',
  },
  {
    key:   'spend',
    label: 'Spend',
    color: '#fb923c',
    unit:  'money',
    hint:  'Meta ad spend for this product',
  },
]

const props = defineProps<{
  data:        HistoryPoint[]
  currency?:   string
  rangeStart?: string
  rangeEnd?:   string
}>()

const emit = defineEmits<{ rangeChange: [range: string] }>()

// ─── Chart geometry ───────────────────────────────────────────────────────────
const W      = 432
const H      = 156
const PAD_T  = 8
const PAD_B  = 22
const PAD_L  = 4
const PAD_R  = 40
const chartH = H - PAD_T - PAD_B
const chartW = W - PAD_L - PAD_R

// ─── Active lines (multi-select, min 1) ──────────────────────────────────────
const activeLines = ref<Set<LineKey>>(new Set(['revenue', 'metaRevenue']))

function toggleLine(key: LineKey) {
  const next = new Set(activeLines.value)
  if (next.has(key)) {
    if (next.size > 1) next.delete(key)
  } else {
    next.add(key)
  }
  activeLines.value = next
}

const activeLineConfigs = computed(() => LINES.filter(l => activeLines.value.has(l.key)))
const singleLineActive  = computed(() => activeLines.value.size === 1)

// ─── Hover + click (pin) state ────────────────────────────────────────────────
const hoveredIdx = ref(-1)  // follows mouse
const pinnedIdx  = ref(-1)  // locked by click until dismissed

// What we actually display — pinned takes priority over hovered
const activeIdx = computed(() =>
  pinnedIdx.value >= 0 ? pinnedIdx.value : hoveredIdx.value
)

// ─── Range pills ──────────────────────────────────────────────────────────────
const RANGES = ['7D', '14D', '30D'] as const
type RangeKey = (typeof RANGES)[number]

const activeRange = ref<RangeKey>('30D')
const chartEl     = ref<HTMLDivElement | null>(null)

const rangeDays = computed(() => {
  if (!props.rangeStart || !props.rangeEnd) return 30
  const s = new Date(props.rangeStart + 'T00:00:00')
  const e = new Date(props.rangeEnd   + 'T00:00:00')
  return Math.max(1, Math.round((e.getTime() - s.getTime()) / 86_400_000) + 1)
})

const showRangePills = computed(() => rangeDays.value > 14)
const visibleRanges  = computed(() => {
  const rd = rangeDays.value
  return RANGES.filter(r => (r === '7D' ? 7 : r === '14D' ? 14 : 30) < rd)
})

watch(
  () => [props.rangeStart, props.rangeEnd],
  () => {
    const rd = rangeDays.value
    activeRange.value = rd <= 7 ? '7D' : rd <= 14 ? '14D' : '30D'
    pinnedIdx.value   = -1   // clear pin when date range changes
  },
  { immediate: true }
)

// Also clear pin when data changes (new product opened)
watch(() => props.data, () => { pinnedIdx.value = -1 })

function setRange(r: RangeKey) {
  activeRange.value = r
  pinnedIdx.value   = -1
  emit('rangeChange', r)
}

// ─── Currency helpers ─────────────────────────────────────────────────────────
const CURRENCY_LOCALE: Record<string, string> = {
  NGN: 'en-NG', GBP: 'en-GB', EUR: 'de-DE', JPY: 'ja-JP',
  AUD: 'en-AU', CAD: 'en-CA', INR: 'en-IN', ZAR: 'en-ZA',
  GHS: 'en-GH', KES: 'sw-KE',
}
const activeCurrency = computed(() => props.currency ?? 'USD')
const currencyLocale = computed(() => CURRENCY_LOCALE[activeCurrency.value] ?? 'en-US')

const formatMoney = (v: number) => new Intl.NumberFormat(currencyLocale.value, {
  style: 'currency', currency: activeCurrency.value, maximumFractionDigits: 0,
}).format(v)

const currencySymbol = computed(() => {
  const parts = new Intl.NumberFormat(currencyLocale.value, {
    style: 'currency', currency: activeCurrency.value,
  }).formatToParts(0)
  return parts.find(p => p.type === 'currency')?.value ?? ''
})

// SSR-safe unique ID per component instance.
// getCurrentInstance().uid is a stable integer assigned by Vue at component creation
// — the same value is used on both server and client for the same instance,
// so SVG gradient IDs stay consistent across SSR hydration.
const uid    = String(getCurrentInstance()?.uid ?? 'c')
const gradId = (key: string) => `pg-${uid}-${key}`

// ─── Date helpers ─────────────────────────────────────────────────────────────
function toDateStr(d: string) { return d.slice(0, 10) }

function dateLabel(dateStr: string) {
  const [y, m, d] = toDateStr(dateStr).split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ─── Data filtering ───────────────────────────────────────────────────────────
const slicedData = computed<(HistoryPoint & { dateLabel: string })[]>(() => {
  let raw = [...props.data]

  if (props.rangeStart && props.rangeEnd) {
    raw = raw.filter(d => {
      const ds = toDateStr(d.date)
      return ds >= props.rangeStart! && ds <= props.rangeEnd!
    })
  }

  if (showRangePills.value) {
    const pillDays = activeRange.value === '7D' ? 7 : activeRange.value === '14D' ? 14 : 30
    if (raw.length > pillDays) raw = raw.slice(-pillDays)
  }

  return raw.map(d => ({ ...d, dateLabel: dateLabel(d.date) }))
})

// ─── Y-axis scales ────────────────────────────────────────────────────────────
const hasMoneyActive = computed(() =>
  (['revenue', 'metaRevenue', 'spend'] as LineKey[]).some(k => activeLines.value.has(k))
)
const hasRoasActive = computed(() => activeLines.value.has('blendedRoas'))
const mixedUnits    = computed(() => hasMoneyActive.value && hasRoasActive.value)

const moneyScale = computed(() => {
  const keys = (['revenue', 'metaRevenue', 'spend'] as LineKey[]).filter(k => activeLines.value.has(k))
  if (!keys.length || !slicedData.value.length) return { min: 0, max: 1, range: 1, mid: 0.5 }
  // Guard: Math.min/max(...[]) = Infinity/-Infinity — filter to finite values
  const all = slicedData.value.flatMap(d => keys.map(k => d[k] as number)).filter(v => isFinite(v))
  if (!all.length) return { min: 0, max: 1, range: 1, mid: 0.5 }
  const min = Math.max(0, Math.min(...all) * 0.88)
  const max = Math.max(...all, 0) * 1.08 || 1
  const range = max - min || 1
  return { min, max, range, mid: (min + max) / 2 }
})

const roasScale = computed(() => {
  if (!slicedData.value.length) return { min: 0, max: 1, range: 1, mid: 0.5 }
  const vals = slicedData.value.map(d => d.blendedRoas).filter(v => isFinite(v))
  if (!vals.length) return { min: 0, max: 1, range: 1, mid: 0.5 }
  const min  = Math.max(0, Math.min(...vals) * 0.88)
  const max  = Math.max(...vals, 0) * 1.08 || 1
  const range = max - min || 1
  return { min, max, range, mid: (min + max) / 2 }
})

const yScale = computed(() => hasMoneyActive.value ? moneyScale.value : roasScale.value)

function getYPos(value: number, unit: LineUnit): number {
  const scale = mixedUnits.value
    ? (unit === 'money' ? moneyScale.value : roasScale.value)
    : yScale.value
  const clamped = Math.max(scale.min, Math.min(scale.max, value))
  return PAD_T + chartH - ((clamped - scale.min) / scale.range) * chartH
}

// ─── SVG paths ────────────────────────────────────────────────────────────────
const linePoints = computed(() =>
  activeLineConfigs.value.map(cfg => ({
    ...cfg,
    points: slicedData.value.map((d, i) => ({
      x: PAD_L + (i / Math.max(slicedData.value.length - 1, 1)) * chartW,
      y: getYPos(d[cfg.key] as number, cfg.unit),
    })),
  }))
)

const hoverX = computed(() =>
  linePoints.value[0]?.points[activeIdx.value]?.x ?? 0
)

function smoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return ''
  if (pts.length === 2) return `M ${pts[0].x} ${pts[0].y} L ${pts[1].x} ${pts[1].y}`
  let d = `M ${pts[0].x} ${pts[0].y}`
  for (let i = 1; i < pts.length; i++) {
    const p0 = pts[i - 2] ?? pts[i - 1]
    const p1 = pts[i - 1]
    const p2 = pts[i]
    const p3 = pts[i + 1] ?? pts[i]
    const cp1x = p1.x + (p2.x - p0.x) / 6, cp1y = p1.y + (p2.y - p0.y) / 6
    const cp2x = p2.x - (p3.x - p1.x) / 6, cp2y = p2.y - (p3.y - p1.y) / 6
    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`
  }
  return d
}

function areaPath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return ''
  const bottom = PAD_T + chartH
  return `${smoothPath(pts)} L ${pts.at(-1)!.x} ${bottom} L ${pts[0].x} ${bottom} Z`
}

// ─── X-axis labels ────────────────────────────────────────────────────────────
const xLabels = computed(() => {
  const data  = slicedData.value
  if (data.length < 2) return []
  const count = Math.min(5, data.length)
  return Array.from({ length: count }, (_, i) => {
    const idx = Math.round((i / (count - 1)) * (data.length - 1))
    return {
      idx,
      x:    PAD_L + (idx / Math.max(data.length - 1, 1)) * chartW,
      text: data[idx]?.dateLabel ?? '',
    }
  })
})

// ─── Y-axis formatting ────────────────────────────────────────────────────────
const formatY = (v: number) => {
  if (!hasMoneyActive.value && hasRoasActive.value) return `${v.toFixed(1)}×`
  const sym = currencySymbol.value
  if (v >= 1_000_000) return `${sym}${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000)     return `${sym}${(v / 1_000).toFixed(0)}k`
  return `${sym}${Math.round(v)}`
}

// ─── Values bar formatting ────────────────────────────────────────────────────
function formatVal(idx: number, key: LineKey, unit: LineUnit): string {
  if (idx < 0 || idx >= slicedData.value.length) return '—'
  const v = slicedData.value[idx][key] as number
  if (unit === 'roas') return `${v.toFixed(2)}×`
  return formatMoney(v)
}

// ─── Mouse / touch interaction ────────────────────────────────────────────────
function getIdxFromEvent(e: MouseEvent): number {
  if (!chartEl.value || !linePoints.value.length || !slicedData.value.length) return -1
  const rect  = chartEl.value.getBoundingClientRect()
  const scale = rect.width / W
  const svgX  = (e.clientX - rect.left) / scale
  const pts   = linePoints.value[0]?.points
  if (!pts?.length) return -1
  let closest = 0, minDist = Infinity
  pts.forEach((pt, i) => {
    const dist = Math.abs(pt.x - svgX)
    if (dist < minDist) { minDist = dist; closest = i }
  })
  return closest
}

function onMouseMove(e: MouseEvent) {
  hoveredIdx.value = getIdxFromEvent(e)
}

function onMouseLeave() {
  hoveredIdx.value = -1
  // Don't clear pinnedIdx — pinned persists until explicitly dismissed
}

function onClick(e: MouseEvent) {
  const idx = getIdxFromEvent(e)
  if (idx < 0) return
  // Clicking the already-pinned index unpins; clicking a new index pins it
  pinnedIdx.value = pinnedIdx.value === idx ? -1 : idx
}

// Escape key to unpin — useEventListener from @vueuse/core is SSR-safe (no window check needed)
useEventListener('keydown', (e: KeyboardEvent) => {
  if (e.key === 'Escape') pinnedIdx.value = -1
})
</script>

<style scoped>
.valbar-enter-active,
.valbar-leave-active {
  transition: opacity 0.15s ease;
}
.valbar-enter-from,
.valbar-leave-to {
  opacity: 0;
}
</style>

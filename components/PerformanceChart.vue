<template>
  <div class="performance-chart">
    <!-- Tab switcher -->
    <div class="flex items-center gap-1 mb-3">
      <button
        v-for="tab in TABS"
        :key="tab.key"
        @click="activeTab = tab.key"
        class="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all duration-150"
        :class="activeTab === tab.key
          ? 'bg-white/10 text-white'
          : 'text-white/65 hover:text-white/65 hover:bg-white/5'"
      >
        <span class="h-1.5 w-1.5 rounded-full" :class="tab.dot"></span>
        {{ tab.label }}
      </button>

      <!-- Range pills — only shown when range is wide enough to zoom into -->
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

    <!-- Chart area -->
    <div
      class="relative select-none"
      ref="chartEl"
      @mousemove="onMouseMove"
      @mouseleave="hoveredIdx = -1"
    >
      <svg
        :viewBox="`0 0 ${W} ${H}`"
        preserveAspectRatio="none"
        class="w-full overflow-visible"
        :style="{ height: H + 'px' }"
      >
        <defs>
          <linearGradient :id="gradId" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" :stop-color="activeColor" :stop-opacity="0.22" />
            <stop offset="100%" :stop-color="activeColor" stop-opacity="0" />
          </linearGradient>
        </defs>

        <!-- Horizontal grid lines -->
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

        <!-- Area fill -->
        <path
          v-if="slicedPoints.length > 1"
          :d="areaPath"
          :fill="`url(#${gradId})`"
        />

        <!-- Line -->
        <path
          v-if="slicedPoints.length > 1"
          :d="linePath"
          fill="none"
          :stroke="activeColor"
          stroke-width="1.75"
          stroke-linecap="round"
          stroke-linejoin="round"
        />

        <!-- Single-point dot (when range is "today" / one day) -->
        <circle
          v-if="slicedPoints.length === 1"
          :cx="slicedPoints[0].x"
          :cy="slicedPoints[0].y"
          r="4"
          :fill="activeColor"
        />

        <!-- Hover crosshair -->
        <template v-if="hoveredIdx >= 0 && hoveredIdx < slicedPoints.length">
          <line
            :x1="slicedPoints[hoveredIdx].x"
            :y1="PAD_T"
            :x2="slicedPoints[hoveredIdx].x"
            :y2="PAD_T + chartH"
            stroke="rgba(255,255,255,0.12)"
            stroke-width="1"
            stroke-dasharray="3 3"
          />
          <circle
            :cx="slicedPoints[hoveredIdx].x"
            :cy="slicedPoints[hoveredIdx].y"
            r="4"
            :fill="activeColor"
            stroke="#0e121a"
            stroke-width="2"
          />
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

      <!-- Y-axis value range (right-aligned, absolute) -->
      <div class="absolute right-0 top-0 flex flex-col justify-between pointer-events-none" :style="{ height: (PAD_T + chartH) + 'px', top: PAD_T + 'px' }">
        <span class="text-[9px] font-mono text-white/50 leading-none">{{ formatY(yMax) }}</span>
        <span class="text-[9px] font-mono text-white/50 leading-none">{{ formatY(yMid) }}</span>
        <span class="text-[9px] font-mono text-white/50 leading-none">{{ formatY(yMin) }}</span>
      </div>

      <!-- Hover tooltip -->
      <Transition name="chart-tip">
        <div
          v-if="hoveredIdx >= 0 && hoveredIdx < slicedPoints.length"
          class="absolute z-10 pointer-events-none px-2.5 py-1.5 rounded-lg bg-ink-900 border border-white/12 shadow-xl text-xs"
          :style="tooltipStyle"
        >
          <p class="text-white/70 mb-0.5 font-mono">{{ slicedData[hoveredIdx]?.dateLabel }}</p>
          <p class="font-semibold" :class="activeColorClass">{{ tooltipValue }}</p>
        </div>
      </Transition>
    </div>
  </div>
</template>

<script setup lang="ts">
export interface HistoryPoint {
  date: string       // ISO "YYYY-MM-DD" or "YYYY-MM-DDTHH:mm:ss.sssZ"
  revenue: number
  roas: number
  spend: number
}

const props = defineProps<{
  data: HistoryPoint[]
  currency?: string
  /** ISO date string (YYYY-MM-DD) — filter chart to start from this date */
  rangeStart?: string
  /** ISO date string (YYYY-MM-DD) — filter chart to end at this date */
  rangeEnd?: string
}>()

const emit = defineEmits<{
  rangeChange: [range: string]
}>()

// ─── Chart geometry ───────────────────────────────────────────────────────────
const W = 432
const H = 156
const PAD_T = 8
const PAD_B = 22
const PAD_L = 4
const PAD_R = 40  // room for y-axis labels
const chartH = H - PAD_T - PAD_B
const chartW = W - PAD_L - PAD_R

const TABS = [
  { key: 'revenue', label: 'Revenue', dot: 'bg-lime-400' },
  { key: 'roas',    label: 'ROAS',    dot: 'bg-amber-400' },
  { key: 'spend',   label: 'Spend',   dot: 'bg-orange-400' },
] as const

const RANGES = ['7D', '14D', '30D'] as const
type RangeKey = (typeof RANGES)[number]
type TabKey = (typeof TABS)[number]['key']

const activeTab   = ref<TabKey>('revenue')
const activeRange = ref<RangeKey>('30D')
const hoveredIdx  = ref(-1)
const chartEl     = ref<HTMLDivElement | null>(null)

// ─── Range width from parent props ────────────────────────────────────────────
/** Number of calendar days in the global date range. */
const rangeDays = computed(() => {
  if (!props.rangeStart || !props.rangeEnd) return 30
  const s = new Date(props.rangeStart + 'T00:00:00')
  const e = new Date(props.rangeEnd   + 'T00:00:00')
  return Math.max(1, Math.round((e.getTime() - s.getTime()) / 86_400_000) + 1)
})

/**
 * Zoom pills are only meaningful when the range is wide enough to zoom.
 * For today/yesterday/7d, hiding pills avoids confusing "7D inside 1 day" UX.
 */
const showRangePills = computed(() => rangeDays.value > 14)

/** Only show zoom pills narrower than the current global range. */
const visibleRanges = computed(() => {
  const rd = rangeDays.value
  return RANGES.filter(r => {
    const d = r === '7D' ? 7 : r === '14D' ? 14 : 30
    return d < rd
  })
})

/** Auto-select the largest zoom pill that fits the global range. */
watch(
  () => [props.rangeStart, props.rangeEnd],
  () => {
    const rd = rangeDays.value
    if (rd <= 7)       activeRange.value = '7D'
    else if (rd <= 14) activeRange.value = '14D'
    else               activeRange.value = '30D'
  },
  { immediate: true }
)

function setRange(r: RangeKey) {
  activeRange.value = r
  emit('rangeChange', r)
}

// Currency locale map for native symbols (e.g. NGN → ₦)
const CURRENCY_LOCALE: Record<string, string> = {
  NGN: 'en-NG', GBP: 'en-GB', EUR: 'de-DE', JPY: 'ja-JP',
  AUD: 'en-AU', CAD: 'en-CA', INR: 'en-IN', ZAR: 'en-ZA',
  GHS: 'en-GH', KES: 'sw-KE',
}
const activeCurrency  = computed(() => props.currency ?? 'USD')
const currencyLocale  = computed(() => CURRENCY_LOCALE[activeCurrency.value] ?? 'en-US')

// Unique gradient ID per component instance (avoids collisions with multiple sidekick instances)
const uid    = Math.random().toString(36).slice(2, 7)
const gradId = computed(() => `pg-${uid}-${activeTab.value}`)

// ─── Colors ───────────────────────────────────────────────────────────────────
const activeColor = computed(() => {
  if (activeTab.value === 'revenue') return '#a3e635'   // lime-400
  if (activeTab.value === 'roas')    return '#fbbf24'   // amber-400
  return '#fb923c'                                       // orange-400 (spend)
})

const activeColorClass = computed(() => {
  if (activeTab.value === 'revenue') return 'text-lime-400'
  if (activeTab.value === 'roas')    return 'text-amber-400'
  return 'text-orange-400'
})

// ─── Date helpers ─────────────────────────────────────────────────────────────
/** Extract YYYY-MM-DD from any date string (strips time/zone portion). */
function toDateStr(d: string): string {
  return d.slice(0, 10)
}

/** Format YYYY-MM-DD as "Mar 5" using local date (avoids UTC off-by-one). */
function dateLabel(dateStr: string): string {
  const s = toDateStr(dateStr)
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ─── Data filtering ───────────────────────────────────────────────────────────
/**
 * 1. Filter data to the parent-provided global date window (rangeStart…rangeEnd).
 * 2. Then apply the zoom pill (7D/14D/30D) if the window is wide enough.
 */
const slicedData = computed<(HistoryPoint & { dateLabel: string })[]>(() => {
  let raw = [...props.data]

  // Step 1: Date range filter (respects global date picker)
  if (props.rangeStart && props.rangeEnd) {
    raw = raw.filter(d => {
      const ds = toDateStr(d.date)
      return ds >= props.rangeStart! && ds <= props.rangeEnd!
    })
  }

  // Step 2: Zoom pill — only applied when range is wider than the pill
  if (showRangePills.value) {
    const pillDays = activeRange.value === '7D' ? 7 : activeRange.value === '14D' ? 14 : 30
    if (raw.length > pillDays) {
      raw = raw.slice(-pillDays)
    }
  }

  return raw.map(d => ({ ...d, dateLabel: dateLabel(d.date) }))
})

// ─── Numeric values for active tab ───────────────────────────────────────────
const values = computed(() => slicedData.value.map(d => d[activeTab.value] as number))

const yMin = computed(() => {
  const min = Math.min(...values.value)
  return Math.max(0, min * 0.88)
})
const yMax = computed(() => {
  const max = Math.max(...values.value, 0)
  return max * 1.08 || 1
})
const yMid   = computed(() => (yMin.value + yMax.value) / 2)
const yRange = computed(() => yMax.value - yMin.value || 1)

// ─── SVG point computation ────────────────────────────────────────────────────
const slicedPoints = computed(() => {
  const n = Math.max(values.value.length - 1, 1)
  return values.value.map((v, i) => ({
    x: PAD_L + (i / n) * chartW,
    y: PAD_T + chartH - ((v - yMin.value) / yRange.value) * chartH,
  }))
})

// Smooth bezier path using Catmull-Rom → Bezier conversion
function smoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return ''
  if (pts.length === 2) {
    return `M ${pts[0].x} ${pts[0].y} L ${pts[1].x} ${pts[1].y}`
  }

  let d = `M ${pts[0].x} ${pts[0].y}`
  for (let i = 1; i < pts.length; i++) {
    const p0 = pts[i - 2] ?? pts[i - 1]
    const p1 = pts[i - 1]
    const p2 = pts[i]
    const p3 = pts[i + 1] ?? pts[i]

    const cp1x = p1.x + (p2.x - p0.x) / 6
    const cp1y = p1.y + (p2.y - p0.y) / 6
    const cp2x = p2.x - (p3.x - p1.x) / 6
    const cp2y = p2.y - (p3.y - p1.y) / 6

    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`
  }
  return d
}

const linePath = computed(() => smoothPath(slicedPoints.value))

const areaPath = computed(() => {
  if (slicedPoints.value.length < 2) return ''
  const bottom = PAD_T + chartH
  const last  = slicedPoints.value[slicedPoints.value.length - 1]
  const first = slicedPoints.value[0]
  return `${linePath.value} L ${last.x} ${bottom} L ${first.x} ${bottom} Z`
})

// ─── X-axis labels (5 evenly spaced) ─────────────────────────────────────────
const xLabels = computed(() => {
  const data = slicedData.value
  if (data.length < 2) return []
  const count = Math.min(5, data.length)
  return Array.from({ length: count }, (_, i) => {
    const idx = Math.round((i / (count - 1)) * (data.length - 1))
    return {
      idx,
      x: PAD_L + (idx / Math.max(data.length - 1, 1)) * chartW,
      text: data[idx]?.dateLabel ?? ''
    }
  })
})

// ─── Y-axis formatting ────────────────────────────────────────────────────────
const formatMoney = (v: number) => new Intl.NumberFormat(currencyLocale.value, {
  style: 'currency', currency: activeCurrency.value, maximumFractionDigits: 0
}).format(v)

// Extract just the currency symbol (e.g. "₦" for NGN, "$" for USD)
const currencySymbol = computed(() => {
  const parts = new Intl.NumberFormat(currencyLocale.value, {
    style: 'currency', currency: activeCurrency.value
  }).formatToParts(0)
  return parts.find(p => p.type === 'currency')?.value ?? ''
})

const formatY = (v: number) => {
  if (activeTab.value === 'roas') return `${v.toFixed(1)}×`
  const sym = currencySymbol.value
  if (v >= 1_000_000) return `${sym}${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000)     return `${sym}${(v / 1_000).toFixed(0)}k`
  return `${sym}${Math.round(v)}`
}

// ─── Tooltip ──────────────────────────────────────────────────────────────────
const tooltipValue = computed(() => {
  if (hoveredIdx.value < 0 || hoveredIdx.value >= slicedData.value.length) return ''
  const v = slicedData.value[hoveredIdx.value][activeTab.value] as number
  if (activeTab.value === 'roas') return `${v.toFixed(2)}×`
  return formatMoney(v)
})

const tooltipStyle = computed(() => {
  if (hoveredIdx.value < 0 || hoveredIdx.value >= slicedPoints.value.length) return {}
  const pt   = slicedPoints.value[hoveredIdx.value]
  const svgW = chartEl.value?.clientWidth ?? W
  const scale = svgW / W
  const px   = pt.x * scale
  const py   = pt.y * scale
  const tipW = 96
  const left = Math.min(px - tipW / 2, svgW - tipW - 4)
  return {
    left: Math.max(0, left) + 'px',
    top:  Math.max(0, py - 52) + 'px',
  }
})

// ─── Mouse interaction ────────────────────────────────────────────────────────
function onMouseMove(e: MouseEvent) {
  if (!chartEl.value || slicedPoints.value.length === 0) return
  const rect  = chartEl.value.getBoundingClientRect()
  const svgW  = rect.width
  const scale = svgW / W
  const localX = e.clientX - rect.left
  const svgX   = localX / scale

  let closest = 0
  let minDist = Infinity
  slicedPoints.value.forEach((pt, i) => {
    const dist = Math.abs(pt.x - svgX)
    if (dist < minDist) { minDist = dist; closest = i }
  })
  hoveredIdx.value = closest
}
</script>

<style scoped>
.chart-tip-enter-active,
.chart-tip-leave-active {
  transition: opacity 0.1s ease;
}
.chart-tip-enter-from,
.chart-tip-leave-to {
  opacity: 0;
}
</style>

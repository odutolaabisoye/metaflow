<template>
  <div class="space-y-6">

    <!-- Page Header -->
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p class="text-[11px] uppercase tracking-widest text-white/40 mb-1">Catalog Intelligence</p>
        <div class="flex items-center gap-3">
          <h1 class="text-2xl font-semibold tracking-tight">Products</h1>
          <span v-if="!pending" class="rounded-full bg-white/[0.08] border border-white/10 px-2.5 py-0.5 text-xs font-medium text-white/60">
            {{ total.toLocaleString() }} SKUs
          </span>
        </div>
        <p class="mt-1 text-sm text-white/50">{{ rangeLabel }} · scored daily by ROAS, CTR, margin &amp; inventory</p>
      </div>
      <div class="flex items-center gap-2.5">
        <button
          @click="triggerSync"
          class="flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white transition-all"
        >
          <svg class="w-4 h-4" :class="syncing ? 'animate-spin' : ''" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"/>
          </svg>
          {{ syncing ? 'Syncing…' : 'Sync now' }}
        </button>
        <button
          @click="exportCsv"
          class="flex items-center gap-2 rounded-xl bg-white text-ink-950 px-4 py-2.5 text-sm font-semibold hover:bg-white/90 transition-all"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"/>
          </svg>
          Export CSV
        </button>
      </div>
    </div>

    <!-- Filters Bar -->
    <div class="glass rounded-2xl p-4 flex flex-wrap items-center gap-3">
      <!-- Search -->
      <div class="relative flex-1 min-w-[200px] max-w-xs">
        <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"/>
        </svg>
        <input
          v-model="search"
          type="search"
          placeholder="Search product or SKU…"
          class="w-full rounded-xl border border-white/10 bg-white/[0.06] pl-9 pr-4 py-2.5 text-sm text-white placeholder:text-white/30 outline-none focus:border-glow-500/40 focus:ring-2 focus:ring-glow-500/15 transition-all"
        />
      </div>

      <!-- Divider -->
      <div class="h-6 w-px bg-white/10 hidden sm:block"></div>

      <!-- Category filter pills -->
      <div class="flex items-center gap-1.5">
        <button
          v-for="cat in categories"
          :key="cat.value"
          @click="filter = cat.value"
          class="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all"
          :class="filter === cat.value
            ? 'bg-white/15 text-white border border-white/20'
            : 'text-white/55 hover:text-white/80 border border-transparent'"
        >
          <span v-if="cat.dot" class="h-1.5 w-1.5 rounded-full" :class="cat.dot"></span>
          {{ cat.label }}
        </button>
      </div>

      <!-- Spacer -->
      <div class="flex-1 hidden sm:block"></div>

      <!-- Sort controls -->
      <div class="flex items-center gap-2">
        <span class="text-xs text-white/45">Sort by</span>
        <select
          v-model="sortBy"
          class="rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 text-xs text-white outline-none focus:border-glow-500/40 transition-all"
        >
          <option value="score">Score</option>
          <option value="roas">ROAS</option>
          <option value="ctr">CTR</option>
          <option value="margin">Margin</option>
          <option value="velocity">Velocity</option>
          <option value="spend">Spend</option>
          <option value="revenue">Revenue</option>
          <option value="title">Title</option>
        </select>
        <button
          @click="sortDir = sortDir === 'asc' ? 'desc' : 'asc'"
          class="flex items-center justify-center w-8 h-8 rounded-lg border border-white/10 bg-white/5 text-white/60 hover:text-white hover:bg-white/10 transition-all"
        >
          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path v-if="sortDir === 'desc'" stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/>
            <path v-else stroke-linecap="round" stroke-linejoin="round" d="M5 15l7-7 7 7"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- Table Card -->
    <div class="glass rounded-2xl overflow-hidden">

      <!-- Loading skeleton -->
      <div v-if="pending" class="p-6 grid gap-3">
        <div v-for="i in 8" :key="i" class="h-14 rounded-xl bg-white/5 animate-pulse" :style="{ opacity: 1 - i * 0.08 }"></div>
      </div>

      <!-- Empty state -->
      <div v-else-if="!products.length" class="p-16 text-center">
        <div class="mx-auto mb-4 h-12 w-12 rounded-2xl bg-white/5 flex items-center justify-center">
          <svg class="w-6 h-6 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z"/>
          </svg>
        </div>
        <p class="text-sm font-medium">No products match your filters</p>
        <p class="mt-1 text-xs text-white/50">Try adjusting your search or clearing the filters</p>
        <button @click="filter = 'all'; search = ''" class="mt-4 text-xs text-glow-500 hover:text-glow-400 transition-colors font-medium">
          Clear filters →
        </button>
      </div>

      <!-- Data table -->
      <div v-else class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-white/10">
              <th class="text-left text-xs font-medium text-white/55 px-5 py-3.5 whitespace-nowrap">Product</th>
              <th class="text-left px-4 py-3.5 whitespace-nowrap">
                <button class="flex items-center gap-1.5 text-xs font-medium text-white/55 hover:text-white/80 transition-colors" @click="setSort('score')">
                  Score
                  <span v-if="sortBy === 'score'" class="text-glow-500 text-[10px]">{{ sortIndicator('score') }}</span>
                </button>
              </th>
              <th class="text-left px-4 py-3.5 whitespace-nowrap">
                <button class="flex items-center gap-1.5 text-xs font-medium text-white/55 hover:text-white/80 transition-colors" @click="setSort('roas')">
                  ROAS
                  <span v-if="sortBy === 'roas'" class="text-glow-500 text-[10px]">{{ sortIndicator('roas') }}</span>
                </button>
              </th>
              <th class="text-left px-4 py-3.5 whitespace-nowrap">
                <button class="flex items-center gap-1.5 text-xs font-medium text-white/55 hover:text-white/80 transition-colors" @click="setSort('ctr')">
                  CTR
                  <span v-if="sortBy === 'ctr'" class="text-glow-500 text-[10px]">{{ sortIndicator('ctr') }}</span>
                </button>
              </th>
              <th class="text-left px-4 py-3.5 whitespace-nowrap">
                <button class="flex items-center gap-1.5 text-xs font-medium text-white/55 hover:text-white/80 transition-colors" @click="setSort('margin')">
                  Margin
                  <span v-if="sortBy === 'margin'" class="text-glow-500 text-[10px]">{{ sortIndicator('margin') }}</span>
                </button>
              </th>
              <th class="text-left px-4 py-3.5 whitespace-nowrap">
                <button class="flex items-center gap-1.5 text-xs font-medium text-white/55 hover:text-white/80 transition-colors" @click="setSort('revenue')">
                  Revenue
                  <span v-if="sortBy === 'revenue'" class="text-glow-500 text-[10px]">{{ sortIndicator('revenue') }}</span>
                </button>
              </th>
              <th class="text-left px-4 py-3.5 whitespace-nowrap text-xs font-medium text-white/55">Status</th>
              <!-- hint column -->
              <th class="w-8 px-3 py-3.5"></th>
            </tr>
          </thead>
          <tbody class="divide-y divide-white/[0.05]">
            <tr
              v-for="item in products"
              :key="item.id"
              class="group hover:bg-white/[0.04] transition-colors cursor-pointer"
              @click="openSidekick(item)"
            >
              <!-- Product info -->
              <td class="px-5 py-4">
                <div class="flex items-center gap-3">
                  <div class="h-9 w-9 flex-shrink-0 rounded-lg border border-white/10 bg-white/5 overflow-hidden">
                    <img :src="item.imageUrl" :alt="item.title" class="h-full w-full object-cover" loading="lazy" />
                  </div>
                  <div class="min-w-0">
                    <p class="font-medium truncate max-w-[180px]">{{ item.title }}</p>
                    <div class="flex items-center gap-2 mt-0.5">
                      <span class="text-xs text-white/45 font-mono">{{ item.sku }}</span>
                      <a
                        :href="item.productUrl"
                        target="_blank"
                        rel="noopener"
                        class="text-xs text-glow-500/80 hover:text-glow-500 transition-colors opacity-0 group-hover:opacity-100"
                        @click.stop
                      >↗</a>
                    </div>
                  </div>
                </div>
              </td>

              <!-- Score with bar -->
              <td class="px-4 py-4">
                <div class="flex items-center gap-2.5">
                  <span class="font-mono text-sm font-semibold w-7 text-right" :class="scoreColor(item.score)">{{ item.score }}</span>
                  <div class="w-14 h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <div
                      class="h-full rounded-full transition-all duration-500"
                      :style="{ width: item.score + '%' }"
                      :class="scoreBarColor(item.score)"
                    ></div>
                  </div>
                </div>
              </td>

              <!-- ROAS -->
              <td class="px-4 py-4 font-mono text-sm font-medium">{{ item.roas }}×</td>

              <!-- CTR -->
              <td class="px-4 py-4 text-sm text-white/80">{{ item.ctr }}%</td>

              <!-- Margin -->
              <td class="px-4 py-4 text-sm text-white/80">{{ item.margin }}%</td>

              <!-- Revenue -->
              <td class="px-4 py-4 text-sm font-medium">{{ formatMoney(item.revenue) }}</td>

              <!-- Category badge -->
              <td class="px-4 py-4">
                <span class="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold whitespace-nowrap" :class="badgeClass(item.category)">
                  <span class="h-1.5 w-1.5 rounded-full" :class="badgeDot(item.category)"></span>
                  {{ item.category }}
                </span>
              </td>

              <!-- Chevron hint -->
              <td class="px-3 py-4">
                <svg class="w-4 h-4 text-white/20 group-hover:text-white/50 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5"/>
                </svg>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination footer -->
      <div v-if="!pending && products.length > 0" class="flex items-center justify-between px-5 py-4 border-t border-white/10">
        <div class="flex items-center gap-2">
          <span class="text-xs text-white/45">Rows</span>
          <select
            v-model.number="limit"
            class="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-white outline-none focus:border-glow-500/40 transition-all"
          >
            <option :value="10">10</option>
            <option :value="20">20</option>
            <option :value="50">50</option>
          </select>
        </div>
        <div class="flex items-center gap-3">
          <span class="text-xs text-white/45">{{ products.length }} of {{ total }} products</span>
          <div class="flex items-center gap-1.5">
            <button
              :disabled="pageStack.length === 0"
              @click="prevPage"
              class="flex items-center justify-center w-8 h-8 rounded-lg border border-white/10 bg-white/5 text-white/55 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg>
            </button>
            <button
              :disabled="!nextCursorId"
              @click="nextPage"
              class="flex items-center justify-center w-8 h-8 rounded-lg border border-white/10 bg-white/5 text-white/55 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
            </button>
          </div>
        </div>
      </div>

    </div>

    <!-- Product Sidekick -->
    <ProductSidekick
      :product="selectedProduct"
      :currency="currency"
      @close="selectedProduct = null"
    />

  </div>
</template>

<script setup lang="ts">
import { useGlobalFilters } from "~/composables/useGlobalFilters";

const search = ref("");
const filter = ref("all");
const sortBy = ref("score");
const sortDir = ref("desc");
const limit = ref(20);
const syncing = ref(false);

const pageStack = ref<string[]>([]);
const cursorId = ref<string | null>(null);

// Sidekick
const selectedProduct = ref<null | Record<string, unknown>>(null);

const { query, rangeOption } = useGlobalFilters();
const rangeLabel = computed(() => rangeOption.value.label);

const categories = [
  { value: 'all', label: 'All', dot: null },
  { value: 'SCALE', label: 'Scale', dot: 'bg-lime-400' },
  { value: 'TEST', label: 'Test', dot: 'bg-glow-400' },
  { value: 'KILL', label: 'Kill', dot: 'bg-ember-500' },
  { value: 'RISK', label: 'Risk', dot: 'bg-violet-400' },
];

watch([sortBy, sortDir, limit, query], () => {
  cursorId.value = null;
  pageStack.value = [];
});

const { data, pending } = await useFetch("/api/products", {
  query: computed(() => ({
    ...query.value,
    q: search.value || undefined,
    category: filter.value === "all" ? undefined : filter.value,
    sortBy: sortBy.value,
    sortDir: sortDir.value,
    limit: limit.value,
    cursorId: cursorId.value ?? undefined
  }))
});

const currency = computed(() => data.value?.currency ?? "USD");
const products = computed(() => data.value?.products ?? []);
const total = computed(() => data.value?.total ?? 0);
const nextCursorId = computed(() => data.value?.nextCursorId ?? null);

const formatMoney = (value: number) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.value,
    maximumFractionDigits: 0
  }).format(value);
};

const scoreColor = (score: number) => {
  if (score >= 75) return 'text-lime-400';
  if (score >= 50) return 'text-glow-400';
  if (score >= 25) return 'text-ember-400';
  return 'text-white/40';
};

const scoreBarColor = (score: number) => {
  if (score >= 75) return 'bg-lime-400';
  if (score >= 50) return 'bg-glow-400';
  if (score >= 25) return 'bg-ember-400';
  return 'bg-white/30';
};

const badgeClass = (category: string) => {
  if (category === 'SCALE') return 'bg-lime-500/15 text-lime-400 border border-lime-500/20';
  if (category === 'TEST') return 'bg-glow-500/15 text-glow-400 border border-glow-500/20';
  if (category === 'KILL') return 'bg-ember-500/15 text-ember-400 border border-ember-500/20';
  return 'bg-violet-500/15 text-violet-400 border border-violet-500/20';
};

const badgeDot = (category: string) => {
  if (category === 'SCALE') return 'bg-lime-400';
  if (category === 'TEST') return 'bg-glow-400';
  if (category === 'KILL') return 'bg-ember-500';
  return 'bg-violet-400';
};

const setSort = (field: string) => {
  if (sortBy.value === field) {
    sortDir.value = sortDir.value === "asc" ? "desc" : "asc";
  } else {
    sortBy.value = field;
    sortDir.value = "desc";
  }
};

const sortIndicator = (field: string) => {
  if (sortBy.value !== field) return "";
  return sortDir.value === "asc" ? "▲" : "▼";
};

const nextPage = () => {
  if (nextCursorId.value) {
    pageStack.value.push(cursorId.value ?? "");
    cursorId.value = nextCursorId.value;
  }
};

const prevPage = () => {
  const prev = pageStack.value.pop();
  cursorId.value = prev && prev.length > 0 ? prev : null;
};

// Open sidekick panel
const openSidekick = (item: Record<string, unknown>) => {
  selectedProduct.value = item;
};

// Sync action
const triggerSync = async () => {
  if (syncing.value) return;
  syncing.value = true;
  await new Promise(res => setTimeout(res, 1800));
  syncing.value = false;
};

// CSV export
const exportCsv = () => {
  const rows = products.value as Record<string, unknown>[];
  if (!rows.length) return;
  const headers = ['title', 'sku', 'category', 'score', 'roas', 'blendedRoas', 'ctr', 'margin', 'spend', 'revenue', 'impressions', 'clicks', 'conversions'];
  const csv = [
    headers.join(','),
    ...rows.map(r => headers.map(h => JSON.stringify(r[h] ?? '')).join(','))
  ].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `metaflow-products-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};
</script>

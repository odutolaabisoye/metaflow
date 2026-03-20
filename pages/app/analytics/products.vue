<template>
  <div class="space-y-6">

    <!-- Header -->
    <div class="flex items-start justify-between gap-4">
      <div>
        <p class="text-[11px] uppercase tracking-widest text-white/65 mb-1">Analytics</p>
        <h1 class="text-2xl font-semibold tracking-tight">Products Analytics</h1>
        <p class="mt-1 text-sm text-white/75">Deep-dive into product metrics, revenue, and scoring data for your store.</p>
      </div>
      <button
        v-if="storeId"
        @click="mode === 'all' ? doInspect() : doSkuLookup()"
        :disabled="loading || skuLoading"
        class="flex-shrink-0 flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-medium text-white/80 hover:bg-white/[0.07] hover:text-white transition-all disabled:opacity-50"
      >
        <svg class="w-4 h-4" :class="(loading || skuLoading) && 'animate-spin'" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"/>
        </svg>
        Refresh
      </button>
    </div>

    <!-- Controls -->
    <div class="glass rounded-2xl p-5 space-y-4">

      <!-- Mode tabs -->
      <div class="flex gap-1 p-1 rounded-xl bg-white/[0.04] border border-white/8 w-fit">
        <button
          @click="mode = 'all'"
          class="rounded-lg px-4 py-1.5 text-xs font-semibold transition-all"
          :class="mode === 'all' ? 'bg-glow-500/80 text-white shadow-md' : 'text-white/55 hover:text-white/80'"
        >All Products</button>
        <button
          @click="mode = 'sku'"
          class="rounded-lg px-4 py-1.5 text-xs font-semibold transition-all"
          :class="mode === 'sku' ? 'bg-glow-500/80 text-white shadow-md' : 'text-white/55 hover:text-white/80'"
        >SKU / Product Lookup</button>
      </div>

      <!-- All Products controls -->
      <div v-if="mode === 'all'" class="flex flex-wrap items-end gap-2 sm:gap-3">
        <div class="min-w-[140px]">
          <label class="block text-xs font-semibold text-white/60 mb-2 uppercase tracking-wider">Date Range</label>
          <select v-model="range" class="w-full rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2.5 text-sm text-white appearance-none focus:outline-none focus:border-glow-500/50">
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="custom">Custom</option>
          </select>
        </div>
        <template v-if="range === 'custom'">
          <div class="min-w-[150px]">
            <label class="block text-xs font-semibold text-white/60 mb-2 uppercase tracking-wider">Start Date</label>
            <input type="date" v-model="customStart" class="w-full rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2.5 text-sm text-white focus:outline-none focus:border-glow-500/50 [color-scheme:dark]"/>
          </div>
          <div class="min-w-[150px]">
            <label class="block text-xs font-semibold text-white/60 mb-2 uppercase tracking-wider">End Date</label>
            <input type="date" v-model="customEnd" class="w-full rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2.5 text-sm text-white focus:outline-none focus:border-glow-500/50 [color-scheme:dark]"/>
          </div>
        </template>
        <div class="min-w-[170px]">
          <label class="block text-xs font-semibold text-white/60 mb-2 uppercase tracking-wider">Sort By</label>
          <select v-model="sortBy" class="w-full rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2.5 text-sm text-white appearance-none focus:outline-none focus:border-glow-500/50">
            <option value="spend">Spend</option>
            <option value="revenue">Revenue (Store)</option>
            <option value="metaRevenue">Meta Revenue</option>
            <option value="impressions">Impressions</option>
            <option value="clicks">Clicks</option>
            <option value="addToCart">Add to Cart (Omni)</option>
            <option value="checkoutInitiated">Checkout (Omni)</option>
            <option value="roas">ROAS (Meta)</option>
            <option value="score">Score</option>
          </select>
        </div>
        <div class="min-w-[120px]">
          <label class="block text-xs font-semibold text-white/60 mb-2 uppercase tracking-wider">Direction</label>
          <select v-model="sortDir" class="w-full rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2.5 text-sm text-white appearance-none focus:outline-none focus:border-glow-500/50">
            <option value="desc">High → Low</option>
            <option value="asc">Low → High</option>
          </select>
        </div>
        <button v-if="storeId" @click="doInspect" :disabled="loading"
          class="rounded-xl bg-glow-500/80 hover:bg-glow-500 disabled:opacity-40 text-white text-sm font-semibold px-5 py-2.5 transition-colors"
        >{{ loading ? 'Loading…' : 'Inspect' }}</button>
      </div>

      <!-- SKU Lookup controls -->
      <div v-else class="flex flex-wrap items-end gap-3">
        <div class="flex-1 min-w-[220px]">
          <label class="block text-xs font-semibold text-white/60 mb-2 uppercase tracking-wider">SKU / Title / External ID</label>
          <input
            v-model="skuQuery"
            @keyup.enter="doSkuLookup"
            type="text"
            placeholder="e.g. SKU-1234, Product Name, 9876543210…"
            class="w-full rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2.5 text-sm text-white placeholder-white/25 focus:outline-none focus:border-glow-500/50"
          />
        </div>
        <div class="min-w-[140px]">
          <label class="block text-xs font-semibold text-white/60 mb-2 uppercase tracking-wider">Date Range</label>
          <select v-model="range" class="w-full rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2.5 text-sm text-white appearance-none focus:outline-none focus:border-glow-500/50">
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="custom">Custom</option>
          </select>
        </div>
        <template v-if="range === 'custom'">
          <div class="min-w-[150px]">
            <label class="block text-xs font-semibold text-white/60 mb-2 uppercase tracking-wider">Start Date</label>
            <input type="date" v-model="customStart" class="w-full rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2.5 text-sm text-white focus:outline-none focus:border-glow-500/50 [color-scheme:dark]"/>
          </div>
          <div class="min-w-[150px]">
            <label class="block text-xs font-semibold text-white/60 mb-2 uppercase tracking-wider">End Date</label>
            <input type="date" v-model="customEnd" class="w-full rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2.5 text-sm text-white focus:outline-none focus:border-glow-500/50 [color-scheme:dark]"/>
          </div>
        </template>
        <button v-if="storeId" @click="doSkuLookup" :disabled="skuLoading || !skuQuery.trim()"
          class="rounded-xl bg-glow-500/80 hover:bg-glow-500 disabled:opacity-40 text-white text-sm font-semibold px-5 py-2.5 transition-colors"
        >{{ skuLoading ? 'Searching…' : 'Lookup' }}</button>
      </div>
    </div>

    <!-- No store state -->
    <div v-if="!storeId" class="glass rounded-2xl p-10 text-center">
      <svg class="w-10 h-10 text-white/20 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1">
        <path stroke-linecap="round" stroke-linejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125"/>
      </svg>
      <p class="text-sm text-white/40">No store selected — switch to a store using the sidebar</p>
    </div>

    <!-- ── ALL PRODUCTS MODE ── -->
    <template v-if="mode === 'all'">
      <!-- Loading skeleton -->
      <div v-if="loading" class="space-y-4">
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div v-for="i in 4" :key="i" class="h-24 rounded-2xl bg-white/4 animate-pulse border border-white/6"></div>
        </div>
        <div class="h-72 rounded-2xl bg-white/4 animate-pulse border border-white/6"></div>
      </div>

      <template v-if="apiData && !loading">
        <!-- Summary stats -->
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div class="glass rounded-2xl p-4">
            <p class="text-xs text-white/55 uppercase tracking-wider mb-1">Products</p>
            <p class="text-2xl font-bold">{{ apiData.stats?.totalProducts ?? 0 }}</p>
            <p class="text-[10px] text-white/40 mt-0.5">{{ apiData.stats?.productsWithMetrics ?? 0 }} with ad data</p>
          </div>
          <div class="glass rounded-2xl p-4">
            <p class="text-xs text-white/55 uppercase tracking-wider mb-1">
              <MetricTooltip metric="revenue">Total Revenue</MetricTooltip>
            </p>
            <p class="text-2xl font-bold">{{ fmt(summaryTotals.revenue) }}</p>
          </div>
          <div class="glass rounded-2xl p-4">
            <p class="text-xs text-white/55 uppercase tracking-wider mb-1">
              <MetricTooltip metric="spend">Total Spend</MetricTooltip>
            </p>
            <p class="text-2xl font-bold">{{ fmt(summaryTotals.spend) }}</p>
          </div>
          <div class="glass rounded-2xl p-4">
            <p class="text-xs text-white/55 uppercase tracking-wider mb-1">
              <MetricTooltip metric="roas">Avg ROAS</MetricTooltip>
            </p>
            <p class="text-2xl font-bold">{{ summaryTotals.spend > 0 ? (summaryTotals.metaRevenue / summaryTotals.spend).toFixed(2) : '—' }}x</p>
          </div>
        </div>

        <!-- Pagination info + export -->
        <div class="flex items-center justify-between gap-3">
          <p class="text-xs text-white/40">
            Showing {{ apiData.items?.length ?? 0 }} of {{ apiData.total ?? 0 }} products
            <span class="ml-2">{{ apiData.dateRange?.sinceDate }} → {{ apiData.dateRange?.untilDate }}</span>
          </p>
          <div class="flex items-center gap-2">
            <button v-if="(apiData.page ?? 0) > 0" @click="changePage((apiData.page ?? 0) - 1)"
              class="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-white/70 hover:bg-white/[0.07] transition-all">← Prev</button>
            <span class="text-xs text-white/40">Page {{ (apiData.page ?? 0) + 1 }} / {{ apiData.totalPages ?? 1 }}</span>
            <button v-if="(apiData.page ?? 0) < (apiData.totalPages ?? 1) - 1" @click="changePage((apiData.page ?? 0) + 1)"
              class="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-white/70 hover:bg-white/[0.07] transition-all">Next →</button>
            <!-- Export split button -->
            <div class="relative" ref="exportMenuRef">
              <div class="flex rounded-lg border border-white/10 bg-white/[0.04] overflow-hidden">
                <button
                  @click="showExportMenu = !showExportMenu"
                  :disabled="exportingAll"
                  class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white/70 hover:bg-white/[0.07] hover:text-white transition-all disabled:opacity-50"
                >
                  <svg v-if="!exportingAll" class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"/>
                  </svg>
                  <svg v-else class="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"/>
                  </svg>
                  {{ exportingAll ? `Fetching… (${exportProgress})` : 'Export CSV' }}
                </button>
                <button
                  @click="showExportMenu = !showExportMenu"
                  :disabled="exportingAll"
                  class="border-l border-white/10 px-2 py-1.5 text-white/40 hover:bg-white/[0.07] hover:text-white/70 transition-all disabled:opacity-50"
                  aria-label="Export options"
                >
                  <svg class="w-3 h-3 transition-transform" :class="showExportMenu && 'rotate-180'" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5"/>
                  </svg>
                </button>
              </div>

              <!-- Dropdown menu -->
              <Transition name="fade-drop">
                <div v-if="showExportMenu" class="absolute right-0 top-[calc(100%+6px)] z-50 w-64 rounded-xl border border-white/10 bg-ink-900/95 backdrop-blur-md shadow-2xl overflow-hidden">
                  <!-- This page -->
                  <button
                    @click="exportCsv('page'); showExportMenu = false"
                    class="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-white/[0.05] transition-colors"
                  >
                    <div class="mt-0.5 h-7 w-7 rounded-lg bg-white/8 flex items-center justify-center flex-shrink-0">
                      <svg class="w-3.5 h-3.5 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z"/>
                      </svg>
                    </div>
                    <div>
                      <p class="text-xs font-semibold text-white/85">This page only</p>
                      <p class="text-[11px] text-white/45 mt-0.5">Export the {{ apiData?.items?.length ?? 0 }} products visible right now</p>
                    </div>
                  </button>
                  <div class="border-t border-white/8"></div>
                  <!-- All products -->
                  <button
                    @click="exportCsv('all'); showExportMenu = false"
                    class="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-white/[0.05] transition-colors"
                  >
                    <div class="mt-0.5 h-7 w-7 rounded-lg bg-glow-500/10 flex items-center justify-center flex-shrink-0">
                      <svg class="w-3.5 h-3.5 text-glow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125"/>
                      </svg>
                    </div>
                    <div>
                      <p class="text-xs font-semibold text-white/85">All products <span class="ml-1 text-[10px] text-glow-400 font-normal">({{ (apiData?.total ?? 0).toLocaleString() }} rows)</span></p>
                      <p class="text-[11px] text-white/45 mt-0.5">Fetch all pages and export a complete CSV</p>
                    </div>
                  </button>
                </div>
              </Transition>
            </div>
          </div>
        </div>

        <!-- Products table -->
        <div class="glass rounded-2xl overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full text-sm min-w-[800px]">
              <thead>
                <tr class="border-b border-white/8">
                  <th class="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-white/50">Product</th>
                  <th class="text-right px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-white/50">
                    <MetricTooltip metric="score">Score</MetricTooltip>
                  </th>
                  <th class="text-right px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-white/50">
                    <MetricTooltip metric="category">Category</MetricTooltip>
                  </th>
                  <th class="text-right px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-white/50">
                    <MetricTooltip metric="revenue">Revenue</MetricTooltip>
                  </th>
                  <th class="text-right px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-white/50">
                    <MetricTooltip metric="metaRevenue">Meta Rev</MetricTooltip>
                  </th>
                  <th class="text-right px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-white/50">
                    <MetricTooltip metric="spend">Spend</MetricTooltip>
                  </th>
                  <th class="text-right px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-white/50">
                    <MetricTooltip metric="roas">ROAS</MetricTooltip>
                  </th>
                  <th class="text-right px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-white/50">
                    <MetricTooltip metric="impressions">Impressions</MetricTooltip>
                  </th>
                  <th class="text-right px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-white/50">
                    <MetricTooltip metric="clicks">Clicks</MetricTooltip>
                  </th>
                  <th class="text-right px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-white/50">
                    <MetricTooltip metric="addToCart">Add to Cart</MetricTooltip>
                  </th>
                  <th class="text-right px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-white/50">
                    <MetricTooltip metric="checkoutInitiated">Checkout</MetricTooltip>
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-white/[0.04]">
                <tr
                  v-for="p in apiData.items"
                  :key="p.productId"
                  class="hover:bg-white/[0.025] transition-colors"
                >
                  <td class="px-4 py-3">
                    <div class="flex items-center gap-2.5">
                      <a v-if="p.productUrl" :href="p.productUrl" target="_blank" rel="noopener" class="flex-shrink-0 block">
                        <img v-if="p.imageUrl" :src="p.imageUrl" class="h-9 w-9 rounded-lg object-cover ring-1 ring-white/10 hover:ring-glow-500/50 transition-all" :alt="p.title" />
                        <div v-else class="h-9 w-9 rounded-lg bg-white/8 ring-1 ring-white/10"></div>
                      </a>
                      <div v-else class="flex-shrink-0">
                        <img v-if="p.imageUrl" :src="p.imageUrl" class="h-9 w-9 rounded-lg object-cover ring-1 ring-white/10" :alt="p.title" />
                        <div v-else class="h-9 w-9 rounded-lg bg-white/8"></div>
                      </div>
                      <div class="min-w-0">
                        <a v-if="p.productUrl" :href="p.productUrl" target="_blank" rel="noopener"
                          class="text-xs font-medium text-white/85 hover:text-white truncate max-w-[200px] block hover:underline underline-offset-2 transition-colors">
                          {{ p.title }}
                        </a>
                        <p v-else class="text-xs font-medium text-white/85 truncate max-w-[200px]">{{ p.title }}</p>
                        <p class="text-[10px] text-white/45 font-mono truncate">{{ p.sku || p.productId }}</p>
                      </div>
                    </div>
                  </td>
                  <td class="text-right px-4 py-3">
                    <span
                      class="inline-block text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                      :class="p.score >= 80 ? 'bg-lime-500/15 text-lime-400' : p.score >= 50 ? 'bg-cyan-500/15 text-cyan-400' : 'bg-ember-500/15 text-ember-400'"
                    >{{ p.score }}</span>
                  </td>
                  <td class="text-right px-4 py-3">
                    <span class="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                      :class="{
                        'bg-lime-500/15 text-lime-400':   p.category === 'SCALE',
                        'bg-ember-500/15 text-ember-400': p.category === 'KILL',
                        'bg-cyan-500/15 text-cyan-400':   p.category === 'TEST',
                        'bg-amber-500/15 text-amber-400': p.category === 'RISK',
                        'bg-white/8 text-white/40':       !p.category,
                      }"
                    >{{ p.category ?? '—' }}</span>
                  </td>
                  <td class="text-right px-4 py-3 text-xs text-white/70 font-mono">{{ fmt(p.rawSums?.revenue) }}</td>
                  <td class="text-right px-4 py-3 text-xs text-white/70 font-mono">{{ fmt(p.rawSums?.metaRevenue) }}</td>
                  <td class="text-right px-4 py-3 text-xs text-white/70 font-mono">{{ fmt(p.rawSums?.spend) }}</td>
                  <td class="text-right px-4 py-3 text-xs font-mono"
                    :class="(p.computed?.roas ?? 0) >= 2 ? 'text-lime-400' : (p.computed?.roas ?? 0) >= 1 ? 'text-white/70' : 'text-ember-400'">
                    {{ p.rawSums?.spend > 0 ? (p.computed?.roas ?? 0).toFixed(2) + 'x' : '—' }}
                  </td>
                  <td class="text-right px-4 py-3 text-xs text-white/55 font-mono">{{ (p.rawSums?.impressions ?? 0).toLocaleString() }}</td>
                  <td class="text-right px-4 py-3 text-xs text-white/55 font-mono">{{ (p.rawSums?.clicks ?? 0).toLocaleString() }}</td>
                  <!-- ATC: null = pre-migration data, no sync yet; 0 = real zero -->
                  <td class="text-right px-4 py-3 text-xs font-mono">
                    <template v-if="p.rawSums?.addToCartOmni != null || p.rawSums?.addToCart != null">
                      <span class="block text-white/55">{{ (p.rawSums.addToCartOmni ?? 0).toLocaleString() }}</span>
                      <span class="block text-[10px] text-white/30">{{ (p.rawSums.addToCart ?? 0).toLocaleString() }} site</span>
                    </template>
                    <span v-else class="text-white/25">—</span>
                  </td>
                  <td class="text-right px-4 py-3 text-xs font-mono">
                    <template v-if="p.rawSums?.checkoutInitiatedOmni != null || p.rawSums?.checkoutInitiated != null">
                      <span class="block text-white/55">{{ (p.rawSums.checkoutInitiatedOmni ?? 0).toLocaleString() }}</span>
                      <span class="block text-[10px] text-white/30">{{ (p.rawSums.checkoutInitiated ?? 0).toLocaleString() }} site</span>
                    </template>
                    <span v-else class="text-white/25">—</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </template>
    </template>

    <!-- ── SKU LOOKUP MODE ── -->
    <template v-if="mode === 'sku'">
      <div v-if="skuLoading" class="h-48 rounded-2xl bg-white/4 animate-pulse border border-white/6"></div>

      <template v-if="skuData && !skuLoading">
        <div v-for="match in skuData.matches" :key="match.product?.id" class="glass rounded-2xl p-5 space-y-4">
          <!-- Product header -->
          <div class="flex items-center gap-4">
            <div class="h-14 w-14 rounded-xl bg-white/8 flex-shrink-0"></div>
            <div>
              <h2 class="text-base font-semibold">{{ match.product?.title }}</h2>
              <p class="text-xs text-white/55 font-mono mt-0.5">{{ match.product?.sku }} · {{ match.product?.externalId }}</p>
              <div class="flex items-center gap-2 mt-1">
                <span class="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-glow-500/15 text-glow-400">Score: {{ match.product?.score }}</span>
                <span class="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-white/8 text-white/60">{{ match.product?.category }}</span>
              </div>
            </div>
          </div>

          <!-- Totals summary row -->
          <div class="grid grid-cols-3 lg:grid-cols-8 gap-3 border-t border-white/8 pt-4">
            <div v-for="(val, label) in {
              Revenue: match.totals?.revenue,
              'Meta Rev': match.totals?.metaRevenue,
              Spend: match.totals?.spend,
              Impressions: match.totals?.impressions,
              Clicks: match.totals?.clicks,
              Conversions: match.totals?.conversions,
              'ATC (Omni)': match.totals?.addToCartOmni,
              Checkout: match.totals?.checkoutInitiated,
            }" :key="label" class="text-center">
              <p class="text-[10px] text-white/45 uppercase tracking-wider mb-0.5">{{ label }}</p>
              <p class="text-sm font-semibold font-mono">
                {{ ['Revenue', 'Meta Rev', 'Spend'].includes(String(label)) ? fmtSku(val) : (val ?? 0).toLocaleString() }}
              </p>
            </div>
          </div>

          <!-- Daily rows table -->
          <div v-if="match.dailyRows?.length" class="overflow-x-auto">
            <table class="w-full text-xs min-w-[700px]">
              <thead>
                <tr class="border-b border-white/8">
                  <th class="text-left px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-white/50">Date</th>
                  <th class="text-right px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-white/50"><MetricTooltip metric="revenue">Revenue</MetricTooltip></th>
                  <th class="text-right px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-white/50"><MetricTooltip metric="metaRevenue">Meta Rev</MetricTooltip></th>
                  <th class="text-right px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-white/50"><MetricTooltip metric="spend">Spend</MetricTooltip></th>
                  <th class="text-right px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-white/50"><MetricTooltip metric="roas">ROAS</MetricTooltip></th>
                  <th class="text-right px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-white/50"><MetricTooltip metric="impressions">Impressions</MetricTooltip></th>
                  <th class="text-right px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-white/50"><MetricTooltip metric="clicks">Clicks</MetricTooltip></th>
                  <th class="text-right px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-white/50"><MetricTooltip metric="addToCart">ATC</MetricTooltip></th>
                  <th class="text-right px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-white/50"><MetricTooltip metric="checkoutInitiated">Checkout</MetricTooltip></th>
                  <th class="text-right px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-white/50">Margin</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-white/[0.04]">
                <tr v-for="m in match.dailyRows" :key="m.date" class="hover:bg-white/[0.025] transition-colors">
                  <td class="px-3 py-2 font-mono text-white/65">{{ m.date?.slice(0, 10) }}</td>
                  <td class="text-right px-3 py-2 font-mono text-white/70">{{ fmtSku(m.revenue) }}</td>
                  <td class="text-right px-3 py-2 font-mono text-white/70">{{ fmtSku(m.metaRevenue) }}</td>
                  <td class="text-right px-3 py-2 font-mono text-white/70">{{ fmtSku(m.spend) }}</td>
                  <td class="text-right px-3 py-2 font-mono" :class="(m.spend > 0 ? m.metaRevenue / m.spend : 0) >= 2 ? 'text-lime-400' : 'text-white/60'">
                    {{ m.spend > 0 ? (m.metaRevenue / m.spend).toFixed(2) + 'x' : '—' }}
                  </td>
                  <td class="text-right px-3 py-2 font-mono text-white/55">{{ (m.impressions ?? 0).toLocaleString() }}</td>
                  <td class="text-right px-3 py-2 font-mono text-white/55">{{ (m.clicks ?? 0).toLocaleString() }}</td>
                  <td class="text-right px-3 py-2 font-mono">
                    <template v-if="m.addToCartOmni != null || m.addToCart != null">
                      <span class="text-white/55">{{ (m.addToCartOmni ?? 0).toLocaleString() }}</span>
                      <span class="block text-[10px] text-white/25">{{ (m.addToCart ?? 0).toLocaleString() }}s</span>
                    </template>
                    <span v-else class="text-white/25">—</span>
                  </td>
                  <td class="text-right px-3 py-2 font-mono">
                    <template v-if="m.checkoutInitiatedOmni != null || m.checkoutInitiated != null">
                      <span class="text-white/55">{{ (m.checkoutInitiatedOmni ?? 0).toLocaleString() }}</span>
                      <span class="block text-[10px] text-white/25">{{ (m.checkoutInitiated ?? 0).toLocaleString() }}s</span>
                    </template>
                    <span v-else class="text-white/25">—</span>
                  </td>
                  <td class="text-right px-3 py-2 font-mono text-white/55">{{ m.margin != null ? (m.margin * 100).toFixed(1) + '%' : '—' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-else class="py-6 text-center text-sm text-white/40">No metric rows found for this product in the selected range.</div>
        </div>

        <div v-if="!skuData.matches?.length" class="glass rounded-2xl p-10 text-center text-sm text-white/40">
          No products matched "{{ skuData.query }}"
        </div>
      </template>
    </template>

    <!-- Upgrade prompt (403 from backend) -->
    <div v-if="upgradePlan" class="glass rounded-2xl p-8 text-center border border-amber-500/20 bg-amber-500/5">
      <svg class="w-10 h-10 text-amber-400/60 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
        <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
      </svg>
      <h3 class="text-base font-semibold mb-1">Advanced Analytics requires a Scale or Grandfathered plan</h3>
      <p class="text-sm text-white/55 mb-4">Upgrade to unlock product-level spend, ROAS, and scoring insights.</p>
      <NuxtLink to="/app/settings?upgrade=analytics"
        class="inline-flex items-center gap-2 rounded-xl bg-amber-500/80 hover:bg-amber-500 text-white text-sm font-semibold px-5 py-2.5 transition-colors">
        Upgrade Plan
      </NuxtLink>
    </div>

    <!-- Error state -->
    <div v-if="error && !upgradePlan" class="glass rounded-2xl p-5 border border-ember-500/20 bg-ember-500/5 text-sm text-ember-400">
      {{ error }}
    </div>

  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' });
useHead({ title: 'Products Analytics — MetaFlow' });

const config = useRuntimeConfig();
const activeStoreId = useState<string | null>('mf_active_store_id', () => null);
const storeId = computed(() => activeStoreId.value ?? '');

const mode = ref<'all' | 'sku'>('all');
const range = ref('30d');
const customStart = ref('');
const customEnd = ref('');
const sortBy = ref('spend');
const sortDir = ref<'desc' | 'asc'>('desc');
const currentPage = ref(0);
const skuQuery = ref('');
const loading = ref(false);
const skuLoading = ref(false);
// Raw API response — matches the backend shape exactly
const apiData = ref<any>(null);
const skuData = ref<any>(null);
const error = ref('');
const upgradePlan = ref(false);
const showExportMenu = ref(false);
const exportMenuRef = ref<HTMLElement | null>(null);
const exportingAll = ref(false);
const exportProgress = ref('');

const CURRENCY_LOCALE: Record<string, string> = {
  NGN: 'en-NG', GBP: 'en-GB', EUR: 'de-DE', JPY: 'ja-JP',
  AUD: 'en-AU', CAD: 'en-CA', INR: 'en-IN', ZAR: 'en-ZA',
  GHS: 'en-GH', KES: 'sw-KE', EGP: 'ar-EG', MAD: 'ar-MA',
};

function fmt(v?: number | null) {
  if (v == null || v === 0) return '—';
  const cur = (apiData.value as any)?.store?.currency ?? 'NGN';
  const locale = CURRENCY_LOCALE[cur] ?? 'en-US';
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency', currency: cur,
      minimumFractionDigits: 0, maximumFractionDigits: 0
    }).format(v);
  } catch {
    return v.toLocaleString('en-US', { maximumFractionDigits: 0 });
  }
}

function fmtSku(v?: number | null) {
  if (v == null || v === 0) return '—';
  const cur = (skuData.value as any)?.store?.currency ?? 'NGN';
  const locale = CURRENCY_LOCALE[cur] ?? 'en-US';
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency', currency: cur,
      minimumFractionDigits: 0, maximumFractionDigits: 0
    }).format(v);
  } catch {
    return v.toLocaleString('en-US', { maximumFractionDigits: 0 });
  }
}

// Compute summary totals from the current page's items
const summaryTotals = computed(() => {
  const items: any[] = apiData.value?.items ?? [];
  // For 30d pre-computed path, all products are summed not just current page
  // The API returns full totals in stats but not aggregated — compute from items
  return items.reduce((acc, p) => ({
    revenue:     acc.revenue     + (p.rawSums?.revenue     ?? 0),
    metaRevenue: acc.metaRevenue + (p.rawSums?.metaRevenue ?? 0),
    spend:       acc.spend       + (p.rawSums?.spend       ?? 0),
    impressions: acc.impressions + (p.rawSums?.impressions ?? 0),
    clicks:      acc.clicks      + (p.rawSums?.clicks      ?? 0),
  }), { revenue: 0, metaRevenue: 0, spend: 0, impressions: 0, clicks: 0 });
});

async function doInspect(page = currentPage.value) {
  if (!storeId.value) return;
  loading.value = true;
  error.value = '';
  upgradePlan.value = false;
  try {
    const params = new URLSearchParams({
      storeId: storeId.value,
      range: range.value,
      sortBy: sortBy.value,
      sortDir: sortDir.value,
      page: String(page),
      limit: '50',
    });
    if (range.value === 'custom' && customStart.value && customEnd.value) {
      params.set('start', customStart.value);
      params.set('end', customEnd.value);
    }
    const res = await $fetch<any>(
      `${config.public.apiBase}/v1/analytics/products?${params}`,
      { credentials: 'include' }
    );
    if (res?.ok) {
      apiData.value = res;
      currentPage.value = page;
    } else {
      error.value = res?.message ?? 'Failed to load analytics';
    }
  } catch (e: any) {
    const code = e?.data?.code ?? e?.statusCode;
    if (code === 'PLAN_REQUIRED' || e?.data?.message?.toLowerCase().includes('scale')) {
      upgradePlan.value = true;
    } else {
      error.value = e?.data?.message ?? e?.message ?? 'Failed to load data';
    }
  } finally {
    loading.value = false;
  }
}

function changePage(page: number) {
  doInspect(page);
}

async function doSkuLookup() {
  if (!storeId.value || !skuQuery.value.trim()) return;
  skuLoading.value = true;
  error.value = '';
  upgradePlan.value = false;
  try {
    const params = new URLSearchParams({
      storeId: storeId.value,
      sku: skuQuery.value.trim(),
      range: range.value,
    });
    if (range.value === 'custom' && customStart.value && customEnd.value) {
      params.set('start', customStart.value);
      params.set('end', customEnd.value);
    }
    const res = await $fetch<any>(
      `${config.public.apiBase}/v1/analytics/products/sku?${params}`,
      { credentials: 'include' }
    );
    if (res?.ok) skuData.value = res;
    else error.value = res?.message ?? 'Product not found';
  } catch (e: any) {
    const code = e?.data?.code ?? e?.statusCode;
    if (code === 'PLAN_REQUIRED' || e?.data?.message?.toLowerCase().includes('scale')) {
      upgradePlan.value = true;
    } else {
      error.value = e?.data?.message ?? e?.message ?? 'Product not found';
    }
  } finally {
    skuLoading.value = false;
  }
}

// ── CSV helpers ────────────────────────────────────────────────────────────
function rowToCsv(p: any): string {
  const esc = (v: string) => `"${(v ?? '').replace(/"/g, '""')}"`;
  return [
    esc(p.title),
    esc(p.sku || ''),
    p.score ?? 0,
    p.category ?? '',
    (p.rawSums?.revenue ?? 0).toFixed(2),
    (p.rawSums?.metaRevenue ?? 0).toFixed(2),
    (p.rawSums?.spend ?? 0).toFixed(2),
    (p.computed?.roas ?? 0).toFixed(2),
    p.rawSums?.impressions ?? 0,
    p.rawSums?.clicks ?? 0,
    p.rawSums?.addToCartOmni ?? 0,
    p.rawSums?.addToCart ?? 0,
    p.rawSums?.checkoutInitiatedOmni ?? 0,
    p.rawSums?.checkoutInitiated ?? 0,
  ].join(',');
}

function downloadCsv(rows: string[], filename: string) {
  const headers = 'Title,SKU,Score,Category,Revenue,Meta Revenue,Spend,ROAS,Impressions,Clicks,ATC (Omni),ATC (Site),Checkout (Omni),Checkout (Site)';
  const csv = [headers, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function exportCsv(mode: 'page' | 'all' = 'page') {
  if (mode === 'page') {
    // Export only the items currently on screen
    const items: any[] = apiData.value?.items ?? [];
    if (!items.length) return;
    const date = new Date().toISOString().split('T')[0];
    downloadCsv(items.map(rowToCsv), `metaflow-products-page${(apiData.value?.page ?? 0) + 1}-${date}.csv`);
    return;
  }

  // Export all — paginate through the API fetching 200 rows at a time
  if (!storeId.value || exportingAll.value) return;
  exportingAll.value = true;
  exportProgress.value = '0 / ?';

  try {
    const allRows: string[] = [];
    const LIMIT = 200;
    let page = 0;
    let totalPages = 1;

    do {
      const params = new URLSearchParams({
        storeId: storeId.value,
        range: range.value,
        sortBy: sortBy.value,
        sortDir: sortDir.value,
        page: String(page),
        limit: String(LIMIT),
      });
      if (range.value === 'custom' && customStart.value && customEnd.value) {
        params.set('start', customStart.value);
        params.set('end', customEnd.value);
      }

      const res = await $fetch<any>(
        `${config.public.apiBase}/v1/analytics/products?${params}`,
        { credentials: 'include' }
      );

      if (!res?.ok) break;

      (res.items ?? []).forEach((p: any) => allRows.push(rowToCsv(p)));
      totalPages = res.totalPages ?? 1;
      exportProgress.value = `${allRows.length} / ${res.total ?? '?'}`;
      page++;
    } while (page < totalPages);

    if (allRows.length) {
      const date = new Date().toISOString().split('T')[0];
      downloadCsv(allRows, `metaflow-products-all-${date}.csv`);
    }
  } finally {
    exportingAll.value = false;
    exportProgress.value = '';
  }
}

// Close export menu on outside click
function onDocClick(e: MouseEvent) {
  if (exportMenuRef.value && !exportMenuRef.value.contains(e.target as Node)) {
    showExportMenu.value = false;
  }
}
onMounted(() => document.addEventListener('click', onDocClick, { capture: true }));
onUnmounted(() => document.removeEventListener('click', onDocClick, { capture: true }));

// Auto-load when store becomes available
watch(storeId, (id) => {
  if (id && mode.value === 'all') doInspect(0);
}, { immediate: true });

watch(mode, (m) => {
  if (m === 'all' && storeId.value && !apiData.value) doInspect(0);
});
</script>

<style scoped>
.fade-drop-enter-active,
.fade-drop-leave-active {
  transition: opacity 0.12s ease, transform 0.12s ease;
}
.fade-drop-enter-from,
.fade-drop-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>

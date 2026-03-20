<template>
  <div class="space-y-6">

    <!-- Header -->
    <div class="flex items-start justify-between gap-4">
      <div>
        <h1 class="text-xl font-semibold text-white">Products Debug</h1>
        <p class="text-sm text-white/55 mt-1">Inspect raw DB metric data by date range — or drill into a single product by SKU</p>
      </div>
      <button
        v-if="storeId && (mode === 'all' ? !!data : !!skuData)"
        @click="mode === 'all' ? load() : doSkuLookup()"
        :disabled="loading || skuLoading"
        class="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-medium text-white/80 hover:bg-white/[0.07] hover:text-white transition-all disabled:opacity-50"
      >
        <svg class="w-4 h-4" :class="(loading || skuLoading) && 'animate-spin'" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"/>
        </svg>
        Refresh
      </button>
    </div>

    <!-- Config panel -->
    <div class="rounded-2xl border border-white/8 bg-white/[0.03] p-5 space-y-4">

      <!-- Store picker -->
      <div>
        <label class="block text-xs font-semibold text-white/60 mb-2 uppercase tracking-wider">Store</label>
        <div v-if="loadingStores" class="h-10 rounded-xl bg-white/4 animate-pulse"></div>
        <div v-else-if="!stores.length" class="text-sm text-white/50 py-2">No stores found</div>
        <div v-else class="flex items-center gap-3 flex-wrap">
          <select
            v-model="storeId"
            @change="onStoreChange"
            class="flex-1 min-w-[200px] rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2.5 text-sm text-white appearance-none focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30"
          >
            <option value="" disabled>Choose a store…</option>
            <option v-for="s in stores" :key="s.id" :value="s.id">
              {{ s.name }} — {{ s.platform }} ({{ s._count.products }} products)
            </option>
          </select>
          <span v-if="storeId" class="text-xs text-white/40 font-mono shrink-0">{{ storeId }}</span>

          <!-- Force sync controls (only shown once a store is selected) -->
          <template v-if="storeId">
            <select
              v-model="syncProvider"
              class="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2.5 text-sm text-white appearance-none focus:outline-none focus:border-orange-500/50"
            >
              <option value="ALL">All providers</option>
              <option value="WOOCOMMERCE">WooCommerce only</option>
              <option value="SHOPIFY">Shopify only</option>
              <option value="META">Meta only</option>
            </select>
            <button
              @click="forceSync"
              :disabled="syncing"
              class="flex items-center gap-2 rounded-xl bg-orange-600 hover:bg-orange-500 disabled:opacity-40 text-white text-sm font-semibold px-4 py-2.5 transition-colors shadow-lg shadow-orange-500/20"
            >
              <svg class="w-4 h-4" :class="syncing && 'animate-spin'" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"/>
              </svg>
              {{ syncing ? 'Enqueuing…' : 'Force Sync' }}
            </button>
            <span v-if="syncMsg" class="text-xs" :class="syncMsg.includes('Error') ? 'text-red-400' : 'text-green-400'">
              {{ syncMsg }}
            </span>
          </template>
        </div>
      </div>

      <!-- Mode tabs -->
      <div class="flex gap-1 p-1 rounded-xl bg-white/[0.04] border border-white/8 w-fit">
        <button
          @click="mode = 'all'"
          class="rounded-lg px-4 py-1.5 text-xs font-semibold transition-all"
          :class="mode === 'all'
            ? 'bg-violet-600 text-white shadow-md shadow-violet-500/20'
            : 'text-white/55 hover:text-white/80'"
        >All Products</button>
        <button
          @click="mode = 'sku'"
          class="rounded-lg px-4 py-1.5 text-xs font-semibold transition-all"
          :class="mode === 'sku'
            ? 'bg-violet-600 text-white shadow-md shadow-violet-500/20'
            : 'text-white/55 hover:text-white/80'"
        >SKU / Product Lookup</button>
      </div>

      <!-- ── All Products controls ─────────────────────────────────────── -->
      <div v-if="mode === 'all'" class="flex flex-wrap items-end gap-3">
        <div class="min-w-[140px]">
          <label class="block text-xs font-semibold text-white/60 mb-2 uppercase tracking-wider">Date Range</label>
          <select v-model="range" class="w-full rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2.5 text-sm text-white appearance-none focus:outline-none focus:border-violet-500/50">
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
            <input type="date" v-model="customStart" class="w-full rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500/50 [color-scheme:dark]"/>
          </div>
          <div class="min-w-[150px]">
            <label class="block text-xs font-semibold text-white/60 mb-2 uppercase tracking-wider">End Date</label>
            <input type="date" v-model="customEnd" class="w-full rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500/50 [color-scheme:dark]"/>
          </div>
        </template>
        <div class="min-w-[170px]">
          <label class="block text-xs font-semibold text-white/60 mb-2 uppercase tracking-wider">Sort By</label>
          <select v-model="sortBy" class="w-full rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2.5 text-sm text-white appearance-none focus:outline-none focus:border-violet-500/50">
            <option value="spend">Spend</option>
            <option value="revenue">Revenue (Store)</option>
            <option value="metaRevenue">Meta Revenue</option>
            <option value="impressions">Impressions</option>
            <option value="clicks">Clicks</option>
            <option value="roas">ROAS (Meta)</option>
            <option value="score">Score</option>
            <option value="metricRows">Metric Row Count</option>
          </select>
        </div>
        <div class="min-w-[120px]">
          <label class="block text-xs font-semibold text-white/60 mb-2 uppercase tracking-wider">Direction</label>
          <select v-model="sortDir" class="w-full rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2.5 text-sm text-white appearance-none focus:outline-none focus:border-violet-500/50">
            <option value="desc">High → Low</option>
            <option value="asc">Low → High</option>
          </select>
        </div>
        <button v-if="storeId" @click="doInspect" :disabled="loading"
          class="rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-sm font-semibold px-5 py-2.5 transition-colors shadow-lg shadow-violet-500/20"
        >{{ loading ? 'Loading…' : 'Inspect' }}</button>
      </div>

      <!-- ── SKU Lookup controls ────────────────────────────────────────── -->
      <div v-else class="flex flex-wrap items-end gap-3">
        <div class="flex-1 min-w-[220px]">
          <label class="block text-xs font-semibold text-white/60 mb-2 uppercase tracking-wider">SKU / Title / External ID</label>
          <input
            v-model="skuQuery"
            @keyup.enter="doSkuLookup"
            type="text"
            placeholder="e.g. SKU-1234, Product Name, 9876543210…"
            class="w-full rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2.5 text-sm text-white placeholder-white/25 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30"
          />
        </div>
        <div class="min-w-[140px]">
          <label class="block text-xs font-semibold text-white/60 mb-2 uppercase tracking-wider">Date Range</label>
          <select v-model="range" class="w-full rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2.5 text-sm text-white appearance-none focus:outline-none focus:border-violet-500/50">
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
            <input type="date" v-model="customStart" class="w-full rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500/50 [color-scheme:dark]"/>
          </div>
          <div class="min-w-[150px]">
            <label class="block text-xs font-semibold text-white/60 mb-2 uppercase tracking-wider">End Date</label>
            <input type="date" v-model="customEnd" class="w-full rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500/50 [color-scheme:dark]"/>
          </div>
        </template>
        <button v-if="storeId" @click="doSkuLookup" :disabled="skuLoading || !skuQuery.trim()"
          class="rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-sm font-semibold px-5 py-2.5 transition-colors shadow-lg shadow-violet-500/20"
        >{{ skuLoading ? 'Searching…' : 'Lookup' }}</button>
      </div>
    </div>

    <!-- Empty state -->
    <div v-if="!storeId && !loading && !skuLoading" class="rounded-2xl border border-white/8 bg-white/[0.03] p-10 text-center">
      <svg class="w-10 h-10 text-white/20 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1">
        <path stroke-linecap="round" stroke-linejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125"/>
      </svg>
      <p class="text-sm text-white/40">Select a store above to start inspecting product data</p>
    </div>

    <!-- ══════════════════════════════════════════════════════════════════ -->
    <!-- ALL PRODUCTS MODE                                                  -->
    <!-- ══════════════════════════════════════════════════════════════════ -->
    <template v-if="mode === 'all'">

      <!-- Loading skeleton -->
      <div v-if="loading" class="space-y-4">
        <div class="h-20 rounded-2xl bg-white/4 animate-pulse border border-white/6"></div>
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div v-for="i in 4" :key="i" class="h-24 rounded-2xl bg-white/4 animate-pulse border border-white/6"></div>
        </div>
        <div class="h-72 rounded-2xl bg-white/4 animate-pulse border border-white/6"></div>
      </div>

      <template v-if="data && !loading">

        <!-- Resolved date range info -->
        <div class="rounded-2xl border border-blue-500/20 bg-blue-500/[0.06] px-5 py-4 flex flex-wrap gap-x-10 gap-y-3 items-start">
          <div>
            <p class="text-[10px] font-bold uppercase tracking-widest text-blue-400/70 mb-1">Resolved Range</p>
            <p class="text-base font-semibold font-mono text-white/90">{{ data.dateRange.sinceDate }} → {{ data.dateRange.untilDate }}</p>
            <p class="text-xs text-blue-300/60 mt-0.5">preset: <span class="font-mono">{{ data.dateRange.resolved }}</span></p>
          </div>
          <div>
            <p class="text-[10px] font-bold uppercase tracking-widest text-blue-400/70 mb-1">UTC Since</p>
            <p class="text-xs font-mono text-white/60">{{ data.dateRange.since }}</p>
          </div>
          <div>
            <p class="text-[10px] font-bold uppercase tracking-widest text-blue-400/70 mb-1">UTC Until</p>
            <p class="text-xs font-mono text-white/60">{{ data.dateRange.until }}</p>
          </div>
          <div>
            <p class="text-[10px] font-bold uppercase tracking-widest text-blue-400/70 mb-1">Store</p>
            <p class="text-sm text-white/80 font-medium">{{ data.store.name }}</p>
            <p class="text-xs font-mono text-blue-300/60 mt-0.5">{{ data.store.currency }}</p>
          </div>
        </div>

        <!-- Stats cards -->
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div class="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
            <p class="text-2xl font-bold text-white tabular-nums">{{ data.stats.totalProducts.toLocaleString() }}</p>
            <p class="text-xs text-white/50 mt-0.5">Total Products (DB)</p>
          </div>
          <div class="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.06] p-4">
            <p class="text-2xl font-bold text-emerald-300 tabular-nums">{{ data.stats.productsWithMetrics.toLocaleString() }}</p>
            <p class="text-xs text-emerald-400/70 mt-0.5">Have Metrics in Range</p>
          </div>
          <div class="rounded-2xl border border-amber-500/20 bg-amber-500/[0.06] p-4">
            <p class="text-2xl font-bold text-amber-300 tabular-nums">{{ data.stats.productsWithNoMetrics.toLocaleString() }}</p>
            <p class="text-xs text-amber-400/70 mt-0.5">No Metrics in Range</p>
          </div>
          <div class="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
            <p class="text-2xl font-bold text-white tabular-nums">{{ data.stats.totalMetricRows.toLocaleString() }}</p>
            <p class="text-xs text-white/50 mt-0.5">Daily Metric Rows in Range</p>
          </div>
        </div>

        <!-- Raw metrics table -->
        <div class="rounded-2xl border border-white/8 bg-white/[0.03]">
          <div class="flex items-center justify-between gap-4 px-5 py-4 border-b border-white/6">
            <div>
              <p class="text-sm font-semibold text-white">Raw Aggregated Metrics</p>
              <p class="text-xs text-white/50 mt-0.5">
                Showing {{ pageStart }}–{{ pageEnd }} of {{ data.total.toLocaleString() }} products ·
                sorted by <span class="font-mono text-white/60">{{ data.params.sortBy }}</span> {{ data.params.sortDir }}
                <span class="text-white/30 mx-1">·</span>
                <span :class="data.stats.productsWithNoMetrics > 0 ? 'text-amber-400' : 'text-emerald-400'">
                  {{ data.stats.productsWithNoMetrics }} with zero data
                </span>
              </p>
            </div>
            <div class="flex items-center gap-2 flex-shrink-0">
              <button @click="prevPage" :disabled="page === 0"
                class="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-white/70 hover:bg-white/[0.07] disabled:opacity-30 transition-colors"
              >← Prev</button>
              <span class="text-xs text-white/45 min-w-[60px] text-center">{{ page + 1 }} / {{ data.totalPages }}</span>
              <button @click="nextPage" :disabled="page >= data.totalPages - 1"
                class="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-white/70 hover:bg-white/[0.07] disabled:opacity-30 transition-colors"
              >Next →</button>
            </div>
          </div>

          <div class="overflow-x-auto">
            <table class="w-full text-xs">
              <thead>
                <tr class="border-b border-white/6 bg-white/[0.015]">
                  <th class="text-left px-4 py-3 text-white/45 font-semibold whitespace-nowrap sticky left-0 bg-[#0d0d14]/95">Product</th>
                  <th class="text-right px-3 py-3 text-white/45 font-semibold whitespace-nowrap" title="DailyMetric rows in range">Rows</th>
                  <th class="text-right px-3 py-3 text-white/45 font-semibold whitespace-nowrap">Spend</th>
                  <th class="text-right px-3 py-3 text-white/45 font-semibold whitespace-nowrap">Store Rev</th>
                  <th class="text-right px-3 py-3 text-violet-400/80 font-semibold whitespace-nowrap" title="Meta action_values per product">Meta Rev</th>
                  <th class="text-right px-3 py-3 text-white/45 font-semibold whitespace-nowrap">Impr</th>
                  <th class="text-right px-3 py-3 text-white/45 font-semibold whitespace-nowrap">Clicks</th>
                  <th class="text-right px-3 py-3 text-white/45 font-semibold whitespace-nowrap">Conv</th>
                  <th class="text-right px-3 py-3 text-amber-400/80 font-semibold whitespace-nowrap" title="omni_add_to_cart (omni top, site small)">ATC</th>
                  <th class="text-right px-3 py-3 text-orange-400/80 font-semibold whitespace-nowrap" title="omni_initiated_checkout (omni top, site small)">Checkout</th>
                  <th class="text-right px-3 py-3 text-violet-400/80 font-semibold whitespace-nowrap" title="metaRevenue / spend">ROAS</th>
                  <th class="text-right px-3 py-3 text-blue-400/80 font-semibold whitespace-nowrap" title="storeRevenue / spend">Blend</th>
                  <th class="text-right px-3 py-3 text-white/45 font-semibold whitespace-nowrap">CTR</th>
                  <th class="text-right px-3 py-3 text-white/45 font-semibold whitespace-nowrap" title="Latest inventoryLevel">Inv</th>
                  <th class="text-right px-3 py-3 text-white/45 font-semibold whitespace-nowrap">Snap Date</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="item in data.items"
                  :key="item.productId"
                  class="border-b border-white/4 hover:bg-white/[0.025] transition-colors"
                  :class="!item.hasMetrics && 'opacity-35'"
                >
                  <td class="px-4 py-2.5 max-w-[200px] sticky left-0 bg-[#0d0d14]/95 border-r border-white/4">
                    <p class="text-white/80 truncate font-medium">{{ item.title }}</p>
                    <div class="flex items-center gap-1.5 mt-0.5">
                      <span v-if="item.sku" class="font-mono text-[10px] text-white/35">{{ item.sku }}</span>
                      <span v-if="item.category" class="inline-flex rounded px-1.5 py-px text-[9px] font-semibold uppercase"
                        :class="{
                          'bg-emerald-500/15 text-emerald-400': item.category === 'SCALE',
                          'bg-blue-500/15 text-blue-400':       item.category === 'TEST',
                          'bg-amber-500/15 text-amber-400':     item.category === 'RISK',
                          'bg-red-500/15 text-red-400':         item.category === 'KILL',
                        }"
                      >{{ item.category }}</span>
                    </div>
                  </td>
                  <td class="px-3 py-2.5 text-right tabular-nums font-mono font-semibold">
                    <span :class="item.metricRowCount > 0 ? 'text-emerald-400' : 'text-red-400/80'">{{ item.metricRowCount }}</span>
                  </td>
                  <td class="px-3 py-2.5 text-right tabular-nums font-mono text-white/70">{{ fmtMoney(item.rawSums.spend) }}</td>
                  <td class="px-3 py-2.5 text-right tabular-nums font-mono text-white/70">{{ fmtMoney(item.rawSums.revenue) }}</td>
                  <td class="px-3 py-2.5 text-right tabular-nums font-mono font-semibold" :class="item.rawSums.metaRevenue > 0 ? 'text-violet-300' : 'text-white/25'">
                    {{ item.rawSums.metaRevenue > 0 ? fmtMoney(item.rawSums.metaRevenue) : '—' }}
                  </td>
                  <td class="px-3 py-2.5 text-right tabular-nums text-white/60">{{ item.rawSums.impressions.toLocaleString() }}</td>
                  <td class="px-3 py-2.5 text-right tabular-nums text-white/60">{{ item.rawSums.clicks.toLocaleString() }}</td>
                  <td class="px-3 py-2.5 text-right tabular-nums text-white/60">{{ item.rawSums.conversions.toLocaleString() }}</td>
                  <td class="px-3 py-2.5 text-right tabular-nums text-amber-400/80">
                    <span class="block">{{ (item.rawSums.addToCartOmni ?? 0).toLocaleString() }}</span>
                    <span class="block text-[10px] text-white/30">{{ (item.rawSums.addToCart ?? 0).toLocaleString() }}s</span>
                  </td>
                  <td class="px-3 py-2.5 text-right tabular-nums text-orange-400/80">
                    <span class="block">{{ (item.rawSums.checkoutInitiatedOmni ?? 0).toLocaleString() }}</span>
                    <span class="block text-[10px] text-white/30">{{ (item.rawSums.checkoutInitiated ?? 0).toLocaleString() }}s</span>
                  </td>
                  <td class="px-3 py-2.5 text-right tabular-nums font-semibold" :class="item.computed.roas > 0 ? 'text-violet-300' : 'text-white/20'">
                    {{ item.computed.roas > 0 ? item.computed.roas.toFixed(2) + 'x' : '—' }}
                  </td>
                  <td class="px-3 py-2.5 text-right tabular-nums font-semibold" :class="item.computed.blendedRoas !== null ? 'text-blue-300' : 'text-white/20'">
                    {{ item.computed.blendedRoas !== null ? item.computed.blendedRoas.toFixed(2) + 'x' : '—' }}
                  </td>
                  <td class="px-3 py-2.5 text-right tabular-nums text-white/55">
                    {{ item.computed.ctr > 0 ? (item.computed.ctr * 100).toFixed(2) + '%' : '—' }}
                  </td>
                  <td class="px-3 py-2.5 text-right tabular-nums font-semibold">
                    <span v-if="item.snapshot?.inventoryLevel !== null && item.snapshot?.inventoryLevel !== undefined"
                      :class="(item.snapshot.inventoryLevel ?? 0) > 0 ? 'text-emerald-400' : 'text-red-400'"
                    >{{ item.snapshot.inventoryLevel }}</span>
                    <span v-else class="text-white/20">—</span>
                  </td>
                  <td class="px-3 py-2.5 text-right font-mono text-white/25 text-[10px]">
                    {{ item.snapshot?.date ? String(item.snapshot.date).slice(0, 10) : '—' }}
                  </td>
                </tr>
              </tbody>
            </table>
            <div v-if="!data.items.length" class="p-10 text-center text-sm text-white/40">No products found for this store and date range</div>
          </div>

          <div v-if="data.totalPages > 1" class="flex items-center justify-between border-t border-white/6 px-5 py-3">
            <p class="text-xs text-white/40">{{ pageStart }}–{{ pageEnd }} of {{ data.total.toLocaleString() }}</p>
            <div class="flex items-center gap-2">
              <button @click="prevPage" :disabled="page === 0"
                class="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-white/70 hover:bg-white/[0.07] disabled:opacity-30 transition-colors"
              >← Prev</button>
              <span class="text-xs text-white/45">{{ page + 1 }} / {{ data.totalPages }}</span>
              <button @click="nextPage" :disabled="page >= data.totalPages - 1"
                class="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-white/70 hover:bg-white/[0.07] disabled:opacity-30 transition-colors"
              >Next →</button>
            </div>
          </div>
        </div>

        <!-- Column key -->
        <div class="rounded-2xl border border-white/6 bg-white/[0.02] px-5 py-4">
          <p class="text-xs font-bold text-white/50 uppercase tracking-wider mb-3">Column Reference</p>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-1.5 text-xs">
            <div class="flex gap-2"><span class="text-white/60 font-semibold min-w-[80px]">Rows</span><span class="text-white/40">DailyMetric rows found in the date range</span></div>
            <div class="flex gap-2"><span class="text-white/60 font-semibold min-w-[80px]">Store Rev</span><span class="text-white/40">Total store order revenue (Shopify/WooCommerce)</span></div>
            <div class="flex gap-2"><span class="text-violet-400/80 font-semibold min-w-[80px]">Meta Rev</span><span class="text-white/40">Meta action_values per product (breakdowns=product_id)</span></div>
            <div class="flex gap-2"><span class="text-violet-400/80 font-semibold min-w-[80px]">ROAS</span><span class="text-white/40">metaRevenue ÷ spend — per-product Meta attribution</span></div>
            <div class="flex gap-2"><span class="text-blue-400/80 font-semibold min-w-[80px]">Blend</span><span class="text-white/40">storeRevenue ÷ spend — shown only when storeRevenue &gt; 0</span></div>
            <div class="flex gap-2"><span class="text-white/60 font-semibold min-w-[80px]">Inv</span><span class="text-white/40">Latest inventoryLevel from most recent DailyMetric snapshot</span></div>
          </div>
        </div>

      </template>
    </template>

    <!-- ══════════════════════════════════════════════════════════════════ -->
    <!-- SKU LOOKUP MODE                                                    -->
    <!-- ══════════════════════════════════════════════════════════════════ -->
    <template v-if="mode === 'sku'">

      <!-- SKU loading skeleton -->
      <div v-if="skuLoading" class="space-y-4">
        <div class="h-20 rounded-2xl bg-white/4 animate-pulse border border-white/6"></div>
        <div class="h-64 rounded-2xl bg-white/4 animate-pulse border border-white/6"></div>
      </div>

      <template v-if="skuData && !skuLoading">

        <!-- Resolved date range -->
        <div class="rounded-2xl border border-blue-500/20 bg-blue-500/[0.06] px-5 py-4 flex flex-wrap gap-x-10 gap-y-3 items-start">
          <div>
            <p class="text-[10px] font-bold uppercase tracking-widest text-blue-400/70 mb-1">Query</p>
            <p class="text-sm font-mono text-white/80">"{{ skuData.query }}"</p>
            <p class="text-xs text-blue-300/60 mt-0.5">
              {{ skuData.matches.length === 0 ? 'No matches found' : `${skuData.matches.length} product${skuData.matches.length > 1 ? 's' : ''} matched` }}
            </p>
          </div>
          <div>
            <p class="text-[10px] font-bold uppercase tracking-widest text-blue-400/70 mb-1">Date Range</p>
            <p class="text-sm font-mono text-white/80">{{ skuData.dateRange.sinceDate }} → {{ skuData.dateRange.untilDate }}</p>
            <p class="text-xs text-blue-300/60 mt-0.5">preset: {{ skuData.dateRange.resolved }}</p>
          </div>
          <div>
            <p class="text-[10px] font-bold uppercase tracking-widest text-blue-400/70 mb-1">UTC Since</p>
            <p class="text-xs font-mono text-white/60">{{ skuData.dateRange.since }}</p>
          </div>
          <div>
            <p class="text-[10px] font-bold uppercase tracking-widest text-blue-400/70 mb-1">UTC Until</p>
            <p class="text-xs font-mono text-white/60">{{ skuData.dateRange.until }}</p>
          </div>
        </div>

        <!-- No matches -->
        <div v-if="!skuData.matches.length" class="rounded-2xl border border-amber-500/20 bg-amber-500/[0.06] p-8 text-center">
          <svg class="w-9 h-9 text-amber-400/50 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 15.803a7.5 7.5 0 0 0 10.607 10.607Z"/>
          </svg>
          <p class="text-sm font-semibold text-amber-300">No products found matching "{{ skuData.query }}"</p>
          <p class="text-xs text-amber-400/70 mt-1">Try a partial SKU, part of the product title, or the external ID</p>
        </div>

        <!-- Match cards -->
        <div v-for="match in skuData.matches" :key="match.product.id" class="space-y-3">

          <!-- Product info + totals card -->
          <div class="rounded-2xl border border-white/8 bg-white/[0.03] p-5">
            <div class="flex flex-wrap items-start justify-between gap-4 mb-4">
              <div>
                <p class="text-base font-semibold text-white leading-tight">{{ match.product.title }}</p>
                <div class="flex flex-wrap items-center gap-2 mt-1.5">
                  <span v-if="match.product.sku" class="font-mono text-xs text-amber-300/80 bg-amber-500/10 border border-amber-500/20 rounded-lg px-2 py-0.5">{{ match.product.sku }}</span>
                  <span v-if="match.product.externalId" class="font-mono text-xs text-blue-300/70 bg-blue-500/10 border border-blue-500/20 rounded-lg px-2 py-0.5">ext: {{ match.product.externalId }}</span>
                  <span v-if="match.product.category" class="inline-flex rounded-lg px-2 py-0.5 text-xs font-semibold uppercase"
                    :class="{
                      'bg-emerald-500/15 text-emerald-400': match.product.category === 'SCALE',
                      'bg-blue-500/15 text-blue-400':       match.product.category === 'TEST',
                      'bg-amber-500/15 text-amber-400':     match.product.category === 'RISK',
                      'bg-red-500/15 text-red-400':         match.product.category === 'KILL',
                    }"
                  >{{ match.product.category }}</span>
                </div>
                <p class="text-[10px] font-mono text-white/25 mt-1">{{ match.product.id }}</p>
              </div>
              <div class="flex items-center gap-2 flex-shrink-0">
                <span class="text-xs font-mono rounded-xl border px-3 py-1.5"
                  :class="match.rowCount > 0 ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400' : 'border-red-500/20 bg-red-500/10 text-red-400'"
                >{{ match.rowCount }} row{{ match.rowCount !== 1 ? 's' : '' }} in range</span>
              </div>
            </div>

            <!-- Totals grid -->
            <div class="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
              <div class="rounded-xl bg-white/[0.04] border border-white/6 px-3 py-2.5">
                <p class="text-[10px] text-white/45 mb-1">Spend</p>
                <p class="text-sm font-bold text-white tabular-nums font-mono">{{ fmtMoney(match.totals.spend) }}</p>
              </div>
              <div class="rounded-xl bg-white/[0.04] border border-white/6 px-3 py-2.5">
                <p class="text-[10px] text-white/45 mb-1">Store Rev</p>
                <p class="text-sm font-bold text-white tabular-nums font-mono">{{ fmtMoney(match.totals.revenue) }}</p>
              </div>
              <div class="rounded-xl bg-violet-500/[0.08] border border-violet-500/20 px-3 py-2.5">
                <p class="text-[10px] text-violet-400/80 mb-1">Meta Rev</p>
                <p class="text-sm font-bold tabular-nums font-mono" :class="match.totals.metaRevenue > 0 ? 'text-violet-300' : 'text-white/30'">
                  {{ match.totals.metaRevenue > 0 ? fmtMoney(match.totals.metaRevenue) : '—' }}
                </p>
              </div>
              <div class="rounded-xl bg-violet-500/[0.08] border border-violet-500/20 px-3 py-2.5">
                <p class="text-[10px] text-violet-400/80 mb-1">ROAS</p>
                <p class="text-sm font-bold tabular-nums" :class="match.totals.computed.roas > 0 ? 'text-violet-300' : 'text-white/30'">
                  {{ match.totals.computed.roas > 0 ? match.totals.computed.roas.toFixed(2) + 'x' : '—' }}
                </p>
              </div>
              <div class="rounded-xl bg-blue-500/[0.06] border border-blue-500/15 px-3 py-2.5">
                <p class="text-[10px] text-blue-400/80 mb-1">Blended ROAS</p>
                <p class="text-sm font-bold tabular-nums" :class="match.totals.computed.blendedRoas !== null ? 'text-blue-300' : 'text-white/30'">
                  {{ match.totals.computed.blendedRoas !== null ? match.totals.computed.blendedRoas.toFixed(2) + 'x' : '—' }}
                </p>
              </div>
              <div class="rounded-xl bg-white/[0.04] border border-white/6 px-3 py-2.5">
                <p class="text-[10px] text-white/45 mb-1">Impressions</p>
                <p class="text-sm font-bold text-white tabular-nums">{{ match.totals.impressions.toLocaleString() }}</p>
              </div>
              <div class="rounded-xl bg-white/[0.04] border border-white/6 px-3 py-2.5">
                <p class="text-[10px] text-white/45 mb-1">Clicks / Conv</p>
                <p class="text-sm font-bold text-white tabular-nums">{{ match.totals.clicks.toLocaleString() }} / {{ match.totals.conversions }}</p>
              </div>
              <div class="rounded-xl bg-amber-500/[0.06] border border-amber-500/15 px-3 py-2.5">
                <p class="text-[10px] text-amber-400/80 mb-1">ATC (Omni)</p>
                <p class="text-sm font-bold text-amber-300 tabular-nums">{{ (match.totals.addToCartOmni ?? 0).toLocaleString() }}</p>
                <p class="text-[10px] text-white/30 mt-0.5">{{ (match.totals.addToCart ?? 0).toLocaleString() }} site</p>
              </div>
              <div class="rounded-xl bg-orange-500/[0.06] border border-orange-500/15 px-3 py-2.5">
                <p class="text-[10px] text-orange-400/80 mb-1">Checkout (Omni)</p>
                <p class="text-sm font-bold text-orange-300 tabular-nums">{{ (match.totals.checkoutInitiatedOmni ?? 0).toLocaleString() }}</p>
                <p class="text-[10px] text-white/30 mt-0.5">{{ (match.totals.checkoutInitiated ?? 0).toLocaleString() }} site</p>
              </div>
            </div>
          </div>

          <!-- Day-by-day table -->
          <div class="rounded-2xl border border-white/8 bg-white/[0.03]">
            <div class="flex items-center justify-between px-5 py-3 border-b border-white/6">
              <p class="text-sm font-semibold text-white">Day-by-Day Breakdown</p>
              <div class="flex items-center gap-2">
                <span class="inline-flex items-center gap-1.5 text-[10px] text-violet-400/80">
                  <span class="h-2 w-2 rounded-full bg-violet-400 inline-block"></span>Computed (per-product)
                </span>
                <span class="inline-flex items-center gap-1.5 text-[10px] text-amber-400/80">
                  <span class="h-2 w-2 rounded-full bg-amber-400 inline-block"></span>Stored (campaign-level)
                </span>
              </div>
            </div>

            <div v-if="!match.dailyRows.length" class="p-8 text-center text-sm text-white/40">
              No daily metric rows found in this date range for this product
            </div>

            <div v-else class="overflow-x-auto">
              <table class="w-full text-xs">
                <thead>
                  <tr class="border-b border-white/6 bg-white/[0.015]">
                    <th class="text-left px-4 py-3 text-white/45 font-semibold whitespace-nowrap sticky left-0 bg-[#0d0d14]/95">Date</th>
                    <th class="text-right px-3 py-3 text-white/45 font-semibold whitespace-nowrap">Spend</th>
                    <th class="text-right px-3 py-3 text-white/45 font-semibold whitespace-nowrap">Store Rev</th>
                    <th class="text-right px-3 py-3 text-violet-400/80 font-semibold whitespace-nowrap">Meta Rev</th>
                    <th class="text-right px-3 py-3 text-white/45 font-semibold whitespace-nowrap">Impr</th>
                    <th class="text-right px-3 py-3 text-white/45 font-semibold whitespace-nowrap">Clicks</th>
                    <th class="text-right px-3 py-3 text-white/45 font-semibold whitespace-nowrap">Conv</th>
                    <th class="text-right px-3 py-3 text-amber-400/80 font-semibold whitespace-nowrap" title="omni_add_to_cart (omni) / site">ATC</th>
                    <th class="text-right px-3 py-3 text-orange-400/80 font-semibold whitespace-nowrap" title="omni_initiated_checkout (omni) / site">Checkout</th>
                    <!-- Computed (violet) -->
                    <th class="text-right px-3 py-3 text-violet-400/80 font-semibold whitespace-nowrap" title="metaRevenue / spend for this row">ROAS ✦</th>
                    <th class="text-right px-3 py-3 text-blue-400/80 font-semibold whitespace-nowrap" title="storeRevenue / spend">Blend ✦</th>
                    <th class="text-right px-3 py-3 text-violet-400/80 font-semibold whitespace-nowrap" title="clicks / impressions">CTR ✦</th>
                    <!-- Stored (amber) -->
                    <th class="text-right px-3 py-3 text-amber-400/80 font-semibold whitespace-nowrap" title="Stored roas field — campaign-level purchaseRoas from Meta API">ROAS ⚙</th>
                    <th class="text-right px-3 py-3 text-amber-400/80 font-semibold whitespace-nowrap" title="Stored ctr field — campaign-level from Meta API">CTR ⚙</th>
                    <th class="text-right px-3 py-3 text-amber-400/80 font-semibold whitespace-nowrap" title="Stored blendedRoas field">Blend ⚙</th>
                    <!-- Other -->
                    <th class="text-right px-3 py-3 text-white/45 font-semibold whitespace-nowrap">Inv</th>
                    <th class="text-right px-3 py-3 text-white/45 font-semibold whitespace-nowrap">Margin</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="row in match.dailyRows"
                    :key="row.date"
                    class="border-b border-white/4 hover:bg-white/[0.025] transition-colors"
                  >
                    <td class="px-4 py-2 font-mono text-white/70 whitespace-nowrap sticky left-0 bg-[#0d0d14]/95 border-r border-white/4">{{ row.date }}</td>
                    <td class="px-3 py-2 text-right tabular-nums font-mono text-white/65">{{ fmtMoney(row.spend) }}</td>
                    <td class="px-3 py-2 text-right tabular-nums font-mono text-white/65">{{ fmtMoney(row.revenue) }}</td>
                    <td class="px-3 py-2 text-right tabular-nums font-mono font-semibold" :class="row.metaRevenue > 0 ? 'text-violet-300' : 'text-white/20'">
                      {{ row.metaRevenue > 0 ? fmtMoney(row.metaRevenue) : '—' }}
                    </td>
                    <td class="px-3 py-2 text-right tabular-nums text-white/55">{{ row.impressions.toLocaleString() }}</td>
                    <td class="px-3 py-2 text-right tabular-nums text-white/55">{{ row.clicks.toLocaleString() }}</td>
                    <td class="px-3 py-2 text-right tabular-nums text-white/55">{{ row.conversions }}</td>
                    <td class="px-3 py-2 text-right tabular-nums text-amber-400/80">
                      <span>{{ (row.addToCartOmni ?? 0).toLocaleString() }}</span>
                      <span class="block text-[10px] text-white/25">{{ (row.addToCart ?? 0).toLocaleString() }}s</span>
                    </td>
                    <td class="px-3 py-2 text-right tabular-nums text-orange-400/80">
                      <span>{{ (row.checkoutInitiatedOmni ?? 0).toLocaleString() }}</span>
                      <span class="block text-[10px] text-white/25">{{ (row.checkoutInitiated ?? 0).toLocaleString() }}s</span>
                    </td>
                    <!-- Computed -->
                    <td class="px-3 py-2 text-right tabular-nums font-semibold" :class="row.computed.roas > 0 ? 'text-violet-300' : 'text-white/20'">
                      {{ row.computed.roas > 0 ? row.computed.roas.toFixed(2) + 'x' : '—' }}
                    </td>
                    <td class="px-3 py-2 text-right tabular-nums font-semibold" :class="row.computed.blendedRoas !== null ? 'text-blue-300' : 'text-white/20'">
                      {{ row.computed.blendedRoas !== null ? row.computed.blendedRoas.toFixed(2) + 'x' : '—' }}
                    </td>
                    <td class="px-3 py-2 text-right tabular-nums" :class="row.computed.ctr > 0 ? 'text-violet-300/80' : 'text-white/20'">
                      {{ row.computed.ctr > 0 ? (row.computed.ctr * 100).toFixed(2) + '%' : '—' }}
                    </td>
                    <!-- Stored (campaign-level) -->
                    <td class="px-3 py-2 text-right tabular-nums font-mono" :class="row.stored.roas !== null ? 'text-amber-400/80' : 'text-white/20'">
                      {{ row.stored.roas !== null ? Number(row.stored.roas).toFixed(2) + 'x' : '—' }}
                    </td>
                    <td class="px-3 py-2 text-right tabular-nums font-mono" :class="row.stored.ctr !== null ? 'text-amber-400/80' : 'text-white/20'">
                      {{ row.stored.ctr !== null ? (Number(row.stored.ctr) * 100).toFixed(2) + '%' : '—' }}
                    </td>
                    <td class="px-3 py-2 text-right tabular-nums font-mono" :class="row.stored.blendedRoas !== null ? 'text-amber-400/80' : 'text-white/20'">
                      {{ row.stored.blendedRoas !== null ? Number(row.stored.blendedRoas).toFixed(2) + 'x' : '—' }}
                    </td>
                    <!-- Other -->
                    <td class="px-3 py-2 text-right tabular-nums font-semibold">
                      <span v-if="row.inventoryLevel !== null" :class="row.inventoryLevel > 0 ? 'text-emerald-400' : 'text-red-400'">{{ row.inventoryLevel }}</span>
                      <span v-else class="text-white/20">—</span>
                    </td>
                    <td class="px-3 py-2 text-right tabular-nums text-white/45">
                      {{ row.margin !== null ? (row.margin * 100).toFixed(1) + '%' : '—' }}
                    </td>
                  </tr>

                  <!-- Totals row -->
                  <tr class="border-t-2 border-white/10 bg-white/[0.03]">
                    <td class="px-4 py-2.5 font-semibold text-white/70 sticky left-0 bg-white/[0.03] border-r border-white/6">TOTAL</td>
                    <td class="px-3 py-2.5 text-right tabular-nums font-mono font-semibold text-white/80">{{ fmtMoney(match.totals.spend) }}</td>
                    <td class="px-3 py-2.5 text-right tabular-nums font-mono font-semibold text-white/80">{{ fmtMoney(match.totals.revenue) }}</td>
                    <td class="px-3 py-2.5 text-right tabular-nums font-mono font-semibold text-violet-300">{{ fmtMoney(match.totals.metaRevenue) }}</td>
                    <td class="px-3 py-2.5 text-right tabular-nums font-semibold text-white/80">{{ match.totals.impressions.toLocaleString() }}</td>
                    <td class="px-3 py-2.5 text-right tabular-nums font-semibold text-white/80">{{ match.totals.clicks.toLocaleString() }}</td>
                    <td class="px-3 py-2.5 text-right tabular-nums font-semibold text-white/80">{{ match.totals.conversions }}</td>
                    <td class="px-3 py-2.5 text-right tabular-nums font-semibold text-amber-400">{{ (match.totals.addToCartOmni ?? 0).toLocaleString() }}</td>
                    <td class="px-3 py-2.5 text-right tabular-nums font-semibold text-orange-400">{{ (match.totals.checkoutInitiatedOmni ?? 0).toLocaleString() }}</td>
                    <td class="px-3 py-2.5 text-right tabular-nums font-semibold text-violet-300">
                      {{ match.totals.computed.roas > 0 ? match.totals.computed.roas.toFixed(2) + 'x' : '—' }}
                    </td>
                    <td class="px-3 py-2.5 text-right tabular-nums font-semibold text-blue-300">
                      {{ match.totals.computed.blendedRoas !== null ? match.totals.computed.blendedRoas.toFixed(2) + 'x' : '—' }}
                    </td>
                    <td class="px-3 py-2.5 text-right tabular-nums text-violet-300">
                      {{ match.totals.computed.ctr > 0 ? (match.totals.computed.ctr * 100).toFixed(2) + '%' : '—' }}
                    </td>
                    <td colspan="3" class="px-3 py-2.5 text-center text-white/25 text-[10px]">campaign-level ↑</td>
                    <td class="px-3 py-2.5"></td>
                    <td class="px-3 py-2.5"></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Column key for SKU mode -->
          <div class="rounded-xl border border-white/6 bg-white/[0.02] px-4 py-3">
            <div class="flex flex-wrap gap-x-8 gap-y-1 text-[11px]">
              <span><span class="text-violet-400 font-semibold">✦ Computed</span> <span class="text-white/45">= derived from raw sums in this row (per-product accurate)</span></span>
              <span><span class="text-amber-400 font-semibold">⚙ Stored</span> <span class="text-white/45">= written by syncMeta from Meta API — ROAS & CTR are campaign-level (same for all products in the campaign)</span></span>
            </div>
          </div>

        </div><!-- end v-for match -->

      </template>
    </template>

  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'admin' });

const config  = useRuntimeConfig();
const apiBase = config.public.apiBase;

// ── State ────────────────────────────────────────────────────────────────────
const storeId       = ref('');
const loadingStores = ref(false);
const stores        = ref<any[]>([]);

// Mode: 'all' = paginated aggregation table | 'sku' = single-product lookup
const mode = ref<'all' | 'sku'>('all');

// All-products state
const loading     = ref(false);
const data        = ref<any>(null);
const page        = ref(0);
const range       = ref('30d');
const customStart = ref('');
const customEnd   = ref('');
const sortBy      = ref('spend');
const sortDir     = ref('desc');

// SKU lookup state
const skuLoading = ref(false);
const skuData    = ref<any>(null);
const skuQuery   = ref('');

// Force-sync state
const syncing      = ref(false);
const syncMsg      = ref('');
const syncProvider = ref('ALL');

// ── Computed ─────────────────────────────────────────────────────────────────
const pageStart = computed(() =>
  (data.value?.total ?? 0) === 0 ? 0 : page.value * 50 + 1
);
const pageEnd = computed(() =>
  Math.min((page.value + 1) * 50, data.value?.total ?? 0)
);

// ── Helpers ───────────────────────────────────────────────────────────────────
const CURRENCY_LOCALE: Record<string, string> = {
  NGN: 'en-NG', GBP: 'en-GB', EUR: 'de-DE', JPY: 'ja-JP',
  AUD: 'en-AU', CAD: 'en-CA', INR: 'en-IN', ZAR: 'en-ZA',
  GHS: 'en-GH', KES: 'sw-KE', EGP: 'ar-EG', MAD: 'ar-MA',
};

function fmtMoney(v: number) {
  const cur = (data.value as any)?.store?.currency ?? 'USD';
  const locale = CURRENCY_LOCALE[cur] ?? 'en-US';
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency', currency: cur,
      minimumFractionDigits: 2, maximumFractionDigits: 2
    }).format(v);
  } catch {
    return v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
}

function buildRangeParams() {
  const p = new URLSearchParams({ storeId: storeId.value, range: range.value });
  if (range.value === 'custom' && customStart.value) p.set('start', customStart.value);
  if (range.value === 'custom' && customEnd.value)   p.set('end',   customEnd.value);
  return p;
}

// ── All-products actions ──────────────────────────────────────────────────────
function onStoreChange() {
  page.value = 0;
  data.value = null;
  skuData.value = null;
  if (storeId.value) load();
}

function doInspect() {
  page.value = 0;
  load();
}

function prevPage() {
  if (page.value > 0) { page.value--; load(); }
}
function nextPage() {
  if (data.value && page.value < data.value.totalPages - 1) { page.value++; load(); }
}

async function load() {
  if (!storeId.value) return;
  loading.value = true;
  try {
    const params = buildRangeParams();
    params.set('sortBy',  sortBy.value);
    params.set('sortDir', sortDir.value);
    params.set('page',    String(page.value));
    params.set('limit',   '50');

    const res = await $fetch<any>(`${apiBase}/v1/admin/products-debug?${params}`, { credentials: 'include' });
    if (res?.ok) data.value = res;
  } catch {}
  finally { loading.value = false; }
}

// ── SKU lookup actions ────────────────────────────────────────────────────────
async function doSkuLookup() {
  if (!storeId.value || !skuQuery.value.trim()) return;
  skuLoading.value = true;
  try {
    const params = buildRangeParams();
    params.set('sku', skuQuery.value.trim());

    const res = await $fetch<any>(`${apiBase}/v1/admin/products-debug/sku?${params}`, { credentials: 'include' });
    if (res?.ok) skuData.value = res;
  } catch {}
  finally { skuLoading.value = false; }
}

// ── Force sync ───────────────────────────────────────────────────────────────
async function forceSync() {
  if (!storeId.value || syncing.value) return;
  syncing.value = true;
  syncMsg.value = '';
  try {
    const url = `${apiBase}/v1/admin/sync-store/${storeId.value}${syncProvider.value !== 'ALL' ? `?provider=${syncProvider.value}` : ''}`;
    const res = await $fetch<any>(url, { method: 'POST', credentials: 'include' });
    syncMsg.value = res?.message ?? 'Sync enqueued';
    // Auto-refresh data after a short delay so the worker has time to start
    setTimeout(() => {
      if (mode.value === 'all' && data.value) load();
    }, 3000);
  } catch (e: any) {
    syncMsg.value = e?.data?.message ?? 'Error triggering sync';
  } finally {
    syncing.value = false;
  }
}

// ── Init ──────────────────────────────────────────────────────────────────────
async function loadStores() {
  loadingStores.value = true;
  try {
    const res = await $fetch<{ ok: boolean; stores: any[] }>(
      `${apiBase}/v1/admin/meta-debug/stores`,
      { credentials: 'include' }
    );
    if (res?.ok) {
      stores.value = res.stores;
      if (res.stores.length === 1) {
        storeId.value = res.stores[0].id;
        await load();
      }
    }
  } catch {}
  finally { loadingStores.value = false; }
}

onMounted(loadStores);
</script>

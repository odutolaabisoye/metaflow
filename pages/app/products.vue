<template>
  <div class="space-y-6">

    <!-- Page Header -->
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p class="text-[11px] uppercase tracking-widest text-white/65 mb-1">Catalog Intelligence</p>
        <div class="flex items-center gap-3">
          <h1 class="text-xl sm:text-2xl font-semibold tracking-tight">Products</h1>
          <span v-if="!pending" class="rounded-full bg-white/[0.08] border border-white/10 px-2.5 py-0.5 text-xs font-medium text-white/80">
            {{ total.toLocaleString() }} SKUs
          </span>
        </div>
        <p class="mt-1 text-xs sm:text-sm text-white/75">{{ rangeLabel }} · scored daily by ROAS, CTR, margin &amp; inventory</p>
        <p class="mt-1 text-[11px] text-white/50">Tip: click a row to open Sidekick details.</p>
      </div>
      <div class="flex flex-wrap items-center gap-2.5 w-full sm:w-auto sm:justify-end">
        <button
          @click="triggerSync"
          :disabled="syncDisabled"
          class="flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg class="w-4 h-4" :class="syncing ? 'animate-spin' : ''" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"/>
          </svg>
          {{ syncing ? 'Syncing…' : syncDisabled ? `Sync in ${cooldownLabel}` : 'Sync now' }}
        </button>
        <!-- Split export button -->
        <div ref="exportMenuRef" class="relative">
          <div class="flex items-center rounded-xl overflow-hidden bg-white text-ink-950 hover:bg-white/90 transition-all">
            <button
              @click="exportCsv('page')"
              :disabled="exportingAll"
              class="flex items-center gap-2 pl-4 pr-3 py-2.5 text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"/>
              </svg>
              {{ exportingAll ? exportProgress : 'Export CSV' }}
            </button>
            <button
              @click="showExportMenu = !showExportMenu"
              :disabled="exportingAll"
              class="flex items-center justify-center px-2 py-2.5 border-l border-ink-950/15 disabled:opacity-60 disabled:cursor-not-allowed"
              aria-label="Export options"
            >
              <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/>
              </svg>
            </button>
          </div>
          <!-- Dropdown -->
          <Transition name="fade-drop">
            <div
              v-if="showExportMenu"
              class="absolute right-0 mt-1.5 w-52 rounded-xl border border-white/10 bg-ink-900/95 backdrop-blur-md shadow-2xl overflow-hidden z-50"
            >
              <button
                @click="exportCsv('page'); showExportMenu = false"
                class="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-white/[0.06] transition-colors"
              >
                <svg class="w-4 h-4 mt-0.5 text-white/60 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75a2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z"/>
                </svg>
                <div>
                  <p class="text-sm font-medium text-white">This page only</p>
                  <p class="text-xs text-white/50">{{ products.length }} rows</p>
                </div>
              </button>
              <div class="h-px bg-white/[0.07]"></div>
              <button
                @click="exportCsv('all'); showExportMenu = false"
                class="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-white/[0.06] transition-colors"
              >
                <svg class="w-4 h-4 mt-0.5 text-white/60 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 5.625c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125"/>
                </svg>
                <div>
                  <p class="text-sm font-medium text-white">All products</p>
                  <p class="text-xs text-white/50">{{ total.toLocaleString() }} rows — fetches all pages</p>
                </div>
              </button>
            </div>
          </Transition>
        </div>
      </div>
    </div>

    <!-- Freshness strip — last sync + last scored timestamps -->
    <div v-if="lastSyncAt || lastScoredAt" class="flex flex-wrap items-center gap-x-5 gap-y-1 text-[11px] text-white/40 -mt-2">
      <span v-if="lastSyncAt">
        <span class="text-white/25 mr-1">Last synced</span>
        <span class="text-white/55">{{ timeAgo(lastSyncAt) }}</span>
      </span>
      <span v-if="lastRollupAt">
        <span class="text-white/25 mr-1">Rollup</span>
        <span class="text-white/55">{{ timeAgo(lastRollupAt) }}</span>
      </span>
      <span v-if="lastScoredAt">
        <span class="text-white/25 mr-1">Scores refreshed</span>
        <span class="text-white/55">{{ timeAgo(lastScoredAt) }}</span>
      </span>
    </div>

    <!-- ATC backfill notice — shown when products have spend but no add-to-cart data yet -->
    <Transition name="fade-up">
      <div v-if="needsAtcResync" class="flex items-start gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/[0.06] px-5 py-3.5">
        <svg class="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"/>
        </svg>
        <div class="flex-1">
          <p class="text-sm font-medium text-amber-300">Add to Cart &amp; Checkout data not yet available</p>
          <p class="text-xs text-amber-400/70 mt-0.5">These columns were recently added. Run a sync to pull the latest event data from Meta.</p>
        </div>
        <button @click="triggerSync" :disabled="syncDisabled"
          class="flex-shrink-0 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/25 px-3 py-1.5 text-xs font-semibold text-amber-300 transition-colors disabled:opacity-50">
          Sync now
        </button>
      </div>
    </Transition>

    <!-- Persistent background-sync error banners (shown after page load, not just manual syncs) -->
    <Transition name="fade-up">
      <div v-if="needsReauth" class="flex items-start gap-3 rounded-2xl border border-ember-500/25 bg-ember-500/[0.07] px-5 py-3.5">
        <svg class="w-4 h-4 text-ember-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"/>
        </svg>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium text-ember-300">Meta connection expired or revoked</p>
          <p class="text-xs text-ember-400/70 mt-0.5">Your Meta access token is no longer valid. Sync has been paused until you reconnect.</p>
        </div>
        <NuxtLink to="/app/settings#meta"
          class="flex-shrink-0 rounded-lg bg-ember-500/20 hover:bg-ember-500/30 border border-ember-500/30 px-3 py-1.5 text-xs font-semibold text-ember-300 transition-colors whitespace-nowrap">
          Reconnect Meta →
        </NuxtLink>
      </div>
    </Transition>
    <Transition name="fade-up">
      <div v-if="hasSyncError && !needsReauth" class="flex items-start gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/[0.06] px-5 py-3.5">
        <svg class="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"/>
        </svg>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium text-amber-300">Last sync failed</p>
          <p class="text-xs text-amber-400/70 mt-0.5 truncate">{{ sanitizeError(storeSyncError, 'An error occurred during the last sync. Try syncing again.') }}</p>
        </div>
        <button @click="triggerSync" :disabled="syncDisabled"
          class="flex-shrink-0 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/25 px-3 py-1.5 text-xs font-semibold text-amber-300 transition-colors disabled:opacity-50 whitespace-nowrap">
          {{ syncing ? 'Syncing…' : 'Retry sync' }}
        </button>
      </div>
    </Transition>

    <!-- Sync error banner (manual sync attempt) -->
    <Transition name="fade-up">
      <div v-if="syncError" role="alert" class="flex items-center justify-between gap-3 rounded-2xl border border-ember-500/25 bg-ember-500/8 px-5 py-3">
        <div class="flex items-center gap-2.5">
          <svg class="w-4 h-4 text-ember-400 flex-shrink-0" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"/>
          </svg>
          <p class="text-sm text-ember-400">{{ sanitizeError(syncError, 'Sync failed. Please try again.') }}</p>
        </div>
        <button @click="syncError = ''" aria-label="Dismiss error" class="text-ember-400/60 hover:text-ember-400 transition-colors">
          <svg class="w-4 h-4" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>
    </Transition>

    <!-- Filters Bar -->
    <div class="glass rounded-2xl p-4 flex flex-wrap items-center gap-3">
      <!-- Search -->
      <div class="relative flex-1 min-w-[200px] max-w-xs">
        <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/65 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"/>
        </svg>
        <input
          v-model="search"
          type="search"
          placeholder="Search product or SKU…"
          maxlength="100"
          class="w-full rounded-xl border border-white/10 bg-white/[0.06] pl-9 pr-4 py-2.5 text-sm text-white placeholder:text-white/55 outline-none focus:border-glow-500/40 focus:ring-2 focus:ring-glow-500/15 transition-all"
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
          :aria-pressed="filter === cat.value"
          class="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all"
          :class="filter === cat.value
            ? 'bg-white/15 text-white border border-white/20'
            : 'text-white/80 hover:text-white/80 border border-transparent'"
        >
          <span v-if="cat.dot" class="h-1.5 w-1.5 rounded-full" :class="cat.dot"></span>
          {{ cat.label }}
        </button>
      </div>

      <!-- Divider -->
      <div class="h-6 w-px bg-white/10 hidden sm:block"></div>

      <!-- Stock toggle -->
      <div class="flex items-center gap-0.5 rounded-lg bg-white/[0.05] border border-white/8 p-0.5">
        <button
          v-for="opt in stockOptions"
          :key="opt.value"
          @click="stockFilter = opt.value"
          :aria-pressed="stockFilter === opt.value"
          class="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-all"
          :class="stockFilter === opt.value
            ? 'bg-white/15 text-white shadow-sm'
            : 'text-white/45 hover:text-white/70'"
        >
          <span
            v-if="opt.dot"
            class="h-1.5 w-1.5 rounded-full flex-shrink-0"
            :class="opt.dot"
          ></span>
          {{ opt.label }}
        </button>
      </div>

      <!-- Variants toggle -->
      <label class="flex items-center gap-2 text-xs text-white/70">
        <input
          v-model="includeVariants"
          type="checkbox"
          class="h-4 w-4 rounded border-white/20 bg-white/10 text-glow-500 focus:ring-glow-500/40"
        />
        Show variants
      </label>

      <!-- Spacer -->
      <div class="flex-1 hidden sm:block"></div>

      <!-- Sort controls -->
      <div class="flex items-center gap-2">
        <span class="text-xs text-white/70">Sort by</span>
        <select
          v-model="sortBy"
          class="rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 text-xs text-white outline-none focus:border-glow-500/40 transition-all"
        >
          <option value="score">Score</option>
          <option value="roas">ROAS</option>
          <option value="ctr">CTR</option>
          <option value="impressions">Impressions</option>
          <option value="clicks">Clicks</option>
          <option value="spend">Spend</option>
          <option value="revenue">Revenue</option>
          <option value="addToCart">Add to Cart</option>
          <option value="checkoutInitiated">Checkout</option>
          <option value="velocity">Velocity</option>
          <option value="title">Title</option>
        </select>
        <button
          @click="sortDir = sortDir === 'asc' ? 'desc' : 'asc'"
          :aria-label="sortDir === 'asc' ? 'Sort descending' : 'Sort ascending'"
          class="flex items-center justify-center w-8 h-8 rounded-lg border border-white/10 bg-white/5 text-white/80 hover:text-white hover:bg-white/10 transition-all"
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
          <svg class="w-6 h-6 text-white/55" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z"/>
          </svg>
        </div>
        <p class="text-sm font-medium">No products match your filters</p>
        <p class="mt-1 text-xs text-white/75">Try adjusting your search or clearing the filters</p>
        <button @click="filter = 'all'; search = ''" class="mt-4 text-xs text-glow-500 hover:text-glow-400 transition-colors font-medium">
          Clear filters →
        </button>
      </div>

      <!-- Mobile cards -->
      <div v-else-if="products.length" class="md:hidden">
        <div class="divide-y divide-white/10">
          <button
            v-for="item in products"
            :key="item.id"
            class="w-full text-left p-4 hover:bg-white/[0.03] transition-colors"
            @click="openSidekick(item)"
          >
            <div class="flex items-center gap-3">
              <div class="h-11 w-11 flex-shrink-0 rounded-xl border border-white/10 bg-white/5 overflow-hidden flex items-center justify-center">
                <img
                  v-if="item.imageUrl"
                  :src="thumbUrl(item.imageUrl, 96)"
                  :alt="item.title"
                  class="h-full w-full object-cover"
                  loading="lazy"
                  width="44" height="44"
                  @error="(e) => { const t = e.target as HTMLImageElement; if (t.src !== item.imageUrl) t.src = item.imageUrl || '' }"
                />
                <svg v-else class="w-4 h-4 text-white/35" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M3 7.5A2.25 2.25 0 015.25 5.25h13.5A2.25 2.25 0 0121 7.5v9A2.25 2.25 0 0118.75 18.75H5.25A2.25 2.25 0 013 16.5v-9z"/>
                  <path stroke-linecap="round" stroke-linejoin="round" d="M8 10.5h8m-8 3h5"/>
                </svg>
              </div>
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2">
                  <p class="text-sm font-semibold truncate">{{ item.title }}</p>
                  <span v-if="item.isVariant" class="rounded-md bg-white/[0.07] border border-white/10 px-1.5 py-0.5 text-[10px] font-medium text-white/45">Var</span>
                </div>
                <div class="mt-0.5 flex items-center gap-2">
                  <span class="text-xs text-white/65 font-mono truncate">{{ item.sku }}</span>
                  <span class="text-[10px] px-2 py-0.5 rounded-full border border-white/10" :class="badgeClass(item.category)">{{ item.category }}</span>
                </div>
              </div>
              <div class="flex flex-col items-end gap-1">
                <span class="text-sm font-semibold" :class="scoreColor(item.score)">{{ item.score }}</span>
                <span class="text-[10px] text-white/45">Score</span>
              </div>
            </div>

            <div class="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div class="rounded-lg border border-white/10 bg-white/[0.03] p-2">
                <p class="text-white/55">Spend</p>
                <p class="mt-0.5 font-semibold">{{ formatMoney(item.spend ?? 0) }}</p>
              </div>
              <div class="rounded-lg border border-white/10 bg-white/[0.03] p-2">
                <p class="text-white/55">Revenue</p>
                <p class="mt-0.5 font-semibold">{{ formatMoney(item.revenue ?? 0) }}</p>
              </div>
              <div class="rounded-lg border border-white/10 bg-white/[0.03] p-2">
                <p class="text-white/55">ROAS</p>
                <p class="mt-0.5 font-semibold">{{ (item.roas ?? 0).toFixed(2) }}</p>
              </div>
              <div class="rounded-lg border border-white/10 bg-white/[0.03] p-2">
                <p class="text-white/55">CTR</p>
                <p class="mt-0.5 font-semibold">{{ (item.ctr ?? 0).toFixed(2) }}%</p>
              </div>
            </div>

            <div class="mt-3 flex items-center justify-between text-xs">
              <a
                v-if="item.productUrl"
                :href="item.productUrl"
                target="_blank"
                rel="noopener"
                class="text-glow-500/80 hover:text-glow-500 transition-colors"
                @click.stop
              >View product ↗</a>
              <button
                class="flex items-center gap-1 text-white/55 hover:text-white transition-colors"
                @click.stop="openSidekick(item)"
              >
                <span>More</span>
                <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/>
                </svg>
              </button>
            </div>

            <p class="mt-2 text-[11px] text-white/45">Tap anywhere for more details</p>
          </button>
        </div>
      </div>

      <!-- Data table -->
      <div v-if="products.length" class="overflow-x-auto hidden md:block">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-white/10">
              <th class="text-left text-xs font-medium text-white/80 px-5 py-3.5 whitespace-nowrap">Product</th>
              <th class="text-left px-4 py-3.5 whitespace-nowrap">
                <button class="flex items-center gap-1.5 text-xs font-medium text-white/80 hover:text-white/80 transition-colors" @click="setSort('score')">
                  <MetricTooltip metric="score">Score</MetricTooltip>
                  <span v-if="sortBy === 'score'" class="text-glow-500 text-[10px]">{{ sortIndicator('score') }}</span>
                </button>
              </th>
              <th class="text-left px-4 py-3.5 whitespace-nowrap">
                <button class="flex items-center gap-1.5 text-xs font-medium text-white/80 hover:text-white/80 transition-colors" @click="setSort('roas')">
                  <MetricTooltip metric="roas">ROAS</MetricTooltip>
                  <span v-if="sortBy === 'roas'" class="text-glow-500 text-[10px]">{{ sortIndicator('roas') }}</span>
                </button>
              </th>
              <th class="text-left px-4 py-3.5 whitespace-nowrap">
                <button class="flex items-center gap-1.5 text-xs font-medium text-white/80 hover:text-white/80 transition-colors" @click="setSort('ctr')">
                  <MetricTooltip metric="ctr">CTR</MetricTooltip>
                  <span v-if="sortBy === 'ctr'" class="text-glow-500 text-[10px]">{{ sortIndicator('ctr') }}</span>
                </button>
              </th>
              <th class="text-left px-4 py-3.5 whitespace-nowrap">
                <button class="flex items-center gap-1.5 text-xs font-medium text-white/80 hover:text-white/80 transition-colors" @click="setSort('impressions')">
                  <MetricTooltip metric="impressions">Impressions</MetricTooltip>
                  <span v-if="sortBy === 'impressions'" class="text-glow-500 text-[10px]">{{ sortIndicator('impressions') }}</span>
                </button>
              </th>
              <th class="text-left px-4 py-3.5 whitespace-nowrap">
                <button class="flex items-center gap-1.5 text-xs font-medium text-white/80 hover:text-white/80 transition-colors" @click="setSort('clicks')">
                  <MetricTooltip metric="clicks">Clicks</MetricTooltip>
                  <span v-if="sortBy === 'clicks'" class="text-glow-500 text-[10px]">{{ sortIndicator('clicks') }}</span>
                </button>
              </th>
              <th class="text-left px-4 py-3.5 whitespace-nowrap">
                <button class="flex items-center gap-1.5 text-xs font-medium text-white/80 hover:text-white/80 transition-colors" @click="setSort('spend')">
                  <MetricTooltip metric="spend">Spend</MetricTooltip>
                  <span v-if="sortBy === 'spend'" class="text-glow-500 text-[10px]">{{ sortIndicator('spend') }}</span>
                </button>
              </th>
              <th class="text-left px-4 py-3.5 whitespace-nowrap">
                <button class="flex items-center gap-1.5 text-xs font-medium text-white/80 hover:text-white/80 transition-colors" @click="setSort('revenue')">
                  <MetricTooltip metric="revenue">Revenue</MetricTooltip>
                  <span v-if="sortBy === 'revenue'" class="text-glow-500 text-[10px]">{{ sortIndicator('revenue') }}</span>
                </button>
              </th>
              <th class="text-left px-4 py-3.5 whitespace-nowrap text-xs font-medium text-white/80">
                <MetricTooltip metric="addToCart">Add to Cart</MetricTooltip>
              </th>
              <th class="text-left px-4 py-3.5 whitespace-nowrap text-xs font-medium text-white/80">
                <MetricTooltip metric="checkoutInitiated">Checkout</MetricTooltip>
              </th>
              <th class="text-left px-4 py-3.5 whitespace-nowrap text-xs font-medium text-white/80">Status</th>
              <!-- hint column -->
              <th class="w-8 px-3 py-3.5"></th>
            </tr>
          </thead>
          <tbody class="divide-y divide-white/[0.05]">
            <template v-for="item in products" :key="item.id">
              <tr
                class="group hover:bg-white/[0.04] transition-colors cursor-pointer"
                @click="openSidekick(item)"
              >
              <!-- Product info -->
              <td class="px-5 py-4">
                <div class="flex items-center gap-3">
                  <div class="h-9 w-9 flex-shrink-0 rounded-lg border border-white/10 bg-white/5 overflow-hidden flex items-center justify-center">
                    <img
                      v-if="item.imageUrl"
                      :src="thumbUrl(item.imageUrl)"
                      :alt="item.title"
                      class="h-full w-full object-cover"
                      loading="lazy"
                      width="36" height="36"
                      @error="(e) => { const t = e.target as HTMLImageElement; if (t.src !== item.imageUrl) t.src = item.imageUrl || '' }"
                    />
                    <svg v-else class="w-4 h-4 text-white/35" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M3 7.5A2.25 2.25 0 015.25 5.25h13.5A2.25 2.25 0 0121 7.5v9A2.25 2.25 0 0118.75 18.75H5.25A2.25 2.25 0 013 16.5v-9z"/>
                      <path stroke-linecap="round" stroke-linejoin="round" d="M8 10.5h8m-8 3h5"/>
                    </svg>
                  </div>
                  <div class="min-w-0">
                    <div class="flex items-center gap-1.5">
                      <p class="font-medium truncate max-w-[180px]">{{ item.title }}</p>
                      <span
                        v-if="item.isVariant"
                        class="flex-shrink-0 rounded-md bg-white/[0.07] border border-white/10 px-1.5 py-0.5 text-[10px] font-medium text-white/45"
                        title="Variant"
                      >Var</span>
                      <span
                        v-if="item.variantCount > 0"
                        class="flex-shrink-0 rounded-md bg-white/[0.07] border border-white/10 px-1.5 py-0.5 text-[10px] font-medium text-white/45"
                        :title="`${item.variantCount} variant${item.variantCount === 1 ? '' : 's'}`"
                      >{{ item.variantCount }}v</span>
                    </div>
                    <div class="flex items-center gap-2 mt-0.5">
                      <span class="text-xs text-white/70 font-mono">{{ item.sku }}</span>
                      <a
                        v-if="item.productUrl"
                        :href="item.productUrl"
                        target="_blank"
                        rel="noopener"
                        class="text-xs text-glow-500/80 hover:text-glow-500 transition-colors opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                        @click.stop
                      >View ↗</a>
                      <button
                        class="text-xs text-white/55 hover:text-white transition-colors hidden lg:inline-flex items-center gap-1"
                        @click.stop="openSidekick(item)"
                      >
                        More
                        <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              </td>

              <!-- Score with bar -->
              <td class="px-4 py-4" @mouseenter="fetchSparkline(item.id)">
                <div class="flex items-center gap-2.5">
                  <span class="font-mono text-sm font-semibold w-7 text-right" :class="scoreColor(item.score)">{{ item.score }}</span>
                  <div class="w-14 h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <div
                      class="h-full rounded-full transition-all duration-500"
                      :style="{ width: item.score + '%' }"
                      :class="scoreBarColor(item.score)"
                    ></div>
                  </div>
                  <svg v-if="sparklines[item.id]?.length > 1" :viewBox="`0 0 40 16`" class="w-10 h-4 flex-shrink-0" style="overflow:visible">
                    <polyline
                      :points="getSparkPoints(sparklines[item.id])"
                      fill="none"
                      :stroke="getSparkColor(sparklines[item.id])"
                      stroke-width="1.5"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                  </svg>
                  <button
                    v-else-if="sparklineFailed.has(item.id)"
                    @click.stop="retrySparkline(item.id)"
                    class="w-10 h-4 flex-shrink-0 text-[9px] text-white/20 hover:text-white/50 transition-colors leading-none"
                    title="Score history unavailable — click to retry"
                  >retry</button>
                  <!-- Why? explainability trigger -->
                  <button
                    @click.stop="showExplain(item)"
                    class="ml-0.5 h-4 w-4 rounded-full border border-white/20 bg-white/[0.06] text-[9px] font-bold text-white/50 hover:bg-white/10 hover:text-white/80 hover:border-white/35 transition-all flex-shrink-0 flex items-center justify-center opacity-0 group-hover:opacity-100"
                    title="Why this score?"
                  >?</button>
                </div>
              </td>

              <!-- ROAS -->
              <td class="px-4 py-4 font-mono text-sm font-medium">{{ Number(item.roas).toFixed(2) }}×</td>

              <!-- CTR -->
              <td class="px-4 py-4 text-sm text-white/80">{{ (Number(item.ctr) * 100).toFixed(2) }}%</td>

              <!-- Impressions -->
              <td class="px-4 py-4 text-sm text-white/80 font-mono">{{ Number(item.impressions).toLocaleString() }}</td>

              <!-- Clicks -->
              <td class="px-4 py-4 text-sm text-white/80 font-mono">{{ Number(item.clicks).toLocaleString() }}</td>

              <!-- Spend -->
              <td class="px-4 py-4 text-sm text-white/80">{{ formatMoney(item.spend) }}</td>

              <!-- Revenue -->
              <td class="px-4 py-4 text-sm font-medium">{{ formatMoney(item.revenue) }}</td>

              <!-- Add to Cart (null = no data yet; 0 = real zero) -->
              <td class="px-4 py-4 text-sm font-mono">
                <template v-if="item.addToCartOmni != null || item.addToCart != null">
                  <span class="block text-white/70">{{ (item.addToCartOmni ?? 0).toLocaleString() }}</span>
                  <span class="block text-[10px] text-white/35">{{ (item.addToCart ?? 0).toLocaleString() }} site</span>
                </template>
                <span v-else class="text-white/25">—</span>
              </td>

              <!-- Checkout Initiated (null = no data yet; 0 = real zero) -->
              <td class="px-4 py-4 text-sm font-mono">
                <template v-if="item.checkoutInitiatedOmni != null || item.checkoutInitiated != null">
                  <span class="block text-white/70">{{ (item.checkoutInitiatedOmni ?? 0).toLocaleString() }}</span>
                  <span class="block text-[10px] text-white/35">{{ (item.checkoutInitiated ?? 0).toLocaleString() }} site</span>
                </template>
                <span v-else class="text-white/25">—</span>
              </td>

              <!-- Category badge -->
              <td class="px-4 py-4">
                <span class="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold whitespace-nowrap" :class="badgeClass(item.category)">
                  <span class="h-1.5 w-1.5 rounded-full" :class="badgeDot(item.category)"></span>
                  {{ item.category }}
                </span>
              </td>

              <!-- Chevron hint -->
              <td class="px-3 py-4">
                <svg class="w-4 h-4 text-white/45 group-hover:text-white/75 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5"/>
                </svg>
              </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>

      <!-- Pagination footer -->
      <div v-if="!pending && products.length > 0" class="flex items-center justify-between px-5 py-4 border-t border-white/10">
        <div class="flex items-center gap-2">
          <span class="text-xs text-white/70">Rows</span>
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
          <span class="text-xs text-white/70">{{ pageStart }}–{{ pageEnd }} of {{ total.toLocaleString() }} products</span>
          <div class="flex items-center gap-1.5">
            <button
              :disabled="page === 0"
              @click="prevPage"
              class="flex items-center justify-center w-8 h-8 rounded-lg border border-white/10 bg-white/5 text-white/80 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg>
            </button>
            <button
              :disabled="page >= totalPages - 1"
              @click="nextPage"
              class="flex items-center justify-center w-8 h-8 rounded-lg border border-white/10 bg-white/5 text-white/80 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
            </button>
          </div>
        </div>
      </div>

    </div>

    <!-- Score Explainability Modal -->
    <Teleport to="body">
      <Transition name="fade">
        <div v-if="explainProduct" class="fixed inset-0 z-50 flex items-center justify-center p-4" @click.self="explainProduct = null">
          <div class="absolute inset-0 bg-black/55 backdrop-blur-sm" @click="explainProduct = null"></div>
          <div class="relative w-full max-w-sm rounded-2xl bg-ink-900 border border-white/12 shadow-2xl overflow-hidden" @click.stop>
            <!-- Top accent -->
            <div class="h-1 w-full" :class="badgeClass(explainProduct.category).includes('lime') ? 'bg-gradient-to-r from-lime-500 to-lime-400' : badgeClass(explainProduct.category).includes('ember') ? 'bg-gradient-to-r from-ember-600 to-ember-500' : badgeClass(explainProduct.category).includes('violet') ? 'bg-gradient-to-r from-violet-600 to-violet-500' : 'bg-gradient-to-r from-glow-500 to-glow-400'"></div>
            <div class="p-5">
              <!-- Header -->
              <div class="flex items-start justify-between gap-3 mb-4">
                <div>
                  <p class="text-[10px] uppercase tracking-widest text-white/55 mb-1">Score Breakdown</p>
                  <h3 class="text-sm font-semibold text-white leading-snug truncate max-w-[220px]">{{ explainProduct.title }}</h3>
                </div>
                <div class="flex items-center gap-2 flex-shrink-0">
                  <span class="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold" :class="badgeClass(explainProduct.category)">
                    <span class="h-1.5 w-1.5 rounded-full" :class="badgeDot(explainProduct.category)"></span>
                    {{ explainProduct.category }}
                  </span>
                  <span class="text-2xl font-bold" :class="scoreColor(explainProduct.score)">{{ explainProduct.score }}</span>
                </div>
              </div>
              <!-- Score components -->
              <div class="space-y-3">
                <div v-for="factor in explainFactors(explainProduct)" :key="factor.label" class="space-y-1.5">
                  <div class="flex items-center justify-between text-xs">
                    <span class="text-white/75">{{ factor.label }}</span>
                    <span class="font-mono font-semibold" :class="factor.contribution >= factor.max * 0.75 ? 'text-lime-400' : factor.contribution >= factor.max * 0.4 ? 'text-glow-400' : 'text-ember-400'">
                      {{ factor.contribution.toFixed(1) }} / {{ factor.max }}
                    </span>
                  </div>
                  <div class="h-2 rounded-full bg-white/8 overflow-hidden">
                    <div
                      class="h-full rounded-full transition-all duration-700"
                      :style="{ width: ((factor.contribution / factor.max) * 100) + '%' }"
                      :class="factor.contribution >= factor.max * 0.75 ? 'bg-lime-400' : factor.contribution >= factor.max * 0.4 ? 'bg-glow-400' : 'bg-ember-400'"
                    ></div>
                  </div>
                  <p class="text-[10px] text-white/50">{{ factor.detail }}</p>
                </div>
              </div>
              <!-- Total -->
              <div class="mt-4 pt-4 border-t border-white/8 flex items-center justify-between">
                <p class="text-xs text-white/65">Total score</p>
                <p class="text-xl font-bold" :class="scoreColor(explainProduct.score)">{{ explainProduct.score }}<span class="text-sm font-normal text-white/40">/100</span></p>
              </div>
              <button @click="explainProduct = null" class="mt-3 w-full py-2 rounded-xl border border-white/10 bg-white/[0.04] text-xs text-white/65 hover:text-white hover:bg-white/8 transition-all">Close</button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Product Sidekick -->
    <ProductSidekick
      :product="selectedProduct"
      :currency="currency"
      :history-loading="historyLoading"
      :range-start="start"
      :range-end="end"
      @close="selectedProduct = null"
    />

  </div>
</template>

<script setup lang="ts">
import { useGlobalFilters } from "~/composables/useGlobalFilters";

const { public: { apiBase } } = useRuntimeConfig();

const search      = ref("");
// Debounced copy used for the API query — avoids a network request on every keystroke
const searchDebounced = ref("");
let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;
watch(search, (val) => {
  if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => { searchDebounced.value = val; }, 300);
});

const filter      = ref("all");
const stockFilter = ref<'all' | 'inStock' | 'outOfStock'>("all");
const includeVariants = ref(false);
const sortBy      = ref("score");
const sortDir     = ref("desc");
const limit = ref(20);
const syncing = ref(false);

const page = ref(0);

// Sidekick
const selectedProduct = ref<null | Record<string, unknown>>(null);
const historyLoading  = ref(false);

const { query, rangeOption, activeStoreId, start, end } = useGlobalFilters();
const rangeLabel = computed(() => rangeOption.value.label);

const categories = [
  { value: 'all', label: 'All', dot: null },
  { value: 'SCALE', label: 'Scale', dot: 'bg-lime-400' },
  { value: 'TEST', label: 'Test', dot: 'bg-glow-400' },
  { value: 'KILL', label: 'Kill', dot: 'bg-ember-500' },
  { value: 'RISK', label: 'Risk', dot: 'bg-violet-400' },
];

const stockOptions: { value: 'all' | 'inStock' | 'outOfStock'; label: string; dot: string | null }[] = [
  { value: 'all',          label: 'All stock',   dot: null },
  { value: 'inStock',      label: 'In stock',    dot: 'bg-lime-400' },
  { value: 'outOfStock',   label: 'Out of stock', dot: 'bg-ember-400' },
];

// Reset to page 0 whenever any filter/sort/range changes (search uses debounced ref)
watch([sortBy, sortDir, limit, filter, stockFilter, includeVariants, query, searchDebounced], () => { page.value = 0; });

const { data, pending, refresh } = await useFetch(`${apiBase}/v1/products`, {
  server: false,
  credentials: 'include',
  onResponseError({ response }) {
    if (response.status === 401) navigateTo('/auth/login');
  },
  query: computed(() => ({
    ...query.value,
    search: searchDebounced.value || undefined,
    category: filter.value === "all" ? undefined : filter.value,
    stock: stockFilter.value === "all" ? undefined : stockFilter.value,
    includeVariants: includeVariants.value ? "true" : undefined,
    sortBy: sortBy.value,
    sortDir: sortDir.value,
    limit: limit.value,
    page: page.value
  }))
});

const currency   = computed(() => data.value?.currency   ?? "USD");
const products   = computed(() => data.value?.items      ?? []);
const total      = computed(() => data.value?.total      ?? 0);
const totalPages = computed(() => data.value?.totalPages ?? 1);

// Store freshness + sync health — surfaced from backend response
const lastSyncAt      = computed(() => data.value?.store?.lastSyncAt      ?? null);
const lastScoredAt    = computed(() => data.value?.store?.lastScoredAt    ?? null);
const storeSyncStatus = computed(() => data.value?.store?.lastSyncStatus  ?? 'IDLE');
const storeSyncError  = computed(() => data.value?.store?.lastSyncError   ?? null);
const needsReauth     = computed(() => storeSyncStatus.value === 'NEEDS_REAUTH');
const hasSyncError    = computed(() => storeSyncStatus.value === 'ERROR');
const lastRollupAt    = computed(() => data.value?.store?.lastRollupAt ?? null);
const rollupStatus    = computed(() => data.value?.store?.lastRollupStatus ?? 'IDLE');
const rollupError     = computed(() => data.value?.store?.lastRollupError ?? null);

// Human-readable "X ago" helper
function timeAgo(iso: string | null): string {
  if (!iso) return 'never';
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins < 2)   return 'just now';
  if (mins < 60)  return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

// True when products exist but all ATC/Checkout values are null → data hasn't been populated yet
const needsAtcResync = computed(() => {
  const items = products.value as any[];
  if (!items.length) return false;
  const itemsWithSpend = items.filter(p => (p.spend ?? 0) > 0);
  if (!itemsWithSpend.length) return false;
  return itemsWithSpend.every(p => p.addToCartOmni == null && p.checkoutInitiatedOmni == null);
});

// Page range shown in the pagination footer ("X–Y of N")
const pageStart = computed(() => total.value === 0 ? 0 : page.value * limit.value + 1);
const pageEnd   = computed(() => Math.min((page.value + 1) * limit.value, total.value));

/**
 * Generate a smaller image URL for thumbnails.
 * Handles WordPress/WooCommerce and Shopify CDN — falls back to the original.
 *
 * WordPress generates standard sizes on upload (e.g. image-150x150.jpg).
 * Shopify CDN supports appending _{width}x{height} before the extension.
 */
function thumbUrl(url: string | null | undefined, size = 150): string {
  if (!url) return '';
  try {
    const u = new URL(url);
    // Shopify CDN — insert _{size}x{size} before the extension
    if (u.pathname.startsWith('/s/files/') || u.hostname.includes('cdn.shopify.com')) {
      return url.replace(/(\.\w{2,5})(\?.*)?$/, `_${size}x${size}$1$2`);
    }
    // WordPress / WooCommerce — insert -{size}x{size} before the extension
    if (u.pathname.includes('/wp-content/uploads/')) {
      return url.replace(/(\.\w{2,5})(\?.*)?$/, `-${size}x${size}$1$2`);
    }
    return url;
  } catch {
    return url || '';
  }
}

// Map currency codes to the locale that produces the native symbol (e.g. NGN → ₦)
const CURRENCY_LOCALE: Record<string, string> = {
  NGN: 'en-NG', GBP: 'en-GB', EUR: 'de-DE', JPY: 'ja-JP',
  AUD: 'en-AU', CAD: 'en-CA', INR: 'en-IN', ZAR: 'en-ZA',
  GHS: 'en-GH', KES: 'sw-KE', EGP: 'ar-EG', MAD: 'ar-MA',
};
const currencyLocale = computed(() => CURRENCY_LOCALE[currency.value] ?? 'en-US');

const formatMoney = (value: number) => {
  return new Intl.NumberFormat(currencyLocale.value, {
    style: "currency",
    currency: currency.value,
    maximumFractionDigits: 0
  }).format(value);
};

const userThresholds = reactive({ scale: 75, test: 50, kill: 25 });
const userBenchmarks = reactive({ roas: 5, ctr: 3, margin: 50, inventory: 10 });

const scoreColor = (score: number) => {
  if (score >= userThresholds.scale) return 'text-lime-400';
  if (score >= userThresholds.test)  return 'text-glow-400';
  if (score >= userThresholds.kill)  return 'text-ember-400';
  return 'text-white/65';
};

const scoreBarColor = (score: number) => {
  if (score >= userThresholds.scale) return 'bg-lime-400';
  if (score >= userThresholds.test)  return 'bg-glow-400';
  if (score >= userThresholds.kill)  return 'bg-ember-400';
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

const nextPage = () => { if (page.value < totalPages.value - 1) page.value++; };
const prevPage = () => { if (page.value > 0) page.value--; };

// Open sidekick panel — show row data immediately, then load full history
const openSidekick = async (item: Record<string, unknown>) => {
  // Open immediately with the list-level data so the drawer feels instant
  selectedProduct.value = { ...item, history: undefined };
  historyLoading.value = true;

  try {
    const res = await $fetch<{
      ok: boolean;
      product: {
        dailyMetrics: {
          date: string; revenue: number; metaRevenue: number | null;
          roas: number; blendedRoas: number | null; spend: number;
          ctr: number; margin: number; velocity: number;
          impressions: number | null; clicks: number | null;
          conversions: number | null; conversionRate: number;
          onsitePurchases?: number | null;
          addToCart?: number | null; addToCartOmni?: number | null;
          checkoutInitiated?: number | null; checkoutInitiatedOmni?: number | null;
        }[];
      };
    }>(`${apiBase}/v1/products/${item.id}`, { credentials: 'include' });

    if (res?.ok && selectedProduct.value?.id === item.id) {
      // dailyMetrics comes in desc order — reverse for the chart (oldest → newest)
      const history = [...res.product.dailyMetrics].reverse().map(m => ({
        date:                  m.date,
        revenue:               m.revenue,
        metaRevenue:           m.metaRevenue ?? 0,
        roas:                  m.roas,
        blendedRoas:           m.blendedRoas ?? (m.spend > 0 ? m.revenue / m.spend : 0),
        spend:                 m.spend,
        ctr:                   m.ctr,
        margin:                m.margin,
        velocity:              m.velocity,
        impressions:           m.impressions ?? 0,
        clicks:                m.clicks ?? 0,
        conversions:           m.conversions ?? 0,
        conversionRate:        m.conversionRate,
        onsitePurchases:       m.onsitePurchases ?? 0,
        addToCart:             m.addToCart             ?? 0,
        addToCartOmni:         m.addToCartOmni         ?? 0,
        checkoutInitiated:     m.checkoutInitiated     ?? 0,
        checkoutInitiatedOmni: m.checkoutInitiatedOmni ?? 0,
      }));
      selectedProduct.value = { ...selectedProduct.value, history };
    }
  } catch {
    // History failed — drawer still works without the chart
  } finally {
    historyLoading.value = false;
  }
};

// Strips stack traces / internal paths from backend error strings before showing
// them in the UI. Truncates anything over 200 chars.
function sanitizeError(msg: string | null | undefined, fallback: string): string {
  if (!msg) return fallback;
  if (/^\s*(Error|TypeError|ReferenceError|SyntaxError):/m.test(msg) || /\s+at \w/.test(msg)) return fallback;
  return msg.length > 200 ? msg.slice(0, 200) + '…' : msg;
}

// ── Sync now ──────────────────────────────────────────────────────────────────
const syncError = ref('');
const csrfToken = ref('');
const cooldownSeconds = ref(0);
let cooldownTimer: ReturnType<typeof setInterval> | null = null;

const syncDisabled = computed(() => syncing.value || cooldownSeconds.value > 0);

const cooldownLabel = computed(() => {
  const total = Math.max(0, cooldownSeconds.value);
  const m = Math.floor(total / 60);
  const s = total % 60;
  if (m <= 0) return `${s}s`;
  return `${m}m ${s}s`;
});

const startCooldown = (seconds: number) => {
  cooldownSeconds.value = Math.max(0, Math.floor(seconds));
  if (cooldownTimer) clearInterval(cooldownTimer);
  cooldownTimer = setInterval(() => {
    if (cooldownSeconds.value <= 1) {
      cooldownSeconds.value = 0;
      if (cooldownTimer) clearInterval(cooldownTimer);
      cooldownTimer = null;
      return;
    }
    cooldownSeconds.value -= 1;
  }, 1000);
};

const loadCsrf = async () => {
  try {
    const res = await $fetch<{ csrfToken: string }>(`${apiBase}/v1/csrf`, { credentials: 'include' });
    csrfToken.value = res.csrfToken;
  } catch {}
};

function onDocClick(e: MouseEvent) {
  if (exportMenuRef.value && !exportMenuRef.value.contains(e.target as Node)) {
    showExportMenu.value = false;
  }
}

onMounted(async () => {
  document.addEventListener('click', onDocClick, true);
  loadCsrf();
  try {
    const config = useRuntimeConfig();
    const res = await $fetch<{ ok: boolean; settings: { thresholds: { scale: number; test: number; kill: number }; benchmarks: { roas: number; ctr: number; margin: number; inventory: number } } }>(
      `${config.public.apiBase}/v1/settings`,
      { credentials: 'include' }
    );
    if (res?.ok) {
      userThresholds.scale = res.settings.thresholds.scale;
      userThresholds.test  = res.settings.thresholds.test;
      userThresholds.kill  = res.settings.thresholds.kill;
      userBenchmarks.roas      = res.settings.benchmarks.roas;
      userBenchmarks.ctr       = +(res.settings.benchmarks.ctr * 100).toFixed(2);
      userBenchmarks.margin    = +(res.settings.benchmarks.margin * 100).toFixed(0);
      userBenchmarks.inventory = res.settings.benchmarks.inventory;
    }
  } catch {}
});

onBeforeUnmount(() => {
  if (cooldownTimer) clearInterval(cooldownTimer);
  document.removeEventListener('click', onDocClick, true);
});

const triggerSync = async () => {
  if (syncing.value || cooldownSeconds.value > 0) return;
  syncing.value = true;
  syncError.value = '';
  try {
    if (!csrfToken.value) await loadCsrf();
    // Use the currently selected store from the global store switcher
    const storeId = activeStoreId.value;
    if (!storeId) throw new Error('No store connected yet. Set one up in Settings.');

    await $fetch(`${apiBase}/v1/stores/${storeId}/sync`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'x-csrf-token': csrfToken.value },
    });

    // Refresh product list after a short delay to pick up any fast changes
    setTimeout(() => refresh(), 3000);
  } catch (err: any) {
    const retryAfter = Number(err?.data?.retryAfterSeconds ?? 0);
    if (retryAfter > 0) {
      startCooldown(retryAfter);
    }
    syncError.value = err?.data?.message || err?.message || 'Sync failed. Please try again.';
  } finally {
    syncing.value = false;
  }
};

// ── Score explainability ──────────────────────────────────────────────────────
const explainProduct = ref<null | Record<string, any>>(null);
const explainMap = ref<Record<string, Array<{ label: string; contribution: number; max: number; detail: string }>>>({});
const explainLoading = ref(false);
watch([() => query.value.range, () => query.value.start, () => query.value.end], () => {
  explainMap.value = {};
});

async function fetchExplain(productId: string) {
  if (explainMap.value[productId]) return;
  explainLoading.value = true;
  try {
    const res = await $fetch<{ ok: boolean; factors: any[] }>(
      `${apiBase}/v1/products/${productId}/explain`,
      { credentials: 'include', query: { range: query.value.range, start: query.value.start, end: query.value.end } }
    );
    if (res?.ok) explainMap.value[productId] = res.factors ?? [];
  } catch {
    // no-op
  } finally {
    explainLoading.value = false;
  }
}

function showExplain(item: Record<string, any>) {
  explainProduct.value = item;
  fetchExplain(item.id);
}

function explainFactors(product: Record<string, any>) {
  const factors = explainMap.value[product.id];
  if (factors?.length) return factors;
  return [
    { label: 'ROAS (Return on Ad Spend)', contribution: 0, max: 35, detail: explainLoading.value ? 'Loading…' : '—' },
    { label: 'CTR (Click-Through Rate)', contribution: 0, max: 20, detail: explainLoading.value ? 'Loading…' : '—' },
    { label: 'Profit Margin', contribution: 0, max: 25, detail: explainLoading.value ? 'Loading…' : '—' },
    { label: 'Inventory', contribution: 0, max: 20, detail: explainLoading.value ? 'Loading…' : '—' },
  ];
}

// ── Score sparklines ──────────────────────────────────────────────────────────
const sparklines     = ref<Record<string, { score: number; date: string }[]>>({});
const sparklineFailed = ref<Set<string>>(new Set());

function getSparkPoints(history: { score: number }[]) {
  if (!history.length) return '';
  const scores = history.map(h => h.score);
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const range = max - min || 1;
  const w = 40, h = 16;
  return history.map((h, i) => {
    const x = (i / (history.length - 1)) * w;
    const y = h - ((h.score - min) / range) * h;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
}

function getSparkColor(history: { score: number }[]) {
  if (history.length < 2) return '#6b7280';
  const first = history[0].score;
  const last = history[history.length - 1].score;
  return last > first + 2 ? '#84cc16' : last < first - 2 ? '#ef4444' : '#6b7280';
}

async function fetchSparkline(productId: string) {
  if (sparklines.value[productId] || sparklineFailed.value.has(productId)) return;
  try {
    const res = await $fetch<any>(
      `${apiBase}/v1/analytics/products/score-history/${productId}`,
      { credentials: 'include' }
    );
    if (res?.ok && res.history?.length) {
      sparklines.value[productId] = res.history;
    } else {
      sparklineFailed.value = new Set([...sparklineFailed.value, productId]);
    }
  } catch {
    sparklineFailed.value = new Set([...sparklineFailed.value, productId]);
  }
}

function retrySparkline(productId: string) {
  sparklineFailed.value = new Set([...sparklineFailed.value].filter(id => id !== productId));
  fetchSparkline(productId);
}

// Fetch sparklines for first 20 visible products when data loads
watch(() => products.value, (prods) => {
  if (prods?.length) {
    prods.slice(0, 20).forEach((p: any) => fetchSparkline(p.id));
  }
});

// ── CSV export ────────────────────────────────────────────────────────────────
const showExportMenu = ref(false);
const exportMenuRef  = ref<HTMLElement | null>(null);
const exportingAll   = ref(false);
const exportProgress = ref('');

const EXPORT_HEADERS = ['title', 'sku', 'category', 'score', 'roas', 'blendedRoas', 'ctr', 'impressions', 'clicks', 'spend', 'revenue', 'conversions', 'addToCartOmni', 'addToCart', 'checkoutInitiatedOmni', 'checkoutInitiated'];

function rowsToCsv(rows: Record<string, unknown>[]) {
  return [
    EXPORT_HEADERS.join(','),
    ...rows.map(r => EXPORT_HEADERS.map(h => JSON.stringify(r[h] ?? '')).join(','))
  ].join('\n');
}

function downloadCsv(csv: string, filename: string) {
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const exportCsv = async (mode: 'page' | 'all' = 'page') => {
  if (!csrfToken.value) await loadCsrf();
  const filename = `metaflow-products-${new Date().toISOString().slice(0, 10)}.csv`;

  if (mode === 'page') {
    const rows = products.value as Record<string, unknown>[];
    if (!rows.length) return;
    downloadCsv(rowsToCsv(rows), filename);
    $fetch(`${apiBase}/v1/products/notify-export`, {
      method: 'POST', credentials: 'include',
      headers: { 'x-csrf-token': csrfToken.value },
      body: { productCount: rows.length },
    }).catch(() => {});
    return;
  }

  // mode === 'all' — paginate through the full dataset
  exportingAll.value = true;
  exportProgress.value = 'Loading…';
  const batchSize = 200;
  let currentPage = 0;
  let fetched = 0;
  let totalCount = total.value || 0;
  const allRows: Record<string, unknown>[] = [];

  try {
    while (true) {
      const res = await $fetch<{ items: Record<string, unknown>[]; total: number }>(`${apiBase}/v1/products`, {
        credentials: 'include',
        query: {
          ...query.value,
          search:   search.value || undefined,
          category: filter.value === 'all' ? undefined : filter.value,
          stock:    stockFilter.value === 'all' ? undefined : stockFilter.value,
          includeVariants: includeVariants.value ? 'true' : undefined,
          sortBy:   sortBy.value,
          sortDir:  sortDir.value,
          limit:    batchSize,
          page:     currentPage,
          __export: '1',
        },
      });
      const items = res?.items ?? [];
      if (!items.length) break;
      allRows.push(...items);
      fetched += items.length;
      totalCount = res?.total ?? totalCount;
      exportProgress.value = `${fetched.toLocaleString()} / ${totalCount.toLocaleString()}`;
      currentPage++;
      if (items.length < batchSize) break;
    }
    downloadCsv(rowsToCsv(allRows), filename);
    $fetch(`${apiBase}/v1/products/notify-export`, {
      method: 'POST', credentials: 'include',
      headers: { 'x-csrf-token': csrfToken.value },
      body: { productCount: allRows.length },
    }).catch(() => {});
  } catch (err: any) {
    const msg = err?.data?.message || err?.message || 'Export failed. Please try again.';
    syncError.value = err?.status === 429 || err?.statusCode === 429
      ? msg
      : `Export failed: ${msg}`;
  } finally {
    exportingAll.value = false;
    exportProgress.value = '';
  }
};
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
.fade-drop-enter-to,
.fade-drop-leave-from {
  opacity: 1;
  transform: translateY(0);
}
</style>

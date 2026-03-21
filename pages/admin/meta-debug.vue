<template>
  <div class="space-y-6">

    <!-- Header -->
    <div class="flex items-start justify-between gap-4">
      <div>
        <h1 class="text-xl font-semibold text-white">Meta Ads Debug</h1>
        <p class="text-sm text-white/55 mt-1">Inspect the raw data received from Meta and verify product matching</p>
      </div>
      <button
        v-if="storeId"
        @click="load"
        :disabled="loading"
        class="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-medium text-white/80 hover:bg-white/[0.07] hover:text-white transition-all disabled:opacity-50"
      >
        <svg class="w-4 h-4" :class="loading && 'animate-spin'" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"/>
        </svg>
        {{ loading ? 'Fetching…' : 'Refresh' }}
      </button>
    </div>

    <!-- Store + Ad Account pickers -->
    <div class="rounded-2xl border border-white/8 bg-white/[0.03] p-5 space-y-4">
      <!-- Store picker -->
      <div>
        <label class="block text-xs font-semibold text-white/60 mb-2 uppercase tracking-wider">Select Store</label>
        <div v-if="loadingStores" class="h-10 rounded-xl bg-white/4 animate-pulse"></div>
        <div v-else-if="!stores.length" class="text-sm text-white/50 py-2">No stores found</div>
        <div v-else class="flex items-center gap-3">
          <select
            v-model="storeId"
            @change="onStoreChange"
            class="flex-1 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2.5 text-sm text-white appearance-none focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30"
          >
            <option value="" disabled>Choose a store…</option>
            <option v-for="s in stores" :key="s.id" :value="s.id">
              {{ s.name }} — {{ s.platform }} ({{ s._count.products }} products){{ s.connections.length === 0 ? ' · no Meta connection' : '' }}
            </option>
          </select>
          <span v-if="storeId" class="text-xs text-white/40 font-mono shrink-0">{{ storeId }}</span>
        </div>
      </div>

      <!-- Ad Account picker (shown once accounts are loaded) -->
      <div v-if="data?.meta?.adAccounts?.length > 1">
        <label class="block text-xs font-semibold text-white/60 mb-2 uppercase tracking-wider">Ad Account</label>
        <select
          v-model="adAccountId"
          @change="load"
          class="w-full rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2.5 text-sm text-white appearance-none focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30"
        >
          <option v-for="acc in data.meta.adAccounts" :key="acc.id" :value="acc.id">
            {{ acc.name }} ({{ acc.currency }}) · {{ acc.account_id }}
          </option>
        </select>
      </div>
    </div>

    <div v-if="!storeId && !loading" class="rounded-2xl border border-white/8 bg-white/[0.03] p-10 text-center">
      <svg class="w-10 h-10 text-white/20 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1">
        <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 15.75l-2.489-2.489m0 0a3.375 3.375 0 1 0-4.773-4.773 3.375 3.375 0 0 0 4.774 4.774ZM21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/>
      </svg>
      <p class="text-sm text-white/40">Select a store to inspect its Meta connection</p>
    </div>

    <template v-if="data && !loading">

      <!-- ── Connection Status ─────────────────────────────────────────── -->
      <div v-if="!data.connection" class="rounded-2xl border border-red-500/20 bg-red-500/5 p-5 flex items-center gap-3">
        <div class="h-8 w-8 rounded-xl bg-red-500/15 flex items-center justify-center flex-shrink-0">
          <svg class="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12"/></svg>
        </div>
        <div>
          <p class="text-sm font-semibold text-red-300">No Meta Connection</p>
          <p class="text-xs text-red-400/70 mt-0.5">This store has no Meta OAuth connection in the database</p>
        </div>
      </div>

      <template v-else>
        <!-- Connection health + token info -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">

          <!-- Token status -->
          <div class="rounded-2xl border p-5 flex items-start gap-3"
            :class="data.connection.isExpired
              ? 'border-red-500/20 bg-red-500/5'
              : data.meta?.meError
                ? 'border-amber-500/20 bg-amber-500/5'
                : 'border-emerald-500/20 bg-emerald-500/5'"
          >
            <div class="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0"
              :class="data.connection.isExpired ? 'bg-red-500/15' : data.meta?.meError ? 'bg-amber-500/15' : 'bg-emerald-500/15'"
            >
              <svg class="w-4.5 h-4.5" :class="data.connection.isExpired ? 'text-red-400' : data.meta?.meError ? 'text-amber-400' : 'text-emerald-400'"
                fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                <path v-if="!data.connection.isExpired && !data.meta?.meError" stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/>
                <path v-else stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"/>
              </svg>
            </div>
            <div class="min-w-0">
              <p class="text-xs font-semibold uppercase tracking-wider"
                :class="data.connection.isExpired ? 'text-red-400' : data.meta?.meError ? 'text-amber-400' : 'text-emerald-400'"
              >
                {{ data.connection.isExpired ? 'Token Expired' : data.meta?.meError ? 'Token Error' : 'Token Valid' }}
              </p>
              <p v-if="data.meta?.me" class="text-sm text-white/80 mt-1 font-medium">{{ data.meta.me.name }}</p>
              <p v-if="data.meta?.meError" class="text-xs text-amber-300/80 mt-1">{{ data.meta.meError }}</p>
              <p class="text-xs text-white/40 mt-1 font-mono">{{ data.connection.tokenPreview }}</p>
              <p v-if="data.connection.daysUntilExpiry !== null" class="text-xs mt-0.5"
                :class="data.connection.daysUntilExpiry < 7 ? 'text-amber-400' : 'text-white/45'"
              >
                {{ data.connection.daysUntilExpiry > 0 ? `Expires in ${data.connection.daysUntilExpiry} days` : 'Expired' }}
              </p>
              <p v-else class="text-xs text-white/40 mt-0.5">No expiry set</p>
            </div>
          </div>

          <!-- Scopes -->
          <div class="rounded-2xl border border-white/8 bg-white/[0.03] p-5">
            <p class="text-xs font-semibold uppercase tracking-wider text-white/50 mb-3">Granted Scopes</p>
            <div class="flex flex-wrap gap-1.5">
              <span
                v-for="scope in (data.connection.scopes ?? '').split(',')"
                :key="scope"
                class="inline-flex items-center rounded-lg border border-white/8 bg-white/5 px-2 py-0.5 text-[11px] text-white/70 font-mono"
              >{{ scope.trim() }}</span>
              <span v-if="!data.connection.scopes" class="text-xs text-white/40">No scopes recorded</span>
            </div>
            <p class="text-xs text-white/40 mt-3">
              Connected {{ formatDate(data.connection.createdAt) }}<br>
              Updated {{ formatDate(data.connection.updatedAt) }}
            </p>
          </div>

          <!-- Ad accounts summary -->
          <div class="rounded-2xl border border-white/8 bg-white/[0.03] p-5">
            <p class="text-xs font-semibold uppercase tracking-wider text-white/50 mb-3">Ad Accounts</p>
            <div v-if="data.meta?.adAccountsError" class="text-xs text-red-400">{{ data.meta.adAccountsError }}</div>
            <div v-else-if="!data.meta?.adAccounts?.length" class="text-xs text-white/40">No ad accounts found</div>
            <div v-else class="space-y-2">
              <div v-for="acc in data.meta.adAccounts" :key="acc.id" class="flex items-center gap-2">
                <div class="h-2 w-2 rounded-full bg-violet-400 flex-shrink-0"></div>
                <div class="min-w-0">
                  <p class="text-sm text-white/80 font-medium truncate">{{ acc.name || 'Unnamed Account' }}</p>
                  <p class="text-[11px] text-white/45 font-mono">{{ acc.account_id }} · {{ acc.currency }}</p>
                </div>
              </div>
            </div>
            <p class="text-xs text-white/40 mt-3">
              {{ data.meta?.catalogCount ?? 0 }} catalog(s) found in adsets
            </p>
          </div>
        </div>

        <!-- Last Meta sync summary -->
        <div class="rounded-2xl border border-white/8 bg-white/[0.03] p-5">
          <div class="flex items-start justify-between gap-3">
            <div>
              <p class="text-xs font-semibold uppercase tracking-wider text-white/50 mb-1">Last Meta Sync</p>
              <p class="text-sm text-white/80 font-medium">
                {{ data.meta?.syncSummary?.createdAt ? formatDateTime(data.meta.syncSummary.createdAt) : 'No sync summary yet' }}
              </p>
              <p v-if="data.meta?.syncSummary?.detail" class="text-xs text-white/60 mt-1">
                {{ data.meta.syncSummary.detail }}
              </p>
              <p v-else class="text-xs text-white/45 mt-1">Run a sync to capture matching diagnostics.</p>
            </div>
            <NuxtLink to="/admin/activity" class="text-xs text-white/70 hover:text-white transition-colors">Audit log →</NuxtLink>
          </div>
          <div v-if="data.meta?.syncSummary?.metadata" class="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div class="rounded-lg border border-white/8 bg-white/[0.03] px-3 py-2">
              <p class="text-white/45">Matched rows</p>
              <p class="text-white/80 font-mono">{{ data.meta.syncSummary.metadata.matched ?? '—' }}</p>
            </div>
            <div class="rounded-lg border border-white/8 bg-white/[0.03] px-3 py-2">
              <p class="text-white/45">Unmatched spend</p>
              <p class="text-white/80 font-mono">{{ fmtCurrency(data.meta.syncSummary.metadata.unmatchedSpend, data.meta.syncSummary.metadata.currency) }}</p>
            </div>
            <div class="rounded-lg border border-white/8 bg-white/[0.03] px-3 py-2">
              <p class="text-white/45">Breakdown</p>
              <p class="text-white/80 font-mono">{{ data.meta.syncSummary.metadata.productBreakdownSucceeded ? 'OK' : 'Skipped' }}</p>
            </div>
            <div class="rounded-lg border border-white/8 bg-white/[0.03] px-3 py-2">
              <p class="text-white/45">Accounts</p>
              <p class="text-white/80 font-mono">{{ data.meta.syncSummary.metadata.adAccounts ?? '—' }}</p>
            </div>
          </div>
          <div v-if="data.meta?.unmatchedCatalog?.metadata?.unmatchedCount" class="mt-3 text-xs text-red-300">
            {{ data.meta.unmatchedCatalog.metadata.unmatchedCount }} catalog items unmatched. Review catalog SKUs or product titles.
          </div>
        </div>

        <!-- ── Adsets ─────────────────────────────────────────────────────── -->
        <div class="rounded-2xl border border-white/8 bg-white/[0.03]">
          <button @click="showAdsets = !showAdsets" class="w-full flex items-center justify-between p-5 text-left">
            <div class="flex items-center gap-3">
              <div class="h-8 w-8 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                <svg class="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 0 1 0 3.75H5.625a1.875 1.875 0 0 1 0-3.75Z"/></svg>
              </div>
              <div>
                <p class="text-sm font-semibold text-white">Ad Sets</p>
                <p class="text-xs text-white/50">{{ data.meta?.adSets?.length ?? 0 }} adsets · {{ activeAccountName }}</p>
              </div>
            </div>
            <svg class="w-4 h-4 text-white/40 transition-transform" :class="showAdsets && 'rotate-180'" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5"/></svg>
          </button>

          <div v-if="showAdsets" class="border-t border-white/6 overflow-x-auto">
            <div v-if="data.meta?.adSetsError" class="p-5 text-sm text-red-400">{{ data.meta.adSetsError }}</div>
            <div v-else-if="!data.meta?.adSets?.length" class="p-5 text-sm text-white/40">No adsets found</div>
            <table v-else class="w-full text-xs">
              <thead>
                <tr class="border-b border-white/6">
                  <th class="text-left px-5 py-3 text-white/50 font-semibold">Adset</th>
                  <th class="text-left px-4 py-3 text-white/50 font-semibold">Status</th>
                  <th class="text-left px-4 py-3 text-white/50 font-semibold">Catalog ID</th>
                  <th class="text-left px-4 py-3 text-white/50 font-semibold">Product Item ID</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="adset in data.meta.adSets" :key="adset.id" class="border-b border-white/4 hover:bg-white/[0.02]">
                  <td class="px-5 py-3">
                    <p class="text-white/80">{{ adset.name }}</p>
                    <p class="text-white/35 font-mono">{{ adset.id }}</p>
                  </td>
                  <td class="px-4 py-3">
                    <span class="inline-flex rounded-lg px-2 py-0.5 text-[10px] font-semibold uppercase"
                      :class="adset.status === 'ACTIVE' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-white/8 text-white/50'"
                    >{{ adset.status }}</span>
                  </td>
                  <td class="px-4 py-3">
                    <span v-if="adset.promoted_object?.product_catalog_id" class="font-mono text-violet-300">{{ adset.promoted_object.product_catalog_id }}</span>
                    <span v-else class="text-white/25">—</span>
                  </td>
                  <td class="px-4 py-3">
                    <span v-if="adset.promoted_object?.product_item_id" class="font-mono text-blue-300">{{ adset.promoted_object.product_item_id }}</span>
                    <span v-else class="text-white/25">—</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- ── Catalog Product Matching ───────────────────────────────────── -->
        <div class="rounded-2xl border border-white/8 bg-white/[0.03]">
          <button @click="showCatalog = !showCatalog" class="w-full flex items-center justify-between p-5 text-left">
            <div class="flex items-center gap-3">
              <div class="h-8 w-8 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                <svg class="w-4 h-4 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 16.875h3.375m0 0h3.375m-3.375 0V13.5m0 3.375v3.375M6 10.5h2.25a2.25 2.25 0 0 0 2.25-2.25V6a2.25 2.25 0 0 0-2.25-2.25H6A2.25 2.25 0 0 0 3.75 6v2.25A2.25 2.25 0 0 0 6 10.5Zm0 9.75h2.25A2.25 2.25 0 0 0 10.5 18v-2.25a2.25 2.25 0 0 0-2.25-2.25H6a2.25 2.25 0 0 0-2.25 2.25V18A2.25 2.25 0 0 0 6 20.25Zm9.75-9.75H18a2.25 2.25 0 0 0 2.25-2.25V6A2.25 2.25 0 0 0 18 3.75h-2.25A2.25 2.25 0 0 0 13.5 6v2.25a2.25 2.25 0 0 0 2.25 2.25Z"/></svg>
              </div>
              <div>
                <p class="text-sm font-semibold text-white">Catalog Product Matching</p>
                <p class="text-xs text-white/50">
                  {{ totalCatalogProducts }} catalog items ·
                  <span class="text-emerald-400">{{ matchedCount }} matched</span> ·
                  <span class="text-red-400">{{ totalCatalogProducts - matchedCount }} unmatched</span>
                </p>
              </div>
            </div>
            <svg class="w-4 h-4 text-white/40 transition-transform" :class="showCatalog && 'rotate-180'" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5"/></svg>
          </button>

          <div v-if="showCatalog" class="border-t border-white/6">
            <div v-if="!data.meta?.catalogs?.length" class="p-5 text-sm text-white/40">
              No catalogs detected in adsets. Ensure your campaigns use Dynamic Product Ads or Advantage+ Catalog.
            </div>
            <template v-else>
              <div v-for="cat in data.meta.catalogs" :key="cat.catalogId" class="border-b border-white/6 last:border-0">
                <div class="flex items-center gap-2 px-5 py-3 bg-white/[0.015]">
                  <svg class="w-3.5 h-3.5 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z"/></svg>
                  <span class="text-xs font-mono text-violet-300">Catalog {{ cat.catalogId }}</span>
                  <span v-if="cat.error" class="text-xs text-red-400 ml-2">Error: {{ cat.error }}</span>
                  <span v-else class="text-xs text-white/40 ml-2">{{ cat.products.length }} items shown (first 30)</span>
                </div>

                <div v-if="!cat.error" class="overflow-x-auto">
                  <table class="w-full text-xs">
                    <thead>
                      <tr class="border-b border-white/6">
                        <th class="text-left px-5 py-2.5 text-white/45 font-semibold">Match</th>
                        <th class="text-left px-4 py-2.5 text-white/45 font-semibold">Meta Product Name</th>
                        <th class="text-left px-4 py-2.5 text-white/45 font-semibold">Retailer ID</th>
                        <th class="text-left px-4 py-2.5 text-white/45 font-semibold">Catalog Item ID</th>
                        <th class="text-left px-4 py-2.5 text-white/45 font-semibold">DB Product</th>
                        <th class="text-left px-4 py-2.5 text-white/45 font-semibold">Method</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr
                        v-for="item in cat.products"
                        :key="item.catalogItemId"
                        class="border-b border-white/4 hover:bg-white/[0.02]"
                        :class="!item.matchedProductId && 'opacity-70'"
                      >
                        <td class="px-5 py-2.5">
                          <div class="h-5 w-5 rounded-full flex items-center justify-center"
                            :class="item.matchedProductId ? 'bg-emerald-500/20' : 'bg-red-500/15'"
                          >
                            <svg class="w-3 h-3" :class="item.matchedProductId ? 'text-emerald-400' : 'text-red-400'" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                              <path v-if="item.matchedProductId" stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5"/>
                              <path v-else stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12"/>
                            </svg>
                          </div>
                        </td>
                        <td class="px-4 py-2.5 max-w-xs">
                          <p class="text-white/75 truncate">{{ item.name || '—' }}</p>
                        </td>
                        <td class="px-4 py-2.5">
                          <span class="font-mono text-amber-300/80">{{ item.retailer_id || '—' }}</span>
                        </td>
                        <td class="px-4 py-2.5">
                          <span class="font-mono text-white/35">{{ item.catalogItemId }}</span>
                        </td>
                        <td class="px-4 py-2.5 max-w-xs">
                          <p v-if="item.matchedProductTitle" class="text-emerald-300 truncate">{{ item.matchedProductTitle }}</p>
                          <span v-else class="text-red-400/70">No match</span>
                        </td>
                        <td class="px-4 py-2.5">
                          <span v-if="item.matchMethod" class="inline-flex rounded-lg border px-2 py-0.5 text-[10px] font-mono"
                            :class="{
                              'border-emerald-500/30 bg-emerald-500/10 text-emerald-400': item.matchMethod === 'retailer_id',
                              'border-blue-500/30 bg-blue-500/10 text-blue-400': item.matchMethod === 'title_sku',
                              'border-amber-500/30 bg-amber-500/10 text-amber-400': item.matchMethod === 'catalog_id',
                            }"
                          >{{ item.matchMethod }}</span>
                          <span v-else class="text-white/25">—</span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </template>
          </div>
        </div>

        <!-- ── Raw Insights ───────────────────────────────────────────────── -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">

          <!-- Regular insights (no breakdown) -->
          <div class="rounded-2xl border border-white/8 bg-white/[0.03]">
            <button @click="showInsights = !showInsights" class="w-full flex items-center justify-between p-5 text-left">
              <div class="flex items-center gap-3">
                <div class="h-8 w-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                  <svg class="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z"/></svg>
                </div>
                <div>
                  <p class="text-sm font-semibold text-white">Regular Insights</p>
                  <p class="text-xs text-white/50">No product breakdown · Last 7 days · 5 rows</p>
                </div>
              </div>
              <svg class="w-4 h-4 text-white/40 transition-transform" :class="showInsights && 'rotate-180'" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5"/></svg>
            </button>

            <div v-if="showInsights" class="border-t border-white/6 p-4">
              <div v-if="data.meta?.sampleInsightsError" class="text-xs text-red-400 mb-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                {{ data.meta.sampleInsightsError }}
              </div>
              <div v-if="!data.meta?.sampleInsights?.length" class="text-xs text-white/40 py-4 text-center">No insights returned</div>
              <div v-else class="space-y-3">
                <div v-for="(ins, i) in data.meta.sampleInsights" :key="i" class="rounded-xl border border-white/6 bg-white/[0.02]">
                  <button @click="toggleInsight('reg', i)" class="w-full flex items-center justify-between px-4 py-2.5 text-left">
                    <div class="flex items-center gap-3 min-w-0">
                      <span class="text-[10px] font-mono text-white/35">{{ ins.date_start }}</span>
                      <span class="text-xs text-white/70 truncate">ad: {{ ins.ad_id }}</span>
                      <span class="text-xs font-semibold text-amber-400">${{ parseFloat(ins.spend || '0').toFixed(2) }}</span>
                    </div>
                    <span class="text-white/35 text-xs ml-2">{{ expandedInsights.reg.has(i) ? '▲' : '▼' }}</span>
                  </button>
                  <div v-if="expandedInsights.reg.has(i)" class="border-t border-white/6 p-4">
                    <pre class="text-[11px] text-white/65 font-mono whitespace-pre-wrap break-all leading-relaxed">{{ JSON.stringify(ins, null, 2) }}</pre>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Product breakdown insights -->
          <div class="rounded-2xl border border-white/8 bg-white/[0.03]">
            <button @click="showProductInsights = !showProductInsights" class="w-full flex items-center justify-between p-5 text-left">
              <div class="flex items-center gap-3">
                <div class="h-8 w-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                  <svg class="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12"/></svg>
                </div>
                <div>
                  <p class="text-sm font-semibold text-white">Product Breakdown Insights</p>
                  <p class="text-xs text-white/50">
                    <span v-if="data.meta?.catalogCount === 0" class="text-amber-400">No catalogs — breakdown skipped</span>
                    <span v-else>breakdowns=product_id · Last 7 days · 10 rows</span>
                  </p>
                </div>
              </div>
              <svg class="w-4 h-4 text-white/40 transition-transform" :class="showProductInsights && 'rotate-180'" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5"/></svg>
            </button>

            <div v-if="showProductInsights" class="border-t border-white/6 p-4">
              <div v-if="data.meta?.sampleProductInsightsError" class="text-xs text-red-400 mb-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                {{ data.meta.sampleProductInsightsError }}
              </div>
              <div v-if="data.meta?.catalogCount === 0" class="text-xs text-amber-400/80 py-4 text-center">
                No catalog-based campaigns detected.<br>Product breakdown only works with Dynamic Product Ads.
              </div>
              <div v-else-if="!data.meta?.sampleProductInsights?.length" class="text-xs text-white/40 py-4 text-center">
                No product breakdown data returned. This usually means no DPA campaigns ran recently.
              </div>
              <div v-else class="space-y-3">
                <div v-for="(ins, i) in data.meta.sampleProductInsights" :key="i" class="rounded-xl border border-white/6 bg-white/[0.02]">
                  <button @click="toggleInsight('prod', i)" class="w-full flex items-center justify-between px-4 py-2.5 text-left">
                    <div class="flex items-center gap-3 min-w-0">
                      <span class="text-[10px] font-mono text-white/35">{{ ins.date_start }}</span>
                      <span v-if="ins.product_id" class="inline-flex rounded-md border border-violet-500/30 bg-violet-500/10 px-1.5 py-px text-[10px] font-mono text-violet-300">{{ ins.product_id }}</span>
                      <span v-else class="text-xs text-red-400/70">no product_id</span>
                      <span class="text-xs font-semibold text-emerald-400">${{ parseFloat(ins.spend || '0').toFixed(2) }}</span>
                    </div>
                    <span class="text-white/35 text-xs ml-2">{{ expandedInsights.prod.has(i) ? '▲' : '▼' }}</span>
                  </button>
                  <div v-if="expandedInsights.prod.has(i)" class="border-t border-white/6 p-4">
                    <pre class="text-[11px] text-white/65 font-mono whitespace-pre-wrap break-all leading-relaxed">{{ JSON.stringify(ins, null, 2) }}</pre>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- ── DB Product Index ───────────────────────────────────────────── -->
        <div class="rounded-2xl border border-white/8 bg-white/[0.03]">
          <button @click="showDbProducts = !showDbProducts" class="w-full flex items-center justify-between p-5 text-left">
            <div class="flex items-center gap-3">
              <div class="h-8 w-8 rounded-xl bg-white/[0.06] border border-white/10 flex items-center justify-center">
                <svg class="w-4 h-4 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125"/></svg>
              </div>
              <div>
                <p class="text-sm font-semibold text-white">DB Product Index</p>
                <p class="text-xs text-white/50">{{ data.dbProducts.length }} products · SKU &amp; externalId used for matching</p>
              </div>
            </div>
            <svg class="w-4 h-4 text-white/40 transition-transform" :class="showDbProducts && 'rotate-180'" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5"/></svg>
          </button>

          <div v-if="showDbProducts" class="border-t border-white/6 overflow-x-auto">
            <div v-if="!data.dbProducts.length" class="p-5 text-sm text-white/40">No products in DB for this store</div>
            <table v-else class="w-full text-xs">
              <thead>
                <tr class="border-b border-white/6">
                  <th class="text-left px-5 py-3 text-white/45 font-semibold">Title</th>
                  <th class="text-left px-4 py-3 text-white/45 font-semibold">SKU</th>
                  <th class="text-left px-4 py-3 text-white/45 font-semibold">External ID</th>
                  <th class="text-left px-4 py-3 text-white/45 font-semibold">DB ID</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="p in data.dbProducts" :key="p.id" class="border-b border-white/4 hover:bg-white/[0.02]">
                  <td class="px-5 py-2.5 text-white/75 max-w-xs truncate">{{ p.title }}</td>
                  <td class="px-4 py-2.5 font-mono text-amber-300/80">{{ p.sku || '—' }}</td>
                  <td class="px-4 py-2.5 font-mono text-blue-300/70">{{ p.externalId || '—' }}</td>
                  <td class="px-4 py-2.5 font-mono text-white/30">{{ p.id }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </template>
    </template>

    <!-- Loading skeleton -->
    <div v-if="loading" class="space-y-4">
      <div class="h-28 rounded-2xl bg-white/4 animate-pulse border border-white/6"></div>
      <div class="grid grid-cols-3 gap-4">
        <div v-for="i in 3" :key="i" class="h-32 rounded-2xl bg-white/4 animate-pulse border border-white/6"></div>
      </div>
      <div class="h-48 rounded-2xl bg-white/4 animate-pulse border border-white/6"></div>
    </div>

  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'admin' });

const config = useRuntimeConfig();
const apiBase = config.public.apiBase;

const storeId = ref('');
const adAccountId = ref('');
const loadingStores = ref(false);
const loading = ref(false);
const stores = ref<any[]>([]);
const data = ref<any>(null);

const activeAccountName = computed(() => {
  const acc = (data.value?.meta?.adAccounts ?? []).find((a: any) => a.id === data.value?.meta?.activeAccountId);
  return acc ? `${acc.name} (${acc.account_id})` : 'unknown account';
});

// Collapsible sections
const showAdsets = ref(false);
const showCatalog = ref(true);
const showInsights = ref(false);
const showProductInsights = ref(true);
const showDbProducts = ref(false);

// Expandable raw insight rows
const expandedInsights = reactive({ reg: new Set<number>(), prod: new Set<number>() });
function toggleInsight(type: 'reg' | 'prod', i: number) {
  if (expandedInsights[type].has(i)) expandedInsights[type].delete(i);
  else expandedInsights[type].add(i);
}

const totalCatalogProducts = computed(() =>
  (data.value?.meta?.catalogs ?? []).reduce((s: number, c: any) => s + c.products.length, 0)
);
const matchedCount = computed(() =>
  (data.value?.meta?.catalogs ?? []).reduce(
    (s: number, c: any) => s + c.products.filter((p: any) => p.matchedProductId).length, 0
  )
);

function formatDate(d: string) {
  return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateTime(d: string) {
  return new Date(d).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function fmtCurrency(value?: number, currency?: string) {
  if (value == null) return '—';
  const cur = (currency ?? 'USD').toUpperCase();
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: cur, maximumFractionDigits: 2 }).format(value);
  } catch {
    return `${value.toFixed(2)} ${cur}`;
  }
}

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
        await onStoreChange();
      }
    }
  } catch {}
  finally { loadingStores.value = false; }
}

function onStoreChange() {
  adAccountId.value = ''; // reset account when store changes
  load();
}

async function load() {
  if (!storeId.value) return;
  loading.value = true;
  data.value = null;
  expandedInsights.reg.clear();
  expandedInsights.prod.clear();
  try {
    const params = new URLSearchParams({ storeId: storeId.value });
    if (adAccountId.value) params.set('adAccountId', adAccountId.value);
    const res = await $fetch<any>(
      `${apiBase}/v1/admin/meta-debug?${params}`,
      { credentials: 'include' }
    );
    if (res?.ok) {
      data.value = res;
      // Sync adAccountId with what the server returned as active
      if (res.meta?.activeAccountId && !adAccountId.value) {
        adAccountId.value = res.meta.activeAccountId;
      }
    }
  } catch {}
  finally { loading.value = false; }
}

onMounted(loadStores);
</script>

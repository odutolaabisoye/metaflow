<template>
  <div class="space-y-6">

    <!-- Header -->
    <div class="flex items-start justify-between gap-4">
      <div>
        <p class="text-[11px] uppercase tracking-widest text-white/65 mb-1">Analytics</p>
        <h1 class="text-2xl font-semibold tracking-tight">Meta Analytics</h1>
        <p class="mt-1 text-sm text-white/75">Inspect your Meta Ads connection, ad sets, and catalog product matching.</p>
      </div>
      <button
        v-if="storeId"
        @click="load"
        :disabled="loading"
        class="flex-shrink-0 flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-medium text-white/80 hover:bg-white/[0.07] hover:text-white transition-all disabled:opacity-50"
      >
        <svg class="w-4 h-4" :class="loading && 'animate-spin'" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"/>
        </svg>
        {{ loading ? 'Fetching…' : 'Refresh' }}
      </button>
    </div>

    <!-- No store -->
    <div v-if="!storeId" class="glass rounded-2xl p-10 text-center">
      <svg class="w-10 h-10 text-white/20 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1">
        <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 15.75l-2.489-2.489m0 0a3.375 3.375 0 1 0-4.773-4.773 3.375 3.375 0 0 0 4.774 4.774ZM21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/>
      </svg>
      <p class="text-sm text-white/40">No store selected — switch to a store using the sidebar</p>
    </div>

    <!-- Loading skeleton -->
    <div v-if="loading" class="space-y-4">
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div v-for="i in 3" :key="i" class="h-28 rounded-2xl bg-white/4 animate-pulse border border-white/6"></div>
      </div>
      <div class="h-48 rounded-2xl bg-white/4 animate-pulse border border-white/6"></div>
    </div>

    <template v-if="data && !loading">

      <!-- No Meta connection -->
      <div v-if="!data.connection" class="glass rounded-2xl border border-ember-500/20 bg-ember-500/[0.04] p-5 flex items-center gap-3">
        <div class="h-8 w-8 rounded-xl bg-ember-500/15 flex items-center justify-center flex-shrink-0">
          <svg class="w-4 h-4 text-ember-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12"/></svg>
        </div>
        <div>
          <p class="text-sm font-semibold text-ember-300">No Meta Connection</p>
          <p class="text-xs text-ember-400/70 mt-0.5">Connect your Meta Ads account in <NuxtLink to="/app/settings" class="underline underline-offset-2 hover:text-ember-300 transition-colors">Settings → Integrations</NuxtLink></p>
        </div>
      </div>

      <template v-else>

        <!-- Connection health + ad accounts + scopes -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">

          <!-- Token status -->
          <div class="glass rounded-2xl p-5 flex items-start gap-3"
            :class="data.connection.isExpired ? 'border-ember-500/20' : data.meta?.meError ? 'border-amber-500/20' : 'border-lime-500/15'"
          >
            <div class="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0"
              :class="data.connection.isExpired ? 'bg-ember-500/15' : data.meta?.meError ? 'bg-amber-500/15' : 'bg-lime-500/15'"
            >
              <svg class="w-4.5 h-4.5"
                :class="data.connection.isExpired ? 'text-ember-400' : data.meta?.meError ? 'text-amber-400' : 'text-lime-400'"
                fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"
              >
                <path v-if="!data.connection.isExpired && !data.meta?.meError" stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/>
                <path v-else stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"/>
              </svg>
            </div>
            <div class="min-w-0">
              <p class="text-xs font-semibold uppercase tracking-wider mb-1"
                :class="data.connection.isExpired ? 'text-ember-400' : data.meta?.meError ? 'text-amber-400' : 'text-lime-400'"
              >
                {{ data.connection.isExpired ? 'Token Expired' : data.meta?.meError ? 'Token Warning' : 'Connection Active' }}
              </p>
              <p v-if="data.meta?.me" class="text-sm text-white/80 font-medium">{{ data.meta.me.name }}</p>
              <p v-if="data.meta?.meError" class="text-xs text-amber-300/80 mt-1">{{ data.meta.meError }}</p>
              <p v-if="data.connection.daysUntilExpiry !== null" class="text-xs mt-1"
                :class="(data.connection.daysUntilExpiry ?? 999) < 7 ? 'text-amber-400' : 'text-white/45'"
              >
                {{ (data.connection.daysUntilExpiry ?? 0) > 0 ? `Expires in ${data.connection.daysUntilExpiry} days` : 'Expired' }}
              </p>
              <p v-else class="text-xs text-white/45 mt-1">No expiry set (long-lived token)</p>
            </div>
          </div>

          <!-- Scopes -->
          <div class="glass rounded-2xl p-5">
            <p class="text-xs font-semibold uppercase tracking-wider text-white/50 mb-3">Granted Scopes</p>
            <div class="flex flex-wrap gap-1.5">
              <span
                v-for="scope in (data.connection.scopes ?? '').split(',').filter(Boolean)"
                :key="scope"
                class="inline-flex items-center rounded-lg border border-white/8 bg-white/5 px-2 py-0.5 text-[11px] text-white/70 font-mono"
              >{{ scope.trim() }}</span>
              <span v-if="!data.connection.scopes" class="text-xs text-white/40">No scopes recorded</span>
            </div>
          </div>

          <!-- Ad accounts -->
          <div class="glass rounded-2xl p-5">
            <p class="text-xs font-semibold uppercase tracking-wider text-white/50 mb-3">Ad Accounts</p>
            <div v-if="data.meta?.adAccountsError" class="text-xs text-ember-400">{{ data.meta.adAccountsError }}</div>
            <div v-else-if="!data.meta?.adAccounts?.length" class="text-xs text-white/40">No ad accounts found</div>
            <div v-else class="space-y-2">
              <div v-for="acc in data.meta.adAccounts" :key="acc.id" class="flex items-center gap-2">
                <div class="h-2 w-2 rounded-full bg-glow-400 flex-shrink-0"></div>
                <div class="min-w-0">
                  <p class="text-sm text-white/80 font-medium truncate">{{ acc.name || 'Unnamed Account' }}</p>
                  <p class="text-[11px] text-white/45 font-mono">{{ acc.account_id }} · {{ acc.currency }}</p>
                </div>
              </div>
            </div>
            <p class="text-xs text-white/40 mt-3">{{ data.meta?.catalogCount ?? 0 }} catalog(s) found in adsets</p>
          </div>
        </div>

        <!-- Ad Sets -->
        <div class="glass rounded-2xl overflow-hidden">
          <button @click="showAdsets = !showAdsets" class="w-full flex items-center justify-between p-5 text-left">
            <div class="flex items-center gap-3">
              <div class="h-8 w-8 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                <svg class="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 0 1 0 3.75H5.625a1.875 1.875 0 0 1 0-3.75Z"/></svg>
              </div>
              <div>
                <p class="text-sm font-semibold text-white">Ad Sets</p>
                <p class="text-xs text-white/50">{{ data.meta?.adSets?.length ?? 0 }} adsets</p>
              </div>
            </div>
            <svg class="w-4 h-4 text-white/40 transition-transform duration-200" :class="showAdsets && 'rotate-180'" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5"/></svg>
          </button>

          <div v-if="showAdsets" class="border-t border-white/8 overflow-x-auto">
            <div v-if="data.meta?.adSetsError" class="p-5 text-sm text-ember-400">{{ data.meta.adSetsError }}</div>
            <div v-else-if="!data.meta?.adSets?.length" class="p-5 text-sm text-white/40">No adsets found</div>
            <table v-else class="w-full text-xs">
              <thead>
                <tr class="border-b border-white/8">
                  <th class="text-left px-5 py-3 text-white/50 font-semibold">Ad Set</th>
                  <th class="text-left px-4 py-3 text-white/50 font-semibold">Status</th>
                  <th class="text-left px-4 py-3 text-white/50 font-semibold">Catalog ID</th>
                  <th class="text-left px-4 py-3 text-white/50 font-semibold">Product Item ID</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="adset in data.meta.adSets" :key="adset.id" class="border-b border-white/[0.05] hover:bg-white/[0.02]">
                  <td class="px-5 py-3">
                    <p class="text-white/80">{{ adset.name }}</p>
                    <p class="text-white/35 font-mono">{{ adset.id }}</p>
                  </td>
                  <td class="px-4 py-3">
                    <span class="inline-flex rounded-lg px-2 py-0.5 text-[10px] font-semibold uppercase"
                      :class="adset.status === 'ACTIVE' ? 'bg-lime-500/15 text-lime-400' : 'bg-white/8 text-white/50'"
                    >{{ adset.status }}</span>
                  </td>
                  <td class="px-4 py-3">
                    <span v-if="adset.promoted_object?.product_catalog_id" class="font-mono text-glow-300">{{ adset.promoted_object.product_catalog_id }}</span>
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

        <!-- Catalog Product Matching -->
        <div class="glass rounded-2xl overflow-hidden">
          <div class="w-full flex items-center justify-between p-5">
            <button @click="showCatalog = !showCatalog" class="flex items-center gap-3 text-left flex-1 min-w-0">
              <div class="h-8 w-8 rounded-xl bg-glow-500/10 border border-glow-500/20 flex items-center justify-center flex-shrink-0">
                <svg class="w-4 h-4 text-glow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 16.875h3.375m0 0h3.375m-3.375 0V13.5m0 3.375v3.375M6 10.5h2.25a2.25 2.25 0 0 0 2.25-2.25V6a2.25 2.25 0 0 0-2.25-2.25H6A2.25 2.25 0 0 0 3.75 6v2.25A2.25 2.25 0 0 0 6 10.5Zm0 9.75h2.25A2.25 2.25 0 0 0 10.5 18v-2.25a2.25 2.25 0 0 0-2.25-2.25H6a2.25 2.25 0 0 0-2.25 2.25V18A2.25 2.25 0 0 0 6 20.25Zm9.75-9.75H18a2.25 2.25 0 0 0 2.25-2.25V6A2.25 2.25 0 0 0 18 3.75h-2.25A2.25 2.25 0 0 0 13.5 6v2.25a2.25 2.25 0 0 0 2.25 2.25Z"/></svg>
              </div>
              <div class="min-w-0">
                <p class="text-sm font-semibold text-white">Catalog Product Matching</p>
                <p class="text-xs text-white/50">
                  {{ totalCatalogProducts }} items ·
                  <span class="text-lime-400">{{ matchedCount }} matched</span> ·
                  <span class="text-ember-400">{{ totalCatalogProducts - matchedCount }} unmatched</span>
                </p>
              </div>
            </button>
            <div class="flex items-center gap-2 flex-shrink-0">
              <button v-if="totalCatalogProducts > 0" @click.stop="exportMetaCsv" class="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-white/70 hover:bg-white/[0.07] hover:text-white transition-all">
                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"/>
                </svg>
                Export CSV
              </button>
              <button @click="showCatalog = !showCatalog" class="p-1">
                <svg class="w-4 h-4 text-white/40 transition-transform duration-200" :class="showCatalog && 'rotate-180'" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5"/></svg>
              </button>
            </div>
          </div>

          <div v-if="showCatalog" class="border-t border-white/8">
            <div v-if="!data.meta?.catalogs?.length" class="p-5 text-sm text-white/40">
              No catalogs detected in adsets. Ensure your campaigns use Dynamic Product Ads or Advantage+ Catalog.
            </div>
            <template v-else>
              <div v-for="cat in data.meta.catalogs" :key="cat.catalogId" class="border-b border-white/8 last:border-0">
                <div class="flex items-center gap-2 px-5 py-3 bg-white/[0.015]">
                  <svg class="w-3.5 h-3.5 text-glow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z"/></svg>
                  <span class="text-xs font-mono text-glow-300">Catalog {{ cat.catalogId }}</span>
                  <span v-if="cat.error" class="text-xs text-ember-400 ml-2">Error: {{ cat.error }}</span>
                  <span v-else class="text-xs text-white/40 ml-2">{{ cat.products?.length ?? 0 }} items shown</span>
                </div>

                <div v-if="!cat.error && cat.products?.length" class="overflow-x-auto">
                  <table class="w-full text-xs">
                    <thead>
                      <tr class="border-b border-white/8">
                        <th class="text-left px-5 py-2.5 text-white/45 font-semibold">Match</th>
                        <th class="text-left px-4 py-2.5 text-white/45 font-semibold">Meta Product</th>
                        <th class="text-left px-4 py-2.5 text-white/45 font-semibold">Retailer ID</th>
                        <th class="text-left px-4 py-2.5 text-white/45 font-semibold">DB Product</th>
                        <th class="text-left px-4 py-2.5 text-white/45 font-semibold">Method</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr
                        v-for="item in cat.products"
                        :key="item.catalogItemId"
                        class="border-b border-white/[0.04] hover:bg-white/[0.02]"
                        :class="!item.matchedProductId && 'opacity-70'"
                      >
                        <td class="px-5 py-2.5">
                          <div class="h-5 w-5 rounded-full flex items-center justify-center"
                            :class="item.matchedProductId ? 'bg-lime-500/20' : 'bg-ember-500/15'"
                          >
                            <svg class="w-3 h-3" :class="item.matchedProductId ? 'text-lime-400' : 'text-ember-400'" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                              <path v-if="item.matchedProductId" stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5"/>
                              <path v-else stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12"/>
                            </svg>
                          </div>
                        </td>
                        <td class="px-4 py-2.5 max-w-[160px]">
                          <p class="text-white/75 truncate">{{ item.name || '—' }}</p>
                        </td>
                        <td class="px-4 py-2.5">
                          <span class="font-mono text-amber-300/80">{{ item.retailer_id || '—' }}</span>
                        </td>
                        <td class="px-4 py-2.5 max-w-[160px]">
                          <p v-if="item.matchedProductTitle" class="text-lime-300 truncate">{{ item.matchedProductTitle }}</p>
                          <span v-else class="text-ember-400/70">No match</span>
                        </td>
                        <td class="px-4 py-2.5">
                          <span v-if="item.matchMethod" class="inline-flex rounded-lg border px-2 py-0.5 text-[10px] font-mono"
                            :class="{
                              'border-lime-500/30 bg-lime-500/10 text-lime-400': item.matchMethod === 'retailer_id',
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

      </template>
    </template>

    <!-- Error -->
    <div v-if="error" class="glass rounded-2xl p-5 border border-ember-500/20 bg-ember-500/[0.04] text-sm text-ember-400">
      {{ error }}
    </div>

  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' });
useHead({ title: 'Meta Analytics — MetaFlow' });

const config = useRuntimeConfig();
const activeStoreId = useState<string | null>('mf_active_store_id', () => null);
const storeId = computed(() => activeStoreId.value ?? '');

const loading = ref(false);
const data = ref<any>(null);
const error = ref('');
const showAdsets = ref(true);
const showCatalog = ref(true);

const totalCatalogProducts = computed(() => {
  if (!data.value?.meta?.catalogs) return 0;
  return (data.value.meta.catalogs as any[]).reduce((s: number, c: any) => s + (c.products?.length ?? 0), 0);
});
const matchedCount = computed(() => {
  if (!data.value?.meta?.catalogs) return 0;
  return (data.value.meta.catalogs as any[]).reduce((s: number, c: any) =>
    s + (c.products ?? []).filter((p: any) => p.matchedProductId).length, 0);
});

async function load() {
  if (!storeId.value) return;
  loading.value = true;
  error.value = '';
  try {
    const res = await $fetch<any>(
      `${config.public.apiBase}/v1/analytics/meta?storeId=${storeId.value}`,
      { credentials: 'include' }
    );
    if (res?.ok) data.value = res;
    else error.value = res?.message ?? 'Failed to load Meta analytics';
  } catch (e: any) {
    error.value = e?.data?.message ?? 'Failed to load data';
  } finally {
    loading.value = false;
  }
}

function exportMetaCsv() {
  if (!data.value?.meta?.catalogs?.length) return;

  const headers = ['Catalog ID', 'Matched', 'Meta Product Name', 'Retailer ID', 'DB Product Title', 'Match Method'];
  const rows: string[][] = [];

  for (const cat of data.value.meta.catalogs as any[]) {
    if (cat.error || !cat.products?.length) continue;
    for (const item of cat.products) {
      rows.push([
        cat.catalogId ?? '',
        item.matchedProductId ? 'Yes' : 'No',
        `"${(item.name ?? '').replace(/"/g, '""')}"`,
        `"${(item.retailer_id ?? '').replace(/"/g, '""')}"`,
        `"${(item.matchedProductTitle ?? '').replace(/"/g, '""')}"`,
        item.matchMethod ?? '',
      ]);
    }
  }

  if (!rows.length) return;

  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `metaflow-catalog-matching-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

watch(storeId, (id) => {
  if (id) load();
}, { immediate: true });
</script>

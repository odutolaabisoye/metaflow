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
        v-if="storeId && (mode === 'all' ? !!data : !!skuData)"
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
      <div v-if="mode === 'all'" class="flex flex-wrap items-end gap-3">
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

      <template v-if="data && !loading">
        <!-- Summary stats -->
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div class="glass rounded-2xl p-4">
            <p class="text-xs text-white/55 uppercase tracking-wider mb-1">Products</p>
            <p class="text-2xl font-bold">{{ data.summary?.total ?? 0 }}</p>
          </div>
          <div class="glass rounded-2xl p-4">
            <p class="text-xs text-white/55 uppercase tracking-wider mb-1">Total Revenue</p>
            <p class="text-2xl font-bold">{{ fmt(data.summary?.totalRevenue) }}</p>
          </div>
          <div class="glass rounded-2xl p-4">
            <p class="text-xs text-white/55 uppercase tracking-wider mb-1">Total Spend</p>
            <p class="text-2xl font-bold">{{ fmt(data.summary?.totalSpend) }}</p>
          </div>
          <div class="glass rounded-2xl p-4">
            <p class="text-xs text-white/55 uppercase tracking-wider mb-1">Avg ROAS</p>
            <p class="text-2xl font-bold">{{ (data.summary?.avgRoas ?? 0).toFixed(2) }}x</p>
          </div>
        </div>

        <!-- Products table -->
        <div class="glass rounded-2xl overflow-hidden">
          <div class="px-5 py-3 border-b border-white/8 flex items-center justify-between">
            <p class="text-xs font-semibold text-white/60 uppercase tracking-wider">Products ({{ data.products?.length ?? 0 }} shown)</p>
            <p class="text-xs text-white/40">{{ data.range?.start }} → {{ data.range?.end }}</p>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full text-sm min-w-[800px]">
              <thead>
                <tr class="border-b border-white/8">
                  <th class="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-white/50">Product</th>
                  <th class="text-right px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-white/50">Score</th>
                  <th class="text-right px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-white/50">Revenue</th>
                  <th class="text-right px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-white/50">Meta Rev</th>
                  <th class="text-right px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-white/50">Spend</th>
                  <th class="text-right px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-white/50">ROAS</th>
                  <th class="text-right px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-white/50">Impressions</th>
                  <th class="text-right px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-white/50">Clicks</th>
                  <th class="text-right px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-white/50">Days</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-white/[0.04]">
                <tr
                  v-for="p in data.products"
                  :key="p.id"
                  class="hover:bg-white/[0.025] transition-colors"
                >
                  <td class="px-4 py-3">
                    <div class="flex items-center gap-2.5">
                      <img v-if="p.imageUrl" :src="p.imageUrl" class="h-8 w-8 rounded-lg object-cover flex-shrink-0" alt="" />
                      <div v-else class="h-8 w-8 rounded-lg bg-white/8 flex-shrink-0"></div>
                      <div class="min-w-0">
                        <p class="text-xs font-medium text-white/85 truncate max-w-[180px]">{{ p.title }}</p>
                        <p class="text-[10px] text-white/45 font-mono truncate">{{ p.sku || p.externalId }}</p>
                      </div>
                    </div>
                  </td>
                  <td class="text-right px-4 py-3">
                    <span
                      class="inline-block text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                      :class="p.score >= 80 ? 'bg-lime-500/15 text-lime-400' : p.score >= 50 ? 'bg-cyan-500/15 text-cyan-400' : 'bg-ember-500/15 text-ember-400'"
                    >{{ p.score }}</span>
                  </td>
                  <td class="text-right px-4 py-3 text-xs text-white/70 font-mono">{{ fmt(p.totalRevenue) }}</td>
                  <td class="text-right px-4 py-3 text-xs text-white/70 font-mono">{{ fmt(p.totalMetaRevenue) }}</td>
                  <td class="text-right px-4 py-3 text-xs text-white/70 font-mono">{{ fmt(p.totalSpend) }}</td>
                  <td class="text-right px-4 py-3 text-xs font-mono" :class="p.roas >= 2 ? 'text-lime-400' : p.roas >= 1 ? 'text-white/70' : 'text-ember-400'">
                    {{ p.roas.toFixed(2) }}x
                  </td>
                  <td class="text-right px-4 py-3 text-xs text-white/55 font-mono">{{ (p.totalImpressions ?? 0).toLocaleString() }}</td>
                  <td class="text-right px-4 py-3 text-xs text-white/55 font-mono">{{ (p.totalClicks ?? 0).toLocaleString() }}</td>
                  <td class="text-right px-4 py-3 text-xs text-white/45">{{ p.metricRowCount }}</td>
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
        <div class="glass rounded-2xl p-5 space-y-4">
          <!-- Product header -->
          <div class="flex items-center gap-4">
            <img v-if="skuData.product?.imageUrl" :src="skuData.product.imageUrl" class="h-14 w-14 rounded-xl object-cover flex-shrink-0" alt="" />
            <div v-else class="h-14 w-14 rounded-xl bg-white/8 flex-shrink-0"></div>
            <div>
              <h2 class="text-base font-semibold">{{ skuData.product?.title }}</h2>
              <p class="text-xs text-white/55 font-mono mt-0.5">{{ skuData.product?.sku }} · {{ skuData.product?.externalId }}</p>
              <div class="flex items-center gap-2 mt-1">
                <span class="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-glow-500/15 text-glow-400">Score: {{ skuData.product?.score }}</span>
                <span class="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-white/8 text-white/60">{{ skuData.product?.category }}</span>
              </div>
            </div>
          </div>

          <!-- Metric rows -->
          <div v-if="skuData.metrics?.length" class="overflow-x-auto">
            <table class="w-full text-xs min-w-[700px]">
              <thead>
                <tr class="border-b border-white/8">
                  <th class="text-left px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-white/50">Date</th>
                  <th class="text-right px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-white/50">Revenue</th>
                  <th class="text-right px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-white/50">Meta Rev</th>
                  <th class="text-right px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-white/50">Spend</th>
                  <th class="text-right px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-white/50">ROAS</th>
                  <th class="text-right px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-white/50">Impressions</th>
                  <th class="text-right px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-white/50">Clicks</th>
                  <th class="text-right px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-white/50">Margin</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-white/[0.04]">
                <tr v-for="m in skuData.metrics" :key="m.date" class="hover:bg-white/[0.025] transition-colors">
                  <td class="px-3 py-2 font-mono text-white/65">{{ m.date?.slice(0, 10) }}</td>
                  <td class="text-right px-3 py-2 font-mono text-white/70">{{ fmt(m.revenue) }}</td>
                  <td class="text-right px-3 py-2 font-mono text-white/70">{{ fmt(m.metaRevenue) }}</td>
                  <td class="text-right px-3 py-2 font-mono text-white/70">{{ fmt(m.spend) }}</td>
                  <td class="text-right px-3 py-2 font-mono" :class="(m.spend > 0 ? m.metaRevenue / m.spend : 0) >= 2 ? 'text-lime-400' : 'text-white/60'">
                    {{ m.spend > 0 ? (m.metaRevenue / m.spend).toFixed(2) : '—' }}x
                  </td>
                  <td class="text-right px-3 py-2 font-mono text-white/55">{{ (m.impressions ?? 0).toLocaleString() }}</td>
                  <td class="text-right px-3 py-2 font-mono text-white/55">{{ (m.clicks ?? 0).toLocaleString() }}</td>
                  <td class="text-right px-3 py-2 font-mono text-white/55">{{ m.margin != null ? (m.margin * 100).toFixed(1) + '%' : '—' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-else class="py-6 text-center text-sm text-white/40">No metric rows found for this product in the selected range.</div>
        </div>
      </template>
    </template>

    <!-- Error state -->
    <div v-if="error" class="glass rounded-2xl p-5 border border-ember-500/20 bg-ember-500/5 text-sm text-ember-400">
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
const skuQuery = ref('');
const loading = ref(false);
const skuLoading = ref(false);
const data = ref<any>(null);
const skuData = ref<any>(null);
const error = ref('');

function fmt(v?: number | null) {
  if (v == null) return '—';
  return '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

async function doInspect() {
  if (!storeId.value) return;
  loading.value = true;
  error.value = '';
  try {
    const params = new URLSearchParams({
      storeId: storeId.value,
      range: range.value,
      sort: sortBy.value,
      dir: sortDir.value,
      limit: '100',
    });
    if (range.value === 'custom' && customStart.value && customEnd.value) {
      params.set('from', customStart.value);
      params.set('to', customEnd.value);
    }
    const res = await $fetch<any>(
      `${config.public.apiBase}/v1/analytics/products?${params}`,
      { credentials: 'include' }
    );
    if (res?.ok) data.value = res;
    else error.value = res?.message ?? 'Failed to load analytics';
  } catch (e: any) {
    error.value = e?.data?.message ?? 'Failed to load data';
  } finally {
    loading.value = false;
  }
}

async function doSkuLookup() {
  if (!storeId.value || !skuQuery.value.trim()) return;
  skuLoading.value = true;
  error.value = '';
  try {
    const params = new URLSearchParams({
      storeId: storeId.value,
      q: skuQuery.value.trim(),
      range: range.value,
    });
    if (range.value === 'custom' && customStart.value && customEnd.value) {
      params.set('from', customStart.value);
      params.set('to', customEnd.value);
    }
    const res = await $fetch<any>(
      `${config.public.apiBase}/v1/analytics/products/sku?${params}`,
      { credentials: 'include' }
    );
    if (res?.ok) skuData.value = res;
    else error.value = res?.message ?? 'Product not found';
  } catch (e: any) {
    error.value = e?.data?.message ?? 'Product not found';
  } finally {
    skuLoading.value = false;
  }
}

// Auto-load when store changes
watch(storeId, (id) => {
  if (id && mode.value === 'all') doInspect();
}, { immediate: true });

watch(mode, (m) => {
  if (m === 'all' && storeId.value && !data.value) doInspect();
});
</script>

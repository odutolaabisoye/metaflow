<template>
  <div class="space-y-5">
    <!-- Header -->
    <div class="flex items-start justify-between">
      <div>
        <h1 class="text-xl font-semibold text-white">Stores</h1>
        <p class="text-sm text-white/65 mt-1">
          <span v-if="!loading">{{ total.toLocaleString() }} store{{ total !== 1 ? 's' : '' }} across the platform</span>
          <span v-else class="inline-block h-4 w-28 bg-white/8 rounded animate-pulse"></span>
        </p>
      </div>
    </div>

    <!-- Filters -->
    <div class="flex items-center gap-3 flex-wrap">
      <div class="relative flex-1 min-w-[200px] max-w-xs">
        <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/55" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"/>
        </svg>
        <input
          v-model="searchInput"
          type="text"
          placeholder="Search stores, owners…"
          class="w-full bg-white/[0.04] border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-white/25 focus:outline-none focus:border-violet-500/50 focus:bg-white/[0.06] transition-all"
          @input="onSearch"
        />
      </div>

      <!-- Platform filter -->
      <div class="flex items-center gap-1.5 bg-white/[0.03] border border-white/8 rounded-xl p-1">
        <button
          v-for="p in ['All', 'SHOPIFY', 'WOOCOMMERCE', 'API']"
          :key="p"
          @click="setPlatform(p)"
          class="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
          :class="selectedPlatform === p
            ? 'bg-violet-500/20 text-violet-300 border border-violet-500/25'
            : 'text-white/65 hover:text-white/65'"
        >
          {{ p === 'All' ? 'All' : p.charAt(0) + p.slice(1).toLowerCase() }}
        </button>
      </div>
    </div>

    <!-- Table -->
    <div class="rounded-2xl border border-white/8 bg-white/[0.02] overflow-hidden">
      <!-- Loading -->
      <div v-if="loading" class="divide-y divide-white/6">
        <div v-for="i in 8" :key="i" class="flex items-center gap-4 px-5 py-4">
          <div class="h-9 w-9 rounded-xl bg-white/6 animate-pulse flex-shrink-0"></div>
          <div class="flex-1 space-y-1.5">
            <div class="h-3.5 w-44 bg-white/6 rounded animate-pulse"></div>
            <div class="h-2.5 w-32 bg-white/4 rounded animate-pulse"></div>
          </div>
          <div class="h-5 w-20 bg-white/4 rounded animate-pulse"></div>
          <div class="h-4 w-10 bg-white/4 rounded animate-pulse"></div>
        </div>
      </div>

      <!-- Empty -->
      <div v-else-if="stores.length === 0" class="py-16 text-center">
        <svg class="w-10 h-10 text-white/45 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1">
          <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 21v-7.5a.75.75 0 0 1 .75-.75h3a.75.75 0 0 1 .75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 0 0 3.75-.615A2.993 2.993 0 0 0 9.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 0 0 2.25 1.016c.896 0 1.7-.393 2.25-1.015a3.001 3.001 0 0 0 3.75.614m-16.5 0a3.004 3.004 0 0 1-.621-4.72L4.318 3.44A1.5 1.5 0 0 1 5.378 3h13.243a1.5 1.5 0 0 1 1.06.44l1.19 1.189a3 3 0 0 1-.621 4.72m-13.5 8.65h3.75a.75.75 0 0 0 .75-.75V13.5a.75.75 0 0 0-.75-.75H6.75a.75.75 0 0 0-.75.75v3.75c0 .415.336.75.75.75Z"/>
        </svg>
        <p class="text-sm text-white/55">{{ search || selectedPlatform !== 'All' ? 'No stores match your filters' : 'No stores found' }}</p>
      </div>

      <!-- Rows -->
      <div v-else class="divide-y divide-white/5">
        <!-- Header -->
        <div class="grid grid-cols-[1fr_180px_80px_80px_120px_80px] gap-4 px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-white/50">
          <span>Store</span>
          <span>Owner</span>
          <span>Platform</span>
          <span>Products</span>
          <span>Created</span>
          <span class="text-right">Actions</span>
        </div>

        <div
          v-for="store in stores"
          :key="store.id"
          class="grid grid-cols-[1fr_180px_80px_80px_120px_80px] gap-4 px-5 py-3.5 items-center hover:bg-white/[0.025] transition-colors group"
        >
          <!-- Store info -->
          <div class="flex items-center gap-3 min-w-0">
            <div
              class="h-9 w-9 flex-shrink-0 rounded-xl flex items-center justify-center text-xs font-bold"
              :style="platformStyle(store.platform)"
            >
              {{ store.name.charAt(0).toUpperCase() }}
            </div>
            <div class="min-w-0">
              <p class="text-sm font-medium text-white/85 truncate">{{ store.name }}</p>
              <p class="text-xs text-white/55 truncate">{{ store.storeUrl }}</p>
            </div>
          </div>

          <!-- Owner -->
          <div class="min-w-0">
            <NuxtLink
              :to="`/admin/users/${store.owner.id}`"
              class="text-xs text-violet-400 hover:text-violet-300 transition-colors truncate block"
            >
              {{ store.owner.name || store.owner.email }}
            </NuxtLink>
            <p class="text-[10px] text-white/55 truncate">{{ store.owner.email }}</p>
          </div>

          <!-- Platform badge -->
          <div>
            <span class="text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider" :class="platformBadge(store.platform)">
              {{ store.platform.toLowerCase() }}
            </span>
          </div>

          <!-- Products -->
          <div class="text-sm font-medium text-white/80">{{ store._count.products }}</div>

          <!-- Created date -->
          <div class="text-xs text-white/60">{{ formatDate(store.createdAt) }}</div>

          <!-- Actions -->
          <div class="flex items-center gap-1.5 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
            <NuxtLink
              :to="`/admin/users/${store.owner.id}`"
              class="p-1.5 rounded-lg bg-white/5 hover:bg-violet-500/10 border border-white/8 hover:border-violet-500/20 text-white/55 hover:text-violet-400 transition-all"
              title="View owner"
            >
              <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"/>
              </svg>
            </NuxtLink>
            <button
              @click="confirmDelete(store)"
              class="p-1.5 rounded-lg bg-white/5 hover:bg-red-500/10 border border-white/8 hover:border-red-500/20 text-white/55 hover:text-red-400 transition-all"
              title="Delete store"
            >
              <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Pagination -->
    <div v-if="nextCursor || page > 1" class="flex items-center justify-between">
      <button :disabled="page <= 1" @click="prevPage" class="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 bg-white/[0.03] text-sm text-white/80 hover:text-white/80 hover:border-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5"/></svg>
        Previous
      </button>
      <span class="text-xs text-white/55">Page {{ page }}</span>
      <button :disabled="!nextCursor" @click="nextPage" class="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 bg-white/[0.03] text-sm text-white/80 hover:text-white/80 hover:border-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
        Next
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5"/></svg>
      </button>
    </div>

    <!-- Delete modal -->
    <Teleport to="body">
      <div v-if="deleteTarget" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" @click="deleteTarget = null"></div>
        <div class="relative w-full max-w-sm rounded-2xl bg-ink-900 border border-white/12 shadow-2xl overflow-hidden">
          <div class="h-1 bg-gradient-to-r from-red-600 to-rose-500"></div>
          <div class="p-6">
            <h3 class="text-sm font-semibold text-white mb-2">Delete Store</h3>
            <p class="text-xs text-white/70 mb-5">
              Permanently delete <span class="text-white/70 font-medium">{{ deleteTarget.name }}</span> owned by <span class="text-white/70 font-medium">{{ deleteTarget.owner.email }}</span>. This will remove all products, metrics, and audit logs.
            </p>
            <div class="flex gap-3">
              <button @click="deleteTarget = null" class="flex-1 py-2.5 rounded-xl border border-white/10 bg-white/[0.04] text-sm text-white/80 hover:text-white transition-all">Cancel</button>
              <button @click="doDelete" :disabled="deleting" class="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-sm font-semibold text-white disabled:opacity-60 transition-colors flex items-center justify-center gap-2">
                <svg v-if="deleting" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                Delete Store
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'admin' });

const config = useRuntimeConfig();

interface StoreRow {
  id: string; name: string; platform: string; storeUrl: string; currency: string;
  createdAt: string; lastSyncAt: string | null;
  owner: { id: string; email: string; name?: string };
  connections: { id: string; provider: string }[];
  _count: { products: number };
}

const loading = ref(true);
const stores = ref<StoreRow[]>([]);
const total = ref(0);
const nextCursor = ref<string | null>(null);
const page = ref(1);
const cursorStack = ref<string[]>([]);

const searchInput = ref('');
const search = ref('');
const selectedPlatform = ref('All');
let searchTimer: ReturnType<typeof setTimeout>;

const deleteTarget = ref<StoreRow | null>(null);
const deleting = ref(false);

async function fetchStores(cursor?: string) {
  loading.value = true;
  try {
    const params = new URLSearchParams({ limit: '20' });
    if (search.value) params.set('search', search.value);
    if (selectedPlatform.value !== 'All') params.set('platform', selectedPlatform.value);
    if (cursor) params.set('cursor', cursor);

    const res = await $fetch<{ ok: boolean; stores: StoreRow[]; nextCursor: string | null; total: number }>(
      `${config.public.apiBase}/v1/admin/stores?${params}`,
      { credentials: 'include' }
    );
    if (res?.ok) {
      stores.value = res.stores;
      nextCursor.value = res.nextCursor;
      total.value = res.total;
    }
  } catch (err: any) {
    if (err?.statusCode === 403 || err?.statusCode === 401) navigateTo('/app');
  } finally {
    loading.value = false;
  }
}

function onSearch() {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    search.value = searchInput.value;
    resetPagination();
    fetchStores();
  }, 350);
}

function setPlatform(p: string) {
  selectedPlatform.value = p;
  resetPagination();
  fetchStores();
}

function resetPagination() {
  page.value = 1;
  cursorStack.value = [];
}

function nextPage() {
  if (!nextCursor.value) return;
  cursorStack.value.push(nextCursor.value);
  page.value++;
  fetchStores(nextCursor.value);
}

function prevPage() {
  if (page.value <= 1) return;
  cursorStack.value.pop();
  const prev = cursorStack.value[cursorStack.value.length - 1];
  page.value--;
  fetchStores(prev);
}

function confirmDelete(store: StoreRow) {
  deleteTarget.value = store;
}

async function doDelete() {
  if (!deleteTarget.value) return;
  deleting.value = true;
  try {
    await $fetch(`${config.public.apiBase}/v1/admin/stores/${deleteTarget.value.id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    stores.value = stores.value.filter(s => s.id !== deleteTarget.value!.id);
    total.value--;
    deleteTarget.value = null;
  } catch {}
  deleting.value = false;
}

function platformStyle(platform: string) {
  const map: Record<string, { background: string; color: string }> = {
    SHOPIFY: { background: 'rgba(150,191,72,0.15)', color: '#96BF48' },
    WOOCOMMERCE: { background: 'rgba(155,114,207,0.15)', color: '#9B72CF' },
    API: { background: 'rgba(34,211,238,0.12)', color: '#22d3ee' },
  };
  return map[platform] ?? { background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)' };
}

function platformBadge(platform: string) {
  const map: Record<string, string> = {
    SHOPIFY: 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400',
    WOOCOMMERCE: 'bg-violet-500/10 border border-violet-500/20 text-violet-400',
    API: 'bg-sky-500/10 border border-sky-500/20 text-sky-400',
  };
  return map[platform] ?? 'bg-white/6 text-white/65';
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

onMounted(() => fetchStores());
</script>

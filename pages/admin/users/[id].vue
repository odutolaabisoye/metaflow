<template>
  <div class="space-y-6">
    <!-- Back link -->
    <NuxtLink to="/admin/users" class="inline-flex items-center gap-2 text-sm text-white/65 hover:text-white/70 transition-colors">
      <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
        <path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18"/>
      </svg>
      Back to users
    </NuxtLink>

    <!-- Loading skeleton -->
    <div v-if="loading" class="space-y-5">
      <div class="h-40 rounded-2xl bg-white/4 animate-pulse"></div>
      <div class="h-64 rounded-2xl bg-white/4 animate-pulse"></div>
    </div>

    <template v-else-if="user">
      <!-- User profile card -->
      <div class="rounded-2xl border border-white/8 bg-white/[0.03] p-6">
        <div class="flex items-start justify-between gap-4 flex-wrap">
          <div class="flex items-center gap-4">
            <div class="h-14 w-14 flex-shrink-0 rounded-2xl bg-gradient-to-br from-violet-500/30 to-indigo-600/30 border border-violet-500/20 flex items-center justify-center text-xl font-bold text-violet-300">
              {{ (user.name || user.email).charAt(0).toUpperCase() }}
            </div>
            <div>
              <div class="flex items-center gap-2.5 mb-1">
                <h1 class="text-lg font-semibold text-white">{{ user.name || 'No name' }}</h1>
                <span
                  class="text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider"
                  :class="user.role === 'ADMIN'
                    ? 'bg-violet-500/15 border border-violet-500/25 text-violet-400'
                    : 'bg-white/6 border border-white/10 text-white/60'"
                >
                  {{ user.role }}
                </span>
              </div>
              <p class="text-sm text-white/70">{{ user.email }}</p>
              <p class="text-xs text-white/55 mt-1">Joined {{ formatDate(user.createdAt) }}</p>
            </div>
          </div>

          <!-- Role + Plan controls -->
          <div class="flex flex-wrap items-center gap-2">
            <!-- Plan selector -->
            <div class="flex items-center gap-2">
              <span class="text-xs text-white/50">Plan:</span>
              <div class="relative">
                <select
                  :value="user.plan"
                  @change="changePlan(($event.target as HTMLSelectElement).value)"
                  :disabled="changingPlan"
                  class="appearance-none rounded-xl border px-3 py-1.5 text-xs font-semibold cursor-pointer focus:outline-none disabled:opacity-50 pr-7"
                  :class="PLAN_STYLES[user.plan] ?? 'bg-white/6 border-white/10 text-white/50'"
                >
                  <option v-for="p in PLAN_OPTIONS" :key="p" :value="p">{{ p.charAt(0) + p.slice(1).toLowerCase() }}</option>
                </select>
                <svg v-if="changingPlan" class="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 animate-spin text-white/50" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                <svg v-else class="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-current pointer-events-none opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5"/>
                </svg>
              </div>
            </div>
            <!-- Role toggle -->
            <button
              @click="toggleRole"
              :disabled="changingRole"
              class="flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-all disabled:opacity-50"
              :class="user.role === 'ADMIN'
                ? 'border-amber-500/25 bg-amber-500/10 text-amber-400 hover:bg-amber-500/15'
                : 'border-violet-500/25 bg-violet-500/10 text-violet-400 hover:bg-violet-500/15'"
            >
              <svg v-if="changingRole" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              <svg v-else class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                <path v-if="user.role === 'ADMIN'" stroke-linecap="round" stroke-linejoin="round" d="M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 0 1 21.75 8.25Z"/>
                <path v-else stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z"/>
              </svg>
              {{ user.role === 'ADMIN' ? 'Demote to User' : 'Promote to Admin' }}
            </button>
          </div>
        </div>

        <!-- Stats row -->
        <div class="grid grid-cols-3 gap-4 mt-6 pt-5 border-t border-white/8">
          <div>
            <p class="text-2xl font-bold text-white">{{ user._count.stores }}</p>
            <p class="text-xs text-white/60 mt-0.5">Total Stores</p>
          </div>
          <div>
            <p class="text-2xl font-bold text-white">{{ totalProducts }}</p>
            <p class="text-xs text-white/60 mt-0.5">Total Products</p>
          </div>
          <div>
            <p class="text-2xl font-bold text-white">{{ totalConnections }}</p>
            <p class="text-xs text-white/60 mt-0.5">Connections</p>
          </div>
        </div>
      </div>

      <!-- Stores list -->
      <div class="rounded-2xl border border-white/8 bg-white/[0.03] overflow-hidden">
        <div class="px-5 py-4 border-b border-white/8">
          <h2 class="text-sm font-semibold text-white/80">Stores ({{ user.stores.length }})</h2>
        </div>

        <div v-if="user.stores.length === 0" class="py-10 text-center">
          <p class="text-sm text-white/55">No stores connected</p>
        </div>

        <div v-else class="divide-y divide-white/5">
          <div
            v-for="store in user.stores"
            :key="store.id"
            class="px-5 py-4 flex items-center gap-4"
          >
            <!-- Platform avatar -->
            <div
              class="h-9 w-9 flex-shrink-0 rounded-xl flex items-center justify-center text-xs font-bold"
              :style="platformStyle(store.platform)"
            >
              {{ store.name.charAt(0).toUpperCase() }}
            </div>

            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-0.5">
                <p class="text-sm font-medium text-white/80 truncate">{{ store.name }}</p>
                <span class="text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider" :class="platformBadge(store.platform)">
                  {{ store.platform.toLowerCase() }}
                </span>
              </div>
              <p class="text-xs text-white/60 truncate">{{ store.storeUrl }}</p>
            </div>

            <div class="flex items-center gap-6 flex-shrink-0">
              <div class="text-right">
                <p class="text-sm font-semibold text-white/70">{{ store._count.products }}</p>
                <p class="text-[10px] text-white/55">products</p>
              </div>
              <div class="text-right">
                <p class="text-sm font-semibold text-white/70">{{ store.connections.length }}</p>
                <p class="text-[10px] text-white/55">connections</p>
              </div>
              <div class="text-right">
                <p class="text-xs text-white/60">{{ formatDate(store.createdAt) }}</p>
              </div>

              <!-- Delete store -->
              <button
                @click="confirmDeleteStore(store)"
                class="p-1.5 rounded-lg bg-white/4 hover:bg-red-500/10 border border-white/8 hover:border-red-500/20 text-white/50 hover:text-red-400 transition-all"
              >
                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Danger zone: Delete user -->
      <div class="rounded-2xl border border-red-500/15 bg-red-500/[0.03] p-5">
        <h2 class="text-sm font-semibold text-red-400 mb-1">Danger Zone</h2>
        <p class="text-xs text-white/65 mb-4">Permanently delete this user account and all associated data. This action cannot be undone.</p>
        <button
          @click="showDeleteUser = true"
          class="px-4 py-2 rounded-xl border border-red-500/25 bg-red-500/10 text-sm font-medium text-red-400 hover:bg-red-500/15 hover:border-red-500/35 transition-all"
        >
          Delete User Account
        </button>
      </div>
    </template>

    <!-- 404 state -->
    <div v-else class="py-16 text-center">
      <p class="text-white/55">User not found</p>
      <NuxtLink to="/admin/users" class="text-sm text-violet-400 hover:text-violet-300 mt-2 block">← Back to users</NuxtLink>
    </div>

    <!-- Delete store modal -->
    <Teleport to="body">
      <div v-if="storeToDelete" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" @click="storeToDelete = null"></div>
        <div class="relative w-full max-w-sm rounded-2xl bg-ink-900 border border-white/12 shadow-2xl overflow-hidden">
          <div class="h-1 bg-gradient-to-r from-red-600 to-rose-500"></div>
          <div class="p-6">
            <h3 class="text-sm font-semibold text-white mb-2">Delete Store</h3>
            <p class="text-xs text-white/70 mb-5">
              Permanently delete <span class="text-white/70 font-medium">{{ storeToDelete.name }}</span> and all its products, metrics, and audit logs.
            </p>
            <div class="flex gap-3">
              <button @click="storeToDelete = null" class="flex-1 py-2.5 rounded-xl border border-white/10 bg-white/[0.04] text-sm text-white/80 hover:text-white transition-all">Cancel</button>
              <button @click="doDeleteStore" :disabled="deletingStore" class="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-sm font-semibold text-white disabled:opacity-60 transition-colors">
                Delete Store
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Delete user modal -->
    <Teleport to="body">
      <div v-if="showDeleteUser" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" @click="showDeleteUser = false"></div>
        <div class="relative w-full max-w-sm rounded-2xl bg-ink-900 border border-white/12 shadow-2xl overflow-hidden">
          <div class="h-1 bg-gradient-to-r from-red-600 to-rose-500"></div>
          <div class="p-6">
            <h3 class="text-sm font-semibold text-white mb-2">Delete User Account</h3>
            <p class="text-xs text-white/70 mb-5">
              This will delete <span class="text-white/70 font-medium">{{ user?.email }}</span>, all their stores and every piece of data. Cannot be undone.
            </p>
            <div class="flex gap-3">
              <button @click="showDeleteUser = false" class="flex-1 py-2.5 rounded-xl border border-white/10 bg-white/[0.04] text-sm text-white/80 hover:text-white transition-all">Cancel</button>
              <button @click="doDeleteUser" :disabled="deletingUser" class="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-sm font-semibold text-white disabled:opacity-60 transition-colors flex items-center justify-center gap-2">
                <svg v-if="deletingUser" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                Delete Forever
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

const route = useRoute();
const config = useRuntimeConfig();
const userId = route.params.id as string;

interface StoreData {
  id: string; name: string; platform: string; storeUrl: string; currency: string;
  createdAt: string; lastSyncAt: string | null;
  connections: { id: string; provider: string; createdAt: string }[];
  _count: { products: number; dailyMetrics: number };
}

interface UserDetail {
  id: string; email: string; name?: string; role: string; plan: string;
  createdAt: string; updatedAt: string;
  stores: StoreData[];
  _count: { stores: number };
}

const PLAN_OPTIONS = ['STARTER', 'GROWTH', 'SCALE', 'GRANDFATHERED'] as const;
const PLAN_STYLES: Record<string, string> = {
  STARTER:       'bg-cyan-500/10 border-cyan-500/20 text-cyan-400',
  GROWTH:        'bg-lime-500/10 border-lime-500/20 text-lime-400',
  SCALE:         'bg-orange-500/10 border-orange-500/20 text-orange-400',
  GRANDFATHERED: 'bg-white/6 border-white/10 text-white/50',
};

const loading = ref(true);
const user = ref<UserDetail | null>(null);
const changingRole = ref(false);
const changingPlan = ref(false);
const showDeleteUser = ref(false);
const deletingUser = ref(false);
const storeToDelete = ref<StoreData | null>(null);
const deletingStore = ref(false);

const totalProducts = computed(() =>
  user.value?.stores.reduce((s, st) => s + st._count.products, 0) ?? 0
);
const totalConnections = computed(() =>
  user.value?.stores.reduce((s, st) => s + st.connections.length, 0) ?? 0
);

async function fetchUser() {
  loading.value = true;
  try {
    const res = await $fetch<{ ok: boolean; user: UserDetail }>(
      `${config.public.apiBase}/v1/admin/users/${userId}`,
      { credentials: 'include' }
    );
    if (res?.ok) user.value = res.user;
  } catch (err: any) {
    if (err?.statusCode === 403 || err?.statusCode === 401) navigateTo('/app');
  } finally {
    loading.value = false;
  }
}

async function toggleRole() {
  if (!user.value) return;
  changingRole.value = true;
  const newRole = user.value.role === 'ADMIN' ? 'USER' : 'ADMIN';
  try {
    const res = await $fetch<{ ok: boolean; user: { role: string } }>(
      `${config.public.apiBase}/v1/admin/users/${userId}`,
      { method: 'PATCH', body: { role: newRole }, credentials: 'include' }
    );
    if (res?.ok) user.value.role = res.user.role;
  } catch {}
  changingRole.value = false;
}

async function changePlan(newPlan: string) {
  if (!user.value || newPlan === user.value.plan) return;
  changingPlan.value = true;
  try {
    const res = await $fetch<{ ok: boolean; user: { plan: string } }>(
      `${config.public.apiBase}/v1/admin/users/${userId}`,
      { method: 'PATCH', body: { plan: newPlan }, credentials: 'include' }
    );
    if (res?.ok) user.value.plan = res.user.plan;
  } catch {}
  changingPlan.value = false;
}

function confirmDeleteStore(store: StoreData) {
  storeToDelete.value = store;
}

async function doDeleteStore() {
  if (!storeToDelete.value) return;
  deletingStore.value = true;
  try {
    await $fetch(`${config.public.apiBase}/v1/admin/stores/${storeToDelete.value.id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (user.value) {
      user.value.stores = user.value.stores.filter(s => s.id !== storeToDelete.value!.id);
      user.value._count.stores--;
    }
    storeToDelete.value = null;
  } catch {}
  deletingStore.value = false;
}

async function doDeleteUser() {
  deletingUser.value = true;
  try {
    await $fetch(`${config.public.apiBase}/v1/admin/users/${userId}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    navigateTo('/admin/users');
  } catch {}
  deletingUser.value = false;
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

onMounted(() => fetchUser());
</script>

<template>
  <div class="space-y-5">
    <!-- Header -->
    <div class="flex items-start justify-between">
      <div>
        <h1 class="text-xl font-semibold text-white">Users</h1>
        <p class="text-sm text-white/65 mt-1">
          <span v-if="!loading">{{ total.toLocaleString() }} total user{{ total !== 1 ? 's' : '' }}</span>
          <span v-else class="inline-block h-4 w-20 bg-white/8 rounded animate-pulse"></span>
        </p>
      </div>
    </div>

    <!-- Search bar -->
    <div class="flex items-center gap-3">
      <div class="relative flex-1 max-w-sm">
        <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/55" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"/>
        </svg>
        <input
          v-model="searchInput"
          type="text"
          placeholder="Search by name or email…"
          class="w-full bg-white/[0.04] border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-white/25 focus:outline-none focus:border-violet-500/50 focus:bg-white/[0.06] transition-all"
          @input="onSearch"
        />
      </div>
    </div>

    <!-- Table -->
    <div class="rounded-2xl border border-white/8 bg-white/[0.02] overflow-hidden">
      <!-- Loading skeleton -->
      <div v-if="loading" class="divide-y divide-white/6">
        <div v-for="i in 8" :key="i" class="flex items-center gap-4 px-5 py-4">
          <div class="h-8 w-8 rounded-full bg-white/6 animate-pulse flex-shrink-0"></div>
          <div class="flex-1 space-y-1.5">
            <div class="h-3 w-48 bg-white/6 rounded animate-pulse"></div>
            <div class="h-2.5 w-32 bg-white/4 rounded animate-pulse"></div>
          </div>
          <div class="h-5 w-12 bg-white/4 rounded-full animate-pulse"></div>
          <div class="h-4 w-8 bg-white/4 rounded animate-pulse"></div>
          <div class="h-4 w-16 bg-white/4 rounded animate-pulse"></div>
        </div>
      </div>

      <!-- Empty state -->
      <div v-else-if="users.length === 0" class="py-16 text-center">
        <svg class="w-10 h-10 text-white/45 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z"/>
        </svg>
        <p class="text-sm text-white/55">{{ search ? 'No users match your search' : 'No users found' }}</p>
      </div>

      <!-- Data rows -->
      <div v-else class="divide-y divide-white/5">
        <!-- Table header -->
        <div class="grid grid-cols-[1fr_80px_80px_60px_130px_90px] gap-4 px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-white/50">
          <span>User</span>
          <span>Role</span>
          <span>Plan</span>
          <span>Stores</span>
          <span>Joined</span>
          <span class="text-right">Actions</span>
        </div>

        <div
          v-for="user in users"
          :key="user.id"
          class="grid grid-cols-[1fr_80px_80px_60px_130px_90px] gap-4 px-5 py-3.5 items-center hover:bg-white/[0.025] transition-colors group"
        >
          <!-- User info -->
          <div class="flex items-center gap-3 min-w-0">
            <div class="h-8 w-8 flex-shrink-0 rounded-full bg-gradient-to-br from-violet-500/25 to-indigo-600/25 border border-violet-500/20 flex items-center justify-center text-xs font-bold text-violet-300">
              {{ (user.name || user.email).charAt(0).toUpperCase() }}
            </div>
            <div class="min-w-0">
              <p class="text-sm font-medium text-white/85 truncate">{{ user.name || '—' }}</p>
              <p class="text-xs text-white/60 truncate">{{ user.email }}</p>
            </div>
          </div>

          <!-- Role badge -->
          <div>
            <span
              class="inline-flex items-center text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider"
              :class="user.role === 'ADMIN'
                ? 'bg-violet-500/15 border border-violet-500/25 text-violet-400'
                : 'bg-white/6 border border-white/10 text-white/60'"
            >
              {{ user.role === 'ADMIN' ? 'Admin' : 'User' }}
            </span>
          </div>

          <!-- Plan badge -->
          <div>
            <span
              class="inline-flex items-center text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider border"
              :class="PLAN_STYLES[user.plan]?.cls ?? 'bg-white/6 border-white/10 text-white/50'"
            >
              {{ PLAN_STYLES[user.plan]?.label ?? user.plan }}
            </span>
          </div>

          <!-- Stores count -->
          <div class="text-sm text-white/80 font-medium">{{ user._count.stores }}</div>

          <!-- Joined date -->
          <div class="text-xs text-white/60">{{ formatDate(user.createdAt) }}</div>

          <!-- Actions -->
          <div class="flex items-center gap-1.5 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
            <NuxtLink
              :to="`/admin/users/${user.id}`"
              class="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-violet-500/15 border border-white/8 hover:border-violet-500/25 text-xs text-white/75 hover:text-violet-300 transition-all"
            >
              View
            </NuxtLink>
            <button
              @click="confirmDelete(user)"
              class="p-1.5 rounded-lg bg-white/5 hover:bg-red-500/10 border border-white/8 hover:border-red-500/20 text-white/55 hover:text-red-400 transition-all"
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
      <button
        :disabled="page <= 1"
        @click="prevPage"
        class="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 bg-white/[0.03] text-sm text-white/80 hover:text-white/80 hover:border-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
      >
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5"/>
        </svg>
        Previous
      </button>
      <span class="text-xs text-white/55">Page {{ page }}</span>
      <button
        :disabled="!nextCursor"
        @click="nextPage"
        class="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 bg-white/[0.03] text-sm text-white/80 hover:text-white/80 hover:border-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
      >
        Next
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5"/>
        </svg>
      </button>
    </div>

    <!-- Delete confirmation modal -->
    <Teleport to="body">
      <div v-if="deleteTarget" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" @click="deleteTarget = null"></div>
        <div class="relative w-full max-w-sm rounded-2xl bg-ink-900 border border-white/12 shadow-2xl overflow-hidden">
          <div class="h-1 bg-gradient-to-r from-red-600 to-rose-500"></div>
          <div class="p-6">
            <div class="flex items-start gap-3 mb-4">
              <div class="h-9 w-9 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center flex-shrink-0">
                <svg class="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"/>
                </svg>
              </div>
              <div>
                <h3 class="text-sm font-semibold text-white">Delete User</h3>
                <p class="text-xs text-white/70 mt-1">
                  This will permanently delete <span class="text-white/70 font-medium">{{ deleteTarget?.email }}</span> and all their stores, products, and data. This cannot be undone.
                </p>
              </div>
            </div>
            <div class="flex gap-3 mt-6">
              <button
                @click="deleteTarget = null"
                class="flex-1 py-2.5 rounded-xl border border-white/10 bg-white/[0.04] text-sm text-white/80 hover:text-white hover:border-white/20 transition-all"
              >
                Cancel
              </button>
              <button
                @click="doDelete"
                :disabled="deleting"
                class="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-sm font-semibold text-white disabled:opacity-60 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                <svg v-if="deleting" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                Delete User
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

interface User {
  id: string; email: string; name?: string; role: string; plan: string;
  createdAt: string; _count: { stores: number }
}

const PLAN_STYLES: Record<string, { label: string; cls: string }> = {
  STARTER:       { label: 'Starter',  cls: 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400' },
  GROWTH:        { label: 'Growth',   cls: 'bg-lime-500/10 border-lime-500/20 text-lime-400' },
  SCALE:         { label: 'Scale',    cls: 'bg-orange-500/10 border-orange-500/20 text-orange-400' },
  GRANDFATHERED: { label: 'Legacy',   cls: 'bg-white/6 border-white/10 text-white/50' },
};

const loading = ref(true);
const users = ref<User[]>([]);
const total = ref(0);
const nextCursor = ref<string | null>(null);
const page = ref(1);
const cursorStack = ref<string[]>([]);

const searchInput = ref('');
const search = ref('');
let searchTimer: ReturnType<typeof setTimeout>;

const deleteTarget = ref<User | null>(null);
const deleting = ref(false);

async function fetchUsers(cursor?: string) {
  loading.value = true;
  try {
    const params = new URLSearchParams({ limit: '20' });
    if (search.value) params.set('search', search.value);
    if (cursor) params.set('cursor', cursor);

    const res = await $fetch<{ ok: boolean; users: User[]; nextCursor: string | null; total: number }>(
      `${config.public.apiBase}/v1/admin/users?${params}`,
      { credentials: 'include' }
    );
    if (res?.ok) {
      users.value = res.users;
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
    page.value = 1;
    cursorStack.value = [];
    fetchUsers();
  }, 350);
}

function nextPage() {
  if (!nextCursor.value) return;
  cursorStack.value.push(nextCursor.value);
  page.value++;
  fetchUsers(nextCursor.value);
}

function prevPage() {
  if (page.value <= 1) return;
  cursorStack.value.pop();
  const prev = cursorStack.value[cursorStack.value.length - 1];
  page.value--;
  fetchUsers(prev);
}

function confirmDelete(user: User) {
  deleteTarget.value = user;
}

async function doDelete() {
  if (!deleteTarget.value) return;
  deleting.value = true;
  try {
    await $fetch(`${config.public.apiBase}/v1/admin/users/${deleteTarget.value.id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    users.value = users.value.filter(u => u.id !== deleteTarget.value!.id);
    total.value--;
    deleteTarget.value = null;
  } catch {}
  deleting.value = false;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

onMounted(() => fetchUsers());
</script>

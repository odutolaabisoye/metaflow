<template>
  <div class="space-y-6">

    <!-- Page header -->
    <div>
      <h1 class="text-2xl font-semibold tracking-tight">Settings</h1>
      <p class="mt-1 text-sm text-white/40">Manage your integrations, automation rules, and account preferences.</p>
    </div>

    <!-- ── Integrations ── -->
    <div class="glass rounded-2xl p-6">
      <div class="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h2 class="font-semibold">Integrations</h2>
          <p class="text-xs text-white/40 mt-0.5">Your connected platforms and data sources</p>
        </div>
        <NuxtLink
          to="/app/onboarding"
          class="flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-xs font-medium text-white/60 hover:bg-white/10 hover:text-white transition-all"
        >
          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/>
          </svg>
          Add integration
        </NuxtLink>
      </div>

      <div class="space-y-3">

        <!-- Store platform -->
        <div class="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden">
          <div class="p-4">
            <p class="text-xs font-medium text-white/35 uppercase tracking-wider mb-3">Store platform</p>
            <div class="grid gap-2.5 sm:grid-cols-3">
              <div
                v-for="store in storeIntegrations"
                :key="store.id"
                class="flex items-center gap-3 rounded-xl border p-3 transition-all"
                :class="store.connected
                  ? 'border-lime-500/25 bg-lime-500/5'
                  : 'border-white/8 bg-white/[0.02] opacity-60'"
              >
                <div class="h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0" :style="{ background: store.iconBg }">
                  <svg class="w-4 h-4" :style="{ color: store.iconColor }" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" v-html="store.icon"></svg>
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-medium truncate">{{ store.label }}</p>
                  <p class="text-xs text-white/35 truncate mt-0.5">{{ store.detail }}</p>
                </div>
                <div class="flex-shrink-0 flex flex-col items-end gap-1.5">
                  <span class="flex items-center gap-1.5 text-xs font-medium whitespace-nowrap" :class="store.connected ? 'text-lime-400' : 'text-white/25'">
                    <span class="h-1.5 w-1.5 rounded-full" :class="store.connected ? 'bg-lime-400 animate-pulse' : 'bg-white/15'"></span>
                    {{ store.connected ? 'Active' : 'Not connected' }}
                  </span>
                  <button class="text-xs transition-colors whitespace-nowrap" :class="store.connected ? 'text-white/30 hover:text-white/60' : 'text-glow-500/70 hover:text-glow-500'">
                    {{ store.connected ? 'Reconnect' : 'Connect →' }}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Meta Ads -->
        <div
          v-for="integration in adsIntegrations"
          :key="integration.id"
          class="flex items-center gap-4 rounded-xl border p-4 transition-all"
          :class="integration.connected
            ? 'border-lime-500/20 bg-lime-500/[0.04]'
            : 'border-white/10 bg-white/[0.03]'"
        >
          <div class="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0" :style="{ background: integration.iconBg }">
            <svg class="w-5 h-5" :style="{ color: integration.iconColor }" v-html="integration.iconContent" viewBox="0 0 24 24"></svg>
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-semibold">{{ integration.label }}</p>
            <p class="text-xs text-white/40 mt-0.5">{{ integration.detail }}</p>
          </div>
          <div class="flex items-center gap-4 flex-shrink-0">
            <div class="text-right hidden sm:block">
              <span class="flex items-center gap-1.5 text-xs font-medium" :class="integration.connected ? 'text-lime-400' : 'text-white/30'">
                <span class="h-1.5 w-1.5 rounded-full" :class="integration.connected ? 'bg-lime-400 animate-pulse' : 'bg-white/15'"></span>
                {{ integration.connected ? 'Connected' : 'Not connected' }}
              </span>
              <p v-if="integration.subtext" class="text-xs text-white/25 mt-0.5">{{ integration.subtext }}</p>
            </div>
            <button
              class="text-xs font-medium px-3 py-1.5 rounded-lg border transition-all whitespace-nowrap"
              :class="integration.connected
                ? 'border-white/10 text-white/40 hover:text-white/70 hover:border-white/20'
                : 'border-glow-500/25 bg-glow-500/8 text-glow-400 hover:bg-glow-500/15'"
            >
              {{ integration.connected ? 'Reconnect' : 'Connect →' }}
            </button>
          </div>
        </div>

      </div>
    </div>

    <!-- ── Automation rules ── -->
    <div class="glass rounded-2xl p-6">
      <div class="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h2 class="font-semibold">Automation rules</h2>
          <p class="text-xs text-white/40 mt-0.5">Control how MetaFlow acts on your daily scoring results</p>
        </div>
        <span class="rounded-full bg-glow-500/10 border border-glow-500/20 px-2.5 py-0.5 text-xs font-medium text-glow-400">Global</span>
      </div>

      <!-- Skeleton -->
      <div v-if="pending" class="space-y-3">
        <div v-for="i in 4" :key="i" class="h-16 rounded-2xl bg-white/5 animate-pulse"></div>
      </div>

      <div v-else class="space-y-2.5">
        <div
          v-for="rule in automationRules"
          :key="rule.key"
          class="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] p-4 hover:bg-white/[0.05] transition-colors"
        >
          <div class="flex items-center gap-3">
            <div class="h-7 w-7 rounded-lg flex items-center justify-center flex-shrink-0" :style="{ background: rule.bg }">
              <span class="h-2 w-2 rounded-full" :style="{ background: rule.color }"></span>
            </div>
            <div>
              <p class="text-sm font-medium">{{ rule.label }}</p>
              <p class="text-xs text-white/35 mt-0.5">{{ rule.desc }}</p>
            </div>
          </div>
          <!-- Toggle -->
          <button
            @click="rules[rule.key] = !rules[rule.key]"
            class="relative h-6 w-11 rounded-full transition-all duration-200 flex-shrink-0 ml-4"
            :class="rules[rule.key] ? 'bg-glow-500/80' : 'bg-white/15'"
            :aria-checked="rules[rule.key]"
            role="switch"
          >
            <span
              class="absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-all duration-200"
              :class="rules[rule.key] ? 'translate-x-5' : 'translate-x-0'"
            ></span>
          </button>
        </div>
      </div>

      <!-- Score threshold sliders -->
      <div v-if="!pending" class="mt-5 pt-5 border-t border-white/8 space-y-4">
        <p class="text-xs font-medium text-white/35 uppercase tracking-wider">Score thresholds</p>
        <div class="grid gap-4 sm:grid-cols-3">
          <div v-for="threshold in thresholds" :key="threshold.key">
            <div class="flex items-center justify-between mb-2">
              <label class="text-xs font-medium" :style="{ color: threshold.color }">{{ threshold.label }}</label>
              <span class="text-xs font-mono text-white/50">≥ {{ thresholdValues[threshold.key] }}</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              v-model.number="thresholdValues[threshold.key]"
              class="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-white/10"
              :style="{ accentColor: threshold.color }"
            />
          </div>
        </div>
      </div>

      <button
        v-if="!pending"
        class="mt-5 w-full flex items-center justify-center gap-2 rounded-xl bg-white text-ink-950 py-2.5 text-sm font-semibold hover:bg-white/90 transition-all"
      >
        Save rule changes
      </button>
    </div>

    <!-- ── Two-column: Notifications + Billing ── -->
    <div class="grid lg:grid-cols-2 gap-6">

      <!-- Notifications -->
      <div class="glass rounded-2xl p-6">
        <h2 class="font-semibold mb-0.5">Notifications</h2>
        <p class="text-xs text-white/40 mb-5">Choose how MetaFlow keeps you informed</p>

        <div v-if="pending" class="space-y-3">
          <div v-for="i in 3" :key="i" class="h-14 rounded-xl bg-white/5 animate-pulse"></div>
        </div>

        <div v-else class="space-y-2.5">
          <div
            v-for="notif in notificationItems"
            :key="notif.key"
            class="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3"
          >
            <div>
              <p class="text-sm font-medium">{{ notif.label }}</p>
              <p class="text-xs text-white/35 mt-0.5">{{ notif.desc }}</p>
            </div>
            <button
              @click="notifications[notif.key] = !notifications[notif.key]"
              class="relative h-6 w-11 rounded-full transition-all duration-200 flex-shrink-0 ml-4"
              :class="notifications[notif.key] ? 'bg-glow-500/80' : 'bg-white/15'"
              role="switch"
              :aria-checked="notifications[notif.key]"
            >
              <span
                class="absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-all duration-200"
                :class="notifications[notif.key] ? 'translate-x-5' : 'translate-x-0'"
              ></span>
            </button>
          </div>
        </div>

        <!-- Email input -->
        <div v-if="!pending && notifications.emailReports" class="mt-4 pt-4 border-t border-white/8">
          <label class="form-label">Report email address</label>
          <input type="email" placeholder="you@yourstore.com" class="form-input" />
        </div>
      </div>

      <!-- Billing -->
      <div class="glass rounded-2xl p-6">
        <h2 class="font-semibold mb-0.5">Billing</h2>
        <p class="text-xs text-white/40 mb-5">Your current plan and payment details</p>

        <div v-if="pending" class="space-y-3">
          <div v-for="i in 4" :key="i" class="h-6 rounded-xl bg-white/5 animate-pulse" :style="{ opacity: 1 - i * 0.15 }"></div>
        </div>

        <div v-else>
          <!-- Plan highlight -->
          <div class="rounded-xl border border-glow-500/20 bg-glow-500/[0.06] p-4 mb-4">
            <div class="flex items-center justify-between mb-1">
              <p class="text-sm font-semibold">{{ billing.plan }}</p>
              <span class="flex items-center gap-1.5 text-xs text-lime-400 font-medium">
                <span class="h-1.5 w-1.5 rounded-full bg-lime-400 animate-pulse"></span>
                Active
              </span>
            </div>
            <p class="text-2xl font-bold tracking-tight">
              {{ billing.price }}
              <span class="text-sm font-normal text-white/35">/mo</span>
            </p>
          </div>

          <div class="space-y-2.5 text-sm mb-5">
            <div class="flex items-center justify-between">
              <span class="text-white/40">Next invoice</span>
              <span class="font-medium">{{ billing.nextInvoice }}</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-white/40">SKUs included</span>
              <span class="font-medium">2,500</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-white/40">Automation rules</span>
              <span class="font-medium">Unlimited</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-white/40">Team seats</span>
              <span class="font-medium">5</span>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-2.5">
            <button class="flex items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-white/5 py-2.5 text-xs font-medium text-white/60 hover:bg-white/10 hover:text-white transition-all">
              Manage billing
            </button>
            <NuxtLink to="/pricing" class="flex items-center justify-center gap-1.5 rounded-xl border border-glow-500/25 bg-glow-500/8 py-2.5 text-xs font-medium text-glow-400 hover:bg-glow-500/15 transition-all">
              Upgrade plan →
            </NuxtLink>
          </div>
        </div>
      </div>

    </div>

    <!-- ── Danger zone ── -->
    <div class="glass rounded-2xl p-6 border-ember-500/20">
      <h2 class="font-semibold text-ember-400 mb-0.5">Danger zone</h2>
      <p class="text-xs text-white/40 mb-5">Irreversible actions — proceed with caution</p>
      <div class="grid sm:grid-cols-2 gap-3">
        <div class="rounded-xl border border-white/10 bg-white/[0.03] p-4 flex items-center justify-between">
          <div>
            <p class="text-sm font-medium">Reset all rules</p>
            <p class="text-xs text-white/35 mt-0.5">Restore automation rules to defaults</p>
          </div>
          <button class="text-xs text-white/40 hover:text-ember-400 border border-white/10 hover:border-ember-500/30 rounded-lg px-3 py-1.5 transition-all whitespace-nowrap ml-3">
            Reset
          </button>
        </div>
        <div class="rounded-xl border border-white/10 bg-white/[0.03] p-4 flex items-center justify-between">
          <div>
            <p class="text-sm font-medium">Disconnect all integrations</p>
            <p class="text-xs text-white/35 mt-0.5">Remove all store and ad connections</p>
          </div>
          <button class="text-xs text-white/40 hover:text-ember-400 border border-white/10 hover:border-ember-500/30 rounded-lg px-3 py-1.5 transition-all whitespace-nowrap ml-3">
            Disconnect
          </button>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
const { data, pending } = await useFetch("/api/settings");

// ── Integrations state ──
const storeIntegrations = ref([
  {
    id: 'shopify',
    label: 'Shopify',
    detail: 'App Store install · catalog + orders sync',
    connected: false,
    iconBg: 'rgba(150,191,72,0.12)',
    iconColor: '#96BF48',
    icon: '<path stroke-linecap="round" stroke-linejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z"/>',
  },
  {
    id: 'woocommerce',
    label: 'WooCommerce',
    detail: 'REST API · consumer key + webhook',
    connected: false,
    iconBg: 'rgba(127,84,179,0.12)',
    iconColor: '#9B72CF',
    icon: '<path stroke-linecap="round" stroke-linejoin="round" d="M6.75 7.5l3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0021 18V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v12a2.25 2.25 0 002.25 2.25z"/>',
  },
  {
    id: 'api',
    label: 'Custom API',
    detail: 'REST endpoint · Bearer token auth',
    connected: false,
    iconBg: 'rgba(34,211,238,0.1)',
    iconColor: '#22d3ee',
    icon: '<path stroke-linecap="round" stroke-linejoin="round" d="M14.25 9.75L16.5 12l-2.25 2.25m-4.5 0L7.5 12l2.25-2.25M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z"/>',
  },
]);

const adsIntegrations = ref([
  {
    id: 'meta',
    label: 'Meta Ads',
    detail: 'Catalog performance · product sets · budget automation',
    connected: false,
    subtext: '',
    iconBg: 'rgba(24,119,242,0.12)',
    iconColor: '#1877F2',
    iconContent: '<path fill="#1877F2" d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>',
  },
]);

// ── Automation rules ──
const rules = reactive({
  scale:     data.value?.rules?.scale     ?? true,
  test:      data.value?.rules?.test      ?? true,
  kill:      data.value?.rules?.kill      ?? true,
  inventory: data.value?.rules?.inventory ?? true,
});

const automationRules = [
  { key: 'scale',     label: 'Scale winners (score ≥ threshold)',    desc: 'Move to SCALE set, increase budget by 15%',          bg: 'rgba(132,204,22,0.12)',  color: '#84cc16' },
  { key: 'test',      label: 'Test mid-performers (50–79)',           desc: 'Keep in TEST set, monitor 7-day trend',              bg: 'rgba(34,211,238,0.1)',   color: '#22d3ee' },
  { key: 'kill',      label: 'Kill underperformers (below threshold)', desc: 'Move to KILL set, reduce or pause spend',           bg: 'rgba(249,115,22,0.1)',   color: '#f97316' },
  { key: 'inventory', label: 'Inventory risk throttle',               desc: 'Limit spend when stock drops below 15 units',        bg: 'rgba(139,92,246,0.1)',   color: '#a78bfa' },
];

const thresholds = [
  { key: 'scale', label: 'Scale threshold', color: '#84cc16' },
  { key: 'test',  label: 'Test threshold',  color: '#22d3ee' },
  { key: 'kill',  label: 'Kill threshold',  color: '#f97316' },
];

const thresholdValues = reactive({ scale: 80, test: 50, kill: 25 });

// ── Notifications ──
const notifications = reactive({
  emailReports:   data.value?.notifications?.emailReports   ?? true,
  whatsappAlerts: data.value?.notifications?.whatsappAlerts ?? false,
  weeklyDigest:   data.value?.notifications?.weeklyDigest   ?? false,
});

const notificationItems = [
  { key: 'emailReports',   label: 'Email reports',         desc: 'Daily AI briefing + scoring summary sent to your inbox' },
  { key: 'whatsappAlerts', label: 'WhatsApp alerts',       desc: 'Critical inventory and budget alerts via WhatsApp' },
  { key: 'weeklyDigest',   label: 'Weekly KPI digest',     desc: 'Friday summary of catalog performance and wins' },
];

// ── Billing ──
const billing = computed(() => data.value?.billing ?? { plan: 'Growth', price: '$149', nextInvoice: '—' });
</script>

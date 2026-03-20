<template>
  <div class="space-y-6">

    <!-- Page header -->
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <p class="text-[11px] uppercase tracking-widest text-white/65 mb-1">Workspace</p>
        <h1 class="text-2xl font-semibold tracking-tight">Settings</h1>
        <p class="mt-1 text-sm text-white/75">Manage your integrations, automation rules, and account preferences.</p>
      </div>
      <!-- Toasts -->
      <Transition name="fade-up">
        <div v-if="saveSuccess" class="flex items-center gap-2.5 rounded-xl border border-lime-500/25 bg-lime-500/8 px-4 py-2.5 text-sm font-medium text-lime-400">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          Rule changes saved
        </div>
        <div v-else-if="saveError" class="flex items-center gap-2.5 rounded-xl border border-ember-500/25 bg-ember-500/8 px-4 py-2.5 text-sm font-medium text-ember-400">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"/>
          </svg>
          Failed to save: {{ saveError }}
        </div>
        <div v-else-if="metaConnected" class="flex items-center gap-2.5 rounded-xl border border-lime-500/25 bg-lime-500/8 px-4 py-2.5 text-sm font-medium text-lime-400">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          Meta Ads connected successfully
        </div>
        <div v-else-if="metaError" class="flex items-center gap-2.5 rounded-xl border border-ember-500/25 bg-ember-500/8 px-4 py-2.5 text-sm font-medium text-ember-400">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"/>
          </svg>
          Meta connection failed: {{ metaError }}
        </div>
      </Transition>
    </div>

    <!-- ── Integrations ── -->
    <div class="glass rounded-2xl p-6">
      <div class="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h2 class="font-semibold">Integrations</h2>
          <p class="text-xs text-white/65 mt-0.5">Your connected platforms and data sources</p>
        </div>
        <!-- Only show "Add integration" when no store is connected yet -->
        <NuxtLink
          v-if="!connectedStorePlatform && !loadingConnections"
          to="/app/onboarding"
          class="flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-xs font-medium text-white/80 hover:bg-white/10 hover:text-white transition-all"
        >
          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/>
          </svg>
          Add integration
        </NuxtLink>
      </div>

      <!-- Loading skeleton -->
      <div v-if="loadingConnections" class="space-y-3">
        <div class="h-32 rounded-2xl bg-white/5 animate-pulse"></div>
        <div class="h-16 rounded-xl bg-white/5 animate-pulse"></div>
      </div>

      <div v-else class="space-y-3">

        <!-- Store platform -->
        <div class="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden">
          <div class="p-4">
            <p class="text-xs font-medium text-white/80 uppercase tracking-wider mb-3">Store platform</p>
            <div class="grid gap-2.5 sm:grid-cols-3">
              <div
                v-for="store in storeIntegrations"
                :key="store.id"
                class="flex flex-col gap-2.5 rounded-xl border p-3 transition-all"
                :class="store.connected
                  ? 'border-lime-500/25 bg-lime-500/5'
                  : store.disabled
                    ? 'border-white/8 bg-white/[0.02] opacity-35'
                    : 'border-white/8 bg-white/[0.02] opacity-60'"
              >
                <!-- Icon + label row -->
                <div class="flex items-center gap-2.5">
                  <div class="h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0" :style="{ background: store.iconBg }">
                    <svg class="w-4 h-4" :style="{ color: store.iconColor }" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" v-html="store.icon"></svg>
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium truncate">{{ store.label }}</p>
                    <p class="text-xs text-white/75 truncate mt-0.5">{{ store.detail }}</p>
                  </div>
                </div>
                <!-- Status + action row -->
                <div class="flex items-center justify-between gap-2">
                  <span class="flex items-center gap-1.5 text-xs font-medium" :class="store.connected ? 'text-lime-400' : 'text-white/50'">
                    <span class="h-1.5 w-1.5 rounded-full flex-shrink-0" :class="store.connected ? 'bg-lime-400 animate-pulse' : 'bg-white/15'"></span>
                    {{ store.connected ? 'Active' : 'Not connected' }}
                  </span>
                  <button
                    v-if="store.connected"
                    @click="openDisconnect('store', connectedStore?.id ?? '', store.label)"
                    class="text-xs text-ember-400 hover:text-ember-300 transition-colors"
                  >Disconnect</button>
                  <span v-else-if="store.disabled" class="text-xs text-white/40 select-none">Unavailable</span>
                  <NuxtLink v-else to="/app/onboarding" class="text-xs text-glow-500/80 hover:text-glow-500 transition-colors">
                    Connect →
                  </NuxtLink>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Ads integrations (Meta) -->
        <div
          v-for="integration in adsIntegrations"
          :key="integration.id"
          class="flex flex-wrap items-center gap-3 rounded-xl border p-4 transition-all"
          :class="integration.connected
            ? 'border-lime-500/20 bg-lime-500/[0.04]'
            : 'border-white/10 bg-white/[0.03]'"
        >
          <div class="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0" :style="{ background: integration.iconBg }">
            <svg class="w-5 h-5" :style="{ color: integration.iconColor }" v-html="integration.iconContent" viewBox="0 0 24 24"></svg>
          </div>
          <div class="flex-1 min-w-0" style="min-width: 120px;">
            <p class="text-sm font-semibold">{{ integration.label }}</p>
            <p class="text-xs text-white/65 mt-0.5">{{ integration.detail }}</p>
          </div>
          <div class="flex items-center gap-3 ml-auto">
            <div class="text-right hidden sm:block">
              <span class="flex items-center gap-1.5 text-xs font-medium" :class="integration.connected ? 'text-lime-400' : 'text-white/55'">
                <span class="h-1.5 w-1.5 rounded-full flex-shrink-0" :class="integration.connected ? 'bg-lime-400 animate-pulse' : 'bg-white/15'"></span>
                {{ integration.connected ? 'Connected' : 'Not connected' }}
              </span>
              <p v-if="integration.connected && integration.lastSynced" class="text-[10px] text-white/50 mt-1">
                Synced {{ timeAgo(integration.lastSynced) }}
              </p>
            </div>
            <button
              @click="integration.connected
                ? openDisconnect('connection', connectedMetaConn?.id ?? '', 'Meta Ads')
                : connectMeta()"
              class="text-xs font-medium px-3 py-1.5 rounded-lg border transition-all"
              :class="integration.connected
                ? 'border-ember-500/25 bg-ember-500/8 text-ember-400 hover:bg-ember-500/15'
                : 'border-glow-500/25 bg-glow-500/8 text-glow-400 hover:bg-glow-500/15'"
            >
              {{ integration.connected ? 'Disconnect' : 'Connect →' }}
            </button>
          </div>
        </div>

      </div>
    </div>

    <!-- ── Meta Ads configuration (shown only when Meta is connected) ── -->
    <div v-if="connectedMetaConn" class="glass rounded-2xl p-6">
      <div class="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h2 class="font-semibold">Meta Ads configuration</h2>
          <p class="text-xs text-white/65 mt-0.5">Select which ad account and product catalog to use for syncing</p>
        </div>
        <Transition name="fade-up">
          <span v-if="metaConfigSuccess" class="flex items-center gap-1.5 text-xs font-medium text-lime-400">
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            Saved
          </span>
        </Transition>
      </div>

      <!-- Loading skeleton -->
      <div v-if="metaConfigLoading" class="space-y-3">
        <div class="h-12 rounded-xl bg-white/5 animate-pulse"></div>
        <div class="h-12 rounded-xl bg-white/5 animate-pulse"></div>
      </div>

      <div v-else class="space-y-4">
        <!-- Ad Account -->
        <div>
          <label class="form-label">Ad Account</label>
          <select
            :value="metaConfig.adAccountId ?? ''"
            @change="onMetaAccountChange(($event.target as HTMLSelectElement).value)"
            class="form-input"
          >
            <option value="">— Select ad account —</option>
            <option v-for="acc in metaAdAccounts" :key="acc.id" :value="acc.id">
              {{ acc.name }} ({{ acc.currency }})
            </option>
          </select>
          <p v-if="metaAdAccounts.length === 0" class="text-xs text-white/45 mt-1.5">No ad accounts found for this token.</p>
        </div>

        <!-- Product Catalog -->
        <div>
          <label class="form-label">Product Catalog</label>
          <select
            v-model="metaConfig.catalogId"
            class="form-input"
            :disabled="!metaConfig.adAccountId || metaCatalogLoading"
          >
            <option value="">{{ metaCatalogLoading ? 'Loading catalogs…' : '— Select catalog —' }}</option>
            <option v-for="cat in metaCatalogs" :key="cat.id" :value="cat.id">
              {{ cat.name }}{{ cat.product_count != null ? ` (${cat.product_count.toLocaleString()} products)` : '' }}
            </option>
          </select>
          <p v-if="metaConfig.adAccountId && !metaCatalogLoading && metaCatalogs.length === 0" class="text-xs text-white/45 mt-1.5">
            No product catalogs found for this ad account.
          </p>
        </div>

        <p v-if="metaConfigError" class="text-xs text-ember-400">{{ metaConfigError }}</p>

        <button
          @click="saveMetaConfig"
          :disabled="metaConfigSaving || !metaConfig.adAccountId"
          class="w-full flex items-center justify-center gap-2 rounded-xl bg-white text-ink-950 py-2.5 text-sm font-semibold hover:bg-white/90 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <svg v-if="metaConfigSaving" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
          {{ metaConfigSaving ? 'Saving…' : 'Save configuration' }}
        </button>
      </div>
    </div>

    <!-- ── Automation rules ── -->
    <div class="glass rounded-2xl p-6">
      <div class="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h2 class="font-semibold">Automation rules</h2>
          <p class="text-xs text-white/65 mt-0.5">Control how MetaFlow acts on your daily scoring results</p>
        </div>
        <span class="rounded-full bg-glow-500/10 border border-glow-500/20 px-2.5 py-0.5 text-xs font-medium text-glow-400">Global</span>
      </div>

      <!-- Skeleton -->
      <div v-if="loadingRules" class="space-y-3">
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
              <p class="text-xs text-white/60 mt-0.5">{{ rule.desc }}</p>
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
      <div v-if="!loadingRules" class="mt-5 pt-5 border-t border-white/8 space-y-4">
        <p class="text-xs font-medium text-white/60 uppercase tracking-wider">Score thresholds</p>
        <div class="grid gap-4 sm:grid-cols-3">
          <div v-for="threshold in thresholds" :key="threshold.key">
            <div class="flex items-center justify-between mb-2">
              <label class="text-xs font-medium" :style="{ color: threshold.color }">{{ threshold.label }}</label>
              <span class="text-xs font-mono text-white/75">≥ {{ thresholdValues[threshold.key] }}</span>
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

      <!-- Scoring benchmarks -->
      <div v-if="!loadingRules" class="mt-5 pt-5 border-t border-white/8 space-y-4">
        <div>
          <p class="text-xs font-medium text-white/60 uppercase tracking-wider">Scoring benchmarks</p>
          <p class="text-xs text-white/45 mt-1">What targets count as 'full marks' when calculating product scores. Changes apply on the next sync.</p>
        </div>
        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <!-- ROAS target -->
          <div>
            <label class="text-xs font-medium text-white/75 block mb-1.5">ROAS Target</label>
            <div class="relative">
              <input
                type="number"
                step="0.5"
                min="0.5"
                placeholder="5"
                v-model.number="benchmarkValues.roas"
                class="w-full rounded-xl border border-white/10 bg-white/[0.06] pl-3 pr-8 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:border-glow-500/40 focus:ring-2 focus:ring-glow-500/15 transition-all"
              />
              <span class="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-white/40">×</span>
            </div>
            <p class="text-[10px] text-white/40 mt-1">35% of score</p>
          </div>
          <!-- CTR target -->
          <div>
            <label class="text-xs font-medium text-white/75 block mb-1.5">CTR Target</label>
            <div class="relative">
              <input
                type="number"
                step="0.1"
                min="0.01"
                placeholder="3"
                v-model.number="benchmarkValues.ctr"
                class="w-full rounded-xl border border-white/10 bg-white/[0.06] pl-3 pr-8 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:border-glow-500/40 focus:ring-2 focus:ring-glow-500/15 transition-all"
              />
              <span class="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-white/40">%</span>
            </div>
            <p class="text-[10px] text-white/40 mt-1">20% of score</p>
          </div>
          <!-- Margin target -->
          <div>
            <label class="text-xs font-medium text-white/75 block mb-1.5">Margin Target</label>
            <div class="relative">
              <input
                type="number"
                step="1"
                min="1"
                max="100"
                placeholder="50"
                v-model.number="benchmarkValues.margin"
                class="w-full rounded-xl border border-white/10 bg-white/[0.06] pl-3 pr-8 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:border-glow-500/40 focus:ring-2 focus:ring-glow-500/15 transition-all"
              />
              <span class="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-white/40">%</span>
            </div>
            <p class="text-[10px] text-white/40 mt-1">25% of score</p>
          </div>
          <!-- Inventory minimum -->
          <div>
            <label class="text-xs font-medium text-white/75 block mb-1.5">Min. Stock</label>
            <div class="relative">
              <input
                type="number"
                step="1"
                min="1"
                placeholder="10"
                v-model.number="benchmarkValues.inventory"
                class="w-full rounded-xl border border-white/10 bg-white/[0.06] pl-3 pr-12 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:border-glow-500/40 focus:ring-2 focus:ring-glow-500/15 transition-all"
              />
              <span class="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-white/40">units</span>
            </div>
            <p class="text-[10px] text-white/40 mt-1">20% of score</p>
          </div>
        </div>
      </div>

      <!-- Per-store benchmark overrides -->
      <div v-if="!loadingRules && stores.length > 0" class="mt-5 pt-5 border-t border-white/8 space-y-4">
        <div>
          <p class="text-xs font-medium text-white/60 uppercase tracking-wider">Store benchmark overrides</p>
          <p class="text-xs text-white/45 mt-1">Set different scoring targets per store. Leave blank to inherit account defaults.</p>
        </div>

        <!-- Store picker -->
        <div v-if="stores.length > 1">
          <label class="text-xs font-medium text-white/75 block mb-1.5">Store</label>
          <select
            v-model="storeBenchmarkStoreId"
            class="form-input"
            @change="loadStoreBenchmarks(storeBenchmarkStoreId)"
          >
            <option v-for="s in stores" :key="s.id" :value="s.id">{{ s.name }}</option>
          </select>
        </div>

        <!-- Loading skeleton -->
        <div v-if="storeBenchmarkLoading" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div v-for="i in 4" :key="i" class="h-16 rounded-xl bg-white/5 animate-pulse"></div>
        </div>

        <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <!-- Store ROAS target -->
          <div>
            <label class="text-xs font-medium text-white/75 block mb-1.5">ROAS Target</label>
            <div class="relative">
              <input
                type="number"
                step="0.5"
                min="0.5"
                :placeholder="String(storeBenchmarkDefaults.roas)"
                v-model.number="storeBenchmarkValues.roas"
                class="w-full rounded-xl border border-white/10 bg-white/[0.06] pl-3 pr-8 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:border-glow-500/40 focus:ring-2 focus:ring-glow-500/15 transition-all"
              />
              <span class="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-white/40">×</span>
            </div>
            <p class="text-[10px] text-white/40 mt-1">default: {{ storeBenchmarkDefaults.roas }}×</p>
          </div>
          <!-- Store CTR target -->
          <div>
            <label class="text-xs font-medium text-white/75 block mb-1.5">CTR Target</label>
            <div class="relative">
              <input
                type="number"
                step="0.1"
                min="0.01"
                :placeholder="String(storeBenchmarkDefaults.ctr)"
                v-model.number="storeBenchmarkValues.ctr"
                class="w-full rounded-xl border border-white/10 bg-white/[0.06] pl-3 pr-8 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:border-glow-500/40 focus:ring-2 focus:ring-glow-500/15 transition-all"
              />
              <span class="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-white/40">%</span>
            </div>
            <p class="text-[10px] text-white/40 mt-1">default: {{ storeBenchmarkDefaults.ctr }}%</p>
          </div>
          <!-- Store Margin target -->
          <div>
            <label class="text-xs font-medium text-white/75 block mb-1.5">Margin Target</label>
            <div class="relative">
              <input
                type="number"
                step="1"
                min="1"
                max="100"
                :placeholder="String(storeBenchmarkDefaults.margin)"
                v-model.number="storeBenchmarkValues.margin"
                class="w-full rounded-xl border border-white/10 bg-white/[0.06] pl-3 pr-8 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:border-glow-500/40 focus:ring-2 focus:ring-glow-500/15 transition-all"
              />
              <span class="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-white/40">%</span>
            </div>
            <p class="text-[10px] text-white/40 mt-1">default: {{ storeBenchmarkDefaults.margin }}%</p>
          </div>
          <!-- Store Min Stock -->
          <div>
            <label class="text-xs font-medium text-white/75 block mb-1.5">Min. Stock</label>
            <div class="relative">
              <input
                type="number"
                step="1"
                min="1"
                :placeholder="String(storeBenchmarkDefaults.inventory)"
                v-model.number="storeBenchmarkValues.inventory"
                class="w-full rounded-xl border border-white/10 bg-white/[0.06] pl-3 pr-12 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:border-glow-500/40 focus:ring-2 focus:ring-glow-500/15 transition-all"
              />
              <span class="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-white/40">units</span>
            </div>
            <p class="text-[10px] text-white/40 mt-1">default: {{ storeBenchmarkDefaults.inventory }} units</p>
          </div>
        </div>

        <!-- Store benchmark actions -->
        <div v-if="!storeBenchmarkLoading" class="flex gap-3">
          <button
            @click="saveStoreBenchmarks"
            :disabled="storeBenchmarkSaving"
            class="flex-1 flex items-center justify-center gap-2 rounded-xl bg-white/10 border border-white/15 text-white py-2.5 text-sm font-semibold hover:bg-white/15 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <svg v-if="storeBenchmarkSaving" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            {{ storeBenchmarkSaving ? 'Saving…' : 'Save store benchmarks' }}
          </button>
          <button
            @click="resetStoreBenchmarks"
            :disabled="storeBenchmarkSaving"
            class="px-4 flex items-center justify-center rounded-xl border border-white/12 bg-white/[0.03] text-white/60 text-sm hover:text-white/85 hover:border-white/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Reset to defaults
          </button>
        </div>

        <p v-if="storeBenchmarkSuccess" class="text-xs text-lime-400">Store benchmarks saved.</p>
        <p v-if="storeBenchmarkError" class="text-xs text-red-400">{{ storeBenchmarkError }}</p>
      </div>

      <button
        v-if="!loadingRules"
        @click="saveRules"
        :disabled="savingRules"
        class="mt-5 w-full flex items-center justify-center gap-2 rounded-xl bg-white text-ink-950 py-2.5 text-sm font-semibold hover:bg-white/90 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
      >
        <svg v-if="savingRules" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
        </svg>
        {{ savingRules ? 'Saving…' : 'Save rule changes' }}
      </button>
    </div>

    <!-- ── Two-column: Notifications + Billing ── -->
    <div class="grid lg:grid-cols-2 gap-6">

      <!-- Notifications -->
      <div class="glass rounded-2xl p-6">
        <h2 class="font-semibold mb-0.5">Notifications</h2>
        <p class="text-xs text-white/65 mb-5">Choose how MetaFlow keeps you informed</p>

        <div v-if="loadingRules" class="space-y-3">
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
              <p class="text-xs text-white/60 mt-0.5">{{ notif.desc }}</p>
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
        <div v-if="!loadingRules && notifications.emailReports" class="mt-4 pt-4 border-t border-white/8">
          <label class="form-label">Report email address</label>
          <input type="email" placeholder="you@yourstore.com" class="form-input" />
        </div>
      </div>

      <!-- Billing -->
      <div class="glass rounded-2xl p-6">
        <h2 class="font-semibold mb-0.5">Billing</h2>
        <p class="text-xs text-white/65 mb-5">Your current plan and usage</p>

        <div v-if="loadingRules" class="space-y-3">
          <div v-for="i in 4" :key="i" class="h-6 rounded-xl bg-white/5 animate-pulse" :style="{ opacity: 1 - i * 0.15 }"></div>
        </div>

        <div v-else>
          <!-- Plan highlight -->
          <div
            class="rounded-xl border p-4 mb-4"
            :class="currentPlanInfo.featured
              ? 'border-glow-500/25 bg-glow-500/[0.07]'
              : 'border-white/12 bg-white/[0.04]'"
          >
            <div class="flex items-center justify-between mb-1">
              <div class="flex items-center gap-2">
                <p class="text-sm font-semibold">{{ currentPlanInfo.label }}</p>
                <span
                  class="text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider"
                  :style="{ background: currentPlanInfo.badgeBg, color: currentPlanInfo.badgeColor }"
                >
                  {{ currentPlanName }}
                </span>
              </div>
              <span class="flex items-center gap-1.5 text-xs text-lime-400 font-medium">
                <span class="h-1.5 w-1.5 rounded-full bg-lime-400 animate-pulse"></span>
                Active
              </span>
            </div>
            <p class="text-2xl font-bold tracking-tight">
              {{ currentPlanInfo.price }}
              <span class="text-sm font-normal text-white/60">/mo</span>
            </p>
          </div>

          <!-- Store usage -->
          <div class="space-y-2.5 text-sm mb-5">
            <div class="flex items-center justify-between">
              <span class="text-white/65">Stores used</span>
              <span class="font-medium">{{ stores.length }} / {{ currentPlanInfo.storeLimit }}</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-white/65">Advanced Analytics</span>
              <span class="font-medium" :class="currentPlanInfo.analytics ? 'text-lime-400' : 'text-white/40'">
                {{ currentPlanInfo.analytics ? '✓ Included' : '—' }}
              </span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-white/65">Automation rules</span>
              <span class="font-medium">Unlimited</span>
            </div>
          </div>

          <!-- Store usage bar -->
          <div v-if="currentPlanInfo.storeMax > 0" class="mb-5">
            <div class="h-1.5 w-full rounded-full bg-white/8 overflow-hidden">
              <div
                class="h-full rounded-full transition-all duration-500"
                :class="storeUsagePercent >= 100 ? 'bg-ember-500' : 'bg-glow-500'"
                :style="{ width: Math.min(storeUsagePercent, 100) + '%' }"
              ></div>
            </div>
            <p v-if="storeUsagePercent >= 100" class="text-[10px] text-ember-400 mt-1">Store limit reached — upgrade to add more</p>
          </div>

          <!-- Actions -->
          <div class="flex flex-col gap-2">
            <button
              @click="openPlanModal()"
              class="flex items-center justify-center gap-1.5 rounded-xl border border-white/12 bg-white/[0.04] py-2.5 text-sm font-medium text-white/70 hover:text-white hover:border-white/22 hover:bg-white/[0.07] transition-all"
            >
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3 7.5 7.5 3m0 0L12 7.5M7.5 3v13.5m13.5 0L16.5 21m0 0L12 16.5m4.5 4.5V7.5"/>
              </svg>
              Change plan
            </button>
          </div>
        </div>
      </div>

    </div>

    <!-- ── Change Password ── -->
    <div class="glass rounded-2xl p-6">
      <h3 class="text-sm font-semibold text-white mb-4">Change Password</h3>
      <div class="space-y-3 max-w-sm">
        <div>
          <label class="form-label">Current password</label>
          <input v-model="pwCurrent" type="password" class="form-input" placeholder="••••••••" />
        </div>
        <div>
          <label class="form-label">New password</label>
          <input v-model="pwNew" type="password" class="form-input" placeholder="Min 8 characters" />
        </div>
        <div>
          <label class="form-label">Confirm new password</label>
          <input v-model="pwConfirm" type="password" class="form-input" placeholder="••••••••" />
        </div>
        <div class="flex items-center gap-3 pt-1">
          <button @click="changePassword" :disabled="pwSaving || !pwCurrent || !pwNew || pwNew !== pwConfirm" class="rounded-xl bg-glow-500/80 hover:bg-glow-500 disabled:opacity-40 text-white text-sm font-semibold px-5 py-2.5 transition-colors">
            {{ pwSaving ? 'Saving…' : 'Update password' }}
          </button>
          <p v-if="pwSuccess" class="text-sm text-lime-400">Password updated!</p>
          <p v-if="pwError" class="text-sm text-red-400">{{ pwError }}</p>
        </div>
      </div>
    </div>

    <!-- ── Team Members ── -->
    <div v-if="activeStoreId" class="glass rounded-2xl p-6 space-y-4">
      <div class="flex items-center justify-between">
        <h3 class="text-sm font-semibold text-white">Team Members</h3>
        <p class="text-xs text-white/50">Store: {{ activeStoreId }}</p>
      </div>

      <!-- Invite form -->
      <div class="flex gap-2">
        <input v-model="inviteEmail" type="email" placeholder="colleague@example.com" class="form-input flex-1" @keyup.enter="sendInvite" />
        <button @click="sendInvite" :disabled="inviteSending || !inviteEmail.trim()" class="flex-shrink-0 rounded-xl bg-glow-500/80 hover:bg-glow-500 disabled:opacity-40 text-white text-sm font-semibold px-4 py-2.5 transition-colors">
          {{ inviteSending ? '…' : 'Invite' }}
        </button>
      </div>
      <p v-if="inviteSuccess" class="text-xs text-lime-400">{{ inviteSuccess }}</p>
      <p v-if="inviteError" class="text-xs text-red-400">{{ inviteError }}</p>

      <!-- Members list -->
      <div v-if="teamMembers.length || pendingInvites.length" class="space-y-2">
        <p class="text-xs font-semibold text-white/50 uppercase tracking-wider">Active Members</p>
        <div v-for="m in teamMembers" :key="m.id" class="flex items-center justify-between rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3">
          <div>
            <p class="text-sm text-white/85">{{ m.user.name || m.user.email }}</p>
            <p class="text-xs text-white/50">{{ m.user.email }} · {{ m.role }}</p>
          </div>
          <button @click="removeMember(m.userId)" class="text-xs text-red-400/70 hover:text-red-400 transition-colors">Remove</button>
        </div>

        <p v-if="pendingInvites.length" class="text-xs font-semibold text-white/50 uppercase tracking-wider mt-3">Pending Invites</p>
        <div v-for="inv in pendingInvites" :key="inv.id" class="flex items-center justify-between rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3">
          <div>
            <p class="text-sm text-white/75">{{ inv.email }}</p>
            <p class="text-xs text-white/40">Expires {{ new Date(inv.expiresAt).toLocaleDateString() }}</p>
          </div>
          <button @click="revokeInvite(inv.id)" class="text-xs text-white/40 hover:text-white/70 transition-colors">Revoke</button>
        </div>
      </div>
      <div v-else-if="!teamLoading" class="text-xs text-white/40">No team members yet. Invite someone above.</div>
    </div>

    <!-- ── Danger zone ── -->
    <div class="rounded-2xl p-6 border border-ember-500/30 bg-ember-500/[0.04]">
      <div class="flex items-center gap-2.5 mb-1">
        <svg class="w-4 h-4 text-ember-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/>
        </svg>
        <h2 class="font-semibold text-ember-400">Danger zone</h2>
      </div>
      <p class="text-xs text-white/55 mb-5">Irreversible actions — proceed with caution</p>
      <div class="grid sm:grid-cols-2 gap-3">
        <div class="rounded-xl border border-ember-500/15 bg-ember-500/[0.03] p-4 flex flex-wrap items-center gap-3">
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium">Reset all rules</p>
            <p class="text-xs text-white/55 mt-0.5">Restore automation rules to defaults</p>
          </div>
          <button
            @click="openDangerConfirm('reset')"
            :disabled="savingRules"
            class="text-xs text-ember-400 hover:text-ember-300 border border-ember-500/25 hover:border-ember-500/45 bg-ember-500/8 rounded-lg px-3 py-1.5 transition-all flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
          >Reset</button>
        </div>
        <div class="rounded-xl border border-ember-500/15 bg-ember-500/[0.03] p-4 flex flex-wrap items-center gap-3">
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium">Disconnect all integrations</p>
            <p class="text-xs text-white/55 mt-0.5">Remove all store and ad connections</p>
          </div>
          <button
            @click="connectedStore ? openDangerConfirm('disconnect') : undefined"
            :disabled="!connectedStore || loadingConnections"
            class="text-xs text-ember-400 hover:text-ember-300 border border-ember-500/25 hover:border-ember-500/45 bg-ember-500/8 rounded-lg px-3 py-1.5 transition-all flex-shrink-0 disabled:opacity-30 disabled:cursor-not-allowed"
          >Disconnect</button>
        </div>
      </div>
    </div>

  </div>

  <!-- ── Plan picker modal ── -->
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="planModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" @click="planStep !== 'processing' && (planModal = false)"></div>
        <div class="relative w-full max-w-md rounded-2xl border border-white/15 bg-ink-900 shadow-2xl overflow-hidden">

          <!-- ── Step: pick ── -->
          <template v-if="planStep === 'pick'">
            <div class="h-1 w-full bg-gradient-to-r from-glow-500 to-glow-400"></div>
            <div class="p-6">
              <div class="flex items-start justify-between mb-5">
                <div>
                  <h3 class="text-base font-semibold">Change plan</h3>
                  <p class="text-sm text-white/55 mt-0.5">
                    Currently on <span class="text-white/80 font-medium">{{ currentPlanInfo.label }}</span> · {{ currentPlanInfo.price }}/mo
                  </p>
                </div>
                <button @click="planModal = false" class="text-white/35 hover:text-white/65 transition-colors p-1 -mr-1 -mt-1">
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                </button>
              </div>

              <!-- All plan cards -->
              <div class="space-y-2 mb-4">
                <div
                  v-for="plan in ALL_PLANS"
                  :key="plan.name"
                  class="flex items-center justify-between rounded-xl border p-3.5 transition-all"
                  :class="plan.name === currentPlanName ? 'border-glow-500/30 bg-glow-500/[0.06]' : 'border-white/10 bg-white/[0.02]'"
                >
                  <div>
                    <div class="flex items-center gap-2">
                      <p class="text-sm font-semibold">{{ plan.label }}</p>
                      <span v-if="plan.name === currentPlanName" class="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-glow-500/15 text-glow-400 uppercase tracking-wider">Current</span>
                    </div>
                    <p class="text-xs text-white/45 mt-0.5">{{ plan.price }}/mo · {{ plan.storeLimit }} {{ plan.storeLimit === '1' ? 'store' : 'stores' }}</p>
                  </div>
                  <span v-if="plan.name === currentPlanName" class="text-xs text-white/30 font-medium px-3 py-1.5 rounded-lg border border-white/8">
                    Active
                  </span>
                  <button
                    v-else-if="PLAN_ORDER.indexOf(plan.name) < PLAN_ORDER.indexOf(currentPlanName as any)"
                    @click="selectPlan(plan.name)"
                    class="text-xs font-medium px-3 py-1.5 rounded-lg border border-ember-500/25 bg-ember-500/8 text-ember-400 hover:bg-ember-500/15 hover:border-ember-500/40 transition-all whitespace-nowrap"
                  >
                    Downgrade ↓
                  </button>
                  <button
                    v-else
                    @click="selectPlan(plan.name)"
                    class="text-xs font-medium px-3 py-1.5 rounded-lg border border-glow-500/30 bg-glow-500/8 text-glow-400 hover:bg-glow-500/15 hover:border-glow-500/45 transition-all whitespace-nowrap"
                  >
                    Upgrade ↑
                  </button>
                </div>
              </div>

              <!-- Cancel -->
              <div class="flex items-center gap-3 mb-3">
                <div class="flex-1 h-px bg-white/8"></div>
                <span class="text-[10px] text-white/25 uppercase tracking-wider">or</span>
                <div class="flex-1 h-px bg-white/8"></div>
              </div>
              <button
                @click="selectPlan('CANCEL')"
                class="w-full text-xs font-medium text-white/35 hover:text-ember-400 transition-colors py-1.5"
              >
                Cancel subscription →
              </button>
            </div>
          </template>

          <!-- ── Step: confirm ── -->
          <template v-else-if="planStep === 'confirm'">
            <div
              class="h-1 w-full bg-gradient-to-r"
              :class="selectedPlan === 'CANCEL' || PLAN_ORDER.indexOf(selectedPlan as any) < PLAN_ORDER.indexOf(currentPlanName as any)
                ? 'from-ember-500 to-ember-400'
                : 'from-glow-500 to-glow-400'"
            ></div>
            <div class="p-6">

              <!-- Cancel confirmation -->
              <template v-if="selectedPlan === 'CANCEL'">
                <h3 class="text-base font-semibold mb-1">Cancel your subscription?</h3>
                <p class="text-sm text-white/60 leading-relaxed mb-5">
                  Your <strong class="text-white/80">{{ currentPlanInfo.label }}</strong> plan will be cancelled. Access continues until the end of your current billing period. Your data stays intact.
                </p>
              </template>

              <!-- Downgrade confirmation -->
              <template v-else-if="PLAN_ORDER.indexOf(selectedPlan as any) < PLAN_ORDER.indexOf(currentPlanName as any)">
                <h3 class="text-base font-semibold mb-1">Downgrade to {{ PLAN_INFO[selectedPlan]?.label }}?</h3>
                <p class="text-sm text-white/60 leading-relaxed mb-4">
                  You'll move from <strong class="text-white/80">{{ currentPlanInfo.label }} ({{ currentPlanInfo.price }}/mo)</strong> to <strong class="text-white/80">{{ PLAN_INFO[selectedPlan]?.label }} ({{ PLAN_INFO[selectedPlan]?.price }}/mo)</strong>. Takes effect immediately.
                </p>
                <!-- Store limit warning -->
                <div
                  v-if="(PLAN_INFO[selectedPlan]?.storeMax ?? 0) > 0 && (PLAN_INFO[selectedPlan]?.storeMax ?? 0) < stores.length"
                  class="flex items-start gap-2.5 rounded-xl border border-ember-500/25 bg-ember-500/[0.07] p-3.5 mb-4 text-xs text-ember-300"
                >
                  <svg class="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/>
                  </svg>
                  <span>You have {{ stores.length }} stores connected but the {{ PLAN_INFO[selectedPlan]?.label }} plan supports {{ PLAN_INFO[selectedPlan]?.storeMax }}. Some stores may become inaccessible.</span>
                </div>
              </template>

              <!-- Upgrade — Stripe Checkout -->
              <template v-else>
                <h3 class="text-base font-semibold mb-1">Upgrade to {{ PLAN_INFO[selectedPlan]?.label }}</h3>
                <p class="text-sm text-white/60 leading-relaxed mb-4">
                  You'll move to <strong class="text-white/80">{{ PLAN_INFO[selectedPlan]?.label }} ({{ PLAN_INFO[selectedPlan]?.price }}/mo)</strong>. You'll be taken to a secure checkout page to complete your upgrade.
                </p>
                <div class="flex gap-3">
                  <button
                    @click="planStep = 'pick'"
                    class="flex-1 rounded-xl border border-white/15 bg-white/5 py-2.5 text-sm font-medium text-white/80 hover:bg-white/10 transition-all"
                  >
                    Go back
                  </button>
                  <button
                    @click="confirmPlanChange()"
                    class="flex-1 flex items-center justify-center gap-2 rounded-xl bg-glow-500/80 hover:bg-glow-500 py-2.5 text-sm font-semibold text-white transition-all"
                  >
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"/>
                    </svg>
                    Proceed to checkout
                  </button>
                </div>
              </template>

              <!-- Action buttons (downgrade + cancel only) -->
              <div
                v-if="selectedPlan === 'CANCEL' || PLAN_ORDER.indexOf(selectedPlan as any) < PLAN_ORDER.indexOf(currentPlanName as any)"
                class="flex gap-3 mt-2"
              >
                <button
                  @click="planStep = 'pick'"
                  class="flex-1 rounded-xl border border-white/15 bg-white/5 py-2.5 text-sm font-medium text-white/80 hover:bg-white/10 transition-all"
                >
                  Go back
                </button>
                <button
                  @click="confirmPlanChange()"
                  class="flex-1 rounded-xl py-2.5 text-sm font-semibold transition-all"
                  :class="selectedPlan === 'CANCEL'
                    ? 'bg-ember-500 hover:bg-ember-400 text-white'
                    : 'bg-ember-500/15 hover:bg-ember-500/25 border border-ember-500/30 text-ember-400'"
                >
                  {{ selectedPlan === 'CANCEL' ? 'Yes, cancel plan' : 'Confirm downgrade' }}
                </button>
              </div>
            </div>
          </template>

          <!-- ── Step: processing ── -->
          <template v-else-if="planStep === 'processing'">
            <div class="p-10 flex flex-col items-center gap-4">
              <svg class="w-8 h-8 text-glow-400 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              <p class="text-sm text-white/55">Updating your plan…</p>
            </div>
          </template>

          <!-- ── Step: success ── -->
          <template v-else-if="planStep === 'success'">
            <div class="h-1 w-full bg-gradient-to-r from-lime-500 to-lime-400"></div>
            <div class="p-6 text-center">
              <div class="w-12 h-12 rounded-full bg-lime-500/15 border border-lime-500/25 flex items-center justify-center mx-auto mb-4">
                <svg class="w-6 h-6 text-lime-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
              </div>
              <template v-if="selectedPlan === 'CANCEL'">
                <h3 class="text-base font-semibold mb-1">Cancellation requested</h3>
                <p class="text-sm text-white/55 mb-5">We've received your request. Your access continues until the end of your billing period and we'll be in touch soon.</p>
              </template>
              <template v-else>
                <h3 class="text-base font-semibold mb-1">Plan updated</h3>
                <p class="text-sm text-white/55 mb-5">You're now on the <strong class="text-white/80">{{ currentPlanInfo.label }}</strong> plan.</p>
              </template>
              <button
                @click="planModal = false"
                class="w-full rounded-xl bg-white/8 hover:bg-white/12 border border-white/12 py-2.5 text-sm font-medium transition-all"
              >
                Done
              </button>
            </div>
          </template>

          <!-- ── Step: error ── -->
          <template v-else-if="planStep === 'error'">
            <div class="h-1 w-full bg-gradient-to-r from-ember-500 to-ember-400"></div>
            <div class="p-6 text-center">
              <div class="w-12 h-12 rounded-full bg-ember-500/15 border border-ember-500/25 flex items-center justify-center mx-auto mb-4">
                <svg class="w-6 h-6 text-ember-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"/>
                </svg>
              </div>
              <h3 class="text-base font-semibold mb-1">Something went wrong</h3>
              <p class="text-sm text-white/55 mb-5">{{ planError }}</p>
              <div class="flex gap-3">
                <button @click="planStep = 'confirm'" class="flex-1 rounded-xl border border-white/15 bg-white/5 py-2.5 text-sm font-medium text-white/80 hover:bg-white/10 transition-all">Try again</button>
                <a href="mailto:hello@metaflow.io" class="flex-1 flex items-center justify-center rounded-xl border border-white/15 bg-white/5 py-2.5 text-sm font-medium text-white/80 hover:bg-white/10 transition-all">Contact us</a>
              </div>
            </div>
          </template>

        </div>
      </div>
    </Transition>
  </Teleport>

  <!-- ── Danger zone confirmation modal ── -->
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="dangerModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" @click="dangerModal = false"></div>
        <div class="relative w-full max-w-md rounded-2xl border border-white/15 bg-ink-900 shadow-2xl overflow-hidden">
          <div class="h-1 w-full bg-gradient-to-r from-ember-500 to-ember-400"></div>
          <div class="p-6">
            <div class="flex items-start gap-4 mb-5">
              <div class="h-10 w-10 flex-shrink-0 rounded-xl bg-ember-500/10 border border-ember-500/20 flex items-center justify-center">
                <svg class="w-5 h-5 text-ember-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/>
                </svg>
              </div>
              <div class="min-w-0">
                <h3 class="text-base font-semibold">{{ dangerAction === 'reset' ? 'Reset all automation rules?' : 'Disconnect all integrations?' }}</h3>
                <p class="text-sm text-white/75 mt-1 leading-relaxed">
                  <template v-if="dangerAction === 'reset'">
                    All automation rules and score thresholds will be restored to their default values. This cannot be undone.
                  </template>
                  <template v-else>
                    This will permanently remove your store and all associated products, metrics, and data. This action <strong class="text-white/85">cannot be undone</strong>.
                  </template>
                </p>
              </div>
            </div>
            <div class="flex gap-3">
              <button
                @click="dangerModal = false"
                class="flex-1 rounded-xl border border-white/15 bg-white/5 py-2.5 text-sm font-medium text-white/80 hover:bg-white/10 transition-all"
              >
                Cancel
              </button>
              <button
                @click="confirmDangerAction"
                :disabled="savingRules || disconnecting"
                class="flex-1 flex items-center justify-center gap-2 rounded-xl bg-ember-500 py-2.5 text-sm font-semibold text-white transition-all hover:bg-ember-400 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg v-if="savingRules || disconnecting" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                {{ dangerAction === 'reset' ? 'Reset rules' : 'Disconnect all' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>

  <!-- ── Disconnect confirmation modal ── -->
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="disconnectModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <!-- Backdrop -->
        <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" @click="!disconnecting && (disconnectModal = false)"></div>
        <!-- Panel -->
        <div class="relative w-full max-w-md rounded-2xl border border-white/15 bg-ink-900 shadow-2xl overflow-hidden">
          <!-- Red accent top bar -->
          <div class="h-1 w-full bg-gradient-to-r from-ember-500 to-ember-400"></div>
          <div class="p-6">
            <div class="flex items-start gap-4 mb-5">
              <div class="h-10 w-10 flex-shrink-0 rounded-xl bg-ember-500/10 border border-ember-500/20 flex items-center justify-center">
                <svg class="w-5 h-5 text-ember-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/>
                </svg>
              </div>
              <div class="min-w-0">
                <h3 class="text-base font-semibold">Disconnect {{ disconnectTarget?.label }}?</h3>
                <p class="text-sm text-white/75 mt-1 leading-relaxed">
                  This will permanently remove your
                  <strong class="text-white/70">{{ disconnectTarget?.label }}</strong>
                  integration{{ disconnectTarget?.type === 'store' ? ' and all associated products, metrics, and data' : '' }}.
                  This action cannot be undone.
                </p>
              </div>
            </div>

            <p class="text-xs text-white/65 mb-2">
              Type <span class="font-mono font-semibold text-ember-400">Disconnect</span> to confirm:
            </p>
            <input
              v-model="disconnectConfirmText"
              type="text"
              placeholder="Disconnect"
              class="form-input mb-4"
              @keyup.enter="disconnectConfirmText === 'Disconnect' && doDisconnect()"
            />

            <div class="flex gap-3">
              <button
                @click="disconnectModal = false"
                :disabled="disconnecting"
                class="flex-1 rounded-xl border border-white/15 bg-white/5 py-2.5 text-sm font-medium text-white/80 hover:bg-white/10 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                @click="doDisconnect"
                :disabled="disconnectConfirmText !== 'Disconnect' || disconnecting"
                class="flex-1 flex items-center justify-center gap-2 rounded-xl bg-ember-500 py-2.5 text-sm font-semibold text-white transition-all hover:bg-ember-400 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <svg v-if="disconnecting" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                {{ disconnecting ? 'Disconnecting…' : 'Disconnect' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
const { public: { apiBase } } = useRuntimeConfig();
const route = useRoute();

// ── Toast state ───────────────────────────────────────────────────────────────
const metaConnected = ref(route.query.meta_connected === '1');
const metaError = ref(typeof route.query.meta_error === 'string' ? decodeURIComponent(route.query.meta_error as string) : '');
const saveSuccess = ref(false);
const saveError = ref('');

// Auto-dismiss toasts
function showSaveSuccess() {
  saveSuccess.value = true;
  saveError.value = '';
  setTimeout(() => { saveSuccess.value = false; }, 3500);
}
function showSaveError(msg: string) {
  saveError.value = msg;
  saveSuccess.value = false;
  setTimeout(() => { saveError.value = ''; }, 6000);
}

if (process.client) {
  if (metaConnected.value) setTimeout(() => { metaConnected.value = false; }, 5000);
  if (metaError.value) setTimeout(() => { metaError.value = ''; }, 8000);
}

// ── Shared store state with layout sidebar ────────────────────────────────────
// Uses useState so the sidebar Onboarding link reacts instantly when we disconnect
const hasStore = useState<boolean>('mf_has_store', () => false);

// ── Connection types ──────────────────────────────────────────────────────────
interface ConnRecord {
  id: string;
  provider: string;
  scopes: string;
  expiresAt: string | null;
  updatedAt?: string;
}

function timeAgo(iso?: string | null): string {
  if (!iso) return 'Never';
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return 'Just now';
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  return `${Math.floor(ms / 86_400_000)}d ago`;
}
interface StoreRecord {
  id: string;
  name: string;
  platform: string;
  connections: ConnRecord[];
}

// ── Connection state ──────────────────────────────────────────────────────────
const stores = ref<StoreRecord[]>([]);
const loadingConnections = ref(true);

// Use the same active store ID that the layout manages via mf_active_store_id state + URL ?store= param
const activeStoreId = useState<string | null>('mf_active_store_id', () => null);

// The currently selected store (matches the sidebar store switcher)
const connectedStore = computed(() => {
  const id = (route.query.store as string | undefined) || activeStoreId.value;
  return stores.value.find(s => s.id === id) ?? stores.value[0] ?? null;
});

// Which store platform is active: "SHOPIFY" | "WOOCOMMERCE" | "API" | null
const connectedStorePlatform = computed(() => connectedStore.value?.platform ?? null);

// Meta connection scoped to the currently active store only
const connectedMetaConn = computed<(ConnRecord & { storeId: string }) | null>(() => {
  const store = connectedStore.value;
  if (!store) return null;
  const mc = store.connections.find((c: ConnRecord) => c.provider === 'META');
  return mc ? { ...mc, storeId: store.id } : null;
});

async function loadConnections() {
  loadingConnections.value = true;
  try {
    const res = await $fetch<{ ok: boolean; stores: StoreRecord[] }>(
      `${apiBase}/v1/connections`,
      { credentials: 'include' }
    );
    if (res.ok) stores.value = res.stores;
  } catch { /* network error — leave state empty */ }
  loadingConnections.value = false;
}

onMounted(() => {
  loadConnections().then(() => {
    // Seed per-store benchmark picker after connections load
    const id = activeStoreId.value ?? stores.value[0]?.id ?? '';
    if (id) {
      storeBenchmarkStoreId.value = id;
      loadStoreBenchmarks(id);
    }
  });
  loadSettings();
});

// ── Disconnect modal ──────────────────────────────────────────────────────────
const disconnectModal = ref(false);
const disconnectConfirmText = ref('');
const disconnecting = ref(false);
const disconnectTarget = ref<{ type: 'store' | 'connection'; id: string; label: string } | null>(null);

function openDisconnect(type: 'store' | 'connection', id: string, label: string) {
  if (!id) return;
  disconnectTarget.value = { type, id, label };
  disconnectConfirmText.value = '';
  disconnectModal.value = true;
}

async function doDisconnect() {
  if (!disconnectTarget.value || disconnectConfirmText.value !== 'Disconnect') return;
  disconnecting.value = true;
  try {
    const { type, id } = disconnectTarget.value;
    if (type === 'store') {
      // Delete the entire store — cascades to all its connections + products + metrics
      await $fetch(`${apiBase}/v1/stores/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      stores.value = [];
      hasStore.value = false;   // Onboarding reappears in the sidebar immediately
    } else {
      // Delete only the specific provider connection (e.g. Meta Ads)
      await $fetch(`${apiBase}/v1/connections/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      await loadConnections(); // Re-fetch so Meta card updates
    }
    disconnectModal.value = false;
  } catch {
    disconnectModal.value = false;
  } finally {
    disconnecting.value = false;
  }
}

// ── Connect Meta Ads (requires a real storeId) ────────────────────────────────
const connectMeta = () => {
  const storeId = connectedStore.value?.id;
  if (!storeId) {
    // No store connected yet — go through onboarding first
    navigateTo('/app/onboarding');
    return;
  }
  window.location.href = `${apiBase}/v1/connections/meta/auth?storeId=${storeId}`;
};

// ── Meta Ads configuration ────────────────────────────────────────────────────
interface MetaAdAccount { id: string; name: string; currency: string; }
interface MetaCatalog { id: string; name: string; product_count?: number; }

// Use empty string instead of null so v-model on <select> options (value="") matches correctly
const metaConfig = reactive<{ adAccountId: string; catalogId: string }>({ adAccountId: '', catalogId: '' });
const metaAdAccounts = ref<MetaAdAccount[]>([]);
const metaCatalogs = ref<MetaCatalog[]>([]);
const metaConfigLoading = ref(false);
const metaCatalogLoading = ref(false);
const metaConfigSaving = ref(false);
const metaConfigError = ref('');
const metaConfigSuccess = ref(false);

// Load config + ad accounts when Meta connection changes
watch(connectedMetaConn, async (conn) => {
  if (!conn) {
    metaAdAccounts.value = [];
    metaCatalogs.value = [];
    metaConfig.adAccountId = '';
    metaConfig.catalogId = '';
    return;
  }
  await loadMetaConfig(conn.storeId);
}, { immediate: true });

async function loadMetaConfig(storeId: string) {
  metaConfigLoading.value = true;
  metaConfigError.value = '';
  try {
    const res = await $fetch<{
      ok: boolean;
      current: { adAccountId: string | null; catalogId: string | null };
      adAccounts: MetaAdAccount[];
      catalogs: MetaCatalog[];
    }>(`${apiBase}/v1/connections/meta/config?storeId=${storeId}`, { credentials: 'include' });
    if (res.ok) {
      metaAdAccounts.value = res.adAccounts;
      metaCatalogs.value = res.catalogs;
      metaConfig.adAccountId = res.current.adAccountId ?? '';
      metaConfig.catalogId = res.current.catalogId ?? '';
    }
  } catch (err: any) {
    metaConfigError.value = err?.data?.message ?? 'Failed to load Meta configuration';
  } finally {
    metaConfigLoading.value = false;
  }
}

async function onMetaAccountChange(accountId: string) {
  metaConfig.adAccountId = accountId;
  metaConfig.catalogId = '';
  metaCatalogs.value = [];
  if (!accountId) return;
  const storeId = connectedMetaConn.value?.storeId;
  if (!storeId) return;
  metaCatalogLoading.value = true;
  try {
    const res = await $fetch<{ ok: boolean; catalogs: MetaCatalog[] }>(
      `${apiBase}/v1/connections/meta/catalogs?storeId=${storeId}&adAccountId=${accountId}`,
      { credentials: 'include' }
    );
    if (res.ok) metaCatalogs.value = res.catalogs;
  } catch { /* silent */ } finally {
    metaCatalogLoading.value = false;
  }
}

async function saveMetaConfig() {
  const storeId = connectedMetaConn.value?.storeId;
  if (!storeId) return;
  metaConfigSaving.value = true;
  metaConfigError.value = '';
  try {
    await $fetch(`${apiBase}/v1/connections/meta/config`, {
      method: 'PATCH',
      credentials: 'include',
      body: { storeId, adAccountId: metaConfig.adAccountId || null, catalogId: metaConfig.catalogId || null },
    });
    metaConfigSuccess.value = true;
    setTimeout(() => { metaConfigSuccess.value = false; }, 3500);
  } catch (err: any) {
    metaConfigError.value = err?.data?.message ?? 'Failed to save configuration';
  } finally {
    metaConfigSaving.value = false;
  }
}

// ── Integrations (computed from live connection state) ────────────────────────
const STORE_DEFS = [
  {
    id: 'SHOPIFY',
    label: 'Shopify',
    detail: 'App Store install · catalog + orders sync',
    iconBg: 'rgba(150,191,72,0.12)',
    iconColor: '#96BF48',
    icon: '<path stroke-linecap="round" stroke-linejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z"/>',
  },
  {
    id: 'WOOCOMMERCE',
    label: 'WooCommerce',
    detail: 'REST API · consumer key + webhook',
    iconBg: 'rgba(127,84,179,0.12)',
    iconColor: '#9B72CF',
    icon: '<path stroke-linecap="round" stroke-linejoin="round" d="M6.75 7.5l3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0021 18V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v12a2.25 2.25 0 002.25 2.25z"/>',
  },
  {
    id: 'API',
    label: 'Custom API',
    detail: 'REST endpoint · Bearer token auth',
    iconBg: 'rgba(34,211,238,0.1)',
    iconColor: '#22d3ee',
    icon: '<path stroke-linecap="round" stroke-linejoin="round" d="M14.25 9.75L16.5 12l-2.25 2.25m-4.5 0L7.5 12l2.25-2.25M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z"/>',
  },
];

// Computed store integrations: marks which is connected and which are disabled
const storeIntegrations = computed(() =>
  STORE_DEFS.map(def => ({
    ...def,
    connected: connectedStorePlatform.value === def.id,
    // Disabled when a *different* store platform is already connected
    disabled: !!connectedStorePlatform.value && connectedStorePlatform.value !== def.id,
  }))
);

const adsIntegrations = computed(() => [
  {
    id: 'meta',
    label: 'Meta Ads',
    detail: 'Catalog performance · product sets · budget automation',
    connected: !!connectedMetaConn.value,
    lastSynced: connectedMetaConn.value?.updatedAt ?? null,
    iconBg: 'rgba(24,119,242,0.12)',
    iconColor: '#1877F2',
    iconContent: '<path fill="#1877F2" d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>',
  },
]);

// ── Automation rules ──────────────────────────────────────────────────────────
const loadingRules = ref(true);
const savingRules  = ref(false);

const rules = reactive({ scale: true, test: true, kill: true, inventory: true });
const thresholdValues = reactive({ scale: 80, test: 50, kill: 25 });
const benchmarkValues = reactive({ roas: 5, ctr: 3, margin: 50, inventory: 10 });

const automationRules = [
  { key: 'scale',     label: 'Scale winners (score ≥ threshold)',     desc: 'Move to SCALE set, increase budget by 15%',    bg: 'rgba(132,204,22,0.12)', color: '#84cc16' },
  { key: 'test',      label: 'Test mid-performers (50–79)',            desc: 'Keep in TEST set, monitor 7-day trend',        bg: 'rgba(34,211,238,0.1)',  color: '#22d3ee' },
  { key: 'kill',      label: 'Kill underperformers (below threshold)', desc: 'Move to KILL set, reduce or pause spend',      bg: 'rgba(249,115,22,0.1)', color: '#f97316' },
  { key: 'inventory', label: 'Inventory risk throttle',                desc: 'Limit spend when stock drops below 15 units',  bg: 'rgba(139,92,246,0.1)', color: '#a78bfa' },
];

const thresholds = [
  { key: 'scale', label: 'Scale threshold', color: '#84cc16' },
  { key: 'test',  label: 'Test threshold',  color: '#22d3ee' },
  { key: 'kill',  label: 'Kill threshold',  color: '#f97316' },
];

// ── Notifications ─────────────────────────────────────────────────────────────
const notifications = reactive({ emailReports: true, whatsappAlerts: false, weeklyDigest: false });

const notificationItems = [
  { key: 'emailReports',   label: 'Email reports',     desc: 'Daily AI briefing + scoring summary sent to your inbox' },
  { key: 'whatsappAlerts', label: 'WhatsApp alerts',   desc: 'Critical inventory and budget alerts via WhatsApp' },
  { key: 'weeklyDigest',   label: 'Weekly KPI digest', desc: 'Friday summary of catalog performance and wins' },
];

// Apply a settings response object to local reactive state
function applySettings(s: {
  rules:         { scale: boolean; test: boolean; kill: boolean; inventory: boolean };
  thresholds:    { scale: number; test: number; kill: number };
  benchmarks:    { roas: number; ctr: number; margin: number; inventory: number };
  notifications: { emailReports: boolean; whatsappAlerts: boolean; weeklyDigest: boolean };
}) {
  rules.scale         = s.rules.scale;
  rules.test          = s.rules.test;
  rules.kill          = s.rules.kill;
  rules.inventory     = s.rules.inventory;
  thresholdValues.scale = s.thresholds.scale;
  thresholdValues.test  = s.thresholds.test;
  thresholdValues.kill  = s.thresholds.kill;
  benchmarkValues.roas      = s.benchmarks.roas;
  benchmarkValues.ctr       = +(s.benchmarks.ctr * 100).toFixed(2);
  benchmarkValues.margin    = +(s.benchmarks.margin * 100).toFixed(0);
  benchmarkValues.inventory = s.benchmarks.inventory;
  notifications.emailReports   = s.notifications.emailReports;
  notifications.whatsappAlerts = s.notifications.whatsappAlerts;
  notifications.weeklyDigest   = s.notifications.weeklyDigest;
}

async function loadSettings() {
  loadingRules.value = true;
  try {
    const res = await $fetch<{ ok: boolean; settings: Parameters<typeof applySettings>[0] }>(
      `${apiBase}/v1/settings`,
      { credentials: 'include' }
    );
    if (res.ok) applySettings(res.settings);
  } catch { /* keep defaults on network error */ }
  loadingRules.value = false;
}

async function saveRules() {
  savingRules.value = true;
  try {
    const res = await $fetch<{ ok: boolean; settings: Parameters<typeof applySettings>[0] }>(
      `${apiBase}/v1/settings`,
      {
        method: 'PATCH',
        credentials: 'include',
        body: {
          rules:         { scale: rules.scale, test: rules.test, kill: rules.kill, inventory: rules.inventory },
          thresholds:    { scale: thresholdValues.scale, test: thresholdValues.test, kill: thresholdValues.kill },
          benchmarks:    { roas: benchmarkValues.roas, ctr: benchmarkValues.ctr, margin: benchmarkValues.margin, inventory: benchmarkValues.inventory },
          notifications: { emailReports: notifications.emailReports, whatsappAlerts: notifications.whatsappAlerts, weeklyDigest: notifications.weeklyDigest },
        },
      }
    );
    if (res.ok) { applySettings(res.settings); showSaveSuccess(); }
    else showSaveError('Unexpected error');
  } catch (err: unknown) {
    const msg = (err as { data?: { message?: string } })?.data?.message ?? 'Network error';
    showSaveError(msg);
  } finally {
    savingRules.value = false;
  }
}

async function resetRules() {
  savingRules.value = true;
  try {
    await $fetch(`${apiBase}/v1/settings`, { method: 'DELETE', credentials: 'include' });
    await loadSettings();
    showSaveSuccess();
  } catch {
    showSaveError('Reset failed');
  } finally {
    savingRules.value = false;
  }
}

// ── Billing / Plan ────────────────────────────────────────────────────────────
const planCookie = useCookie<string>('mf_plan', { path: '/', sameSite: 'lax' });
const currentPlanName = computed(() => planCookie.value?.toUpperCase() ?? 'STARTER');

interface PlanInfo {
  label: string;
  price: string;
  storeLimit: string;
  storeMax: number;
  analytics: boolean;
  featured: boolean;
  badgeBg: string;
  badgeColor: string;
}
const PLAN_INFO: Record<string, PlanInfo> = {
  STARTER:       { label: 'Starter',  price: '$50',   storeLimit: '1',         storeMax: 1, analytics: false, featured: false, badgeBg: 'rgba(34,211,238,0.12)',  badgeColor: '#22d3ee' },
  GROWTH:        { label: 'Growth',   price: '$100',  storeLimit: '5',         storeMax: 5, analytics: false, featured: true,  badgeBg: 'rgba(132,204,22,0.15)',  badgeColor: '#84cc16' },
  SCALE:         { label: 'Scale',    price: '$250',  storeLimit: 'Unlimited', storeMax: 0, analytics: true,  featured: false, badgeBg: 'rgba(249,115,22,0.12)',  badgeColor: '#f97316' },
  GRANDFATHERED: { label: 'Legacy',   price: 'Free',  storeLimit: 'Unlimited', storeMax: 0, analytics: false, featured: false, badgeBg: 'rgba(255,255,255,0.08)', badgeColor: 'rgba(255,255,255,0.5)' },
};
const currentPlanInfo = computed<PlanInfo>(() => PLAN_INFO[currentPlanName.value] ?? PLAN_INFO.STARTER);
const storeUsagePercent = computed(() => {
  const max = currentPlanInfo.value.storeMax;
  if (max === 0) return 0;
  return (stores.value.length / max) * 100;
});

// ── Plan change modal ──────────────────────────────────────────────────────────
const PLAN_ORDER = ['STARTER', 'GROWTH', 'SCALE'] as const;
const ALL_PLANS  = PLAN_ORDER.map(p => ({ name: p, ...PLAN_INFO[p] }));

const planModal    = ref(false);
type PlanStep = 'pick' | 'confirm' | 'processing' | 'success' | 'error';
const planStep     = ref<PlanStep>('pick');
const selectedPlan = ref<string>('');
const planError    = ref<string>('');

const upgradeMailto = computed(() => {
  const label = PLAN_INFO[selectedPlan.value]?.label ?? selectedPlan.value;
  return `mailto:hello@metaflow.io?subject=Upgrade%20Request&body=Hi%2C%20I%27d%20like%20to%20upgrade%20to%20the%20MetaFlow%20${encodeURIComponent(label)}%20plan.`;
});

function openPlanModal() {
  planStep.value     = 'pick';
  selectedPlan.value = '';
  planError.value    = '';
  planModal.value    = true;
}

function selectPlan(name: string) {
  selectedPlan.value = name;
  planStep.value     = 'confirm';
}

async function confirmPlanChange() {
  if (!selectedPlan.value) return;

  // Upgrades go through Stripe Checkout
  const isUpgrade = selectedPlan.value !== 'CANCEL' &&
    PLAN_ORDER.indexOf(selectedPlan.value as any) > PLAN_ORDER.indexOf(currentPlanName.value as any);

  if (isUpgrade) {
    planStep.value = 'processing';
    try {
      const res = await $fetch<{ ok: boolean; url?: string }>(`${apiBase}/v1/billing/checkout`, {
        method: 'POST',
        credentials: 'include',
        body: { plan: selectedPlan.value },
      });
      if (res?.ok && res.url) {
        window.location.href = res.url;
        return;
      }
      // Unexpected response without URL
      planError.value = 'Unable to start checkout. Please try again.';
      planStep.value = 'error';
    } catch (e: any) {
      // 503 = billing not configured — fall back to support email
      if (e?.status === 503 || e?.statusCode === 503) {
        window.location.href = upgradeMailto.value;
        planModal.value = false;
        return;
      }
      planError.value = e?.data?.message ?? 'Something went wrong. Please try again.';
      planStep.value = 'error';
    }
    return;
  }

  // Downgrades and cancellations go through the existing settings/plan endpoint
  planStep.value = 'processing';
  try {
    const res = await $fetch<{ ok: boolean; plan?: string }>(`${apiBase}/v1/settings/plan`, {
      method: 'PATCH',
      credentials: 'include',
      body: { plan: selectedPlan.value },
    });
    if (selectedPlan.value !== 'CANCEL' && res.plan) {
      planCookie.value = res.plan;
    }
    planStep.value = 'success';
  } catch (e: any) {
    planError.value = e?.data?.message ?? 'Something went wrong. Please try again.';
    planStep.value  = 'error';
  }
}

// ── Change Password ────────────────────────────────────────────────────────────
const pwCurrent = ref('');
const pwNew = ref('');
const pwConfirm = ref('');
const pwSaving = ref(false);
const pwSuccess = ref(false);
const pwError = ref('');

async function changePassword() {
  if (!pwCurrent.value || !pwNew.value || pwNew.value !== pwConfirm.value) return;
  pwSaving.value = true;
  pwSuccess.value = false;
  pwError.value = '';
  try {
    await $fetch(`${apiBase}/v1/auth/password`, {
      method: 'PATCH',
      credentials: 'include',
      body: { currentPassword: pwCurrent.value, newPassword: pwNew.value }
    });
    pwSuccess.value = true;
    pwCurrent.value = '';
    pwNew.value = '';
    pwConfirm.value = '';
    setTimeout(() => { pwSuccess.value = false; }, 3000);
  } catch (e: any) {
    pwError.value = e?.data?.message ?? 'Failed to update password';
  } finally {
    pwSaving.value = false;
  }
}

// ── Team members ───────────────────────────────────────────────────────────────
const inviteEmail = ref('');
const inviteSending = ref(false);
const inviteSuccess = ref('');
const inviteError = ref('');
const teamMembers = ref<any[]>([]);
const pendingInvites = ref<any[]>([]);
const teamLoading = ref(false);

async function loadTeamMembers() {
  if (!activeStoreId.value) return;
  teamLoading.value = true;
  try {
    const res = await $fetch<any>(`${apiBase}/v1/teams/${activeStoreId.value}/members`, { credentials: 'include' });
    if (res?.ok) {
      teamMembers.value = res.members ?? [];
      pendingInvites.value = res.invites ?? [];
    }
  } catch {} finally {
    teamLoading.value = false;
  }
}

async function sendInvite() {
  if (!inviteEmail.value.trim() || !activeStoreId.value) return;
  inviteSending.value = true;
  inviteSuccess.value = '';
  inviteError.value = '';
  try {
    await $fetch(`${apiBase}/v1/teams/${activeStoreId.value}/invite`, {
      method: 'POST',
      credentials: 'include',
      body: { email: inviteEmail.value.trim() }
    });
    inviteSuccess.value = `Invite sent to ${inviteEmail.value}`;
    inviteEmail.value = '';
    await loadTeamMembers();
    setTimeout(() => { inviteSuccess.value = ''; }, 3000);
  } catch (e: any) {
    inviteError.value = e?.data?.message ?? 'Failed to send invite';
  } finally {
    inviteSending.value = false;
  }
}

async function removeMember(userId: string) {
  if (!activeStoreId.value) return;
  try {
    await $fetch(`${apiBase}/v1/teams/${activeStoreId.value}/members/${userId}`, {
      method: 'DELETE',
      credentials: 'include'
    });
    await loadTeamMembers();
  } catch {}
}

async function revokeInvite(inviteId: string) {
  if (!activeStoreId.value) return;
  try {
    await $fetch(`${apiBase}/v1/teams/${activeStoreId.value}/invites/${inviteId}`, {
      method: 'DELETE',
      credentials: 'include'
    });
    await loadTeamMembers();
  } catch {}
}

// Load team members when store changes
watch(activeStoreId, (id) => { if (id) loadTeamMembers(); }, { immediate: true });

// ── Per-store benchmark overrides ─────────────────────────────────────────────
const storeBenchmarkStoreId = ref<string>(activeStoreId.value ?? '');
const storeBenchmarkValues  = reactive<{ roas: number | null; ctr: number | null; margin: number | null; inventory: number | null }>({
  roas: null, ctr: null, margin: null, inventory: null
});
const storeBenchmarkDefaults = reactive({ roas: 5, ctr: 3, margin: 50, inventory: 10 });
const storeBenchmarkLoading  = ref(false);
const storeBenchmarkSaving   = ref(false);
const storeBenchmarkSuccess  = ref(false);
const storeBenchmarkError    = ref('');

// When the stores list loads or the active store changes, seed the store picker
watch([stores, activeStoreId], ([s, id]) => {
  if (!storeBenchmarkStoreId.value && s.length > 0) {
    storeBenchmarkStoreId.value = id ?? s[0]?.id ?? '';
  }
  if (storeBenchmarkStoreId.value) loadStoreBenchmarks(storeBenchmarkStoreId.value);
}, { immediate: false });

async function loadStoreBenchmarks(storeId: string) {
  if (!storeId) return;
  storeBenchmarkLoading.value = true;
  storeBenchmarkError.value = '';
  try {
    const res = await $fetch<{
      ok: boolean;
      storeBenchmarks: { roas: number | null; ctr: number | null; margin: number | null; inventory: number | null };
      effectiveBenchmarks: { roas: number; ctr: number; margin: number; inventory: number };
    }>(`${apiBase}/v1/settings/store/${storeId}`, { credentials: 'include' });
    if (res.ok) {
      storeBenchmarkValues.roas      = res.storeBenchmarks.roas;
      storeBenchmarkValues.ctr       = res.storeBenchmarks.ctr;
      storeBenchmarkValues.margin    = res.storeBenchmarks.margin;
      storeBenchmarkValues.inventory = res.storeBenchmarks.inventory;
      storeBenchmarkDefaults.roas      = +res.effectiveBenchmarks.roas.toFixed(2);
      storeBenchmarkDefaults.ctr       = +res.effectiveBenchmarks.ctr.toFixed(2);
      storeBenchmarkDefaults.margin    = +res.effectiveBenchmarks.margin.toFixed(1);
      storeBenchmarkDefaults.inventory = res.effectiveBenchmarks.inventory;
    }
  } catch { /* silent — store may not exist yet */ }
  storeBenchmarkLoading.value = false;
}

async function saveStoreBenchmarks() {
  const storeId = storeBenchmarkStoreId.value;
  if (!storeId) return;
  storeBenchmarkSaving.value  = true;
  storeBenchmarkSuccess.value = false;
  storeBenchmarkError.value   = '';
  try {
    await $fetch(`${apiBase}/v1/settings/store/${storeId}`, {
      method: 'PATCH',
      credentials: 'include',
      body: {
        roas:      storeBenchmarkValues.roas      ?? null,
        ctr:       storeBenchmarkValues.ctr       ?? null,
        margin:    storeBenchmarkValues.margin    ?? null,
        inventory: storeBenchmarkValues.inventory ?? null,
      }
    });
    storeBenchmarkSuccess.value = true;
    setTimeout(() => { storeBenchmarkSuccess.value = false; }, 3000);
  } catch (err: unknown) {
    storeBenchmarkError.value = (err as { data?: { message?: string } })?.data?.message ?? 'Failed to save';
    setTimeout(() => { storeBenchmarkError.value = ''; }, 5000);
  } finally {
    storeBenchmarkSaving.value = false;
  }
}

async function resetStoreBenchmarks() {
  const storeId = storeBenchmarkStoreId.value;
  if (!storeId) return;
  storeBenchmarkSaving.value  = true;
  storeBenchmarkError.value   = '';
  try {
    await $fetch(`${apiBase}/v1/settings/store/${storeId}`, {
      method: 'PATCH',
      credentials: 'include',
      body: { roas: null, ctr: null, margin: null, inventory: null }
    });
    storeBenchmarkValues.roas      = null;
    storeBenchmarkValues.ctr       = null;
    storeBenchmarkValues.margin    = null;
    storeBenchmarkValues.inventory = null;
    storeBenchmarkSuccess.value = true;
    setTimeout(() => { storeBenchmarkSuccess.value = false; }, 3000);
  } catch (err: unknown) {
    storeBenchmarkError.value = (err as { data?: { message?: string } })?.data?.message ?? 'Failed to reset';
    setTimeout(() => { storeBenchmarkError.value = ''; }, 5000);
  } finally {
    storeBenchmarkSaving.value = false;
  }
}

// Danger zone modal
const dangerModal = ref(false);
const dangerAction = ref<'reset' | 'disconnect'>('reset');

function openDangerConfirm(action: 'reset' | 'disconnect') {
  dangerAction.value = action;
  dangerModal.value = true;
}

async function confirmDangerAction() {
  dangerModal.value = false;
  if (dangerAction.value === 'reset') {
    await resetRules();
  } else if (dangerAction.value === 'disconnect' && connectedStore.value) {
    openDisconnect('store', connectedStore.value.id, 'all integrations');
  }
}
</script>

<style scoped>
.fade-up-enter-active, .fade-up-leave-active { transition: all 0.3s ease; }
.fade-up-enter-from, .fade-up-leave-to { opacity: 0; transform: translateY(-6px); }

/* Modal backdrop fade */
.modal-fade-enter-active { transition: opacity 0.2s ease; }
.modal-fade-leave-active { transition: opacity 0.15s ease; }
.modal-fade-enter-from, .modal-fade-leave-to { opacity: 0; }
</style>

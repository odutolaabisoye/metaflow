<template>
  <div class="space-y-6">

    <!-- Progress header -->
    <div class="glass rounded-2xl p-6">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 class="text-2xl font-semibold tracking-tight">Workspace setup</h1>
          <p class="mt-1 text-sm text-white/40">{{ steps[step].subtitle }}</p>
        </div>
        <span class="rounded-full bg-white/[0.08] border border-white/10 px-3 py-1 text-xs font-medium text-white/50">
          Step {{ step + 1 }} of {{ steps.length }}
        </span>
      </div>

      <!-- Step track -->
      <div class="mt-6 flex items-center gap-0">
        <template v-for="(s, i) in steps" :key="i">
          <div
            class="flex items-center justify-center w-8 h-8 rounded-full text-xs font-semibold flex-shrink-0 transition-all duration-300"
            :class="i < step
              ? 'bg-lime-500/20 border border-lime-500/30 text-lime-400'
              : i === step
                ? 'bg-glow-500/15 border border-glow-500/40 text-glow-400'
                : 'bg-white/5 border border-white/10 text-white/25'"
          >
            <svg v-if="i < step" class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/>
            </svg>
            <span v-else>{{ i + 1 }}</span>
          </div>
          <div v-if="i < steps.length - 1" class="h-px flex-1 mx-1 transition-all duration-300" :class="i < step ? 'bg-lime-500/30' : 'bg-white/10'"></div>
        </template>
      </div>

      <!-- Step labels (desktop) -->
      <div class="mt-3 hidden sm:flex items-start">
        <template v-for="(s, i) in steps" :key="i">
          <div class="flex-1 text-center" :class="i === 0 ? 'text-left' : i === steps.length - 1 ? 'text-right' : 'text-center'">
            <p class="text-xs transition-colors" :class="i === step ? 'text-white/70' : 'text-white/25'">{{ s.label }}</p>
          </div>
        </template>
      </div>
    </div>

    <!-- Step content card -->
    <div class="glass rounded-2xl p-6 md:p-8">
      <div class="mb-7">
        <h2 class="text-xl font-semibold">{{ steps[step].title }}</h2>
        <p class="mt-1 text-sm text-white/45">{{ steps[step].hint }}</p>
      </div>

      <!-- ── Step 0: Connect store ── -->
      <div v-if="step === 0" class="space-y-6">

        <!-- Platform picker -->
        <div>
          <p class="text-xs font-medium text-white/35 uppercase tracking-wider mb-3">Choose your platform</p>
          <div class="grid gap-3 sm:grid-cols-3">
            <button
              v-for="p in platforms"
              :key="p.value"
              @click="form.platform = p.value"
              class="relative rounded-2xl border p-5 text-left transition-all duration-200 group"
              :class="form.platform === p.value
                ? 'border-glow-500/40 bg-glow-500/8 shadow-[0_0_0_1px_rgba(34,211,238,0.15)]'
                : 'border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/5'"
            >
              <div class="h-9 w-9 rounded-xl flex items-center justify-center mb-3 transition-all" :style="{ background: p.iconBg }">
                <svg class="w-4 h-4" :style="{ color: p.iconColor }" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" v-html="p.icon"></svg>
              </div>
              <p class="font-semibold text-sm">{{ p.label }}</p>
              <p class="text-xs text-white/40 mt-0.5 leading-relaxed">{{ p.note }}</p>
              <!-- Checkmark -->
              <div
                v-if="form.platform === p.value"
                class="absolute top-3 right-3 h-5 w-5 rounded-full bg-glow-500/20 border border-glow-500/40 flex items-center justify-center"
              >
                <svg class="w-3 h-3 text-glow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/>
                </svg>
              </div>
            </button>
          </div>
        </div>

        <!-- ── Shopify flow ── -->
        <Transition name="fade-up">
          <div v-if="form.platform === 'Shopify'" class="space-y-4">
            <div class="rounded-2xl border border-[#96BF48]/20 bg-[#96BF48]/[0.06] p-5">
              <div class="flex items-start gap-3">
                <div class="h-8 w-8 rounded-lg bg-[#96BF48]/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <svg class="w-4 h-4" style="color: #96BF48" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"/>
                  </svg>
                </div>
                <div>
                  <p class="text-sm font-semibold">Shopify App Installation</p>
                  <p class="text-xs text-white/50 mt-1 leading-relaxed">
                    You'll be redirected to the Shopify App Store to install MetaFlow. Once installed, your catalog, orders, and inventory sync automatically — no API keys or webhooks needed.
                  </p>
                </div>
              </div>
            </div>

            <div>
              <label class="form-label">Store name</label>
              <input v-model.trim="form.storeName" type="text" placeholder="Lagos Homeware" class="form-input" />
            </div>

            <div>
              <label class="form-label">Your Shopify store URL</label>
              <div class="flex items-stretch">
                <div class="flex items-center rounded-l-xl border border-r-0 border-white/10 bg-white/[0.04] px-3 text-sm text-white/35 select-none flex-shrink-0">
                  https://
                </div>
                <input
                  v-model.trim="form.shopifySubdomain"
                  type="text"
                  placeholder="yourstore"
                  class="flex-1 min-w-0 border border-x-0 border-white/10 bg-white/[0.06] px-3 py-3 text-sm text-white placeholder:text-white/25 outline-none focus:border-glow-500/40 transition-all"
                />
                <div class="flex items-center rounded-r-xl border border-l-0 border-white/10 bg-white/[0.04] px-3 text-sm text-white/35 select-none flex-shrink-0">
                  .myshopify.com
                </div>
              </div>
            </div>

            <button
              :disabled="!form.shopifySubdomain || !form.storeName"
              class="w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style="background: #96BF48; color: #1a1a1a;"
            >
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"/>
              </svg>
              Install MetaFlow on Shopify →
            </button>

            <div class="flex items-start gap-2 text-xs text-white/35">
              <svg class="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-white/25" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"/>
              </svg>
              MetaFlow requests read-only catalog and orders access. We cannot create products, process refunds, or alter your store.
            </div>
          </div>
        </Transition>

        <!-- ── WooCommerce flow ── -->
        <Transition name="fade-up">
          <div v-if="form.platform === 'WooCommerce'" class="space-y-4">
            <div class="rounded-2xl border border-[#7F54B3]/20 bg-[#7F54B3]/[0.06] p-5">
              <div class="flex items-start gap-3">
                <div class="h-8 w-8 rounded-lg bg-[#7F54B3]/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <svg class="w-4 h-4" style="color: #9B72CF" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M6.75 7.5l3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0021 18V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v12a2.25 2.25 0 002.25 2.25z"/>
                  </svg>
                </div>
                <div>
                  <p class="text-sm font-semibold">WooCommerce REST API</p>
                  <p class="text-xs text-white/50 mt-1 leading-relaxed">
                    Generate API credentials in your WordPress admin at
                    <span class="text-[#9B72CF] font-medium">WooCommerce → Settings → Advanced → REST API</span>.
                    Create a key with <strong class="text-white/70">Read/Write</strong> permissions.
                  </p>
                </div>
              </div>
            </div>

            <div class="grid gap-4 sm:grid-cols-2">
              <div>
                <label class="form-label">Store name</label>
                <input v-model.trim="form.storeName" type="text" placeholder="Lagos Homeware" class="form-input" />
              </div>
              <div>
                <label class="form-label">Store URL</label>
                <input v-model.trim="form.storeUrl" type="url" placeholder="https://yourstore.com" class="form-input" />
              </div>
            </div>

            <div class="grid gap-4 sm:grid-cols-2">
              <div>
                <label class="form-label">Consumer Key</label>
                <input v-model.trim="form.apiKey" type="text" placeholder="ck_xxxxxxxxxxxxxxxxxxxx" class="form-input font-mono text-xs" autocomplete="off" />
              </div>
              <div>
                <label class="form-label">Consumer Secret</label>
                <input v-model.trim="form.apiSecret" type="password" placeholder="cs_xxxxxxxxxxxxxxxxxxxx" class="form-input font-mono text-xs" autocomplete="off" />
              </div>
            </div>

            <div class="grid gap-4 sm:grid-cols-2">
              <div>
                <label class="form-label">Store currency</label>
                <input v-model.trim="form.storeCurrency" type="text" placeholder="NGN" class="form-input" />
              </div>
            </div>

            <!-- Webhook instructions -->
            <div class="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p class="text-xs font-semibold text-white/60 mb-2">Webhook setup (recommended)</p>
              <p class="text-xs text-white/40 mb-3">Add this URL in WooCommerce → Settings → Advanced → Webhooks to receive real-time product and order updates:</p>
              <code class="block text-xs text-[#9B72CF] bg-[#7F54B3]/5 border border-[#7F54B3]/15 rounded-lg px-3 py-2 font-mono break-all">
                https://api.metaflow.io/v1/webhooks/woo/{your-workspace-key}
              </code>
            </div>
          </div>
        </Transition>

        <!-- ── API flow ── -->
        <Transition name="fade-up">
          <div v-if="form.platform === 'API'" class="space-y-4">
            <div class="rounded-2xl border border-glow-500/20 bg-glow-500/[0.05] p-5">
              <div class="flex items-start gap-3">
                <div class="h-8 w-8 rounded-lg bg-glow-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <svg class="w-4 h-4 text-glow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M14.25 9.75L16.5 12l-2.25 2.25m-4.5 0L7.5 12l2.25-2.25M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z"/>
                  </svg>
                </div>
                <div>
                  <p class="text-sm font-semibold">Direct API Integration</p>
                  <p class="text-xs text-white/50 mt-1 leading-relaxed">
                    Connect any custom store, headless commerce platform, or ERP by pointing MetaFlow at your products and orders API. We'll pull catalog data on a schedule and process webhook events in real time.
                  </p>
                </div>
              </div>
            </div>

            <div class="grid gap-4 sm:grid-cols-2">
              <div>
                <label class="form-label">Store name</label>
                <input v-model.trim="form.storeName" type="text" placeholder="Lagos Homeware" class="form-input" />
              </div>
              <div>
                <label class="form-label">Store currency</label>
                <input v-model.trim="form.storeCurrency" type="text" placeholder="NGN" class="form-input" />
              </div>
            </div>

            <div>
              <label class="form-label">Products API endpoint</label>
              <input v-model.trim="form.storeUrl" type="url" placeholder="https://api.yourstore.com/v1/products" class="form-input font-mono text-sm" />
              <p class="mt-1.5 text-xs text-white/35">Should return a JSON array of products with SKU, price, inventory, and category fields.</p>
            </div>

            <div>
              <label class="form-label">API Key / Bearer token</label>
              <input v-model.trim="form.apiKey" type="password" :placeholder="apiKeyPlaceholder" class="form-input font-mono text-xs" autocomplete="off" />
              <p class="mt-1.5 text-xs text-white/35">Sent as <code class="text-glow-400">Authorization: Bearer &lt;key&gt;</code> with every request.</p>
            </div>

            <!-- Inbound webhook -->
            <div class="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p class="text-xs font-semibold text-white/60 mb-1.5">Inbound webhook endpoint</p>
              <p class="text-xs text-white/35 mb-2.5">POST product and order events to MetaFlow for real-time updates:</p>
              <code class="block text-xs text-glow-400 bg-glow-500/5 border border-glow-500/15 rounded-lg px-3 py-2 font-mono break-all">
                https://api.metaflow.io/v1/webhooks/ingest/{your-workspace-key}
              </code>
            </div>
          </div>
        </Transition>
      </div>

      <!-- ── Step 1: Connect Meta Ads ── -->
      <div v-else-if="step === 1" class="space-y-4">

        <!-- Meta OAuth card -->
        <div class="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div class="flex items-center gap-4">
            <div class="h-11 w-11 rounded-xl flex-shrink-0 flex items-center justify-center" style="background: rgba(24,119,242,0.15);">
              <svg class="w-5 h-5" style="color: #1877F2" fill="currentColor" viewBox="0 0 24 24">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
            </div>
            <div class="flex-1">
              <p class="font-semibold text-sm">Connect Meta Ads</p>
              <p class="text-xs text-white/50 mt-0.5">We'll pull catalog performance and manage product sets and budgets using your automation rules.</p>
            </div>
            <div class="flex-shrink-0">
              <span v-if="metaConnected" class="flex items-center gap-1.5 text-xs text-lime-400 font-medium">
                <span class="h-1.5 w-1.5 rounded-full bg-lime-400 animate-pulse"></span>
                Connected
              </span>
            </div>
          </div>
          <button
            @click="metaConnected = !metaConnected"
            class="mt-4 w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-all"
            style="background: #1877F2; color: white;"
          >
            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
            </svg>
            {{ metaConnected ? 'Reconnect Meta Account' : 'Authorize with Meta' }}
          </button>
        </div>

        <div class="grid gap-4 sm:grid-cols-2">
          <div>
            <label class="form-label">Ad Account ID</label>
            <input v-model.trim="form.adAccountId" type="text" placeholder="act_1234567890" class="form-input font-mono text-sm" />
          </div>
          <div>
            <label class="form-label">Ads account currency</label>
            <select v-model="form.adAccountCurrency" class="form-input appearance-none">
              <option value="USD">USD — US Dollar</option>
              <option value="GBP">GBP — British Pound</option>
              <option value="EUR">EUR — Euro</option>
              <option value="NGN">NGN — Nigerian Naira</option>
              <option value="KES">KES — Kenyan Shilling</option>
              <option value="ZAR">ZAR — South African Rand</option>
              <option value="GHS">GHS — Ghanaian Cedi</option>
              <option value="CAD">CAD — Canadian Dollar</option>
              <option value="AUD">AUD — Australian Dollar</option>
            </select>
            <p class="mt-1.5 text-xs text-white/35">Used for spend + revenue reporting across your dashboard.</p>
          </div>
        </div>

        <!-- Permissions notice -->
        <div class="rounded-2xl border border-white/8 bg-white/[0.03] p-4 flex items-start gap-3">
          <svg class="w-4 h-4 text-glow-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"/>
          </svg>
          <p class="text-xs text-white/45 leading-relaxed">
            MetaFlow requests <strong class="text-white/65">ads_read</strong>, <strong class="text-white/65">ads_management</strong>, and <strong class="text-white/65">catalog_management</strong> permissions. We never create campaigns, delete ads, or spend money without your explicit automation rules.
          </p>
        </div>
      </div>

      <!-- ── Step 2: Goals ── -->
      <div v-else-if="step === 2" class="space-y-6">

        <div>
          <p class="text-xs font-medium text-white/35 uppercase tracking-wider mb-3">Primary goal</p>
          <div class="grid gap-3 sm:grid-cols-3">
            <button
              v-for="goal in goals"
              :key="goal.value"
              @click="form.goal = goal.value"
              class="relative rounded-2xl border p-5 text-left transition-all duration-200"
              :class="form.goal === goal.value
                ? 'border-lime-500/40 bg-lime-500/8 shadow-[0_0_0_1px_rgba(132,204,22,0.15)]'
                : 'border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/5'"
            >
              <div class="h-8 w-8 rounded-lg flex items-center justify-center mb-3" :style="{ background: goal.bg }">
                <svg class="w-4 h-4" :style="{ color: goal.color }" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" v-html="goal.icon"></svg>
              </div>
              <p class="text-sm font-semibold">{{ goal.label }}</p>
              <p class="text-xs text-white/40 mt-0.5">{{ goal.desc }}</p>
              <div v-if="form.goal === goal.value" class="absolute top-3 right-3 h-5 w-5 rounded-full bg-lime-500/20 border border-lime-500/40 flex items-center justify-center">
                <svg class="w-3 h-3 text-lime-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>
              </div>
            </button>
          </div>
        </div>

        <div>
          <p class="text-xs font-medium text-white/35 uppercase tracking-wider mb-3">
            Scoring focus
            <span class="normal-case text-white/20 ml-1">— select all that apply</span>
          </p>
          <div class="grid gap-2.5 sm:grid-cols-2">
            <label
              v-for="focus in focusAreas"
              :key="focus"
              class="flex items-center justify-between rounded-xl border px-4 py-3 cursor-pointer transition-all duration-150"
              :class="form.focus.includes(focus)
                ? 'border-glow-500/30 bg-glow-500/5'
                : 'border-white/10 bg-white/[0.03] hover:border-white/20'"
            >
              <span class="text-sm">{{ focus }}</span>
              <input v-model="form.focus" type="checkbox" :value="focus" class="sr-only" />
              <div
                class="h-4 w-4 rounded flex items-center justify-center flex-shrink-0 transition-all"
                :class="form.focus.includes(focus)
                  ? 'bg-glow-500/25 border border-glow-500/50'
                  : 'border border-white/20'"
              >
                <svg v-if="form.focus.includes(focus)" class="w-2.5 h-2.5 text-glow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/>
                </svg>
              </div>
            </label>
          </div>
        </div>
      </div>

      <!-- ── Step 3: Automation + Review ── -->
      <div v-else class="space-y-5">

        <div class="space-y-3">
          <div
            v-for="toggle in automationToggles"
            :key="toggle.key"
            class="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] p-4"
          >
            <div class="flex items-center gap-3">
              <div class="h-7 w-7 rounded-lg flex items-center justify-center flex-shrink-0" :style="{ background: toggle.bg }">
                <svg class="w-3.5 h-3.5" :style="{ color: toggle.color }" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" v-html="toggle.icon"></svg>
              </div>
              <div>
                <p class="text-sm font-semibold">{{ toggle.label }}</p>
                <p class="text-xs text-white/40 mt-0.5">{{ toggle.desc }}</p>
              </div>
            </div>
            <button
              @click="(form as any)[toggle.key] = !(form as any)[toggle.key]"
              class="relative h-6 w-11 rounded-full transition-all duration-200 flex-shrink-0 ml-4"
              :class="(form as any)[toggle.key] ? 'bg-glow-500/70' : 'bg-white/15'"
            >
              <span
                class="absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-all duration-200"
                :class="(form as any)[toggle.key] ? 'translate-x-5' : 'translate-x-0'"
              ></span>
            </button>
          </div>
        </div>

        <!-- Review summary -->
        <div class="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <p class="text-sm font-semibold mb-4 flex items-center gap-2">
            <svg class="w-4 h-4 text-glow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            Review your setup
          </p>
          <div class="space-y-2.5">
            <div v-for="item in reviewItems" :key="item.label" class="flex items-center justify-between text-sm border-b border-white/[0.05] pb-2.5 last:border-0 last:pb-0">
              <span class="text-white/40">{{ item.label }}</span>
              <span class="font-medium" :class="item.value === '—' ? 'text-white/20' : ''">{{ item.value }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Save error -->
      <Transition name="fade-up">
        <div v-if="saveError" class="mt-5 flex items-center justify-between gap-3 rounded-xl border border-ember-500/25 bg-ember-500/8 px-4 py-3">
          <div class="flex items-center gap-2.5">
            <svg class="w-4 h-4 text-ember-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"/>
            </svg>
            <p class="text-sm text-ember-400">{{ saveError }}</p>
          </div>
          <button @click="saveError = ''" class="text-ember-400/60 hover:text-ember-400 transition-colors flex-shrink-0">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
      </Transition>

      <!-- Navigation buttons -->
      <div class="mt-6 flex items-center justify-between">
        <button
          v-if="step > 0"
          :disabled="saving"
          @click="step--"
          class="flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-medium text-white/60 hover:bg-white/10 hover:text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          ← Back
        </button>
        <div v-else></div>

        <button
          :disabled="!canProceed || saving"
          @click="step < steps.length - 1 ? step++ : finishSetup()"
          class="flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-semibold transition-all disabled:opacity-35 disabled:cursor-not-allowed"
          :class="step === steps.length - 1
            ? 'bg-white text-ink-950 hover:bg-white/90'
            : 'bg-glow-500/15 border border-glow-500/30 text-glow-300 hover:bg-glow-500/25'"
        >
          <svg v-if="saving" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
          {{ saving ? 'Saving…' : step === steps.length - 1 ? 'Finish setup' : 'Continue' }} →
        </button>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { useGlobalFilters } from "~/composables/useGlobalFilters";

const config = useRuntimeConfig();
const apiKeyPlaceholder = computed(() => config.public.apiKeyPlaceholder);

const { metaCurrency, storeCurrency } = useGlobalFilters();

const step = ref(0);
const metaConnected = ref(false);

const steps = [
  { label: 'Connect store',   title: 'Connect your store',      subtitle: 'Choose how MetaFlow syncs your product catalog',   hint: 'Shopify, WooCommerce, or direct API' },
  { label: 'Meta Ads',        title: 'Connect Meta Ads',        subtitle: 'Authorize catalog and ads access',                  hint: 'Needed to sync product sets and manage budgets' },
  { label: 'Goals',           title: 'Define your goals',       subtitle: 'Tell MetaFlow what matters most to your business',  hint: 'Shapes how scoring weights are applied' },
  { label: 'Automation',      title: 'Automation preferences',  subtitle: 'Configure scoring and rule automation',             hint: 'You can change these at any time in Settings' },
];

const platforms = [
  {
    value: 'Shopify',
    label: 'Shopify',
    note: 'App install via Shopify App Store — automatic catalog + order sync',
    iconBg: 'rgba(150,191,72,0.12)',
    iconColor: '#96BF48',
    icon: '<path stroke-linecap="round" stroke-linejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z"/>',
  },
  {
    value: 'WooCommerce',
    label: 'WooCommerce',
    note: 'REST API key + webhook for WordPress / WooCommerce stores',
    iconBg: 'rgba(127,84,179,0.12)',
    iconColor: '#9B72CF',
    icon: '<path stroke-linecap="round" stroke-linejoin="round" d="M6.75 7.5l3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0021 18V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v12a2.25 2.25 0 002.25 2.25z"/>',
  },
  {
    value: 'API',
    label: 'Custom API',
    note: 'Connect any platform — headless, ERP, or custom-built store',
    iconBg: 'rgba(34,211,238,0.1)',
    iconColor: '#22d3ee',
    icon: '<path stroke-linecap="round" stroke-linejoin="round" d="M14.25 9.75L16.5 12l-2.25 2.25m-4.5 0L7.5 12l2.25-2.25M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z"/>',
  },
];

const goals = [
  {
    value: 'scale',
    label: 'Scale winners',
    desc: 'Maximise ROAS by pushing budget to top performers',
    bg: 'rgba(132,204,22,0.12)', color: '#84cc16',
    icon: '<path stroke-linecap="round" stroke-linejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941"/>',
  },
  {
    value: 'reduce-waste',
    label: 'Reduce waste',
    desc: 'Cut spend on underperformers and dead-stock SKUs',
    bg: 'rgba(249,115,22,0.12)', color: '#f97316',
    icon: '<path stroke-linecap="round" stroke-linejoin="round" d="M15.75 5.25v13.5m-7.5-13.5v13.5"/>',
  },
  {
    value: 'protect-inventory',
    label: 'Protect inventory',
    desc: 'Throttle spend on low-stock products before stockouts',
    bg: 'rgba(139,92,246,0.12)', color: '#a78bfa',
    icon: '<path stroke-linecap="round" stroke-linejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0l-3-3m3 3l3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z"/>',
  },
];

const focusAreas = ['ROAS', 'CTR', 'Conversion rate', 'Gross margin', 'Inventory velocity', 'Low stock risk'];

const automationToggles = [
  {
    key: 'enableScoring',
    label: 'Product scoring',
    desc: 'Score every SKU daily across ROAS, CTR, margin, and inventory',
    bg: 'rgba(34,211,238,0.1)', color: '#22d3ee',
    icon: '<path stroke-linecap="round" stroke-linejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>',
  },
  {
    key: 'enableAutomation',
    label: 'Automation rules',
    desc: 'Move products between ad sets and adjust budgets based on scores',
    bg: 'rgba(132,204,22,0.1)', color: '#84cc16',
    icon: '<path stroke-linecap="round" stroke-linejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"/>',
  },
  {
    key: 'inventoryAlerts',
    label: 'Inventory risk alerts',
    desc: 'Get notified and throttle spend when stock drops below threshold',
    bg: 'rgba(249,115,22,0.1)', color: '#f97316',
    icon: '<path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z"/>',
  },
];

const form = reactive({
  platform: '' as '' | 'Shopify' | 'WooCommerce' | 'API',
  storeName: '',
  storeUrl: '',
  shopifySubdomain: '',
  storeCurrency: 'NGN',
  apiKey: '',
  apiSecret: '',
  adAccountId: '',
  adAccountCurrency: 'USD',
  goal: '',
  focus: [] as string[],
  enableScoring: true,
  enableAutomation: true,
  inventoryAlerts: true,
});

const canProceed = computed(() => {
  if (step.value === 0) {
    if (!form.platform) return false;
    if (form.platform === 'Shopify') return Boolean(form.storeName && form.shopifySubdomain);
    if (form.platform === 'WooCommerce') return Boolean(form.storeName && form.storeUrl && form.apiKey && form.apiSecret);
    if (form.platform === 'API') return Boolean(form.storeName && form.storeUrl && form.apiKey);
  }
  if (step.value === 1) return Boolean(form.adAccountId && form.adAccountCurrency);
  if (step.value === 2) return Boolean(form.goal);
  return true;
});

const reviewItems = computed(() => [
  { label: 'Platform',       value: form.platform || '—' },
  { label: 'Store',          value: form.storeName || '—' },
  { label: 'Store currency', value: form.storeCurrency || '—' },
  { label: 'Ad Account',     value: form.adAccountId || '—' },
  { label: 'Ads currency',   value: form.adAccountCurrency || '—' },
  { label: 'Goal',           value: goals.find(g => g.value === form.goal)?.label || '—' },
  { label: 'Scoring',        value: form.enableScoring ? 'Enabled' : 'Disabled' },
  { label: 'Automation',     value: form.enableAutomation ? 'Enabled' : 'Disabled' },
]);

const saving = ref(false);
const saveError = ref('');

const finishSetup = async () => {
  if (saving.value) return;
  saving.value = true;
  saveError.value = '';

  try {
    const apiBase = config.public.apiBase;

    // Build the store URL from platform-specific fields
    const storeUrl =
      form.platform === 'Shopify'
        ? `https://${form.shopifySubdomain}.myshopify.com`
        : form.storeUrl;

    const platformMap: Record<string, string> = {
      Shopify: 'SHOPIFY',
      WooCommerce: 'WOOCOMMERCE',
      API: 'API',
    };

    // 1. Create the store
    const storeRes = await $fetch<{ ok: boolean; store: { id: string } }>(
      `${apiBase}/v1/stores`,
      {
        method: 'POST',
        credentials: 'include',
        body: {
          name: form.storeName,
          platform: platformMap[form.platform],
          storeUrl,
          currency: form.storeCurrency || 'USD',
        },
      }
    );

    const storeId = storeRes.store?.id;

    // 2. For WooCommerce, connect the REST API credentials
    if (form.platform === 'WooCommerce' && storeId) {
      await $fetch(`${apiBase}/v1/connections/woocommerce`, {
        method: 'POST',
        credentials: 'include',
        body: {
          storeId,
          consumerKey: form.apiKey,
          consumerSecret: form.apiSecret,
        },
      });
    }

    // 3. Persist currency preferences
    metaCurrency.value = form.adAccountCurrency || metaCurrency.value;
    storeCurrency.value = form.storeCurrency || storeCurrency.value;

    navigateTo('/app');
  } catch (err: any) {
    saveError.value = err?.data?.message || 'Failed to save. Please try again.';
  } finally {
    saving.value = false;
  }
};
</script>

<style scoped>
.fade-up-enter-active,
.fade-up-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.fade-up-enter-from,
.fade-up-leave-to {
  opacity: 0;
  transform: translateY(6px);
}
</style>

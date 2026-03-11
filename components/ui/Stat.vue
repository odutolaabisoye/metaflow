<template>
  <div class="flex flex-col gap-3">
    <div class="flex items-center justify-between text-xs text-white/80">
      <span>{{ label }}</span>
      <Badge v-if="badge" :variant="badgeVariant">{{ badge }}</Badge>
    </div>
    <div class="text-2xl font-semibold">{{ value }}</div>
    <p class="text-xs text-white/75">{{ hint }}</p>
  </div>
</template>

<script setup lang="ts">
import { Badge } from "~/components/ui/badge";
import type { BadgeVariants } from "~/components/ui/badge";

const props = withDefaults(
  defineProps<{
    label: string;
    value: string;
    hint: string;
    badge?: string;
    badgeVariant?: BadgeVariants["variant"];
  }>(),
  { badgeVariant: "secondary" }
);
</script>

<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  remainingTime: number;
}>();

const radius = 15;
const circumference = 2 * Math.PI * radius;

const progressOffset = computed(() => {
  const safeRemaining = Number.isFinite(props.remainingTime)
    ? props.remainingTime
    : 0;
  const elapsedRatio = (30 - safeRemaining) / 30;
  return circumference * (1 - Math.min(Math.max(elapsedRatio, 0), 1));
});
</script>

<template>
  <div class="progress-ring">
    <svg class="progress-ring__svg" viewBox="0 0 36 36" aria-hidden="true">
      <circle class="progress-ring__track" cx="18" cy="18" :r="radius" />
      <circle
        class="progress-ring__indicator"
        cx="18"
        cy="18"
        :r="radius"
        :stroke-dasharray="circumference"
        :stroke-dashoffset="progressOffset"
      />
    </svg>
    <span class="progress-ring__time">{{ remainingTime }}s</span>
  </div>
</template>

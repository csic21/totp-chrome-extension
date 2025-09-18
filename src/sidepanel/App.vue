<script setup lang="ts">
import TotpAuthenticator from '../shared/TotpAuthenticator.vue';
import { isDarkMode } from '../composables/useTheme';
import { onMounted } from 'vue';

onMounted(() => {
  // Theme is now managed by the composable and will be reactive across components
});
</script>

<template>
  <div 
    :class="[
      'w-full min-h-screen p-4',
      {
        'bg-gray-100': !isDarkMode,
        'bg-gray-900': isDarkMode,
      }
    ]"
  >
    <div class="max-w-4xl mx-auto">
      <TotpAuthenticator />
    </div>
  </div>
</template>

<style>
/* Side panel-specific styles */
body {
  margin: 0;
  padding: 0;
}
</style>
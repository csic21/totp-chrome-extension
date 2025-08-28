<script setup lang="ts">
import TotpAuthenticator from '../shared/TotpAuthenticator.vue';
</script>

<template>
  <div class="w-80 bg-gray-900 rounded-xl overflow-hidden">
    <TotpAuthenticator />
  </div>
</template>

<style>
/* Popup-specific styles */
body {
  margin: 0;
  padding: 0;
  background-color: #212121; /* gray-900 to match the component background */
}
</style>
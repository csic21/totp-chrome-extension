<script setup lang="ts">
import TotpAuthenticator from "../shared/TotpAuthenticator.vue";
</script>

<template>
  <div class="w-85 overflow-hidden shadow-embossed">
    <TotpAuthenticator />
  </div>
</template>

<style>
/* Popup-specific styles */
body {
  margin: 0;
  padding: 0;
}
</style>

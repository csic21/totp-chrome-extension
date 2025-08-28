<script setup lang="ts">
import TotpAuthenticator from '../shared/TotpAuthenticator.vue';
</script>

<template>
  <div class="w-full min-h-screen bg-slate-900 p-4">
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
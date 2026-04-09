<script setup lang="ts">
import TotpAuthenticator from "../shared/TotpAuthenticator.vue";
</script>

<template>
  <div class="app-shell app-shell--sidepanel">
    <div class="app-shell__inner">
      <div class="chrome-panel chrome-panel--sidepanel">
        <TotpAuthenticator />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { validateBase32Secret } from "../lib/totp";

defineProps({
  isDarkMode: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(["add-account", "close"]);

const newAccountName = ref("");
const newAccountSecret = ref("");

const addAccount = () => {
  const name = newAccountName.value.trim();
  const secret = newAccountSecret.value.trim();

  if (!name || !secret) {
    alert("Name and Secret cannot be empty.");
    return;
  }

  if (!validateBase32Secret(secret)) {
    alert("Invalid secret key format. Please enter a valid Base32 encoded secret.");
    return;
  }

  emit("add-account", { name, secret });
};

const closeModal = () => {
  emit("close");
};
</script>

<template>
  <Teleport to="body">
    <div class="modal-backdrop">
      <div class="modal-card">
        <h2 class="modal-title">Add New Account</h2>
        <p class="modal-copy">
          Enter the account label and Base32 secret exactly as provided by your
          service.
        </p>

        <div class="form-stack">
          <input
            v-model="newAccountName"
            class="field-input"
            placeholder="Account Name"
          />
          <input
            v-model="newAccountSecret"
            class="field-input"
            placeholder="Secret Key (Base32)"
          />
        </div>

        <div class="form-actions">
          <button class="pill-button pill-button--primary" @click="addAccount">
            Add Account
          </button>
          <button class="pill-button pill-button--secondary" @click="closeModal">
            Cancel
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

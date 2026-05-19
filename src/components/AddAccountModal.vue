<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { validateBase32Secret } from "../lib/totp";

const props = withDefaults(
  defineProps<{
    isDarkMode?: boolean;
    mode?: "add" | "edit";
    initialName?: string;
    initialSecret?: string;
  }>(),
  {
    isDarkMode: false,
    mode: "add",
    initialName: "",
    initialSecret: "",
  },
);

const emit = defineEmits<{
  (e: "submit", payload: { name: string; secret: string }): void;
  (e: "close"): void;
}>();

const accountName = ref("");
const accountSecret = ref("");

watch(
  () => [props.initialName, props.initialSecret, props.mode],
  () => {
    accountName.value = props.initialName;
    accountSecret.value = props.mode === "edit" ? "" : props.initialSecret;
  },
  { immediate: true },
);

const modalTitle = computed(() =>
  props.mode === "edit" ? "Edit Account" : "Add New Account",
);
const modalCopy = computed(() =>
  props.mode === "edit"
    ? "Update the account label. Enter a new Base32 secret only if you want to replace the current one."
    : "Enter the account label and Base32 secret exactly as provided by your service.",
);
const submitLabel = computed(() =>
  props.mode === "edit" ? "Save Changes" : "Add Account",
);
const secretPlaceholder = computed(() =>
  props.mode === "edit"
    ? "New Secret Key (Base32, optional)"
    : "Secret Key (Base32)",
);

const submitAccount = () => {
  const name = accountName.value.trim();
  const secret = accountSecret.value.trim();

  if (!name || (props.mode !== "edit" && !secret)) {
    alert("Name and Secret cannot be empty.");
    return;
  }

  if (secret && !validateBase32Secret(secret)) {
    alert("Invalid secret key format. Please enter a valid Base32 encoded secret.");
    return;
  }

  emit("submit", { name, secret });
};

const closeModal = () => {
  emit("close");
};
</script>

<template>
  <Teleport to="body">
    <div class="modal-backdrop">
      <div class="modal-card">
        <h2 class="modal-title">{{ modalTitle }}</h2>
        <p class="modal-copy">{{ modalCopy }}</p>

        <div class="form-stack">
          <input
            v-model="accountName"
            class="field-input"
            placeholder="Account Name"
          />
          <input
            v-model="accountSecret"
            class="field-input"
            :placeholder="secretPlaceholder"
          />
        </div>

        <div class="form-actions">
          <button class="pill-button pill-button--primary" @click="submitAccount">
            {{ submitLabel }}
          </button>
          <button class="pill-button pill-button--secondary" @click="closeModal">
            Cancel
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<template>
  <div class="relative">
    <button
      @click="toggleMenu"
      :class="[
        'p-1 rounded-md focus:outline-none transition-colors',
        {
          'hover:bg-gray-700 focus:ring-gray-500': isDarkMode,
          'hover:bg-gray-200 focus:ring-gray-300': !isDarkMode,
        },
      ]"
      aria-label="Add account"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor"
        class="size-6"
      >
        <path
          fill-rule="evenodd"
          d="M12 3.75a.75.75 0 0 1 .75.75v6.75h6.75a.75.75 0 0 1 0 1.5h-6.75v6.75a.75.75 0 0 1-1.5 0v-6.75H4.5a.75.75 0 0 1 0-1.5h6.75V4.5a.75.75 0 0 1 .75-.75Z"
          clip-rule="evenodd"
        />
      </svg>
    </button>

    <div
      v-if="isOpen"
      :class="[
        'absolute right-0 mt-2 w-48 rounded-md shadow-lg py-1 z-10',
        {
          'bg-gray-800': isDarkMode,
          'bg-white': !isDarkMode,
        },
      ]"
      style="top: 100%"
    >
      <button
        @click="addAccount"
        :class="[
          'block w-full text-left px-4 py-2 text-sm focus:outline-none',
          {
            'text-gray-300 hover:bg-gray-700 focus:bg-gray-700': isDarkMode,
            'text-gray-700 hover:bg-gray-200 focus:bg-gray-200': !isDarkMode,
          },
        ]"
      >
        Add Account
      </button>
      <button
        @click="scanQrCode"
        :class="[
          'block w-full text-left px-4 py-2 text-sm focus:outline-none',
          {
            'text-gray-300 hover:bg-gray-700 focus:bg-gray-700': isDarkMode,
            'text-gray-700 hover:bg-gray-200 focus:bg-gray-200': !isDarkMode,
          },
        ]"
      >
        Scan QR Code
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";

const isOpen = ref(false);

const emit = defineEmits<{
  (e: "add-account"): void;
  (e: "scan-qr"): void;
}>();

defineProps({
  isDarkMode: {
    type: Boolean,
    default: false,
  },
});

const toggleMenu = () => {
  isOpen.value = !isOpen.value;
};

const addAccount = () => {
  isOpen.value = false;
  emit("add-account");
};

const scanQrCode = () => {
  isOpen.value = false;
  emit("scan-qr");
};

const handleClickOutside = (event: MouseEvent) => {
  if (isOpen.value) {
    const target = event.target as HTMLElement;
    if (!target.closest(".relative")) {
      isOpen.value = false;
    }
  }
};

onMounted(() => {
  document.addEventListener("click", handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener("click", handleClickOutside);
});
</script>

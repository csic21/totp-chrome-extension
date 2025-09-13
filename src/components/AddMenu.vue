<template>
  <div class="relative">
    <button 
      @click="toggleMenu" 
      class="p-1 rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors"
      aria-label="Add account"
    >
      <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
      </svg>
    </button>

    <div 
      v-if="isOpen" 
      class="absolute right-0 mt-2 w-48 bg-gray-800 rounded-md shadow-lg py-1 z-10"
      style="top: 100%;"
    >
      <button 
        @click="addAccount"
        class="block w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 focus:outline-none focus:bg-gray-700"
      >
        Add Account
      </button>
      <button 
        @click="scanQrCode"
        class="block w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 focus:outline-none focus:bg-gray-700"
      >
        Scan QR Code
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';

const isOpen = ref(false);

const emit = defineEmits<{
  (e: 'add-account'): void;
  (e: 'scan-qr'): void;
}>();

const toggleMenu = () => {
  isOpen.value = !isOpen.value;
};

const addAccount = () => {
  isOpen.value = false;
  emit('add-account');
};

const scanQrCode = () => {
  isOpen.value = false;
  emit('scan-qr');
};

const handleClickOutside = (event: MouseEvent) => {
  if (isOpen.value) {
    const target = event.target as HTMLElement;
    if (!target.closest('.relative')) {
      isOpen.value = false;
    }
  }
};

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
});
</script>
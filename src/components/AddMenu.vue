<template>
  <div class="relative">
    <button 
      @click="toggleMenu" 
      :class="[
        'p-1 rounded-md focus:outline-none transition-colors',
        { 
          'hover:bg-gray-700 focus:ring-gray-500': isDarkMode,
          'hover:bg-gray-200 focus:ring-gray-300': !isDarkMode
        }
      ]"
      aria-label="Add account"
    >
      <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" :class="{ 'text-gray-300': isDarkMode, 'text-gray-600': !isDarkMode }" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
      </svg>
    </button>

    <div 
      v-if="isOpen" 
      :class="[
        'absolute right-0 mt-2 w-48 rounded-md shadow-lg py-1 z-10',
        { 
          'bg-gray-800': isDarkMode,
          'bg-white': !isDarkMode
        }
      ]"
      style="top: 100%;"
    >
      <button 
        @click="addAccount"
        :class="[
          'block w-full text-left px-4 py-2 text-sm focus:outline-none',
          { 
            'text-gray-300 hover:bg-gray-700 focus:bg-gray-700': isDarkMode,
            'text-gray-700 hover:bg-gray-200 focus:bg-gray-200': !isDarkMode
          }
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
            'text-gray-700 hover:bg-gray-200 focus:bg-gray-200': !isDarkMode
          }
        ]"
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

defineProps({
  isDarkMode: {
    type: Boolean,
    default: false
  }
});

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
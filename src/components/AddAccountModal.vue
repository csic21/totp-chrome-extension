<script setup lang="ts">
import { ref, computed } from 'vue';
import { validateBase32Secret } from '../lib/totp';

const props = defineProps({
  isDarkMode: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['add-account', 'close']);

const newAccountName = ref('');
const newAccountSecret = ref('');

const backgroundColor = computed(() => props.isDarkMode ? 'bg-gray-900' : 'bg-white');
const textColor = computed(() => props.isDarkMode ? 'text-gray-200' : 'text-gray-700');
const inputBackgroundColor = computed(() => props.isDarkMode ? 'bg-gray-800' : 'bg-gray-100');
const inputTextColor = computed(() => props.isDarkMode ? 'text-gray-200' : 'text-gray-700');
const inputBorderColor = computed(() => props.isDarkMode ? 'border-gray-700' : 'border-gray-300');
const cancelButtonColor = computed(() => props.isDarkMode ? 'bg-gray-700 text-gray-200 hover:bg-gray-600 focus:ring-gray-500' : 'bg-gray-200 text-gray-700 hover:bg-gray-300 focus:ring-gray-500');

const addAccount = () => {
  const name = newAccountName.value.trim();
  const secret = newAccountSecret.value.trim();

  if (!name || !secret) {
    alert('Name and Secret cannot be empty.');
    return;
  }

  if (!validateBase32Secret(secret)) {
    alert('Invalid secret key format. Please enter a valid Base32 encoded secret.');
    return;
  }

  emit('add-account', { name, secret });
};

const closeModal = () => {
  emit('close');
};
</script>

<template>
  <div :class="['fixed inset-0 flex items-center justify-center z-50', { 'bg-gray-900 bg-opacity-75': isDarkMode, 'bg-gray-500 bg-opacity-75': !isDarkMode }]">
    <div :class="['p-6 rounded-lg w-full max-w-sm shadow-embossed-strong', backgroundColor, textColor]">
      <h2 :class="['text-xl font-bold mb-4', textColor]">Add New Account</h2>
      <input v-model="newAccountName" placeholder="Account Name" :class="['w-full px-3 py-2 mb-3 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500 shadow-embossed-light', inputBackgroundColor, inputTextColor, inputBorderColor]" />
      <input v-model="newAccountSecret" placeholder="Secret Key (Base32)" :class="['w-full px-3 py-2 mb-4 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500 shadow-embossed-light', inputBackgroundColor, inputTextColor, inputBorderColor]" />
      <div class="flex justify-end gap-3">
        <button @click="addAccount" :class="['px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors shadow-embossed']">Add Account</button>
        <button @click="closeModal" :class="['px-4 py-2 rounded-md focus:outline-none focus:ring-2 transition-colors shadow-embossed-light', cancelButtonColor]">Cancel</button>
      </div>
    </div>
  </div>
</template>
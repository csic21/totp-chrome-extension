<script setup lang="ts">
import { ref } from 'vue';
import { validateBase32Secret } from '../lib/totp';

const emit = defineEmits(['add-account', 'close']);

const newAccountName = ref('');
const newAccountSecret = ref('');

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
  <div class="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-50">
    <div class="bg-gray-900 p-6 rounded-lg shadow-xl w-full max-w-sm">
      <h2 class="text-xl font-bold text-gray-200 mb-4">Add New Account</h2>
      <input v-model="newAccountName" placeholder="Account Name" class="w-full px-3 py-2 mb-3 bg-gray-800 border border-gray-700 text-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500" />
      <input v-model="newAccountSecret" placeholder="Secret Key (Base32)" class="w-full px-3 py-2 mb-4 bg-gray-800 border border-gray-700 text-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500" />
      <div class="flex justify-end gap-3">
        <button @click="closeModal" class="px-4 py-2 bg-gray-700 text-gray-200 rounded-md hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors">Cancel</button>
        <button @click="addAccount" class="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors">Add Account</button>
      </div>
    </div>
  </div>
</template>
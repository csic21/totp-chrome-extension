<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import AddAccountModal from '../components/AddAccountModal.vue';
import QrScanner from '../components/QrScanner.vue';
import { generateAllTokens, validateBase32Secret, type TotpAccounts } from '../lib/totp';

// Using an array of objects for accounts
const accounts = ref<TotpAccounts>([]);
const currentTokens = ref<{ token: string; remainingTime: number }[]>([]);
const isModalOpen = ref(false);
const isQrScannerOpen = ref(false);
const copiedName = ref<string | null>(null);
// For editing account names
const editingIndex = ref<number | null>(null);
const editedName = ref<string>('');

let intervalId: number | undefined;

const loadAccounts = async () => {
  try {
    const result = await chrome.storage.sync.get('totpAccounts');
    let storedAccounts = result.totpAccounts;

    // Data migration: if old object format is found, convert to array
    if (storedAccounts && !Array.isArray(storedAccounts)) {
      console.log('Migrating data from object to array format...');
      storedAccounts = Object.entries(storedAccounts).map(([name, account]: [string, any]) => ({
        name,
        secret: account.secret,
      }));
      // Save the migrated data back
      await chrome.storage.sync.set({ totpAccounts: storedAccounts });
    }
    
    accounts.value = storedAccounts || [];
    updateAllTokens(); // Initial token generation after loading
  } catch (error) {
    console.error('Error loading accounts:', error);
  }
};

const saveAccounts = async () => {
  try {
    console.log('Saving to storage:', accounts.value);
    await chrome.storage.sync.set({ totpAccounts: accounts.value.map(item=>item) });
  } catch (error) {
    console.error('Error saving accounts:', error);
  }
};

const handleAccountAdded = async ({ name, secret }: { name: string; secret: string }) => {
  // // Allow duplicate names, but not duplicate secrets
  // if (accounts.value.find(acc => acc.secret === secret)) {
  //   alert('Account with this secret already exists.');
  //   return;
  // }

  // Validate the secret before adding
  if (!validateBase32Secret(secret)) {
    alert('Invalid secret key format. Please enter a valid Base32 encoded secret.');
    return;
  }

  // Add new account to the array
  accounts.value.push({ name, secret });
  cancelEdit();
  await saveAccounts();
  updateAllTokens();
  isModalOpen.value = false;
};

const handleQrScanSuccess = async ({ name, secret }: { name: string; secret: string }) => {
  // Allow duplicate names, but not duplicate secrets
  // if (accounts.value.find(acc => acc.secret === secret)) {
  //   alert('Account with this secret already exists.');
  //   return;
  // }

  // Validate the secret before adding
  if (!validateBase32Secret(secret)) {
    alert('Invalid secret key format. Please enter a valid Base32 encoded secret.');
    return;
  }

  // Add new account to the array
  handleAccountAdded({ name, secret });
  isQrScannerOpen.value = false;
};

const deleteAccount = async (index: number) => {
    accounts.value = accounts.value.filter((_, i) => i !== index);
    delete currentTokens.value[index];
    cancelEdit()
    await saveAccounts();
    updateAllTokens();
};

const updateAllTokens = () => {
  // Use the utility function to generate all tokens
  const tokens = generateAllTokens(accounts.value);
  
  // Update the reactive refs
  currentTokens.value = tokens;
};

// Functions for editing account names
const startEditing = (index: number, currentName: string) => {
  editingIndex.value = index;
  editedName.value = currentName;
};

const saveEdit = async () => {
  if (editingIndex.value !== null) {
    // Validate the new name (e.g., not empty)
    if (!editedName.value.trim()) {
      alert('Account name cannot be empty.');
      return;
    }
    
    // Update the account name
    accounts.value[editingIndex.value].name = editedName.value.trim();
    await saveAccounts();
    
    // Exit editing mode
    cancelEdit();
  }
};

const cancelEdit = () => {
  editingIndex.value = null;
  editedName.value = '';
};

const copyToClipboard = async (name: string, text: string) => {
  if (!text || text === 'Error') return;
  try {
    await navigator.clipboard.writeText(text);
    copiedName.value = name;
    setTimeout(() => {
      copiedName.value = null;
    }, 2000);
  } catch (err) {
    console.error('Failed to copy: ', err);
    alert('Failed to copy to clipboard.');
  }
};

const openQrScanner = () => {
  isQrScannerOpen.value = true;
};

onMounted(() => {
  loadAccounts();
  intervalId = setInterval(updateAllTokens, 1000) as unknown as number;
});

onUnmounted(() => {
  if (intervalId) {
    clearInterval(intervalId);
  }
});
</script>

<template>
  <div class="w-full max-w-md bg-gray-900 p-4 font-sans text-white mx-auto rounded-xl min-h-[400px]">
    <h1 class="text-center text-xl font-bold text-gray-200 mb-4">TOTP Authenticator</h1>

    <div class="mb-4 flex gap-2">
      <button @click="isModalOpen = true" class="flex-1 bg-gray-700 text-white py-2 rounded-md hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-opacity-50 transition-colors">
        Add Account
      </button>
      <button @click="openQrScanner" class="flex-1 bg-gray-700 text-white py-2 rounded-md hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-opacity-50 transition-colors">
        Scan QR Code
      </button>
    </div>

    <AddAccountModal v-if="isModalOpen" @add-account="handleAccountAdded" @close="isModalOpen = false" />
    <QrScanner v-if="isQrScannerOpen" @scan-success="handleQrScanSuccess" @close="isQrScannerOpen = false" />

    <div class="space-y-3">
      <h2 class="text-base font-semibold text-gray-400 mb-2">Your Accounts</h2>
      <p v-if="accounts.length === 0" class="text-gray-400 text-center py-4">No accounts added yet.</p>
      <div v-for="(account, index) in accounts" :key="index+account.name+account.secret" class="bg-gray-800 p-3 rounded-lg shadow-md flex justify-between items-center">
        <div class="flex-grow">
          <!-- Edit mode -->
          <div v-if="editingIndex === index" class="flex items-center gap-2">
            <input 
              v-model="editedName" 
              type="text" 
              class="flex-grow bg-gray-700 text-white px-2 py-1 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500"
              @keyup.enter="saveEdit"
              @keyup.esc="cancelEdit"
            />
            <button @click="saveEdit" class="p-1 text-green-500 rounded-full hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-green-400 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
              </svg>
            </button>
            <button @click="cancelEdit" class="p-1 text-gray-400 rounded-full hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <!-- View mode -->
          <div v-else>
            <h3 class="text-base font-medium text-gray-200 text-left flex items-center">
              {{ account.name }}
              <button @click="startEditing(index, account.name)" class="ml-2 p-1 text-gray-400 rounded-full hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
            </h3>
            <div class="flex items-center gap-2 mt-2">
              <span class="text-2xl font-mono text-gray-300 tracking-wider">{{ currentTokens[index]?.token || '...' }}</span>
              <progress :value="currentTokens[index]?.remainingTime" max="30" class="w-full h-1.5 rounded-full overflow-hidden"></progress>
              <span class="text-xs text-gray-400 w-8 text-right">{{ currentTokens[index]?.remainingTime }}s</span>
            </div>
          </div>
        </div>
        <div v-if="editingIndex !== index" class="flex items-center gap-1 ml-3">
          <div class="relative">
            <button @click="copyToClipboard(account.name, currentTokens[index]?.token)" :disabled="!currentTokens[index]?.token || currentTokens[index]?.token === 'Error'" class="p-1 text-gray-400 rounded-full hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </button>
            <span v-if="copiedName === account.name" class="absolute -top-8 left-1/2 -translate-x-1/2 bg-black text-white text-xs rounded-md px-2 py-1">
              Copied!
            </span>
          </div>
          <button @click="deleteAccount(index)" class="p-1 text-red-500 rounded-full hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-red-400 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style>
/* Using Tailwind CSS classes, so no scoped styles are needed here */
progress::-webkit-progress-bar {
  background-color: #757575; /* gray-600 */
}

progress::-webkit-progress-value {
  background-color: #9e9e9e; /* gray-500 */
  transition: width 0.2s ease;
}

progress::-moz-progress-bar {
  background-color: #9e9e9e; /* gray-500 */
}
</style>
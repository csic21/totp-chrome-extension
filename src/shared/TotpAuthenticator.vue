<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import AddAccountModal from '../components/AddAccountModal.vue';
import QrScanner from '../components/QrScanner.vue';
import { generateAllTokens, validateBase32Secret, type TotpAccounts } from '../lib/totp';

// Using a dictionary-like object for accounts
// Key: account name (string)
// Value: account data (object with secret)
const accounts = ref<TotpAccounts>({});
const currentTokens = ref<{ [key: string]: string }>({});
const remainingTimes = ref<{ [key: string]: number }>({});
const isModalOpen = ref(false);
const isQrScannerOpen = ref(false);
const copiedName = ref<string | null>(null);
let intervalId: number | undefined;

const loadAccounts = async () => {
  try {
    const result = await chrome.storage.sync.get('totpAccounts');
    // Use an empty object as default
    accounts.value = result.totpAccounts || {};
    updateAllTokens(); // Initial token generation after loading
  } catch (error) {
    console.error('Error loading accounts:', error);
  }
};

const saveAccounts = async () => {
  try {
    console.log('Saving to storage:', accounts.value);
    await chrome.storage.sync.set({ totpAccounts: accounts.value });
  } catch (error) {
    console.error('Error saving accounts:', error);
  }
};

const handleAccountAdded = async ({ name, secret }: { name: string; secret: string }) => {
  if (accounts.value[name]) {
    alert('Account with this name already exists.');
    return;
  }

  // Validate the secret before adding
  if (!validateBase32Secret(secret)) {
    alert('Invalid secret key format. Please enter a valid Base32 encoded secret.');
    return;
  }

  // Add new account by setting a new key-value pair
  accounts.value[name] = { secret };
  await saveAccounts();
  updateAllTokens();
  isModalOpen.value = false;
};

const handleQrScanSuccess = async ({ name, secret }: { name: string; secret: string }) => {
  if (accounts.value[name]) {
    alert('Account with this name already exists.');
    return;
  }

  // Validate the secret before adding
  if (!validateBase32Secret(secret)) {
    alert('Invalid secret key format. Please enter a valid Base32 encoded secret.');
    return;
  }

  // Add new account by setting a new key-value pair
  accounts.value[name] = { secret };
  await saveAccounts();
  updateAllTokens();
  isQrScannerOpen.value = false;
};

const deleteAccount = async (name: string) => {
  // Deletion is simpler
  delete accounts.value[name];
  delete currentTokens.value[name];
  delete remainingTimes.value[name];
  await saveAccounts();
};

const updateAllTokens = () => {
  // Use the utility function to generate all tokens
  const tokens = generateAllTokens(accounts.value);
  
  // Update the reactive refs
  for (const [name, tokenData] of Object.entries(tokens)) {
    currentTokens.value[name] = tokenData.token;
    remainingTimes.value[name] = tokenData.remainingTime;
  }
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
      <p v-if="Object.keys(accounts).length === 0" class="text-gray-400 text-center py-4">No accounts added yet.</p>
      <div v-for="(_, name) in accounts" :key="name" class="bg-gray-800 p-3 rounded-lg shadow-md flex justify-between items-center">
        <div class="flex-grow">
          <h3 class="text-base font-medium text-gray-200 text-left">{{ name }}</h3>
          <div class="flex items-center gap-2 mt-2">
            <span class="text-2xl font-mono text-gray-300 tracking-wider">{{ currentTokens[String(name)] || '...' }}</span>
            <progress :value="remainingTimes[String(name)]" max="30" class="w-full h-1.5 rounded-full overflow-hidden"></progress>
            <span class="text-xs text-gray-400 w-8 text-right">{{ remainingTimes[String(name)] }}s</span>
          </div>
        </div>
        <div class="flex items-center gap-1 ml-3">
          <div class="relative">
            <button @click="copyToClipboard(String(name), currentTokens[String(name)])" :disabled="!currentTokens[String(name)] || currentTokens[String(name)] === 'Error'" class="p-1 text-gray-400 rounded-full hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </button>
            <span v-if="copiedName === name" class="absolute -top-8 left-1/2 -translate-x-1/2 bg-black text-white text-xs rounded-md px-2 py-1">
              Copied!
            </span>
          </div>
          <button @click="deleteAccount(String(name))" class="p-1 text-red-500 rounded-full hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-red-400 transition-colors">
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
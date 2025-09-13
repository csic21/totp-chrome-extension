<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import AddAccountModal from "../components/AddAccountModal.vue";
import QrScanner from "../components/QrScanner.vue";
import AddMenu from "../components/AddMenu.vue";
import {
  generateAllTokens,
  validateBase32Secret,
  type TotpAccounts,
} from "../lib/totp";

// Using an array of objects for accounts
const accounts = ref<TotpAccounts>([]);
const currentTokens = ref<{ token: string; remainingTime: number }[]>([]);
const isModalOpen = ref(false);
const isQrScannerOpen = ref(false);
const copiedName = ref<string | null>(null);
// For editing account names
const editingIndex = ref<number | null>(null);
const editedName = ref<string>("");
const currentHostname = ref<string | undefined>();

let intervalId: number | undefined;

const getCurrentTabHostname = async (): Promise<string | undefined> => {
  try {
    const [activeTab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (activeTab && activeTab.url) {
      const url = new URL(activeTab.url);
      return url.hostname;
    }
  } catch (error) {
    console.error("Error getting active tab hostname:", error);
  }
  return undefined;
};

const loadAccounts = async () => {
  try {
    const result = await chrome.storage.sync.get("totpAccounts");
    let storedAccounts = result.totpAccounts;
    currentHostname.value = await getCurrentTabHostname();
    // Data migration: if old object format is found, convert to array
    if (storedAccounts && !Array.isArray(storedAccounts)) {
      console.log("Migrating data from object to array format...");
      storedAccounts = Object.entries(storedAccounts).map(
        ([name, account]: [string, any]) => ({
          name,
          secret: account.secret,
        })
      );
      // Save the migrated data back
      await chrome.storage.sync.set({ totpAccounts: storedAccounts });
    }

    accounts.value = storedAccounts || [];
    updateAllTokens(); // Initial token generation after loading
  } catch (error) {
    console.error("Error loading accounts:", error);
  }
};

const saveAccounts = async () => {
  try {
    console.log("Saving to storage:", accounts.value);
    await chrome.storage.sync.set({
      totpAccounts: accounts.value.map((item) => item),
    });
  } catch (error) {
    console.error("Error saving accounts:", error);
  }
};

const handleAccountAdded = async ({
  name,
  secret,
}: {
  name: string;
  secret: string;
}) => {
  // // Allow duplicate names, but not duplicate secrets
  // if (accounts.value.find(acc => acc.secret === secret)) {
  //   alert('Account with this secret already exists.');
  //   return;
  // }

  // Validate the secret before adding
  if (!validateBase32Secret(secret)) {
    alert(
      "Invalid secret key format. Please enter a valid Base32 encoded secret."
    );
    return;
  }

  // Add new account to the array
  accounts.value.push({ name, secret });
  cancelEdit();
  await saveAccounts();
  updateAllTokens();
  isModalOpen.value = false;
};

const handleQrScanSuccess = async ({
  name,
  secret,
}: {
  name: string;
  secret: string;
}) => {
  // Allow duplicate names, but not duplicate secrets
  // if (accounts.value.find(acc => acc.secret === secret)) {
  //   alert('Account with this secret already exists.');
  //   return;
  // }

  // Validate the secret before adding
  if (!validateBase32Secret(secret)) {
    alert(
      "Invalid secret key format. Please enter a valid Base32 encoded secret."
    );
    return;
  }

  // Add new account to the array
  handleAccountAdded({ name, secret });
  isQrScannerOpen.value = false;
};

const deleteAccount = async (index: number) => {
  accounts.value = accounts.value.filter((_, i) => i !== index);
  delete currentTokens.value[index];
  cancelEdit();
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

const focusHostName = (index: number) => {
  // give account current hostname
  accounts.value[index].activePath = currentHostname.value;
  saveAccounts();
};

const unFocusHostName = (index: number) => {
  // remove account activePath
  accounts.value[index].activePath = undefined;
  saveAccounts();
};
const saveEdit = async () => {
  if (editingIndex.value !== null) {
    // Validate the new name (e.g., not empty)
    if (!editedName.value.trim()) {
      alert("Account name cannot be empty.");
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
  editedName.value = "";
};

const copyToClipboard = async (name: string, text: string) => {
  if (!text || text === "Error") return;
  try {
    await navigator.clipboard.writeText(text);
    copiedName.value = name;
    setTimeout(() => {
      copiedName.value = null;
    }, 2000);
  } catch (err) {
    console.error("Failed to copy: ", err);
    alert("Failed to copy to clipboard.");
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
  <div
    class="w-full max-w-md bg-gray-900 p-4 font-sans text-white mx-auto rounded-xl min-h-[400px]"
  >
    <div class="flex justify-between items-center mb-4">
      <h1 class="text-xl font-bold text-gray-200">TOTP Authenticator</h1>
      <AddMenu @add-account="isModalOpen = true" @scan-qr="openQrScanner" />
    </div>

    <AddAccountModal
      v-if="isModalOpen"
      @add-account="handleAccountAdded"
      @close="isModalOpen = false"
    />
    <QrScanner
      v-if="isQrScannerOpen"
      @scan-success="handleQrScanSuccess"
      @close="isQrScannerOpen = false"
    />

    <div class="space-y-3">
      <h2 class="text-base font-semibold text-gray-400 mb-2">Your Accounts</h2>
      <p v-if="accounts.length === 0" class="text-gray-400 text-center py-4">
        No accounts added yet.
      </p>
      <div
        v-for="(account, index) in accounts"
        :key="index + account.name + account.secret"
        class="bg-gray-800 p-3 rounded-lg shadow-md flex justify-between items-center"
      >
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
            <button
              @click="saveEdit"
              class="p-1 text-green-500 rounded-full hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-green-400 transition-colors"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke-width="1.5"
                stroke="currentColor"
                class="size-5"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="m4.5 12.75 6 6 9-13.5"
                />
              </svg>
            </button>
            <button
              @click="cancelEdit"
              class="p-1 text-gray-400 rounded-full hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke-width="1.5"
                stroke="currentColor"
                class="size-5"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M6 18 18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
          <!-- View mode -->
          <div v-else>
            <div class="flex items-center gap-1 justify-between">
              <button
                @click="focusHostName(index)"
                class="p-1 text-gray-400 rounded-full hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke-width="1.5"
                  stroke="currentColor"
                  class="size-5"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M13.181 8.68a4.503 4.503 0 0 1 1.903 6.405m-9.768-2.782L3.56 14.06a4.5 4.5 0 0 0 6.364 6.365l3.129-3.129m5.614-5.615 1.757-1.757a4.5 4.5 0 0 0-6.364-6.365l-4.5 4.5c-.258.26-.479.541-.661.84m1.903 6.405a4.495 4.495 0 0 1-1.242-.88 4.483 4.483 0 0 1-1.062-1.683m6.587 2.345 5.907 5.907m-5.907-5.907L8.898 8.898M2.991 2.99 8.898 8.9"
                  />
                </svg>
              </button>
              <button
                @click="unFocusHostName(index)"
                class="p-1 text-green-500 rounded-full hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-green-400 transition-colors"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke-width="1.5"
                  stroke="currentColor"
                  class="size-5"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244"
                  />
                </svg>
              </button>
              <h3
                class="w-0 text-base font-medium text-gray-200 overflow-hidden text-ellipsis flex-1 flex-nowrap text-nowrap"
              >
                {{ account.name }}
              </h3>
              <div
                v-if="editingIndex !== index"
                class="flex items-center gap-1 ml-3"
              >
                <div class="relative">
                  <button
                    @click="startEditing(index, account.name)"
                    class="ml-2 p-1 text-gray-400 rounded-full hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke-width="1.5"
                      stroke="currentColor"
                      class="size-5"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10"
                      />
                    </svg>
                  </button>

                  <span
                    v-if="copiedName === account.name"
                    class="absolute -top-8 left-1/2 -translate-x-1/2 bg-black text-white text-xs rounded-md px-2 py-1"
                  >
                    Copied!
                  </span>
                </div>
                <button
                  @click="deleteAccount(index)"
                  class="p-1 text-red-500 rounded-full hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-red-400 transition-colors"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke-width="1.5"
                    stroke="currentColor"
                    class="size-5"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
                    />
                  </svg>
                </button>
              </div>
            </div>
            <div class="flex items-center gap-2 mt-2">
              <button
                @click="
                  copyToClipboard(account.name, currentTokens[index]?.token)
                "
                :disabled="
                  !currentTokens[index]?.token ||
                  currentTokens[index]?.token === 'Error'
                "
                class="p-1 text-gray-400 rounded-full hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke-width="1.5"
                  stroke="currentColor"
                  class="size-5"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H9.75"
                  />
                </svg>
              </button>
              <span class="text-2xl font-mono text-gray-300 tracking-wider">{{
                currentTokens[index]?.token || "..."
              }}</span>
              <progress
                :value="currentTokens[index]?.remainingTime"
                max="30"
                class="w-full h-1.5 rounded-full overflow-hidden"
              ></progress>
              <span class="text-xs text-gray-400 w-8 text-right"
                >{{ currentTokens[index]?.remainingTime }}s</span
              >
            </div>
          </div>
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

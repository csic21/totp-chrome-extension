<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import AddAccountModal from "../components/AddAccountModal.vue";
import QrScanner from "../components/QrScanner.vue";
import AddMenu from "../components/AddMenu.vue";
import CircularProgress from "../components/CircularProgress.vue";
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
const copiedIndex = ref<number | null>(null);
// For editing account names
const editingIndex = ref<number | null>(null);
const editedName = ref<string>("");
const currentHostname = ref<string | undefined>();

// Theme management
import {
  isDarkMode,
  isAutoMode,
  toggleTheme,
  toggleAutoMode,
  applyTheme,
} from "../composables/useTheme";

// Apply theme on component mount
onMounted(() => {
  applyTheme();
});

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

const sorterAccounts = () => {
  accounts.value.sort((a, b) => {
    const asort = a.activePath === currentHostname.value ? 0 : 1;
    const bsort = b.activePath === currentHostname.value ? 0 : 1;
    return asort - bsort;
  });
  updateAllTokens();
};
const getStorageAccounts = async () => {
  const result = await chrome.storage.sync.get("totpAccounts");
  let storedAccounts: TotpAccounts = result.totpAccounts;
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

  accounts.value =
    storedAccounts?.map((item, index) => ({
      ...item,
      originIndex: index + 1,
    })) || [];
};
const loadAccounts = async () => {
  try {
    currentHostname.value = await getCurrentTabHostname();
    await getStorageAccounts();
    sorterAccounts();
  } catch (error) {
    console.error("Error loading accounts:", error);
  }
};

const saveAccounts = async () => {
  try {
    console.log("Saving to storage:", accounts.value);
    await chrome.storage.sync.set({
      totpAccounts: accounts.value
        .sort((a, b) => {
          const asort = a.originIndex ? a.originIndex : 999;
          const bsort = b.originIndex ? b.originIndex : 999;
          return asort - bsort;
        })
        .map((item) => ({
          name: item.name,
          secret: item.secret,
          activePath: item.activePath,
        })),
    });
    await getStorageAccounts();
    sorterAccounts();
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

const copyToClipboard = async (index: number, text: string) => {
  if (!text || text === "Error") return;
  try {
    await navigator.clipboard.writeText(text);
    copiedIndex.value = index;
    setTimeout(() => {
      copiedIndex.value = null;
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
    :class="[
      'w-full max-w-md p-4 font-sans mx-auto min-h-[400px] shadow-embossed',
      {
        'bg-gray-100 text-gray-800': !isDarkMode,
        'bg-gray-900 text-white': isDarkMode,
      },
    ]"
  >
    <div class="flex justify-between items-start mb-4">
      <h1
        :class="[
          'text-xl font-bold',
          { 'text-gray-700': !isDarkMode, 'text-gray-200': isDarkMode },
        ]"
      >
        TOTP Authenticator
      </h1>
      <div class="flex items-center gap-2">
        <!-- Auto Mode Switch -->
        <div class="flex items-center gap-1">
          <span
            :class="[
              'text-sm',
              { 'text-gray-700': !isDarkMode, 'text-gray-300': isDarkMode },
            ]"
          >
            Auto
          </span>
          <button
            @click="toggleAutoMode"
            :class="[
              'relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1',
              {
                'bg-gray-600 focus:ring-gray-300': isAutoMode && !isDarkMode,
                'bg-gray-500 focus:ring-gray-500': isAutoMode && isDarkMode,
                'bg-gray-200': !isAutoMode && !isDarkMode,
                'bg-gray-600': !isAutoMode && isDarkMode,
              },
            ]"
            title="Toggle auto theme (follow system)"
          >
            <span
              :class="[
                'inline-block h-3 w-3 transform rounded-full bg-white transition-transform',
                {
                  'translate-x-5': isAutoMode,
                  'translate-x-1': !isAutoMode,
                },
              ]"
            />
          </button>
        </div>

        <!-- Theme Toggle Button -->
        <button
          @click="toggleTheme"
          :class="[
            'p-1 rounded-full focus:outline-none focus:ring-2 transition-colors shadow-embossed-light',
            {
              'text-gray-700 hover:bg-gray-200 focus:ring-gray-300':
                !isDarkMode,
              'text-gray-300 hover:bg-gray-700 focus:ring-gray-500': isDarkMode,
            },
          ]"
          title="Toggle dark mode"
        >
          <svg
            v-if="isDarkMode"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            class="size-5"
          >
            <path
              fill-rule="evenodd"
              d="M9.528 1.718a.75.75 0 0 1 .162.819A8.97 8.97 0 0 0 9 6a9 9 0 0 0 9 9 8.97 8.97 0 0 0 3.463-.69.75.75 0 0 1 .981.98 10.503 10.503 0 0 1-9.694 6.46c-5.799 0-10.5-4.7-10.5-10.5 0-4.368 2.667-8.112 6.46-9.694a.75.75 0 0 1 .818.162Z"
              clip-rule="evenodd"
            />
          </svg>
          <svg
            v-else
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            class="size-5"
          >
            <path
              d="M12 2.25a.75.75 0 0 1 .75.75v2.25a.75.75 0 0 1-1.5 0V3a.75.75 0 0 1 .75-.75ZM7.5 12a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0ZM18.894 6.166a.75.75 0 0 0-1.06-1.06l-1.591 1.59a.75.75 0 1 0 1.06 1.061l1.591-1.59ZM21.75 12a.75.75 0 0 1-.75.75h-2.25a.75.75 0 0 1 0-1.5H21a.75.75 0 0 1 .75.75ZM17.834 18.894a.75.75 0 0 0 1.06-1.06l-1.59-1.591a.75.75 0 1 0-1.061 1.06l1.59 1.591ZM12 18a.75.75 0 0 1 .75.75V21a.75.75 0 0 1-1.5 0v-2.25A.75.75 0 0 1 12 18ZM7.758 17.303a.75.75 0 0 0-1.061-1.06l-1.591 1.59a.75.75 0 0 0 1.06 1.061l1.591-1.59ZM6 12a.75.75 0 0 1-.75.75H3a.75.75 0 0 1 0-1.5h2.25A.75.75 0 0 1 6 12ZM6.697 7.757a.75.75 0 0 0 1.06-1.06l-1.59-1.591a.75.75 0 0 0-1.061 1.06l1.59 1.591Z"
            />
          </svg>
        </button>

        <AddMenu
          @add-account="isModalOpen = true"
          @scan-qr="openQrScanner"
          :is-dark-mode="isDarkMode"
        />
      </div>
    </div>

    <AddAccountModal
      v-if="isModalOpen"
      @add-account="handleAccountAdded"
      @close="isModalOpen = false"
      :is-dark-mode="isDarkMode"
    />
    <QrScanner
      v-if="isQrScannerOpen"
      @scan-success="handleQrScanSuccess"
      @close="isQrScannerOpen = false"
      :is-dark-mode="isDarkMode"
    />

    <div class="space-y-3">
      <h2
        :class="[
          'text-base font-semibold mb-2',
          { 'text-gray-600': !isDarkMode, 'text-gray-400': isDarkMode },
        ]"
      >
        Your Accounts
      </h2>
      <p
        :class="[
          'text-center py-4',
          { 'text-gray-500': !isDarkMode, 'text-gray-400': isDarkMode },
        ]"
        v-if="accounts.length === 0"
      >
        No accounts added yet.
      </p>
      <div
        v-for="(account, index) in accounts"
        :key="index + account.name + account.secret"
        :class="[
          'px-3 py-2 rounded-lg flex justify-between items-center shadow-embossed-light',
          { 'bg-white': !isDarkMode, 'bg-gray-800': isDarkMode },
        ]"
      >
        <div class="flex-grow">
          <!-- Edit mode -->
          <div v-if="editingIndex === index" class="flex items-center gap-2">
            <input
              v-model="editedName"
              type="text"
              :class="[
                'flex-grow px-2 py-1 rounded-md focus:outline-none focus:ring-2 transition-colors shadow-embossed-light',
                {
                  'bg-gray-100 text-gray-800 focus:ring-gray-500': !isDarkMode,
                  'bg-gray-700 text-white focus:ring-gray-500': isDarkMode,
                },
              ]"
              @keyup.enter="saveEdit"
              @keyup.esc="cancelEdit"
            />
            <button
              @click="saveEdit"
              :class="[
                'p-1 rounded-full focus:outline-none transition-colors shadow-embossed-light',
                {
                  'text-green-600 hover:bg-gray-100 focus:ring-green-300':
                    !isDarkMode,
                  'text-green-500 hover:bg-gray-700 focus:ring-green-400':
                    isDarkMode,
                },
              ]"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke-width="1.5"
                stroke="currentColor"
                class="size-4"
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
              :class="[
                'p-1 rounded-full focus:outline-none transition-colors shadow-embossed-light',
                {
                  'text-gray-500 hover:bg-gray-100 focus:ring-gray-300':
                    !isDarkMode,
                  'text-gray-400 hover:bg-gray-700 focus:ring-gray-500':
                    isDarkMode,
                },
              ]"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke-width="1.5"
                stroke="currentColor"
                class="size-4"
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
              <div class="flex items-center gap-1">
                <button
                  @click="copyToClipboard(index, currentTokens[index]?.token)"
                  :disabled="
                    !currentTokens[index]?.token ||
                    currentTokens[index]?.token === 'Error'
                  "
                  :class="[
                    'relative p-1 rounded-full focus:outline-none transition-colors shadow-embossed-light',
                    {
                      'text-gray-600 hover:bg-gray-100 focus:ring-gray-300':
                        !isDarkMode,
                      'text-gray-300 hover:bg-gray-700 focus:ring-gray-500':
                        isDarkMode,
                    },
                  ]"
                  title="Copy to clipboard"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke-width="1.5"
                    stroke="currentColor"
                    class="size-7"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H9.75"
                    />
                  </svg>
                  <span
                    v-if="copiedIndex === index"
                    class="absolute -top-8 left-1/2 -translate-x-1/2 bg-black text-white text-xs rounded-md px-2 py-1"
                  >
                    Copied!
                  </span>
                </button>

                <h2
                  :class="[
                    'text-2xl font-mono tracking-wider',
                    {
                      'text-gray-700': !isDarkMode,
                      'text-gray-300': isDarkMode,
                    },
                  ]"
                >
                  {{ currentTokens[index]?.token || "..." }}
                </h2>
              </div>
              <div
                v-if="editingIndex !== index"
                class="flex items-center gap-1 ml-3"
              >
                <div class="relative">
                  <button
                    @click="startEditing(index, account.name)"
                    :class="[
                      'ml-2 p-1 rounded-full focus:outline-none transition-colors shadow-embossed-light',
                      {
                        'text-gray-500 hover:bg-gray-100 focus:ring-gray-300':
                          !isDarkMode,
                        'text-gray-400 hover:bg-gray-700 focus:ring-gray-500':
                          isDarkMode,
                      },
                    ]"
                    title="Edit name"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke-width="1.5"
                      stroke="currentColor"
                      class="size-4"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10"
                      />
                    </svg>
                  </button>
                </div>
                <button
                  @click="deleteAccount(index)"
                  :class="[
                    'p-1 rounded-full focus:outline-none transition-colors shadow-embossed-light',
                    {
                      'text-red-500 hover:bg-gray-100 focus:ring-red-300':
                        !isDarkMode,
                      'text-red-500 hover:bg-gray-700 focus:ring-red-400':
                        isDarkMode,
                    },
                  ]"
                  title="Delete account"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke-width="1.5"
                    stroke="currentColor"
                    class="size-4"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
                    />
                  </svg>
                </button>
                <button
                  v-if="account.activePath !== currentHostname"
                  @click="focusHostName(index)"
                  :class="[
                    'p-1 rounded-full focus:outline-none transition-colors shadow-embossed-light',
                    {
                      'text-gray-500 hover:bg-gray-100 focus:ring-gray-300':
                        !isDarkMode,
                      'text-gray-400 hover:bg-gray-700 focus:ring-gray-500':
                        isDarkMode,
                    },
                  ]"
                  title="Pin the current domain name"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke-width="1.5"
                    stroke="currentColor"
                    class="size-4"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M13.181 8.68a4.503 4.503 0 0 1 1.903 6.405m-9.768-2.782L3.56 14.06a4.5 4.5 0 0 0 6.364 6.365l3.129-3.129m5.614-5.615 1.757-1.757a4.5 4.5 0 0 0-6.364-6.365l-4.5 4.5c-.258.26-.479.541-.661.84m1.903 6.405a4.495 4.495 0 0 1-1.242-.88 4.483 4.483 0 0 1-1.062-1.683m6.587 2.345 5.907 5.907m-5.907-5.907L8.898 8.898M2.991 2.99 8.898 8.9"
                    />
                  </svg>
                </button>
                <button
                  v-else
                  @click="unFocusHostName(index)"
                  :class="[
                    'p-1 rounded-full focus:outline-none transition-colors shadow-embossed-light',
                    {
                      'text-green-600 hover:bg-gray-100 focus:ring-green-300':
                        !isDarkMode,
                      'text-green-500 hover:bg-gray-700 focus:ring-green-400':
                        isDarkMode,
                    },
                  ]"
                  title="Unpin the current domain name"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke-width="1.5"
                    stroke="currentColor"
                    class="size-4"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244"
                    />
                  </svg>
                </button>
              </div>
            </div>
            <div class="flex items-end gap-1 justify-between">
              <h4
                :class="[
                  'w-0 text-sm font-medium overflow-hidden text-ellipsis flex-1 flex-nowrap text-nowrap',
                  { 'text-gray-600': !isDarkMode, 'text-gray-400': isDarkMode },
                ]"
              >
                <span>
                  {{ account.name }}
                </span>
                <div
                  :class="[
                    'text-xs overflow-hidden text-ellipsis',
                    {
                      'text-gray-500': !isDarkMode,
                      'text-gray-400': isDarkMode,
                    },
                  ]"
                  v-if="!!account.activePath"
                >
                  Pin:
                  {{ account.activePath }}
                </div>
              </h4>
              <CircularProgress
                :remaining-time="currentTokens[index]?.remainingTime"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style>
/* Using Tailwind CSS classes, so no scoped styles are needed here */
</style>

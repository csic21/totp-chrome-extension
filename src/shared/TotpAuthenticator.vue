<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from "vue";
import AddAccountModal from "../components/AddAccountModal.vue";
import QrScanner from "../components/QrScanner.vue";
import AddMenu from "../components/AddMenu.vue";
import CircularProgress from "../components/CircularProgress.vue";
import vaultLabelLight from "../assets/Vault_iOS_Label.svg";
import vaultLabelDark from "../assets/Vault_iOS_Label_Dark.svg";
import {
  generateAllTokens,
  validateBase32Secret,
  type TotpAccounts,
} from "../lib/totp";
import QRCode from "qrcode";
import {
  isDarkMode,
  isAutoMode,
  toggleTheme,
  toggleAutoMode,
} from "../composables/useTheme";

const accounts = ref<TotpAccounts>([]);
const currentTokens = ref<{ token: string; remainingTime: number }[]>([]);
const isModalOpen = ref(false);
const isQrScannerOpen = ref(false);
const showQRCode = ref(false);
const selectedAccountForQR = ref<{ name: string; secret: string } | null>(null);
const qrCodeDataUrl = ref("");
const copiedIndex = ref<number | null>(null);
const editingIndex = ref<number | null>(null);
const pendingDeleteIndex = ref<number | null>(null);
const currentHostname = ref<string | undefined>();
const isContentOverflowing = ref(false);
type InfoPopoverKey = "hero" | "refresh";

const openInfoPopover = ref<InfoPopoverKey | null>(null);
const heroInfoRef = ref<HTMLElement | null>(null);
const refreshInfoRef = ref<HTMLElement | null>(null);

let intervalId: number | undefined;
let copiedResetTimeoutId: number | undefined;

const activeHostCount = computed(
  () =>
    accounts.value.filter(
      (account) => account.activePath === currentHostname.value,
    ).length,
);
const currentHostLabel = computed(
  () => currentHostname.value || "No active domain detected",
);
const currentDomainAccounts = computed(() =>
  accounts.value
    .map((account, index) => ({
      index,
      account,
      token: currentTokens.value[index]?.token,
    }))
    .filter((item) => item.account.activePath === currentHostname.value),
);
const pendingDeleteAccount = computed(() =>
  pendingDeleteIndex.value !== null
    ? accounts.value[pendingDeleteIndex.value] || null
    : null,
);

const getCurrentTabHostname = async (): Promise<string | undefined> => {
  try {
    const [activeTab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (activeTab?.url) {
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
    if (asort !== bsort) {
      return asort - bsort;
    }

    const aOrigin = a.originIndex ?? Number.MAX_SAFE_INTEGER;
    const bOrigin = b.originIndex ?? Number.MAX_SAFE_INTEGER;
    return aOrigin - bOrigin;
  });
  updateAllTokens();
};

const getStorageAccounts = async () => {
  const result = await chrome.storage.sync.get("totpAccounts");
  let storedAccounts: TotpAccounts = result.totpAccounts;

  if (storedAccounts && !Array.isArray(storedAccounts)) {
    console.log("Migrating data from object to array format...");
    storedAccounts = Object.entries(storedAccounts).map(
      ([name, account]: [string, any]) => ({
        name,
        secret: account.secret,
      }),
    );
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
  if (!validateBase32Secret(secret)) {
    alert(
      "Invalid secret key format. Please enter a valid Base32 encoded secret.",
    );
    return;
  }

  accounts.value.push({ name, secret });
  cancelEdit();
  await saveAccounts();
  updateAllTokens();
  isModalOpen.value = false;
};

const handleAccountUpdated = async ({
  name,
  secret,
}: {
  name: string;
  secret: string;
}) => {
  if (editingIndex.value === null) return;

  const currentAccount = accounts.value[editingIndex.value];
  accounts.value[editingIndex.value] = {
    ...currentAccount,
    name,
    secret: secret || currentAccount.secret,
  };
  await saveAccounts();
  updateAllTokens();
  cancelEdit();
};

const handleQrScanSuccess = async ({
  name,
  secret,
}: {
  name: string;
  secret: string;
}) => {
  if (!validateBase32Secret(secret)) {
    alert(
      "Invalid secret key format. Please enter a valid Base32 encoded secret.",
    );
    return;
  }

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

const requestDeleteAccount = (index: number) => {
  pendingDeleteIndex.value = index;
};

const cancelDeleteAccount = () => {
  pendingDeleteIndex.value = null;
};

const confirmDeleteAccount = async () => {
  if (pendingDeleteIndex.value === null) return;

  const index = pendingDeleteIndex.value;
  pendingDeleteIndex.value = null;
  await deleteAccount(index);
};

const updateAllTokens = () => {
  currentTokens.value = generateAllTokens(accounts.value);
};

const checkContentOverflow = () => {
  const element = document.querySelector(".totp-container");
  if (!element) return;

  const rect = element.getBoundingClientRect();
  const viewportHeight = window.innerHeight;
  isContentOverflowing.value = rect.height > viewportHeight * 0.8;
};

const openGitHub = () => {
  window.open("https://github.com/csic21/totp-chrome-extension", "_blank");
};

const toggleInfoPopover = (key: InfoPopoverKey) => {
  if (openInfoPopover.value === key) {
    openInfoPopover.value = null;
    return;
  }

  openInfoPopover.value = key;
};

const handleClickOutside = (event: MouseEvent) => {
  if (!openInfoPopover.value) return;

  const target = event.target as Node | null;
  const activeRoot =
    openInfoPopover.value === "hero"
      ? heroInfoRef.value
      : refreshInfoRef.value;

  if (target && activeRoot && !activeRoot.contains(target)) {
    openInfoPopover.value = null;
  }
};

const startEditing = (index: number) => {
  editingIndex.value = index;
};

const focusHostName = (index: number) => {
  accounts.value[index].activePath = currentHostname.value;
  saveAccounts();
};

const unFocusHostName = (index: number) => {
  accounts.value[index].activePath = undefined;
  saveAccounts();
};

const cancelEdit = () => {
  editingIndex.value = null;
};

const copyToClipboard = async (index: number, text: string) => {
  if (!text || text === "Error") return;

  try {
    await navigator.clipboard.writeText(text);
    copiedIndex.value = index;

    if (copiedResetTimeoutId) {
      clearTimeout(copiedResetTimeoutId);
    }

    copiedResetTimeoutId = window.setTimeout(() => {
      copiedIndex.value = null;
      copiedResetTimeoutId = undefined;
    }, 2000);
  } catch (err) {
    console.error("Failed to copy: ", err);
    alert("Failed to copy to clipboard.");
  }
};

const openQrScanner = () => {
  isQrScannerOpen.value = true;
};

const copyCurrentDomainAccount = (index: number, token: string) => {
  copyToClipboard(index, token);
};

const generateQRCode = async (name: string, secret: string) => {
  try {
    const otpUri = `otpauth://totp/${encodeURIComponent(name)}?secret=${secret}&algorithm=SHA1&digits=6&period=30`;
    const dataUrl = await QRCode.toDataURL(otpUri, {
      width: 256,
      margin: 2,
      color: {
        dark: isDarkMode.value ? "#ffffff" : "#000000",
        light: isDarkMode.value ? "#1f2937" : "#ffffff",
      },
    });
    qrCodeDataUrl.value = dataUrl;
    selectedAccountForQR.value = { name, secret };
    showQRCode.value = true;
  } catch (err) {
    console.error("Failed to generate QR code: ", err);
    alert("Failed to generate QR code.");
  }
};

const closeQRCode = () => {
  showQRCode.value = false;
  selectedAccountForQR.value = null;
  qrCodeDataUrl.value = "";
};

onMounted(() => {
  loadAccounts();
  intervalId = setInterval(updateAllTokens, 1000) as unknown as number;
  document.addEventListener("click", handleClickOutside);

  nextTick(() => {
    checkContentOverflow();
    window.addEventListener("resize", checkContentOverflow);
  });
});

onUnmounted(() => {
  if (intervalId) {
    clearInterval(intervalId);
  }
  if (copiedResetTimeoutId) {
    clearTimeout(copiedResetTimeoutId);
  }
  document.removeEventListener("click", handleClickOutside);
  window.removeEventListener("resize", checkContentOverflow);
});
</script>

<template>
  <div
    class="auth-shell totp-container"
    :class="{ 'auth-shell--scroll': isContentOverflowing }"
  >
    <div class="topbar">
      <div class="topbar__header">
        <div class="hero-block">
          <div class="hero-label">
            <img
              class="hero-label__logo"
              :src="isDarkMode ? vaultLabelDark : vaultLabelLight"
              alt=""
            />
            TOTP Authenticator
          </div>
        </div>

        <div ref="heroInfoRef" class="info-trigger">
          <button
            class="icon-button icon-button--tip"
            title="How it works"
            @click.stop="toggleInfoPopover('hero')"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="1.5"
              stroke="currentColor"
              class="info-trigger__icon"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M12 9v3.75m0 3.75h.008v.008H12v-.008ZM21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
              />
            </svg>
          </button>
          <div v-if="openInfoPopover === 'hero'" class="info-popover">
            <p class="info-popover__title">How it works</p>
            <p class="info-popover__copy">
              Add secrets manually, scan QR codes, and pin accounts to the current
              domain so the right codes stay at the top when you need to copy them.
            </p>
          </div>
        </div>
      </div>

      <div class="topbar__actions">
        <div class="theme-toggle">
          <span class="theme-toggle__label">Auto</span>
          <button
            class="toggle-track"
            :class="{ 'is-active': isAutoMode }"
            title="Toggle auto theme"
            @click="toggleAutoMode"
          >
            <span class="toggle-track__thumb"></span>
          </button>
        </div>

        <button class="icon-button" title="Toggle dark mode" @click="toggleTheme">
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

        <button class="icon-button" title="View on GitHub" @click="openGitHub">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            class="size-5"
          >
            <path
              d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2Z"
            />
          </svg>
        </button>

        <AddMenu
          :is-dark-mode="isDarkMode"
          @add-account="isModalOpen = true"
          @scan-qr="openQrScanner"
        />
      </div>
    </div>

    <div v-if="currentDomainAccounts.length > 0" class="summary-grid">
      <div class="summary-card summary-card--domain">
        <div class="summary-card__label">Current Domain</div>
        <div class="summary-card__value summary-card__value--domain">
          {{ currentHostLabel }}
        </div>
        <div class="summary-card__meta">
          {{ activeHostCount }} pinned account(s) match this site.
        </div>
        <div class="summary-card__actions">
          <div class="summary-card__hint">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="1.5"
              stroke="currentColor"
              class="size-4 shrink-0"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25"
              />
            </svg>
            Tap an account below to copy the current code.
          </div>
          <div class="summary-card__choices">
            <button
              v-for="item in currentDomainAccounts"
              :key="item.index + item.account.secret"
              class="summary-card__choice"
              :class="{ 'is-copied': copiedIndex === item.index }"
              :disabled="!item.token || item.token === 'Error'"
              @click="copyCurrentDomainAccount(item.index, item.token || '')"
            >
              <span class="summary-card__choice-name">
                {{ item.account.name }}
              </span>
              <span class="summary-card__choice-token">
                {{ copiedIndex === item.index ? "Copied" : item.token || "......" }}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="surface-section mt-3 p-5 md:p-6">
      <div class="section-header">
        <div ref="refreshInfoRef" class="section-header__main">
          <div class="section-title-row">
            <h2 class="section-title">Your Accounts</h2>
            <div class="info-trigger">
              <button
                class="icon-button icon-button--tip icon-button--tip-compact"
                title="Refresh info"
                @click.stop="toggleInfoPopover('refresh')"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke-width="1.5"
                  stroke="currentColor"
                  class="info-trigger__icon"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M12 9v3.75m0 3.75h.008v.008H12v-.008ZM21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                />
              </svg>
            </button>
            </div>
            <div
              v-if="openInfoPopover === 'refresh'"
              class="info-popover info-popover--header-width info-popover--card-width"
            >
              <p class="info-popover__title">Refresh</p>
              <p class="info-popover__copy">
                Tokens refresh automatically every 30 seconds.
              </p>
            </div>
          </div>
        </div>
        <div class="status-pill">
          <span class="status-pill__dot"></span>
          Live refresh
        </div>
      </div>

      <div class="account-list">
        <div v-if="accounts.length === 0" class="empty-state">
          No accounts added yet. Use the Add button to create one or import from
          a QR code.
        </div>

        <div
          v-for="(account, index) in accounts"
          v-else
          :key="index + account.name + account.secret"
          class="account-card"
        >
          <div class="account-card__top">
            <div class="account-card__token-group">
              <div class="min-w-0">
                <p class="token-display">
                  {{ currentTokens[index]?.token || "..." }}
                </p>
                <h3 class="account-card__name">{{ account.name }}</h3>
                <div
                  v-if="account.activePath && account.activePath !== currentHostname"
                  class="account-card__meta"
                >
                  Pinned: {{ account.activePath }}
                </div>
              </div>
            </div>

            <button
              class="icon-button account-card__copy-button"
              :disabled="
                !currentTokens[index]?.token ||
                currentTokens[index]?.token === 'Error'
              "
              title="Copy to clipboard"
              @click="copyToClipboard(index, currentTokens[index]?.token)"
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
              <span v-if="copiedIndex === index" class="tooltip">Copied</span>
            </button>
          </div>

          <div class="account-card__actions">
            <div class="account-card__actions-main">
              <button
                class="icon-button"
                title="Show QR code"
                @click="generateQRCode(account.name, account.secret)"
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
                    d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 3.75 9.375v-4.5ZM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 0 1-1.125-1.125v-4.5ZM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 13.5 9.375v-4.5Z"
                  />
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M6.75 6.75h.75v.75h-.75v-.75ZM6.75 16.5h.75v.75h-.75v-.75ZM16.5 6.75h.75v.75h-.75v-.75ZM13.5 13.5h.75v.75h-.75v-.75ZM13.5 19.5h.75v.75h-.75v-.75ZM19.5 13.5h.75v.75h-.75v-.75ZM19.5 19.5h.75v.75h-.75v-.75ZM16.5 16.5h.75v.75h-.75v-.75Z"
                  />
                </svg>
              </button>

              <button
                class="icon-button"
                title="Edit account"
                @click="startEditing(index)"
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

                <button
                  class="icon-button icon-button--danger"
                  title="Delete account"
                  @click="requestDeleteAccount(index)"
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
                class="icon-button"
                title="Pin the current domain name"
                @click="focusHostName(index)"
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
                class="icon-button icon-button--success"
                title="Unpin the current domain name"
                @click="unFocusHostName(index)"
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

            <CircularProgress
              :remaining-time="currentTokens[index]?.remainingTime"
            />
          </div>
        </div>
      </div>
    </div>

    <AddAccountModal
      v-if="isModalOpen"
      :is-dark-mode="isDarkMode"
      @submit="handleAccountAdded"
      @close="isModalOpen = false"
    />

    <AddAccountModal
      v-if="editingIndex !== null"
      :is-dark-mode="isDarkMode"
      mode="edit"
      :initial-name="accounts[editingIndex]?.name || ''"
      @submit="handleAccountUpdated"
      @close="cancelEdit"
    />

    <QrScanner
      v-if="isQrScannerOpen"
      :is-dark-mode="isDarkMode"
      @scan-success="handleQrScanSuccess"
      @close="isQrScannerOpen = false"
    />

    <Teleport to="body">
      <div
        v-if="pendingDeleteIndex !== null"
        class="modal-backdrop"
        @click.self="cancelDeleteAccount"
      >
        <div class="modal-card">
          <h3 class="modal-title">Delete Account?</h3>
          <p class="modal-copy">
            This will remove
            <strong>{{ pendingDeleteAccount?.name || "this account" }}</strong>
            from your saved TOTP list.
          </p>
          <p class="modal-copy">This action cannot be undone.</p>

          <div class="form-actions form-actions--stacked">
            <button
              class="pill-button pill-button--danger"
              @click="confirmDeleteAccount"
            >
              Delete
            </button>
            <button
              class="pill-button pill-button--secondary"
              @click="cancelDeleteAccount"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <Teleport to="body">
      <div
        v-if="showQRCode"
        class="modal-backdrop"
        @click.self="closeQRCode"
      >
        <div class="modal-card">
          <button class="icon-button modal-close" @click="closeQRCode">
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

          <div>
            <h3 class="modal-title text-[22px]">
              {{ selectedAccountForQR?.name }}
            </h3>
            <p class="modal-copy">Scan with your phone to import this account.</p>
          </div>

          <div class="qr-preview mt-5">
            <img :src="qrCodeDataUrl" alt="QR Code" class="rounded-2xl" />
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

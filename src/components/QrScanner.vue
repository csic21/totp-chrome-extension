<script setup lang="ts">
import { ref } from "vue";
import jsQR from "jsqr";
import base32Encode from "base32-encode";
import { MigrationPayload } from "../lib/google-migration";

defineProps({
  isDarkMode: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(["scan-success", "close"]);
const fileInput = ref<HTMLInputElement | null>(null);
const errorMessage = ref("");
const isProcessing = ref(false);

function triggerFileSelect() {
  fileInput.value?.click();
}

const handleFileUpload = (event: Event) => {
  const target = event.target as HTMLInputElement;
  if (!target.files || target.files.length === 0) return;

  const file = target.files[0];
  if (!file.type.startsWith("image/")) {
    errorMessage.value = "Please select an image file";
    return;
  }

  processImageFile(file);
};

const processImageFile = (file: File) => {
  isProcessing.value = true;
  errorMessage.value = "";

  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        errorMessage.value = "Unable to create image processing context";
        isProcessing.value = false;
        return;
      }

      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);

      if (code) {
        handleQrCodeResult(code.data);
      } else {
        errorMessage.value = "No QR code found in the image";
      }

      isProcessing.value = false;
    };

    img.onerror = () => {
      errorMessage.value = "Unable to load image file";
      isProcessing.value = false;
    };

    img.src = e.target?.result as string;
  };

  reader.onerror = () => {
    errorMessage.value = "Unable to read file";
    isProcessing.value = false;
  };

  reader.readAsDataURL(file);
};

const scanCurrentTab = async () => {
  isProcessing.value = true;
  errorMessage.value = "";

  try {
    const response = await chrome.runtime.sendMessage({
      action: "scanCurrentTab",
    });
    const base64Image = response.data;

    if (base64Image) {
      const res = await fetch(base64Image);
      const blob = await res.blob();
      const file = new File([blob], "screenshot.png", { type: blob.type });
      processImageFile(file);
    } else {
      errorMessage.value = response.error || "Failed to scan current tab";
    }
  } catch (error: any) {
    console.error("Error scanning current tab:", error);
    errorMessage.value = error.message || "Failed to scan current tab";
  } finally {
    isProcessing.value = false;
  }
};

const handleGoogleMigration = (data: string) => {
  const buffer = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
  const payload = MigrationPayload.deserializeBinary(buffer);
  payload.toObject().otp_parameters?.forEach((element) => {
    if (element.secret) {
      const secret = base32Encode(element.secret as Uint8Array, "RFC4648", {
        padding: false,
      });
      const name = element.issuer
        ? `${element.issuer}: ${element.name}`
        : element.name;
      emit("scan-success", {
        name,
        secret,
      });
    }
  });
};

const handleQrCodeResult = (data: string) => {
  try {
    const url = new URL(data);
    if (url.protocol === "otpauth:" && url.hostname === "totp") {
      const issuerAndAccount = url.pathname.substring(1);
      const params = new URLSearchParams(url.search);
      const secret = params.get("secret");

      if (secret) {
        let issuer = "";
        let account = issuerAndAccount;

        if (issuerAndAccount.includes(":")) {
          [issuer, account] = issuerAndAccount.split(":", 2);
        }

        if (params.get("issuer")) {
          issuer = params.get("issuer") || "";
        }

        const name = issuer ? `${issuer}: ${account}` : account;

        emit("scan-success", {
          name,
          secret,
        });
        return;
      }
    }

    if (url.protocol === "otpauth-migration:") {
      handleGoogleMigration(url.searchParams.get("data") || "");
      return;
    }

    errorMessage.value = "QR code is not a valid TOTP authentication URI";
  } catch (err) {
    console.error("Error parsing QR code:", err);
    errorMessage.value = "Unable to parse QR code content";
  }
};

const closeScanner = () => {
  emit("close");
};
</script>

<template>
  <Teleport to="body">
    <div class="modal-backdrop">
      <div class="modal-card">
        <h2 class="modal-title">Scan QR Code</h2>
        <p class="modal-copy">
          Upload a QR image or capture the active page to import TOTP accounts.
        </p>

        <div class="form-stack">
          <button class="dropzone" @click="triggerFileSelect">
            <span class="dropzone__icon">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke-width="1.5"
                stroke="currentColor"
                class="size-6"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l1.409 1.409m0 0 2.409-2.409a2.25 2.25 0 0 1 3.182 0L21.75 14.25m-9.75-2.25h.008v.008H12V12ZM3.75 19.5h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Z"
                />
              </svg>
            </span>
            <p class="dropzone__title">Select QR Code Image</p>
            <p class="dropzone__copy">
              Supports JPG, PNG, and GIF files with visible TOTP QR codes.
            </p>
          </button>

          <input
            ref="fileInput"
            type="file"
            accept="image/*"
            class="hidden"
            @change="handleFileUpload"
          />
        </div>

        <div v-if="isProcessing" class="feedback-text">
          <span class="spinner"></span>
          <div class="mt-3">Processing image...</div>
        </div>

        <div v-if="errorMessage" class="feedback-text feedback-text--error">
          {{ errorMessage }}
        </div>

        <div v-if="!errorMessage && !isProcessing" class="feedback-text">
          Select an image file or scan the current page for a TOTP QR code.
        </div>

        <div class="form-actions">
          <button
            class="pill-button pill-button--primary"
            :disabled="isProcessing"
            @click="scanCurrentTab"
          >
            Scan Page
          </button>
          <button class="pill-button pill-button--secondary" @click="closeScanner">
            Cancel
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

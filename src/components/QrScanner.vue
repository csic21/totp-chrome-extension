<script setup lang="ts">
import { ref } from "vue";
import jsQR from "jsqr";
import base32Encode from "base32-encode";
import { MigrationPayload } from "../lib/google-migration";
const emit = defineEmits(["scan-success", "close"]);
const fileInput = ref<HTMLInputElement | null>(null);
const errorMessage = ref("");
const isProcessing = ref(false);

// Trigger file selection
const triggerFileSelect = () => {
  if (fileInput.value) {
    fileInput.value.click();
  }
};

// Handle file upload
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

// Process image file
const processImageFile = (file: File) => {
  isProcessing.value = true;
  errorMessage.value = "";

  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      // Create canvas to process image
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        errorMessage.value = "Unable to create image processing context";
        isProcessing.value = false;
        return;
      }

      // Set canvas dimensions
      canvas.width = img.width;
      canvas.height = img.height;

      // Draw image to canvas
      ctx.drawImage(img, 0, 0);

      // Get image data
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      // Use jsQR to recognize QR code
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

// Scan current tab for QR code
const scanCurrentTab = async () => {
  isProcessing.value = true;
  errorMessage.value = "";

  try {
    // Send message to background script to capture visible tab
    const response = await chrome.runtime.sendMessage({
      action: "scanCurrentTab",
    });
    const base64Image = response.data;
    if (base64Image) {
      // BASE64 TO FILE
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

// Handle QR code result
const handleQrCodeResult = (data: string) => {
  try {
    // Parse TOTP URI format: otpauth://totp/Example:alice@google.com?secret=JBSWY3DPEHPK3PXP&issuer=Example
    const url = new URL(data);
    console.log(url);
    if (url.protocol === "otpauth:" && url.hostname === "totp") {
      const issuerAndAccount = url.pathname.substring(1); // Remove leading "/"
      const params = new URLSearchParams(url.search);
      const secret = params.get("secret");

      if (secret) {
        // Parse account name and issuer
        let issuer = "";
        let account = issuerAndAccount;

        if (issuerAndAccount.includes(":")) {
          [issuer, account] = issuerAndAccount.split(":", 2);
        }

        // If issuer is in URL params, use it
        if (params.get("issuer")) {
          issuer = params.get("issuer") || "";
        }

        // Combine issuer and account name
        const name = issuer ? `${issuer}: ${account}` : account;

        emit("scan-success", {
          name,
          secret,
        });
        return;
      }
    }
    if (url.protocol === "otpauth-migration:") {
      // is google migration
      handleGoogleMigration(url.searchParams.get("data") || "");
      return;
    }

    errorMessage.value = "QR code is not a valid TOTP authentication URI";
  } catch (err) {
    console.error("Error parsing QR code:", err);
    errorMessage.value = "Unable to parse QR code content";
  }
};

// Close scanner
const closeScanner = () => {
  emit("close");
};
</script>

<template>
  <div
    class="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-50 p-4"
  >
    <div class="bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-sm">
      <h2 class="text-xl font-bold text-gray-200 mb-4">Scan QR Code</h2>

      <div class="mb-4">
        <div
          @click="triggerFileSelect"
          class="border-2 border-dashed border-gray-600 rounded-lg p-6 text-center cursor-pointer hover:border-gray-500 transition-colors mb-3"
        >
          <div class="flex flex-col items-center justify-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-10 w-10 text-gray-500 mb-2"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <p class="text-gray-400 mb-1">Click to select QR code image</p>
            <p class="text-gray-500 text-sm">Supports JPG, PNG, GIF formats</p>
          </div>
        </div>

        <input
          ref="fileInput"
          type="file"
          accept="image/*"
          class="hidden"
          @change="handleFileUpload"
        />
      </div>

      <div v-if="isProcessing" class="text-center mb-4">
        <div
          class="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-gray-300"
        ></div>
        <p class="text-gray-400 mt-2">Processing...</p>
      </div>

      <div v-if="errorMessage" class="text-red-400 text-center mb-4">
        {{ errorMessage }}
      </div>

      <div class="text-gray-400 text-sm text-center mb-4">
        Select an image file or scan the current page for a TOTP QR code
      </div>

      <div class="flex justify-end gap-2">
        <button
          @click="scanCurrentTab"
          :disabled="isProcessing"
          class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors flex-1 disabled:opacity-50"
        >
          Scan Page
        </button>
        <button
          @click="closeScanner"
          class="px-4 py-2 bg-gray-700 text-gray-200 rounded-md hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors flex-1"
        >
          Cancel
        </button>
      </div>
    </div>
  </div>
</template>

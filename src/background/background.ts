// Background script for the extension
// This script runs in the background and can handle events, manage storage, etc.

// Create a context menu item for opening the side panel
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus?.create({
    id: "openSidePanel",
    title: "Open TOTP Authenticator Side Panel",
    contexts: ["action"], // Right-click on the extension icon
  });
});

// Handle context menu clicks
chrome.contextMenus?.onClicked?.addListener((info, _tab) => {
  if (info.menuItemId === "openSidePanel") {
    // Open the side panel
    chrome.windows.getCurrent().then((window) => {
      if (window.id) {
        chrome.sidePanel.open({ windowId: window.id });
      }
    });
  }
});

// Handle messages from content scripts or popup
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.action === "scanCurrentTab") {
    // Capture visible tab and scan for QR code
    captureAndScanTab()
      .then((result) => {
        sendResponse({
          success: true,
          data: result,
        });
      })

      .catch((error) => {
        console.error("Error scanning current tab:", error);
        sendResponse({ success: false, error: error.message });
      });
    // Return true to indicate we will send a response asynchronously
    return true;
  }

  // Return false for unknown messages
  return false;
});

// Function to capture visible tab and scan for QR codes
async function captureAndScanTab(): Promise<string> {
  try {
    // Get the active tab
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (!tab || !tab.id) {
      throw new Error("No active tab found");
    }

    // Capture visible tab
    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
      format: "png",
    });

    // Process the captured image to scan for QR codes
    return dataUrl;
  } catch (error: any) {
    console.error("Error capturing tab:", error);
    throw new Error(`Failed to capture tab: ${error.message}`);
  }
}

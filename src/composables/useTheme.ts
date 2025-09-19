import { ref, onMounted, onUnmounted } from "vue";

const isDarkMode = ref(false);
const isAutoMode = ref(false);

// Apply theme based on localStorage, auto mode, or system preference
const applyTheme = () => {
  const savedAutoMode = localStorage.getItem("autoMode");
  isAutoMode.value = savedAutoMode === "true";

  if (isAutoMode.value) {
    // Auto mode: follow system preference
    isDarkMode.value = window.matchMedia(
      "(prefers-color-scheme: dark)"
    ).matches;
  } else {
    // Manual mode: use saved theme or default to light
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme) {
      isDarkMode.value = savedTheme === "dark";
    } else {
      isDarkMode.value = false;
    }
  }
  document.documentElement.classList.toggle("dark", isDarkMode.value);
};

// Toggle theme and save to localStorage
const toggleTheme = () => {
  // Disable auto mode when manually toggling theme
  if (isAutoMode.value) {
    isAutoMode.value = false;
    localStorage.setItem("autoMode", "false");
  }

  isDarkMode.value = !isDarkMode.value;
  document.documentElement.classList.toggle("dark", isDarkMode.value);
  localStorage.setItem("theme", isDarkMode.value ? "dark" : "light");

  // Dispatch custom event so other parts of the app can react to theme changes
  window.dispatchEvent(
    new CustomEvent("theme-change", { detail: isDarkMode.value })
  );
};

// Toggle auto mode
const toggleAutoMode = () => {
  isAutoMode.value = !isAutoMode.value;
  localStorage.setItem("autoMode", isAutoMode.value.toString());

  if (isAutoMode.value) {
    // When enabling auto mode, apply system preference immediately
    applyTheme();
  }

  // Dispatch custom event so other parts of the app can react to auto mode changes
  window.dispatchEvent(
    new CustomEvent("auto-mode-change", { detail: isAutoMode.value })
  );
};

// Listen for theme changes from other parts of the app
const handleThemeChange = (e: Event) => {
  const event = e as CustomEvent;
  isDarkMode.value = event.detail;
  document.documentElement.classList.toggle("dark", isDarkMode.value);
};

// Listen for storage changes (from other tabs)
const handleStorageChange = (e: StorageEvent) => {
  if (e.key === "theme" || e.key === "autoMode") {
    applyTheme();
  }
};

// Listen for system color scheme changes
const handleSystemThemeChange = (e: MediaQueryListEvent) => {
  if (isAutoMode.value) {
    isDarkMode.value = e.matches;
    document.documentElement.classList.toggle("dark", isDarkMode.value);
    // Dispatch custom event so other parts of the app can react to theme changes
    window.dispatchEvent(
      new CustomEvent("theme-change", { detail: isDarkMode.value })
    );
  }
};

// Initialize theme and media query listener
let mediaQuery: MediaQueryList | null = null;

onMounted(() => {
  applyTheme();
  window.addEventListener("theme-change", handleThemeChange);
  window.addEventListener("storage", handleStorageChange);

  // Set up system color scheme listener
  mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  mediaQuery.addEventListener("change", handleSystemThemeChange);
});

// Clean up event listeners
onUnmounted(() => {
  window.removeEventListener("theme-change", handleThemeChange);
  window.removeEventListener("storage", handleStorageChange);

  if (mediaQuery) {
    mediaQuery.removeEventListener("change", handleSystemThemeChange);
  }
});

export { isDarkMode, isAutoMode, toggleTheme, toggleAutoMode, applyTheme };

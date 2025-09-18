import { ref, onMounted, onUnmounted } from 'vue'

const isDarkMode = ref(false)

// Apply theme based on localStorage or system preference
const applyTheme = () => {
  const savedTheme = localStorage.getItem('theme')
  if (savedTheme) {
    isDarkMode.value = savedTheme === 'dark'
  } else {
    // Default to light mode
    isDarkMode.value = false
  }
  document.documentElement.classList.toggle('dark', isDarkMode.value)
}

// Toggle theme and save to localStorage
const toggleTheme = () => {
  isDarkMode.value = !isDarkMode.value
  document.documentElement.classList.toggle('dark', isDarkMode.value)
  localStorage.setItem('theme', isDarkMode.value ? 'dark' : 'light')
  
  // Dispatch custom event so other parts of the app can react to theme changes
  window.dispatchEvent(new CustomEvent('theme-change', { detail: isDarkMode.value }))
}

// Listen for theme changes from other parts of the app
const handleThemeChange = (e: Event) => {
  const event = e as CustomEvent
  isDarkMode.value = event.detail
  document.documentElement.classList.toggle('dark', isDarkMode.value)
}

// Listen for storage changes (from other tabs)
const handleStorageChange = (e: StorageEvent) => {
  if (e.key === 'theme') {
    applyTheme()
  }
}

// Initialize theme
onMounted(() => {
  applyTheme()
  window.addEventListener('theme-change', handleThemeChange)
  window.addEventListener('storage', handleStorageChange)
})

// Clean up event listeners
onUnmounted(() => {
  window.removeEventListener('theme-change', handleThemeChange)
  window.removeEventListener('storage', handleStorageChange)
})

export { isDarkMode, toggleTheme, applyTheme }
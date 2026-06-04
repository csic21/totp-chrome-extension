(() => {
  try {
    const isAutoMode = localStorage.getItem("autoMode") === "true";
    const savedTheme = localStorage.getItem("theme");
    const prefersDark =
      window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
    const isDarkMode = isAutoMode ? prefersDark : savedTheme === "dark";

    document.documentElement.classList.toggle("dark", isDarkMode);
  } catch {
    document.documentElement.classList.remove("dark");
  }
})();

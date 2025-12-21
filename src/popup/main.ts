import { createApp } from "vue";
import App from "./App.vue";
import "../style.css";
import { setupTheme } from "../composables/useTheme";

setupTheme();

createApp(App).mount("#app");

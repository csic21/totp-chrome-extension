import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/**/*.{test,spec}.{ts,js}'],
    coverage: {
      reporter: ['text', 'json', 'html'],
    },
  },
})
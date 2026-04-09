# Repository Guidelines

## Project Structure & Module Organization

This repository is a Vue 3 + TypeScript browser extension built with Vite and CRXJS. Core extension entry points live in `src/popup`, `src/sidepanel`, and `src/background`. Shared UI is in `src/shared` and reusable components are in `src/components`. Business logic such as TOTP generation and Google Authenticator migration parsing lives in `src/lib`. Static extension assets and the Chrome manifest are under `public/`.

## Build, Test, and Development Commands

- `pnpm install`: install dependencies.
- `pnpm run dev`: start the Vite dev server for local UI work.
- `pnpm run build`: run `vue-tsc` type checking and produce the extension build.
- `pnpm run preview`: preview the built app locally.
- `pnpm test`: run the Vitest suite.
- `pnpm run test:ui`: open the Vitest UI for interactive debugging.

## Coding Style & Naming Conventions

Follow the existing codebase style: TypeScript, Vue Single File Components, 2-space indentation, semicolons, and double quotes. Use `PascalCase` for Vue components such as `AddAccountModal.vue`, `camelCase` for functions, and `useXxx` for composables such as `useTheme.ts`. Keep feature logic close to its entry point, but move reusable logic into `src/lib` or `src/shared` instead of duplicating it across popup and sidepanel code.

## Testing Guidelines

Tests use Vitest with the pattern `src/**/*.{test,spec}.{ts,js}`. Add tests next to the code they cover, for example `src/lib/google-migration.test.ts`. Prefer focused unit tests around token generation, QR parsing, and migration import logic. Run `pnpm test` before opening a PR.

## Commit & Pull Request Guidelines

Recent history follows Conventional Commit-style prefixes such as `feat:`, `perf:`, and `style(...)`. Keep commit messages short and imperative, for example `feat: add sidepanel account sorting`. PRs should include a concise summary, note any manifest or permission changes, link related issues, and attach screenshots or short recordings for popup or sidepanel UI changes.

## Security & Configuration Tips

Treat TOTP secrets as sensitive user data. Do not log secrets, check exported account data into git, or hardcode sample credentials in `public/manifest.json` or source files.

# Design & UX Guidelines

All UI must follow DESIGN.md. Do not invent new colors/typography outside the spec.

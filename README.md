# TOTP Authenticator Extension

A simple and clean Time-based One-Time Password (TOTP) authenticator browser extension.

![GitHub stars](https://img.shields.io/github/stars/csic21/totp-chrome-extension?style=social)

## Features

- Add and manage TOTP accounts.
- Generates TOTP codes.
- Copy codes to clipboard.
- QR code scanning from image files or directly from the current webpage.

## Development

- Built with Vue 3, Vite, and Tailwind CSS.
- Uses `otpauth` for TOTP generation.
- Uses `jsQR` for QR code scanning.

### Setup

```bash
# Install dependencies
pnpm install

# Run the development server
pnpm run dev

# Build the extension
pnpm run build
```

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=totp-chrome-extension/totp-chrome-extension&type=Date)](https://www.star-history.com/#totp-chrome-extension/totp-chrome-extension&Date)

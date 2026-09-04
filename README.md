# ZenRyn

ZenRyn is a high-performance Discord server backup, export, and import bot built with Node.js and TypeScript. It compiles to standalone native distribution executables for Termux (Android ARM64), Linux, Windows, and macOS without requiring Node.js, npm, or node_modules installed at runtime.

## Project Structure

- `src/bot/commands`: Command registration & interaction logic (`/zynren`, `/zynren export`, `/zynren import`, `/zynren funnycommand`).
- `src/discord`: Isolated Discord API fetching and server restoration engine.
- `src/storage`: Versioned `.zynren` backup container serialization, compression, and verification.
- `src/security`: Authorization checks and cryptographic integrity validation.
- `src/config`: Environment and variable configuration system.
- `src/utils`: Secure temporary directory creation and file sanitization utilities.
- `tests`: Automated unit tests covering format validation, integrity verification, and malformed input handling.
- `scripts`: Standalone cross-platform distribution bundler.

## Commands

- `/zynren export`: Administrator-only. Collects server structure, roles, channels, emojis, stickers, and AutoMod rules, serializes into a single `.zynren` file, and sends via DM (or ephemeral fallback).
- `/zynren import`: Administrator-only. Validates backup integrity and restores server roles, categories, channels, permissions, emojis, stickers, and AutoMod rules.
- `/zynren funnycommand`: Harmless randomized responses available to all users.

## Environment Variables

- `ZENRYN_TOKEN`: Discord Bot Token (Required).
- `ZENRYN_MAX_BACKUP_SIZE`: Max backup file size limit in bytes (Default: 100MB).
- `ZENRYN_TEMP_DIR`: Directory for temporary files.
- `ZENRYN_COMPRESSION_LEVEL`: Gzip compression level (Default: 6).

## Development & Build Commands

```bash
npm test
npm run build
```

The standalone distribution binary will be output to `bin/zenryn-termux-arm64`.

## License

MIT

v1.0.01.003

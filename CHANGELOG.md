# Changelog

## 0.1.0 — 2026-09-08

- Rebuilt the standalone MCP server in strict TypeScript with MCP SDK 2 and Zod 4.
- Added dynamic discovery with TTL caching and centralized capability/family routing.
- Added vision and image tools with chat, images and conservative auto adapters.
- Added bounded response/image reads, safe errors, mock tests and cross-platform CI.
- Preserved explicit file reads and exact edits with audit output.
- Breaking migration: credentials are environment-only; file tasks require workspace_root. Removed test_files execution, implicit workspace and Codex credential fallback. server.mjs is a build-dependent compatibility launcher.
- Added release, configuration, security and contribution documentation.

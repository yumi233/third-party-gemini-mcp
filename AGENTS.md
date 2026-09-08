# Project instructions

This is an unofficial standalone OpenAI-compatible MCP server.

- Use strict TypeScript, MCP SDK 2 public APIs and Zod 4.
- Read proxy credentials only from GEMINI_PROXY_BASE_URL and GEMINI_PROXY_API_KEY.
- Never embed actual credentials, internal addresses or personal paths in source, fixtures or documentation.
- Keep version-independent model policy in src/models/routing.ts and discovery in its own module.
- Do not execute model-provided shell commands. Preserve explicit caller file authorization and partial-edit audit reporting.
- Do not automatically retry paid POST requests or silently change models on error.
- Use mock APIs by default. Run build, lint and tests for behavior changes; add regression coverage for safety boundaries.
- Keep stdout reserved for MCP framing. Do not log provider response bodies, headers or raw filesystem errors.
- Do not publish or push without explicit user authorization.

# Security policy

This is a local stdio MCP server for trusted hosts and trusted proxy operators. It is not an OS sandbox or a multi-user service. The current maintained line is 0.1.x.

- API URL and Key come only from the two documented environment variables. No Codex credential discovery occurs.
- HTTP errors do not include provider response bodies or request headers. Unexpected exceptions use generic messages. Exact configured Key occurrences in successful responses and file-tool messages are redacted; this is not a universal secret scanner. Do not submit other secrets as prompts or file content.
- HTTP is accepted for locally operated proxies; use HTTPS for remote traffic. HTTP transmits credentials without TLS protection.
- Prompts, allowed file contents and local vision images are sent to the configured provider. Image URLs are passed to that provider, which controls fetching and its own network policy.
- The MCP caller grants file access by explicit path and allowlist. The model cannot widen the allowlist. Dotfiles, common credential files, traversal and links are denied. Exact edits can be partially completed; they are not transactions. Keep backups or version control.
- Path checks and bounded reads reduce abuse but do not prevent a hostile local process racing filesystem changes between checks and opens. Do not use shared, attacker-writable workspaces. Arbitrary secrets in otherwise allowed files are not automatically detected.
- Image signature validation rejects non-image files but does not fully decode images or limit decoded pixel dimensions. The host must safely render untrusted media. Remote URLs may contain provider-issued signed tokens; treat those outputs as sensitive.
- No shell, subprocess, model-returned code execution or trusted-test runner is exposed. Network calls have time and decoded-byte limits. POST requests are not retried automatically.

Once the repository exists, enable GitHub private vulnerability reporting and use its Security → Report a vulnerability flow. Until that channel is configured, contact the repository owner privately. Do not open public issues containing live credentials, private inputs or exploit payloads. Rotate exposed credentials immediately; deleting a working-tree file does not remove Git history.

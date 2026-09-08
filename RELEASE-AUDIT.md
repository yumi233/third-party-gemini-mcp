# Release audit — 2026-09-08

## Result

The standalone project is prepared for review and local use. No repository was created, no commit was made, and nothing was pushed or published. The existing standalone directory was kept in place; the package name is now gemini-proxy-mcp.

## Architecture and changes

- Migrated the JavaScript worker to strict TypeScript using the confirmed npm stable MCP Server 2.0.0 package and Zod 4.
- Added src/index.ts and src/server.ts; split API, model discovery/routing, tools and image utilities into separate modules.
- Exposed gemini_flash, gemini_vision and image_generate with schemas and MCP annotations.
- Preserved explicit read/exact-edit tasks and partial-edit audit output. Removed implicit workspace selection, Codex credential reads and test_files execution. server.mjs is a compatibility launcher requiring a build.
- Added tests/, scripts/integration.ts, GitHub Actions, environment example, ignore rules, README, MIT license, contributing/security/changelog documents and project instructions.
- Removed old core.mjs, smoke.mjs and test/core.test.mjs after replacing their relevant coverage.

## Verification

- npm install: passed; dependency audit reported zero known vulnerabilities.
- Build and ESLint: passed.
- Automated tests: 25 passed, zero failed, using mock APIs. Includes HTTP errors, timeouts during body reads, size limits, escaped credential redaction, model parsing/routing/cache, image adapters, filesystem access boundaries, partial edits, MCP handshake and the built stdio entrypoint.
- Live integration: dynamic /models discovery and a minimal /chat/completions text request passed using the two existing environment variables. No credentials were printed or stored.
- npm pack dry run: passed; package contents are explicitly limited to compiled output, package metadata and public documentation.
- Working-tree scan included source, fixtures, documentation, lockfile and build output. No exact configured API Key or proxy URL, personal user path/name or private IPv4 address was found. This is a targeted scan, not proof that all possible secrets are absent.
- No .git directory exists, so there was no Git history to audit. Audit full history if files are later imported into another repository.

## Before public release

1. Confirm MIT licensing/copyright ownership, repository name, package name availability and actual repository metadata.
2. Run the Windows/Linux/macOS Node 22/24 GitHub Actions matrix after creating a repository. Only the local Windows environment was run in this session.
3. Verify real vision and image-generation behavior against the intended proxy. Those paths passed mocked tests; live image calls were not made. Select chat/images explicitly when known, or add a provider adapter for a nonstandard response.
4. Check the actual Codex registration. Official documentation access returned HTTP 403, so host configuration examples could not be reverified online. The server's stdio handshake and tool list passed automated tests.
5. Enable a private security reporting channel and review staged files and all history before publishing. Actual credentials and local inputs must remain ignored.

## Remaining boundaries

Without capability metadata, model capabilities are inferred from names. HTTP proxies do not encrypt credentials. Allowed file contents and vision images are sent to the proxy. Caller file permissions are not an OS sandbox, and hostile local filesystem races remain outside this threat model. File edits are not transactional. Signature checks do not fully decode images. Generation may incur charges and is not automatically retried.

The local npm command wrapper was broken during verification; checks used the installed npm CLI through Node with a workspace-local cache. This workaround did not change system npm settings and does not affect the project's standard scripts.

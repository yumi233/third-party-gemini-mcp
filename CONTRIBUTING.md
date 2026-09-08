# Contributing

Use Node.js 22.13+ (22 LTS) or 24+. Run `npm ci`, `npm run build`, `npm run lint` and `npm test` before proposing a change. Tests use mock proxies. Do not put live credentials, personal paths, internal server addresses or private images in fixtures or issues.

Keep discovery parsing, routing policy, transport and image adapters separate. Add a regression test for a changed compatibility rule or safety boundary. Use model versions only as synthetic test samples; do not pin production routing to a specific model ID.

Explain the problem, behavior change and validation in pull requests. Integration requests require explicit `--run`; image generation can incur provider costs. Do not silently add automatic POST retries. Avoid logging upstream response bodies and request headers.

Before the first public release, maintainers should choose and confirm the license, fill actual repository metadata, enable private security reporting and verify the platform CI matrix. Never push credentials, even to a private repository.

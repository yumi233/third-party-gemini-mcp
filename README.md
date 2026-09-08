# 第三方 Gemini MCP

Unofficial MCP server for OpenAI-compatible model proxy APIs.

这是非官方项目，不属于 Google、Gemini 或 OpenAI 官方产品。通过 stdio 提供文本任务、视觉理解和图像生成；API 地址和凭据只从环境变量读取。当前版本为 `0.1.0`。

## 安装

需要 Node.js 22.13+（22 LTS）或 24+ 和 npm。先从你发布的仓库 clone，进入仓库根目录：

```sh
git clone https://github.com/yumi233/third-party-gemini-mcp.git
cd third-party-gemini-mcp
npm install
npm run build
npm run lint
npm test
```

已有锁文件时，CI 和其他电脑优先使用 `npm ci`。安装后运行的是 `dist/index.js`。本项目尚未发布 npm 包，不要假定同名 `npx` 包由本项目维护。

## 配置环境变量

仅支持以下两个变量；不会读取 Codex 配置文件，也没有默认代理地址或 Key。BASE_URL 是完整的 API 前缀，通常包含 `/v1`；程序不会自动补 `/v1`。

```env
GEMINI_PROXY_BASE_URL=https://your-openai-compatible-proxy.example/v1
GEMINI_PROXY_API_KEY=your_api_key_here
```

`.env.example` 只有占位值。复制为 `.env` 后，默认不会自动加载；可通过 Node 的 `--env-file` 明确加载。真实 Key 不要写进版本控制、截图或日志。

Windows PowerShell（当前会话）：

```powershell
$env:GEMINI_PROXY_BASE_URL = 'https://your-openai-compatible-proxy.example/v1'
$env:GEMINI_PROXY_API_KEY = 'your_api_key_here'
node dist/index.js
```

macOS/Linux：

```sh
export GEMINI_PROXY_BASE_URL='https://your-openai-compatible-proxy.example/v1'
export GEMINI_PROXY_API_KEY='your_api_key_here'
node dist/index.js
```

stdio 服务启动后等待 MCP 消息，终端没有输出是正常的。标准输出只用于 MCP 协议。

## Codex 注册

在 Codex MCP 配置中加入以下示例，并把示例路径替换为安装目录。凭据从 Codex 进程环境传递；桌面应用需要在设置环境变量后重新启动，并确保启动它的环境包含这些变量。

Windows：

```toml
[mcp_servers.gemini-proxy]
command = "node"
args = ['C:\path\to\gemini-proxy-mcp\dist\index.js']
env_vars = ["GEMINI_PROXY_BASE_URL", "GEMINI_PROXY_API_KEY"]
tool_timeout_sec = 900
```

macOS/Linux：

```toml
[mcp_servers.gemini-proxy]
command = "node"
args = ["/path/to/gemini-proxy-mcp/dist/index.js"]
env_vars = ["GEMINI_PROXY_BASE_URL", "GEMINI_PROXY_API_KEY"]
tool_timeout_sec = 900
```

也可将 args 设置为 `['--env-file=C:\path\to\gemini-proxy-mcp\.env', 'C:\path\to\gemini-proxy-mcp\dist\index.js']`，明确加载本地凭据文件。该文件须限制本机访问权限并保持在 Git 之外。

参考：[Codex MCP documentation](https://developers.openai.com/codex/mcp/)。本次该站点返回 HTTP 403，未能在线复核这些宿主配置字段；实际注册请以所安装 Codex 的配置说明为准。服务端 stdio 和工具发现另有自动测试。连接后应能看到下面三个工具。

## MCP tools

| 工具 | 输入 | 行为 |
| --- | --- | --- |
| `gemini_flash` | `task`，可选 `context`、`expected_output` | 自动选择 Gemini Flash，进行文本、代码、文档和日志分析 |
| `gemini_vision` | `prompt`、`images` | 理解或比较 1–4 张图片；每项使用 `path` 或 `url` 之一 |
| `image_generate` | `prompt`，可选 `adapter` | 自动选择图像模型；返回 MCP 图片块或图片 URL |

示例参数：

```json
{"task":"检查这段代码的边界情况","context":"function add(a,b) { return a+b; }"}
```

```json
{"prompt":"分析木材、连接结构和比例","images":[{"url":"https://images.example/chair.png"}]}
```

```json
{"prompt":"白色背景上的现代木椅产品效果图","adapter":"auto"}
```

本地视觉图片用 `{"path":"/absolute/path/chair.png"}` 或 Windows 绝对路径。图片会上传到配置的代理。支持 PNG/JPEG/GIF/WebP，每张最多 8 MiB；拒绝目录、链接、网络路径和 Windows alternate data stream。检查签名不等同于完整图像解码验证。

Flash 也支持受限文件任务：明确传入绝对 `workspace_root`，以及使用 `/` 的相对路径 `read_files` / `write_files` 白名单。默认两者为空。模型只能读取已批准的文件、对已批准的现有文件做一次唯一匹配替换；不会创建文件、执行 shell 或运行测试代码。单文件最多 128 KiB。`max_rounds` 默认 6，上限 8。返回实际 `model`、`summary`、`audit` 和 `incomplete`；失败可能发生在部分编辑之后，须检查工作区差异。

## 模型发现和路由

首次工具调用时请求 `GET {BASE_URL}/models`，缓存 5 分钟；并发调用共享发现请求。列出 MCP 工具不访问代理。缓存失效后刷新失败会报告错误，不使用过期模型偷偷降级。

标准返回形状是 `{"data":[{"id":"model-id"}]}`。可选扩展 `capabilities: ["text","vision","image"]` 是本项目定义的明确能力声明；提供时优先使用并将其视为完整声明，不是所有代理都支持这一扩展。没有能力元数据时才采用名称规则：

- 文本：Gemini Flash，排除图像、音频、TTS 和 embedding；数字版本由高到低，同版本优先非 Lite。
- 视觉：优先明确的 vision 能力，否则推断普通 Gemini 模型或含 vision 的模型；不会把名字含 image 自动当作视觉理解能力。
- 图像：明确 image 能力或 image/imagen/dall-e 家族。默认家族顺序集中在 `src/models/routing.ts` 的 `defaultPolicy`，可更换；没有写死具体模型版本。

名称推断不保证代理实际提供该能力。路由改变只需要修改集中策略；代理私有 metadata 字段需在 discovery 层明确适配。返回实际使用的模型，不会在出错后悄悄切换其他模型或协议。

## API 与图像适配

文本和视觉使用 `POST {BASE_URL}/chat/completions`，非流式 `choices[0].message.content`。不使用 Responses API。Flash 文件任务还要求代理支持 OpenAI-compatible function tool calls。

| adapter | 端点 | 说明 |
| --- | --- | --- |
| `chat` | `/chat/completions` | 发送 `modalities: ["text","image"]` |
| `images` | `/images/generations` | 发送 `model`、`prompt`、`n: 1` |
| `auto` | 先 chat | 仅 HTTP 404/405/501 时尝试 images |

支持 `data[].b64_json`、`data[].url`、message 的 image_url 内容块和 images 数组，以及文本中的 data URL / Markdown 图片。最多返回 4 张图片。不自动下载远程图片，URL 可由宿主展示或另行获取。代理支持不同参数时可实现 `ImageProviderAdapter`；自动模式不会穷举私有协议。

每次请求超时 60 秒，包含响应体读取；解压后响应体上限 24 MiB，禁止 HTTP 重定向。发现请求对 429/500/502/503/504 最多重试两次。POST 不自动重试，避免重复计费或重复任务；超时、无图和 HTTP 500 时自动模式也不再发起第二次生成。

## 测试

```sh
npm run build
npm run lint
npm test
npm run test:integration
```

最后一个命令默认跳过真实请求。手动联调需要已设置的环境变量，并明确启用：

```sh
npm run test:integration -- --run
npm run test:integration -- --run --vision /absolute/path/sample.png
npm run test:integration -- --run --image --adapter chat
```

图片联调可能计费；脚本只输出模型和通过状态，不输出图片内容、Key 或完整响应。CI 不调用真实代理。GitHub Actions 覆盖 Windows、Linux、macOS 和 Node 22/24；本机通过不代表其他平台已经实际通过 CI。

## 故障排查和迁移

- 启动失败：检查两个环境变量、Node 版本和是否已构建。Key 不能带换行。
- HTTP 401/403：检查 Key 和权限；错误不回显响应体或 Authorization。
- HTTP 404：检查 BASE_URL 是否包含代理所需前缀、模型和端点是否受支持。
- HTTP 500/503：代理暂时不可用；生成请求不自动重试，可由用户决定重试。
- No compatible model：查看代理 `/models` 返回，核对命名或能力扩展。
- No supported image：选择已确认的 `chat` / `images`，或新增适配器。文字成功不表示图片生成成功。
- 超时：单请求上限是 60 秒；Flash 多轮任务更长，宿主 timeout 应覆盖整个调用。
- 从旧 gemini-worker 迁移：`server.mjs` 留作启动兼容桥，但需先 build。隐式读取 Codex 凭据、默认上级工作目录、`GEMINI_WORKSPACE_ROOT` 和 `test_files` 已移除。文件任务需显式 `workspace_root`；新的严格 schema 会拒绝旧的额外字段。

## 架构和发布

```text
src/index.ts → server.ts → tools/{flash,vision,image}.ts
                         → models/{discovery,routing}.ts
                         → api/{client,image-adapters}.ts
                         → utils/{data,image}.ts + tools/workspace.ts
tests/              mock、权限边界、MCP 内存与 stdio 测试
scripts/integration.ts    可选真实代理联调
```

发布前运行 `npm pack --dry-run` 并检查包文件，确认许可证、仓库名及维护者信息，审计整个 Git 历史。项目仓库：https://github.com/yumi233/third-party-gemini-mcp。不要提交 `.env`、本地图片、生成物和日志。参见 [SECURITY.md](SECURITY.md)、[CONTRIBUTING.md](CONTRIBUTING.md) 和 [CHANGELOG.md](CHANGELOG.md)。

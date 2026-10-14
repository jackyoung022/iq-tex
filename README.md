# 智商税 · 买之前，想明白

一个适配电脑和手机的 AI 消费判断工具。输入产品名称，应用先联网搜索公开资料，再通过 OpenAI 兼容接口调用大模型，给出智商税风险估计、判断理由、购买建议和资料来源。证据不足时显示“暂无法判断”。

[在线体验](https://iq-tax-check.jackyra.workers.dev/) · [大家搜过什么](https://iq-tax-check.jackyra.workers.dev/history)

> 百分比是 AI 对风险的主观估计，未经真实消费案例校准。它不等于统计概率、检测报告或产品质量鉴定，判断可能受到资料、型号、价格和个人需求的影响。

## 功能

- **产品判断**：输入产品名称，展示 0–100% 风险估计、证据等级、理由和购买建议。
- **联网检索**：支持 Tavily 和自建 SearXNG，去重并筛选相关资料，保留可点击的来源。
- **自选模型**：兼容 Chat Completions API，提供 OpenAI、DeepSeek、通义千问、Moonshot、硅基流动、OpenRouter 地址预设。
- **浏览器配置恢复**：配置与密钥以加密 HttpOnly Cookie 保存 30 天，支持更新和清除。
- **公开搜索记录**：使用 Cloudflare D1 展示产品名称、搜索次数和最近搜索时间，支持筛选、分页和再次判断。
- **可选 Laya**：已实现自托管 HTTP 服务适配；默认关闭，当前在线实例未启用。
- **Cloudflare 部署**：使用官方 `cf` CLI 部署 Worker、静态资源和 D1 迁移。

## 使用方法

1. 打开应用，点击右上角“设置”。
2. 选择接口服务商，填写接口地址、模型 ID 和自己的模型 API Key。
3. 填写 **Tavily 专用搜索 Key**，点击“测试联网搜索”检查连接。
4. 点击“保存设置”，输入具体的产品名称，再点击“判断一下”。

模型 Key 和 Tavily Key 属于不同服务，不能混用。模型名称应使用服务商实际提供的 ID；接口地址填到 `/v1` 或相应兼容路径，应用会追加 `/chat/completions`。

同一浏览器刷新后可恢复配置，其他浏览器或设备需要分别设置。“再判断”只预填产品名称，不会自动调用模型。

## 技术栈

| 部分 | 实现 |
| --- | --- |
| 界面 | React 19、TypeScript、响应式 CSS、Lucide 图标 |
| 框架与构建 | Vinext、Vite |
| 服务端 | Cloudflare Workers |
| 搜索 | Tavily / SearXNG |
| 模型 | OpenAI 兼容 Chat Completions API |
| 数据库 | Cloudflare D1、Drizzle 表结构及迁移 |
| 数据校验 | Zod |
| 配置保护 | AES-256-GCM、HttpOnly Cookie |

## 本地运行

需要 **Node.js 22.13+** 和 npm。

```bash
git clone https://github.com/jackyoung022/iq-tex.git
cd iq-tex
npm ci
cp .env.example .env.local
```

首次配置时生成本地 Cookie 加密密钥，直接写入 `.env.local`，不输出密钥：

```bash
node --input-type=module <<'JS'
import { randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
const path = '.env.local';
const text = readFileSync(path, 'utf8');
writeFileSync(path, text.replace(/^SETTINGS_COOKIE_SECRET=.*$/m,
  'SETTINGS_COOKIE_SECRET=' + randomBytes(32).toString('base64url')));
JS

npm run dev
```

打开终端输出的地址，默认 `http://localhost:5173`。在页面设置中填写模型 Key 和 Tavily Key，即可运行判断。不要在每次启动时重新生成 Cookie 密钥，否则之前保存的配置会失效。

如需在同一可信局域网内用手机调试：

```bash
npm run dev -- --host 0.0.0.0
```

手机访问 `http://电脑局域网IP:5173`。模型和搜索请求由电脑上的后端执行。正式部署使用 HTTPS。

### 本地搜索记录数据库

本地 D1 与线上 D1 独立，不会自动下载客户记录。先执行本地迁移，再启动开发服务器：

```bash
npm run db:migrate:local
npm run dev
```

脚本读取 `cloudflare.deploy.json` 的 `env.DB`，使用项目锁定版本的 Wrangler，在 `.wrangler/state` 创建本地数据库。无需登录 Cloudflare，不会修改线上数据库。未执行迁移时，本地判断仍可运行，公开记录页面会提示读取失败。不要让不同版本的 `cf` 本地模拟器与 Wrangler 共用这份状态目录。

## 环境变量

`.env.example` 提供所有支持的配置。`.env.local` 只用于本机开发，**不会自动上传到 Cloudflare**。

| 变量 | 用途 |
| --- | --- |
| `SETTINGS_COOKIE_SECRET` | 必需的 Cookie 加密密钥；随机 32 字节的 base64url 字符串，需保持稳定 |
| `OPENAI_BASE_URL` | 服务端默认模型接口地址，默认 `https://api.openai.com/v1` |
| `OPENAI_MODEL` | 可选的服务端默认模型 ID |
| `OPENAI_API_KEY` | 可选的服务端默认模型 Key；客户自带 Key 时无需配置 |
| `OPENAI_JSON_MODE` | 默认开启；不支持 `response_format` 的兼容接口可设为 `false` |
| `OPENAI_ALLOWED_HOSTS` | 允许客户填写的额外模型接口域名，以逗号分隔 |
| `TAVILY_API_KEY` | 可选的服务端搜索 Key；也可由客户在页面填写 |
| `SEARXNG_URL` | 自建搜索接口的完整 `/search` 地址 |
| `SEARXNG_FALLBACK_URLS` | 备用搜索地址，逗号分隔，最多使用两个备用地址 |
| `LAYA_BASE_URL` | 可选的自托管 Laya 地址，未设置即关闭 |
| `LAYA_API_KEY` | 可选的 Laya 服务鉴权 Key |

页面输入的自定义模型域名必须加入 `OPENAI_ALLOWED_HOSTS`；服务端配置的 `OPENAI_BASE_URL` 自动受信任。切换服务商时，已保存的模型 Key 不会被转发到新的接口。

## Cloudflare 部署

部署使用 [Cloudflare 官方 cf CLI](https://github.com/cloudflare/cf)。需要具有 Workers 和 D1 权限的 Cloudflare 账号。

```bash
npm install -g cf
cf auth login
cf auth whoami
```

### 在自己的账号中首次部署

1. 创建自己的 D1 数据库：

   ```bash
   cf d1 create --name my-iq-tax-db --primary-location-hint apac
   ```

2. 修改 `cloudflare.deploy.json`：将 `env.DB.name` 和 `env.DB.id` 替换为新数据库名称及返回的 `uuid`；`name` 是要创建的 Worker 名称。

   `env.DB` 字段示例：

   ```json
   {
     "type": "d1",
     "name": "my-iq-tax-db",
     "id": "创建数据库时返回的 UUID"
   }
   ```

   仓库内的现有数据库 ID 属于在线实例，自行部署时应替换。默认搜索地址可能被拒绝或限流，可以替换为自己的搜索服务，或删除 `SEARXNG_URL` / `SEARXNG_FALLBACK_URLS` 字段，让客户填写 Tavily Key。保留 `SETTINGS_COOKIE_SECRET` 的 `secret` 声明，不在 JSON 中填入真实密钥。

3. 创建并发布 Worker：

   ```bash
   npm run deploy:cf -- --init-cookie-secret
   ```

首次部署脚本会生成随机 Cookie 加密密钥，上传到 Cloudflare Secret，并删除权限为 `0600` 的临时文件。脚本先应用 `drizzle/` 中的 D1 迁移，再使用 `cf deploy --prebuilt` 发布，终端会返回 `workers.dev` 地址。

### 更新已有实例

```bash
npm run deploy:cf
```

后续部署保留已有 Cookie 加密密钥，自动应用新增数据库迁移。迁移失败会停止发布。首次初始化选项只适用于尚未创建的 Worker，避免覆盖既有配置。

本仓库保留原 Sites 构建集成，`.openai/hosting.json` 是原 Sites 项目的身份配置。Cloudflare 与 Sites 独立发布，推送 GitHub 不会自动更新任何线上实例。

## 数据保存与隐私

### 客户 API Key

客户的模型 Key、Tavily Key、接口地址和模型 ID 保存在其浏览器的加密 Cookie 中，服务器不将客户密钥持久化到数据库、业务文件或判断记录。

- AES-256-GCM 加密，每次保存使用随机 IV 和认证标签。
- Cookie 为 host-only，限定 `Path=/api`，带 `HttpOnly`、`SameSite=Strict`，HTTPS 下带 `Secure`，有效期 30 天。
- 页面恢复接口只返回接口地址、模型和密钥是否存在，不返回密钥明文。
- 密钥留空会保留同一接口的原值，彻底删除使用“清除已保存配置”。

后端必须在请求期间解密并使用密钥，因此密钥会经过部署者的服务器；请使用可信的实例。`SETTINGS_COOKIE_SECRET` 是部署者的应用加密密钥，保存在 Cloudflare Secret 中；它与客户的 API Key 不同。轮换它会使原 Cookie 失效。

### 公开产品搜索记录

提交判断的产品名称会公开展示，首页输入框旁已注明，请只填写产品信息。D1 仅保存：

| 字段 | 内容 |
| --- | --- |
| `id` | 内部记录 ID |
| `product_key` | 标准化产品名称，用于合并重复搜索 |
| `product` | 展示用产品名称 |
| `search_count` | 提交次数 |
| `first_searched_at` | 首次提交时间 |
| `last_searched_at` | 最近提交时间 |

名称按 Unicode NFKC、空白和英文大小写合并，计数采用原子 upsert。页面每页 20 条，按最近搜索排序，时间按北京时间显示。

只记录通过输入和模型配置校验后提交的判断；上游搜索或模型失败也计为一次提交。配置错误和设置弹窗中的搜索连接测试不计入。没有保存客户身份、IP、API Key、模型配置、完整请求或判断结果。记录从功能上线后开始积累，之前未保存的数据无法恢复。

## 判断流程与边界

```text
产品名称 → 联网搜索 → 去重和相关性筛选 → 可选 Laya 辅助 → LLM 判断 → 结构与引用校验 → 展示结果
```

搜索优先使用客户 Tavily Key，其次为服务端 Tavily Key，再尝试 SearXNG 主接口及备用接口。最多合并 12 条相关来源摘要，不抓取来源网页全文。

模型结合功效证据、价格价值和使用场景进行判断。返回结构、分数范围及引用编号均经过校验；至少引用两个不同域名、每条理由都有引用，才允许显示分数。这些规则能减少部分错误，但不保证不同域名的资料独立或真实。

模型格式错误时最多纠正一次，复用原始检索资料，不重新搜索。兼容数字字符串、明确的中文证据等级和来源编号字符串，不推测缺失的分数或编造引用。官方 DeepSeek 接口的 `deepseek-flash` / `deepseek-v4-pro` 已有专用参数适配，其他接口按通用协议调用。

## 可选 Laya 接入

本项目适配 [Laya 自托管 HTTP 服务](https://github.com/NandhaKishorM/laya)，通过 `POST /v1/systemone` 请求 `multilingual` 模型。当前在线实例没有部署或启用 Laya。

在能够运行 Python 模型的机器上启动服务，例如：

```bash
python3 -m venv .venv-laya
.venv-laya/bin/pip install 'laya[serve]'
LAYA_HOST=127.0.0.1 LAYA_PORT=8000 LAYA_DEVICE=cpu LAYA_MODELS=multilingual LAYA_PRELOAD=1 .venv-laya/bin/laya-serve
```

本地应用设置 `LAYA_BASE_URL=http://127.0.0.1:8000`。云端 Worker 需要可访问的 HTTPS Laya 地址；若服务启用鉴权，两端配置对应的 `LAYA_API_KEY`。

Laya 会下载模型权重并消耗内存，不能直接在当前 Worker 中运行。它只提供辅助信号，不与最终百分比机械加权；超时或故障会降级并在结果中说明。Laya 没有针对本项目的消费判断业务进行校准。

## 开发与验证

```bash
npm run check       # TypeScript 检查
npm test            # 自动化测试
npm run build       # Vinext 构建
npm run build:cf    # 构建并生成 cf Build Output
npm run db:generate # 修改 db/schema.ts 后生成数据库迁移
npm run db:migrate:local # 应用本地 D1 迁移
```

当前有 41 项测试，覆盖模型密钥隔离、搜索备用服务、模型输出校验、引用约束、Laya 降级、Cookie 加密，以及 D1 计数、筛选和分页。测试使用模拟上游与 SQLite，不消耗真实模型账户额度。已有线上验证覆盖 Cookie 保存与刷新恢复、重新部署后的恢复、D1 记录合并及手机布局。

```text
app/                   首页、公开记录页和 API 路由
lib/analysis.ts        搜索、LLM、Laya 和结果校验
lib/settings-cookie.ts Cookie 加密、恢复与密钥隔离
lib/search-history.ts  D1 记录与分页查询
db/schema.ts           数据库表结构
drizzle/               SQL 迁移及元数据
scripts/               构建、部署和开发辅助脚本
cloudflare.deploy.json Cloudflare Worker 与 D1 配置
tests/                 自动化测试和本地夹具
```

## 常见问题

**联网搜索返回 403 / 429**

通常是搜索服务拒绝云端访问、限流或额度不足，与模型 Key 无关。请填写可用的 Tavily Key，或更换自己的 SearXNG 地址。默认免费搜索服务的可用性不保证。“测试联网搜索”不会调用 LLM。

**模型返回格式不完整**

核对模型 ID 和兼容接口是否支持 JSON mode。不支持时将服务端 `OPENAI_JSON_MODE` 设为 `false`，应用仍会严格验证 JSON；自动纠正后仍失败会提示具体字段。

**刷新后没有恢复设置**

确认已点击“保存设置”、浏览器允许 Cookie，并且服务器已配置稳定的 `SETTINGS_COOKIE_SECRET`。更换域名、浏览器、设备或 Cookie 密钥后需要重新保存。

**公开记录页为空或读取失败**

空列表表示还没有符合条件的提交。读取失败时检查 Worker 的 `DB` 绑定、数据库 ID 和 SQL 迁移是否应用。本地数据库与线上数据库分别维护。

**用于公网运营前还需要什么**

当前并发限制为单实例的尽力限制，尚无账户系统、持久化访客限流或记录审核后台。扩大访问量前应根据实际运营需求补齐这些能力。依赖的搜索和模型服务按各自账户政策计费。

## 参考资料

- [Cloudflare cf CLI](https://github.com/cloudflare/cf)
- [Cloudflare D1 Workers Binding API](https://developers.cloudflare.com/d1/worker-api/)
- [Tavily Search API](https://docs.tavily.com/documentation/api-reference/endpoint/search)
- [DeepSeek Chat Completions API](https://api-docs.deepseek.com/api/create-chat-completion/)
- [Laya 项目](https://github.com/NandhaKishorM/laya)

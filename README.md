# 智商税 · 消费判断助手

适配桌面和手机的中文 Web 小应用。输入产品名称，联网检索公开资料，再通过 **OpenAI 兼容 Chat Completions API** 综合判断，显示 0–100% 的智商税风险估计、理由、购买建议及可点击的来源。证据不足时返回“暂无法判断”，不伪造分数。

## 本地运行

要求 Node.js 22.13+。

```bash
cd iq-tax # 如果已经在应用目录则跳过
npm ci
cp .env.example .env.local
npm run dev -- --host 0.0.0.0
```

打开终端输出的本地地址，默认 `http://127.0.0.1:5173`。同一 Wi-Fi 的手机可访问 `http://电脑局域网IP:5173`。手机访问时，LLM 和搜索请求仍由电脑上的服务端执行。

在右上角“设置”填写接口地址、模型 ID、API Key。没有服务端搜索配置时，还需填写 Tavily Key。页面密钥仅保留在 React 会话内存，不写入 localStorage、cookie 或文件；刷新后需要重填。请求通过同源后端转发，密钥不可避免地会经过你部署的服务端，请使用自己信任的实例。**本地 HTTP 调试只用于可信网络；正式使用应部署在 HTTPS 后。**

更适合长期使用的方式是在忽略提交的 `.env.local` 中配置：

```dotenv
OPENAI_BASE_URL=https://你的兼容服务商/v1
OPENAI_API_KEY=你的密钥
OPENAI_MODEL=你的模型ID
TAVILY_API_KEY=你的Tavily密钥
# 或：SEARXNG_URL=https://你的搜索服务/search
```

当前开发目录已配置本机已有的 SearXNG 地址，不包含 LLM Key；复制示例文件会覆盖该配置。首次填写模型 ID 请使用服务商实际支持的名称。

支持 OpenAI、DeepSeek、通义千问、Moonshot、硅基流动、OpenRouter 预设地址。页面输入的自定义 API 域名需加入服务端 `OPENAI_ALLOWED_HOSTS`（逗号分隔）；服务端配置的 `OPENAI_BASE_URL` 自动受信任。切换页面服务商时必须填写该服务商的 Key，服务端默认密钥不会被转发到另一个接口。`Base URL` 填到 `/v1` 或兼容路径即可，程序追加 `/chat/completions`。不支持 `response_format` 的接口可设 `OPENAI_JSON_MODE=false`，仍严格验证返回 JSON。

## 联网搜索与判断

- 优先采用页面 Tavily Key、服务端 Tavily Key，然后使用服务端 `SEARXNG_URL` 及 `SEARXNG_FALLBACK_URLS`（逗号分隔的备用地址）。上游拒绝、超时、无有效结果时会尝试备用服务，且不把 Tavily Key 转发给 SearXNG。
- 检索产品名称和功效/评测/价格/研究，最多合并 12 条有效、去重且与产品相关的来源摘要；免费 SearXNG 顺序请求，并在已有足够资料时减少请求以避免限流。
- LLM 检查产品匹配、功效证据、价格价值和使用场景。网页材料按不可信数据处理。
- Zod 校验结构、概率范围及引用编号；越界分数、编造引用、截断输出会报错。
- 至少引用两个不同域名，并且每条理由有引用，才允许显示概率。该规则仅减少单一来源误导，不代表不同域名一定独立或真实。
- 不抓取源网页全文；评估依据是搜索服务返回的摘要，完整材料应打开原文核对。检索相关性低、广告多、型号不明时应弃权。
- 不缓存用户输入或判断记录。并发限制是每个运行实例的尽力限制，不是可用于公开生产服务的持久化限流。

百分比是 **AI 主观风险估计**，未经消费案例校准，不能理解为真实统计概率或产品质量鉴定。Laya 同样没有在此业务领域微调或校准。

## 可选 Laya 辅助判断

根据 [Laya 官方 README](https://github.com/NandhaKishorM/laya) 的 HTTP 协议接入 `POST /v1/systemone`，使用 `multilingual` 模型和 `noul` 类型问题。

```bash
python3 -m venv .venv-laya
.venv-laya/bin/pip install 'laya[serve]'
LAYA_HOST=127.0.0.1 LAYA_PORT=8000 LAYA_DEVICE=cpu LAYA_MODELS=multilingual LAYA_PRELOAD=1 .venv-laya/bin/laya-serve
```

再设置应用环境变量：

```dotenv
LAYA_BASE_URL=http://127.0.0.1:8000
# 如果 Laya 配置了鉴权，则两端填相同的密钥
LAYA_API_KEY=
```

Laya 会下载模型权重，消耗额外内存。默认不安装/启用 Laya，LLM 可以独立运行；其辅助输出传给 LLM 作参考，不与最终分数机械加权。Laya 超时或故障会降级并在结果中说明。云端应用不能访问你电脑的 localhost，需要部署可达的 HTTPS Laya 服务并启用鉴权。

## 验证与构建

```bash
npm run check
npm test
npm run build
npm start
```

测试使用明确的模拟上游，覆盖密钥隔离、搜索失败、证据不足、非法引用、无结果、输出截断、Laya 降级和完整分析链路。真实搜索已单独连通验证；真实 LLM 调用需要你自己的 Key。

技术栈：React 19、TypeScript、Vinext/Vite、Cloudflare Workers 运行时、Zod。保留 Sites 的构建集成，因此可在 Sites 中私有部署；所有外部请求通过 HTTP 完成。

## 部署配置

本项目 `.openai/hosting.json` 绑定当前 Sites 项目。生产环境变量需要配置在 Sites 中，**不会自动读取本机 `.env.local`**。默认部署为仅本人可访问，不会开放你的服务端密钥给陌生人。修改环境变量后需重新部署才能生效。如需迁移给其他服务器或公开发布，应另行配置 HTTPS、身份访问和持久化限流。

参考 [OpenAI JSON mode 文档](https://developers.openai.com/api/docs/guides/structured-outputs#json-mode)、[Tavily Search 文档](https://docs.tavily.com/documentation/api-reference/endpoint/search)。

浏览器 QA 使用本地 `tests/fixture-server.mjs`，明确标注夹具数据，验证成功评分、证据不足和设置弹窗；不将测试分数作为真实产品判断。390px 手机和 1440px 桌面布局均无横向溢出。当前 Ego Lite 截图接口超时，未完成截图视觉核验。

## 搜索连接排查

设置弹窗中的“测试联网搜索”通过 `POST /api/search` 实际检索当前产品，不调用 LLM、无需模型 API Key。Tavily 的密钥错误与 SearXNG 的云端访问拒绝分别显示。

当前云端通过 Jina Reader 的 HTTPS 读取接口获取现有匿名 SearXNG 的结果，避免云端直接连接 HTTP 非标准端口的问题；本地开发仍可直接使用自建服务。搜索服务和 Reader 会收到产品检索词，不转发模型密钥；两者可能限流或暂时不可用。可替换为自己的 HTTPS SearXNG 实例，或填写 Tavily Key。

SearXNG 地址可附带 `?format=html`，读取公开搜索结果卡片；默认仍为 JSON。只提取结果标题、链接和摘要，不执行页面脚本，遇到拒绝或验证页面不会尝试绕过。

Reader 格式为 `https://r.jina.ai/http://你的公开匿名SearXNG/search`；只用于无需凭据的公开搜索地址，不应把含密钥或私有服务的地址发送给 Reader。

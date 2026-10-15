# 拾学集 · AI 检索接入指南

> 目标：让同学用**自然语言**提问（如"我想找数学分析的复习资料"），由 AI 从 170 条资源里
> 挑出合适的并说明理由。
>
> **为什么不用向量检索（RAG）**：DeepSeek 官方明确不提供 embedding 接口
> （见 [DeepSeek-V3 issue #806](https://github.com/deepseek-ai/DeepSeek-V3/issues/806)，
> 调用 `/embeddings` 返回 404）。而拾学集只有 170 条资源，全部塞进提示词也只占约 1.5 万 token，
> DeepSeek 的上下文窗口是 1M —— **根本不需要向量库**。少一个组件，就少一处故障。

---

## 一、成本（按官方定价实算）

DeepSeek `deepseek-flash` 价格（[官方定价页](https://api-docs.deepseek.com/zh-cn/quick_start/pricing)）：

| 时段 | 输入（缓存未命中） | 输入（**缓存命中**） | 输出 |
|---|---|---|---|
| 高峰（工作日 9:00-12:00、14:00-18:00） | 2 元/百万 | **0.04 元/百万** | 8 元/百万 |
| 空闲（其余时段含周末） | 1 元/百万 | 0.02 元/百万 | 4 元/百万 |

**本项目实测数据**：提示词约 15,280 token，回答约 300 token。

| 场景 | 单次成本 |
|---|---|
| 首次（缓存未命中，高峰） | 约 **3.3 分** |
| 后续（缓存命中，高峰） | 约 **0.3 分** |
| 后续（缓存命中，空闲） | 约 **0.15 分** |

**一天 100 次提问 ≈ 0.3 元。** 充值 10 元可以用很久。

> 缓存生效的前提：**系统提示词完全不变**。所以提示词是生成一次、固定不动的文件。
> 不要每次请求动态拼接（比如带上时间戳），那会让缓存永远失效、成本涨 50 倍。

---

## 二、架构

```
用户提问
   ↓
前端 index.html（「问 AI」入口）
   ↓  POST { question }   ← HTTP 网关
云函数 ask（API Key 只存在这里的环境变量中）
   ↓
固定提示词（170 条资源）+ 用户问题 → DeepSeek /chat/completions
   ↓  返回 { answer, resources:[{title, reason}] }
★ 云函数校验：标题必须真实存在于资源库，否则丢弃
   ↓
前端渲染：自然语言回答 + 可点击的资源卡片
```

**★ 那一行是整个方案的安全底线**：即使模型编造了一个不存在的资源，
也会在服务端被过滤掉，永远到不了用户眼前。

---

## 三、部署步骤

### 第 1 步：注册 DeepSeek 并充值

1. 打开 https://platform.deepseek.com/
2. 手机号注册 → 实名认证
3. 充值（10 元足够很久）
4. 创建 API Key → **复制保存，只显示一次**

> ⚠️ **不要把 API Key 发给 AI，也不要写进任何会提交到 git 的文件。**
> 它只需要填进云函数的环境变量。

### 第 2 步：注册腾讯云并创建 CloudBase 环境

1. 打开 https://cloud.tencent.com/ → 注册（手机号 + 实名认证）
2. 打开云开发控制台 https://tcb.cloud.tencent.com/dev
3. **新建环境**：选「按量计费」（有免费额度），记下**环境 ID**（形如 `shixueji-3g8xxxxx`）

### 第 3 步：创建并上传云函数

进入 https://tcb.cloud.tencent.com/dev#/scf?tab=function → 新建云函数：

| 配置项 | 值 |
|---|---|
| 函数名称 | `ask` |
| 运行环境 | Node.js 18 或更高 |
| 内存 | 256 MB |
| **超时时间** | **20 秒** ← 默认 3 秒，调大模型**必定超时** |
| 入口函数 | `index.main` |

上传代码：把本仓库 `cloudbase/ask/` 下的 **4 个文件**打包成 zip 上传：
**（注意：是把这 4 个文件放在 zip 根目录，不要多套一层文件夹）**

```
index.js         云函数代码
ai-prompt.txt    系统提示词
resources.json   资源库（用于校验 AI 返回的标题）
package.json     CommonJS 声明
```

### 第 4 步：配置环境变量（关键）

云函数 → 配置 → 环境变量，新增：

| 变量名 | 值 |
|---|---|
| `DEEPSEEK_API_KEY` | 你的 API Key |

### 第 5 步：开启 HTTP 访问

依据 [官方文档：通过 HTTP 访问云函数](https://docs.cloudbase.net/service/access-cloud-function)，
推荐用**详情页就地绑定**：

1. 云函数详情页 → 「自定义域名」模块 → 「添加域名」
2. 「触发路径」填 `/ask`（或直接 `/`）
3. 域名选**默认域名**
4. 确认后得到访问地址：
   ```
   https://你的环境ID.区域.app.tcloudbase.com/ask
   ```

**把这个地址发我**，我接前端。

也可以从 HTTP 网关统一配：https://tcb.cloud.tencent.com/dev#/env/http-access → 路由管理 → 新建

### 第 6 步：先自己验证一下

部署完在浏览器控制台或命令行试一次（把地址换掉）：

```bash
curl -X POST https://你的地址/ask \
  -H "Content-Type: application/json" \
  -d "{\"question\":\"我想入门 AI，推荐点资源\"}"
```

**应该返回** `{"ok":true,"answer":"...","resources":[{"title":"...","reason":"...","url":"..."}]}`

如果报错，看云函数日志（日志监控），常见原因：
- `服务端未配置 API Key` → 第 4 步没做或变量名拼错
- 超时 → 第 3 步的超时时间还是 3 秒
- `AI 服务暂时不可用：DeepSeek HTTP 401` → API Key 不对或余额不足

---

## 四、资源库更新后要做什么

提示词是根据资源库生成的，**改了资源就必须重新生成并上传**，否则 AI 看不到新资源，
甚至可能推荐已被删掉的资源：

```bash
node tools/build-ai-prompt.mjs resources.json ai-prompt.txt
copy resources.json cloudbase\ask\resources.json
copy ai-prompt.txt cloudbase\ask\ai-prompt.txt
```

然后把这两个文件重新上传到云函数（或整个 zip 重传）。

---

## 五、本地能验证什么（不需要账号）

```bash
npm test
```

包含 `tests/verify-ai-guard.mjs`，**40 项断言，全部无需 API Key**：

| 测试组 | 验证内容 |
|---|---|
| 防幻觉 | AI 编造的 3 条资源全部被丢弃 |
| 资源库没有 | 如实说明"暂时没有"，不硬凑 |
| 边界情况 | 标题空格、重复推荐、非 JSON、缺字段 |
| **HTTP 事件解析** | `body` 为 JSON 字符串/纯文本/已解析对象/base64 都能取到问题 |
| **IP 提取** | `requestContext` 与 `X-Forwarded-For`（大小写）都能取到 |
| **主流程接线** | 未配 Key 返回 500、OPTIONS 预检带 CORS、空问题返回 400 |

**这些都不需要账号就能跑**，所以每次改代码都能立刻验证防护是否还生效。

---

## 六、还没做的事（等云函数地址）

- **前端入口**：在页面上加提问框（需要云函数地址）
- **端到端实测**：真实提问一次，确认回答质量与耗时
- **限频升级**：目前是每 IP 每天 20 次（内存计数，实例重启后清零）；
  用量大了需要换成云数据库持久化
- **回答质量调优**：拿真实问题测几轮，看提示词要不要改

# AGENTS.md — 项目约束与开发规范

> 本文件给 **AI 工程师（Trae / Kimi / Cursor 等）** 和 **人类开发者** 看。
> 每次开工前请先读一遍，避免踩到双目录同步、敏感信息泄露等坑。

---

## 1. 双目录架构（最重要）

本项目在磁盘上有两份，**用途完全不同**：

| 路径 | 角色 | 说明 |
|------|------|------|
| `E:\doubao\` | **开发目录 + Git 仓库** | IDE 在这里打开，改代码 / 测功能 / commit / push 到公开仓库 |
| `D:\wwwroot\doubao-bot\` | **宝塔生产目录** | 宝塔面板运行的 Node 服务实际读取这里的代码 |

### 1.1 同步流程

```
IDE 改 E:\doubao\xxx.mjs
        ↓
  功能测试通过（可选，也可以直接推）
        ↓
  robocopy 同步到 D 盘（见 1.3）
        ↓
  宝塔面板重启 Node 进程
        ↓
  需要开源时：E:\doubao 里 git commit + push
```

### 1.2 同步命令（在 E 盘根目录执行）

```powershell
# 增量同步 src 和 tools 下改过的文件
robocopy "E:\doubao\src" "D:\wwwroot\doubao-bot\src" /E /NFL /NDL /NJH /NJS /nc /ns /np
robocopy "E:\doubao\tools" "D:\wwwroot\doubao-bot\tools" /E /NFL /NDL /NJH /NJS /nc /ns /np
robocopy "E:\doubao" "D:\wwwroot\doubao-bot" package.json .gitignore /NFL /NDL /NJH /NJS /nc /ns /np
```

**注意**：robocopy exit code 0-7 都是成功，PowerShell 可能会报错，忽略即可。

### 1.3 禁止反向同步

**绝不能**从 D 盘覆盖 E 盘。两个目录可能包含不同的本地运行时状态（`.doubao-bot/`、`credentials.json`），反向覆盖会把生产凭据带进开发目录。

---

## 2. 🔒 敏感信息 —— 绝对不能进 Git

以下内容**任何情况下**都不能出现在 commit 里：

| 类型 | 位置 | 危害 |
|------|------|------|
| B 站 Cookie | `~/.bili-ai/credentials.json` | 被盗号，用你的号乱发评论 |
| 豆包 API Key | `credentials.json` 里的 `doubaoApiKey` | 被盗刷，花你的钱 |
| 运行时数据 | `~/.doubao-bot/**` | 日记、token 用量、任务状态都属于用户隐私 |

### 2.1 .gitignore 已覆盖

`.gitignore` 里已经写了以下规则，**不要删除**：

```gitignore
credentials.json
.doubao-bot/
.dsh/
~/.bili-ai/
**/*secret*
**/*token*
**/*cookie*
**/*key*.json
```

### 2.2 代码里的硬性要求

- **绝不能**把 Cookie / API Key 硬编码在 `.mjs` 源文件里
- 凭据**只能**从 `~/.bili-ai/credentials.json` 或 `.doubao-bot/credentials.json` 读取
- Web UI `/config` API 返回凭据时**必须脱敏**（如 `sk-xxxx...xxxx`，只保留前 8 位）
- 写日志时**必须脱敏**，打印 SESSDATA / bili_jct 时输出 `***`

### 2.3 git commit 前自查清单

- [ ] `git status` 里没有 `credentials.json`、`.doubao-bot/`、`.dsh/`
- [ ] `git diff` 里没有 Cookie 值、API Key、SESSDATA
- [ ] 新增的 `.mjs` 文件里没有硬编码的凭据字符串

---

## 3. 项目架构

### 3.1 零依赖原则

项目**全程使用 Node.js 原生 `http` / `fs` / `child_process` 模块**，不引入任何第三方 npm 包。原因：
- 方便用户一键部署（宝塔面板 / PM2 直接 `node web.mjs`）
- 公开仓库 clone 下来就能跑，不需要 `npm install`

**新增功能时先想想能不能用原生模块解决，实在不行再考虑加依赖。**

### 3.2 目录结构

```
E:\doubao\
├── src/
│   ├── web.mjs              # Web 管理界面（HTTP server）
│   ├── scheduler.mjs        # 定时任务调度器 + 关注守望进程管理
│   ├── agent.mjs            # 豆包 AI 分身主循环（唤醒模式）
│   ├── run-task.mjs         # 定时任务入口（agent 模式，耗 token）
│   ├── run-task-direct.mjs  # 定时任务入口（纯脚本直达，0 token）
│   ├── follow-await.mjs     # 关注列表守望进程（轮询 B 站动态 API）
│   ├── doubao-client.mjs    # 豆包 API 封装（chatWithTools / token 计数）
│   ├── tools-def.mjs        # 工具列表（B 站 API + 豆包能力）
│   ├── tool-executor.mjs    # 工具执行分发
│   ├── config.mjs           # 配置读取
│   └── memory.mjs           # 日记 / 记忆
├── tools/
│   ├── bili.mjs             # B 站命令行工具（所有 commands 的统一入口）
│   └── commands/
│       ├── bangumi.mjs      # 番剧 ss/ep → 最新正片 BV 自动解析
│       ├── comment.mjs      # 发评论
│       ├── comment-await.mjs# 评论守望（被动监听回复）
│       ├── dm.mjs           # 私信
│       ├── deps.mjs         # 凭据健康检查
│       ├── feed.mjs         # 刷 feed（关注 + 热门）
│       ├── search.mjs       # WBI 签名搜索
│       └── ...
└── .gitignore               # 敏感数据屏蔽规则（不要改）
```

### 3.3 两种任务模式（token 优化核心）

```
定时任务 / 关注抢新
    │
    ├── 有预设文案 template → run-task-direct.mjs（纯脚本，0 token，3秒发完）
    │   适用：抢前排占位
    │
    └── 无预设文案 → run-task.mjs → agent.mjs（豆包帮写，耗 token）
        适用：需要看视频后写"有内容"的评论
```

### 3.4 鉴权

所有写操作（评论、私信、动态）通过 B 站 Cookie 鉴权：
```json
// ~/.bili-ai/credentials.json
{
  "sessdata": "xxxxx",
  "bili_jct": "xxxxx",
  "buvid3": "xxxxx",
  "doubaoApiKey": "ep-2025xxxxxx-xxxxx",
  "doubaoEndpointId": "..."
}
```

**Cookie 会过期**，过期后 B 站 API 返回 `-111 / -101`。用户需要在 Web UI「凭据」Tab 重新粘贴。

---

## 4. 开发规范

### 4.1 新增 B 站工具

1. 在 `tools/commands/` 下新建 `.mjs`，**同时支持 CLI 入口和模块 export**
2. 在 `tools/bili.mjs` 注册命令别名
3. 在 `src/tools-def.mjs` 加工具描述（给豆包 agent 用的 function 定义）
4. 在 `src/tool-executor.mjs` 加 `case` 路由

### 4.2 API 限频

- B 站公开 API：同一 IP 同一接口，**至少间隔 3 分钟**
- B 站写操作（评论/私信）：**加随机 2-5 秒延迟**，避免被风控
- 豆包 API：**预算在 config.budget.dailyTokens**，默认 30000

### 4.3 时区

B 站 API 返回的 pub_ts 是 **Unix 秒（UTC）**，展示时用：
```javascript
new Date(ts * 1000).toLocaleString('zh-CN', { hour12: false })
```

### 4.4 番剧解析过滤

`tools/commands/bangumi.mjs` 里维护的 `SKIP_TOKENS`：
```javascript
['预告', '花絮', 'pv', '特典', '番外', 'sp', 'ova', '先行', '短片', '小剧场']
```
匹配 title 或 index_title，同时过滤 `pub_time === 0` 的未上线集数。

### 4.5 终端进程管理（IDE 崩溃元凶）

**AI 工程师（Trae / Kimi / Cursor）务必遵守**：

> 每次通过 RunCommand 打开后台进程（`node web.mjs`、follow-await.mjs、临时测试脚本等），**必须在任务结束后立即 StopCommand 或 taskkill 关掉它**。

典型崩溃场景：
- 开了 5 个终端，每个都跑着 node 进程 → 内存被吃光 → IDE OOM 崩溃
- 旧的 `node web.mjs` 没关 → 新的 bind 7890 端口失败 → "EADDRINUSE" → 误以为代码有 bug 浪费时间排查
- 多个终端同时占着资源 → 任何一个异常退出都可能拖垮其他

**开终端 checklist**：
- [ ] 启动前台短命令（node --check、curl、grep）：执行完自然退出，不用管
- [ ] 启动后台长进程（node web.mjs、node follow-await.mjs）：**完成任务后必须 StopCommand**
- [ ] 重新跑 web.mjs / scheduler 之前：先 `taskkill /F /IM node.exe` 清干净旧进程
- [ ] IDE 报错 "端口被占用"：先 kill 再想别的，不要猜

---

## 5. 快速同步脚本（可选，加到 PowerShell Profile）

把下面函数加到你的 `$PROFILE`，改完代码一行命令同步：

```powershell
function Sync-Doubao {
    robocopy "E:\doubao\src" "D:\wwwroot\doubao-bot\src" /E /NFL /NDL /NJH /NJS /nc /ns /np
    robocopy "E:\doubao\tools" "D:\wwwroot\doubao-bot\tools" /E /NFL /NDL /NJH /NJS /nc /ns /np
    Write-Host "✅ 同步完成，记得宝塔重启 Node 进程" -ForegroundColor Green
}
Set-Alias sd Sync-Doubao
```

之后在 PowerShell 里直接 `sd` 就同步了。
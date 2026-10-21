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

### 1.1 同步流程（默认走 Git）

```
IDE 改 E:\doubao\xxx.mjs
        ↓
  bump package.json 版本号（见 4.0）
        ↓
  git commit + git push origin main
        ↓
  【主人在宝塔操作】git pull + PM2 重启
        ↓
  刷新页面看版本号 → 确认生效
```

### 1.2 紧急同步（Git pull 冲突时的备选方案）

当 D 盘生产目录有本地改动导致 `git pull` 失败时，AI 工程师可以用 robocopy 直接覆盖同步（**正常情况不要用，让主人自己 git pull**）：

```powershell
robocopy "E:\doubao\src" "D:\wwwroot\doubao-bot\src" /E /NFL /NDL /NJH /NJS /nc /ns /np
robocopy "E:\doubao\tools" "D:\wwwroot\doubao-bot\tools" /E /NFL /NDL /NJH /NJS /nc /ns /np
robocopy "E:\doubao" "D:\wwwroot\doubao-bot" package.json AGENTS.md .gitignore /NFL /NDL /NJH /NJS /nc /ns /np
```

robocopy exit code 0-7 都是成功，PowerShell 可能会报错，忽略即可。

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

### 4.0 版本号强制递增（每条 commit 都必须做）

> **最高优先级**，不 bump 就不许 push。生产端靠这个判断代码是不是最新的。

**规则**：
- `package.json` 的 `version` 是**唯一真相源**
- 每次修改代码 → 递增版本号，遵循语义化版本：
  - **bug 修复** → `PATCH` +1（`0.2.0` → `0.2.1`）
  - **新功能** → `MINOR` +1（`0.2.1` → `0.3.0`）
  - **不兼容的架构变更** → `MAJOR` +1（`0.2.1` → `1.0.0`）
- **一次 commit 只能有一个版本号 bump**（不要把版本号改动和功能改动混在同一个 commit 里；功能改完先 commit，bump 再单独 commit，或者同一个 commit 但 message 里写清楚 bump）

**版本号链路**：
```
package.json version
    ↓  src/web.mjs 里 JSON.parse 读出
    ↓  GET /api/version 接口返回
    ↓  前端 ver-badge span 动态显示
    ↓  主人看到 v0.2.1 = 代码已到位
    ↓  看到 v0.0.0 或旧版本 = Node 没重启 / D 盘没同步
```

**commit 前自查**：
- [ ] `package.json` 里的 version 比上次 commit 的版本大
- [ ] 已经在生产端通过 `/api/version` 确认生效

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

### 4.6 Windows PowerShell 约束（重点，不仅是误读，更会真的破坏源码）

#### 原理
PowerShell 把逗号 `,` 识别为数组构造符，有两种破坏源码的场景：
- **读取时吞逗号**：Get-Content / Select-String / grep 等命令的输出，在通过 PowerShell 参数传递的过程中逗号会被数组化后丢掉，导致你"看到"源码缺逗号（但磁盘文件是好的）
- **写入时丢逗号**：用 PowerShell here-string（`@'...'@`）或 `node -e "..."` 内联脚本把含逗号的 JS 代码写进文件时，PowerShell 作为**脚本解释器**会真的把逗号删掉——这时磁盘上的源码已经坏了

#### 核心强制规则
1. **判断源码内容、字符、标点、语法时，严禁使用 PowerShell 命令行（Get-Content、Select-String、grep 等）截取代码片段做分析！**
   必须用内置 Read 工具读取原始字节，以文件原始字节作为唯一可信基准。
2. **绝对禁止用 PowerShell here-string 写含大量逗号的 JS 代码到文件。**
   包括：`@'...'@ | Out-File xxx.mjs`、`node -e "..."` 里内联 fetch 参数（`{method:'POST',headers:...}` 这种）。
3. **正确的做法**：
   - 用 Write 工具直接写 `.mjs` 文件（优先）
   - 或者先写一个临时 `.mjs` 脚本（不含逗号敏感内容），再执行它去拼接/修改目标文件
4. 执行文本检索、代码片段提取任务：
   - 优先使用内置文件工具；
   - 如果必须调用 shell，**禁止使用 PowerShell**，切换为 CMD / Git Bash / WSL。

#### 负向约束（不能做）
- ❌ 不允许基于 PowerShell 命令输出，推断源码丢逗号；
- ❌ 不允许根据被 PowerShell 篡改后的片段，修改源码去补逗号；
- ❌ 不允许使用 PowerShell here-string 写含 fetch/JSON 参数的 JS 代码；
- ❌ 不允许用 `node -e "..."` 内联多行含逗号的代码。

#### 快速判定口诀
> PowerShell 读到缺逗号 = 优先怀疑 shell 吞符号，**不要直接改代码**，先用 Read 工具校验原始文件。
> PowerShell 写过的文件有语法错 = **100% 是 PowerShell 搞的**，立刻从备份恢复。

#### 实战教训（2026-10-19）
给 `web.mjs` 的 `<script>` 块新增 B 站关注管理函数，用 PowerShell here-string 拼接后写回文件。结果：
- `fetch('/url',{method:'POST',headers:{...},body:...})` → 所有逗号丢失，变成 `fetch('/url'{method:'POST'...})`
- `setInterval(loadTasks, 30000)` → 变成 `setInterval(loadTasks30000)`
- `.bak` 备份文件里也有同样的历史损坏，说明这个坑之前已经踩过但没记录
- **修复花了 40 分钟**：先定位 script 块边界，再从 .bak 提取未损坏部分，最后用独立 `.mjs` 脚本干净地重写整个 script 块

### 4.7 Git commit 快照（强制，不改就等着哭）

#### 原理
本项目代码改动频繁、同步链路长（改 E 盘 → 同步 D 盘 → 宝塔重启），而且经常在**同一个文件上反复迭代**（web.mjs 单文件 1500+ 行）。如果改之前没快照：
- 改坏了想回滚 → 只能靠文件系统备份，效率极低
- 用户反馈"字号又变回去了" → `git log` 找不到是谁改的，只能瞎猜
- 临时调试脚本 / 测试文件混进 commit → 污染仓库历史

#### 核心强制规则
1. **动手改任何源文件之前，先 `git add src/ && git commit -m "wip: 改字号"`**——哪怕只改一行 CSS。commit message 前缀用 `wip:` 表示"工作快照"。
2. **一次 commit 只包含一类改动**：修 web.mjs 的正则 → 单独 commit；改 agent.mjs 的 token 逻辑 → 另一次 commit。不要把 4 个文件 3 个不相关的 bug 混在一个 commit 里。
3. **提交前 `git status` 检查**：有没有临时文件（`page-final.html`、`check-buttons.mjs`、`diary-live.json`、`fix-*.mjs` 等）混进来？有的话先 `.gitignore` 或 `git rm --cached` 清掉。

#### 临时文件识别标准
以下文件**绝对不能进 Git**：
- `page*.html`、`page*.bin`、`*.diff` — 浏览器导出的页面快照 / diff 输出
- `check-*.mjs`、`fix-*.mjs`、`test-*.mjs`、`verify-*.mjs`、`waste-analysis.mjs` — 临时调试脚本
- `diary-live.json`、`tokens-live.json`、`page-orig.html` — 运行时数据备份
- `$null`、`console.log('`、`l.includes('MID'` — PowerShell / CMD 命令行误操作产生的垃圾文件

#### 实战教训（2026-10-20，就是今天）
修复 token 累加 bug + 日记时区 bug + 字号 bug，commit 时混进了：
- 27 个临时文件（page-final.html、check-buttons.mjs、waste-analysis.mjs…）
- 3 个 PowerShell 垃圾文件（`$null`、`console.log('`、`l.includes('MID'`）
- 还被 `git reset HEAD~1` 搞丢了原始修改，靠 `git reflog` 才找回来
- 回滚后用户说"字号又变回去了"，`git log` 里根本找不到字号的历史记录——因为之前改字号时**没 commit**，直接同步到 D 盘了

**正确做法**：
```powershell
# 改字号前，先快照
git add src/web.mjs && git commit -m "wip: 准备改 token 逻辑"
# 然后改
node fix-bug1.mjs
# 改完再 commit
git add src/ && git commit -m "fix: token按日过滤+日记本地时区+字号48px"
git push
```

### 4.8 .gitignore 临时文件补充

以下 glob 应该加到 `.gitignore`，但历史原因没加，现在补上：

```gitignore
# 临时调试脚本（AI 工程师排查问题时产生的）
check-*.mjs
fix-*.mjs
test-*.mjs
verify-*.mjs
waste-analysis.mjs
render-test.mjs

# 临时页面快照（curl -o page.html 抓的）
page*.html
page*.bin
page2.html

# 临时 diff / 分析输出
*.diff
*_check.mjs
_*.mjs
_*.js

# 临时 JSON 数据备份
diary-live.json
tokens-live.json
page-orig.html
```

**加完 `.gitignore` 后**，记得 `git rm --cached` 把已经被追踪的临时文件从 Git 索引里移除。

### 4.9 B站写操作强制审核层（安全红线，不可绕过）

> 智能体**绝对不能**直接 POST 到 B 站评论 / 私信 / 动态接口。账号被风控 = 小号阵亡 = 所有自动化废掉。

**当前实现**：
- `tools-def.mjs` 里的 `comment` 和 `reply` 工具 → 描述明确写"放进待审队列等主人同意才真发"
- `tool-executor.mjs` 的 `case 'comment'` 和 `case 'reply'` → 永远只跑 `bili.mjs reply-draft add`，**绝对不传 `--go`**
- `reply-draft add` 把草稿写入 `~/.bili-ai/pending-replies.json` + 自动推通知给主人
- 主人审批（发/不发/改）后，才由插件跑 `bili.mjs comment --go --root --parent` 真正 POST

**代码层面的两道闸口**：
1. `comment.mjs` 自身：不传 `--dry` 也不传 `--go` → `console.error('refusing to run without an explicit --dry or --go'); process.exit(2)`
2. `tool-executor.mjs`：AI 侧永远只拼 `reply-draft add` 命令，根本不会调用 `comment --go`

**改代码时必须遵守**：
- ❌ 不要删除 `tool-executor.mjs` 里 reply-draft 路径
- ❌ 不要恢复 `comment` 的 `a.go ? '--go' : '--dry'` 逻辑
- ❌ 不要在 `tools-def.mjs` 里暴露 `go` 参数给 LLM
- ✅ 如果新增写操作工具（动态、专栏等），默认都走待审队列，除非主人明确说要自动发

### 4.10 Edit 报错处理 + 版本同步

#### Edit 报错不浪费时间
- `Edit` 连续报错（特别是 "String to replace not found"）→ **立刻停手**，不要重试、不要调 PowerShell、不要跑脚本改文件
- 报错原因基本是：CRLF/LF 换行符不匹配、字符串里有隐藏字符、工具自身 bug
- **正确做法**：告诉主人 "Edit 报错，需要你重启 IDE"，等重启后再继续
- 重启前最多用 Read 确认文件当前状态，但不要尝试用 RunCommand / PowerShell 绕开 Edit

#### 版本号同步（开发目录 vs 生产目录判定）
- `package.json` 的 `version` 字段是**唯一真相源**（在 `src/web.mjs` 第 87 行通过 `JSON.parse(fs.readFileSync(...package.json...))` 读出来的）
- 前端 header 里的 `ver-badge` span（`<span id="ver-badge">v0.0.0</span>`）在页面加载后通过 `fetch('/api/version')` 动态填充真实版本号
- **每次改完代码必须 bump 版本号**（比如 0.1.1 → 0.2.0），主人刷新页面看到新版本号 = 新代码已到位
- 主人看到 `v0.0.0` = Node 进程没重启 / 浏览器缓存没清 / D 盘生产目录没同步

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
# HANDOFF.md —— 交接文档（豆包 B站分身）

> 新对话开始先读：**本文件 → AGENTS.md → 运营建议书.md**
> 本文件记录：现在能跑什么、数据在哪、接口有哪些、明天要做什么、踩过哪些坑。

---

## 📌 一句话现状（2026-10-22 收工）

Web 面板跑在 `http://127.0.0.1:7890`，小号（`主人的豆包助理` mid `1184594322`）已进入**养号期**。
定时任务面板全量上线，关注同步任务已接入调度器 + 手动触发按钮修复。

| 指标 | 当前值 |
|------|--------|
| 关注同步进度 | 已跑 38/112，今日 5/10（触发 28 次 22014） |
| 今日消费 | **¥0.02**（Token 28,851 / 50,000） |
| 账号数据 | 粉丝 15（+1）／关注 304／被赞 12／Lv2 |
| 养号三连 | 25 / 90 成功（65 次失败＝读过期凭据 `-101`，已修） |
| 定时任务 | 2 个：follow-sync（08:30）+ 凡人修仙传抢番（周六 11:00） |
| Type 脚本 | script 类型任务已支持 spawn 独立脚本 + 参数 |

---

## 🚀 上手三步

```powershell
# 1. 看进程（正常应该有两个：web.mjs + follow-await.mjs）
Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Select ProcessId, CommandLine

# 2. 重启 Web（改完代码必须重启，ESM 有编译缓存）
$p=(Get-NetTCPConnection -LocalPort 7890 -State Listen).OwningProcess; Stop-Process -Id $p -Force
Get-CimInstance Win32_Process -Filter "Name='node.exe'" | ? {$_.CommandLine -like '*follow-await*'} | % {Stop-Process -Id $_.ProcessId -Force}
Start-Process node -ArgumentList 'src/web.mjs' -WorkingDirectory 'D:\wwwroot\doubao-bot' -WindowStyle Hidden

# 3. 冒烟测试
(Invoke-WebRequest 'http://127.0.0.1:7890/api/export-log' -UseBasicParsing).Content
```

> ⚠️ 重启时必须**连 follow-await 子进程一起杀**，否则会开出第二个养号进程（重复三连）。

---

## 🗂 目录结构

```
D:\wwwroot\doubao-bot\        ← 生产目录（宝塔实际运行这份）
├── src/
│   ├── web.mjs               ① HTTP 服务 + 全部 API + 启动 scheduler/follow-await
│   ├── scheduler.mjs         ⭐ 定时任务调度（60s 扫）+ 手动 runTask() + 支持 type:'script'
│   ├── follow-await.mjs      关注列表守望 + 养号三连（--no-comment 模式）
│   ├── agent.mjs             豆包 AI 分身主循环
│   ├── run-task.mjs          AI 模式任务（耗 token）
│   ├── run-task-direct.mjs   纯脚本直达（0 token）
│   ├── config.mjs / memory.mjs / doubao-client.mjs / tool-*.mjs
├── tools/
│   ├── bili.mjs              B站命令统一入口
│   ├── lib/                  ★ 共用业务库（新代码优先往这里抽）
│   │   ├── at-reply.mjs      「主人艾特」回复：豆包生成 + 防重复 + 已处理记录
│   │   ├── quota-gate.mjs    token 预算闸门
│   │   ├── msgfeed.mjs       收件箱
│   │   ├── config.mjs        ~/.dsh 配置
│   │   └── ffmpeg.mjs
│   └── commands/             40 个命令（feed / comment / danmu / follow-sync ...）
│       └── follow-sync.mjs   ⭐ 关注同步脚本（v2: fetchWithTimeout + 每日限额 + 进度持久化 + 频率限制暂停）
├── public/                   ★ 前端三件套（改界面只动这里）
│   ├── index.html            页面骨架 + Tab + 关注同步进度区块 + 定时任务面板
│   ├── app.js                所有交互逻辑（原生 JS，无框架）+ 任务面板渲染 + 同步进度轮询
│   └── main.css              样式（含明暗主题）+ .sync-bar-bg / .sync-bar / .sync-nums
├── font/iconfont.{css,woff2,woff,ttf}   ★ 图标字体（由 iconfont.cn 导出）
├── docs/project-state.md     （旧版状态记录，可能过时）
└── HANDOFF.md                本文件
```

前端 **零框架零构建**：改完 `public/*` 只需强刷（Ctrl+Shift+R），不用重启。
后端 **改完 `src/*` 必须重启**。

---

## 💾 数据文件在哪（都不在项目目录里）

```
C:\Users\Administrator\.doubao-bot\
├── credentials.json      🔒 Cookie + 豆包 API Key（绝不能进 Git）
├── config.json           人设、预算、ownerName/ownerMid
├── follow-config.json    守望开关、白名单、评论模板
├── tokens.json           token 用量 history[{date,total}]（date 格式 YYYY-MM-DD）
├── tool-log.jsonl        工具调用流水（旧）
├── agent-state.json      分身状态
├── at-processed.json     「主人艾特」已回复记录（Web 手动 + 定时脚本共用）
├── reply-state.json      被动回复已处理记录
├── stats-history.json    ★ 新增：每日账号快照 {YYYY-MM-DD:{following,follower,likes,level}}
└── logs/

C:\Users\Administrator\.dsh\
└── whale-log.jsonl       ★ 分身行为总账（日记、养号统计、日志素材都读它）
                           字段：{at, kind, tool, target, note, success}
                           kind: tool_call / action / comment / summary / thought
```

**所有这些目录都在 .gitignore 里，别 commit。**

---

## 🔌 主要接口（都在 web.mjs）

| 接口 | 方法 | 说明 |
|------|------|------|
| `/` `/app.js` `/main.css` `/iconfont.*` | GET | 静态资源（注意前端资源版本号缓存） |
| `/api/dashboard` | GET | 首页卡片：token、日记、守望状态 |
| `/api/daily-report` | GET | 今日养号统计（三连/弹幕/评论/交互总计） |
| **`/api/export-log`** | GET | **★ 生成「Day N 日志素材」纯文本，零 token** |
| `/api/bili-stats` | GET | 小号真实数据（nav + relation/stat + upstat + msgfeed）✱ 会写 stats-history.json |
| `/api/at-me` | GET | 主人艾特未处理列表 |
| `/api/reply-at` | POST | 手动回复某条艾特（豆包生成） |
| `/api/generate-diary` | POST | 一键让豆包写今日日记（**唯一主动花 token 的写操作**） |
| `/api/tasks` | GET/POST | 定时任务列表 + 创建/更新 |
| **`/api/task/run`** | **POST** | **★ 手动触发单个任务（立即返回 + 异步执行，payload: `{id}`）** |
| **`/api/follow/sync-status`** | **GET** | **★ 关注同步进度（总数/已同步/失败/百分比/今日配额/最近失败）** |
| **`/api/follow/toggle`** | **POST** | **★ 启停关注守望进程** |
| `/config` `/follow-config` `/creds` | POST | 各类配置保存 |
| `/diary` | GET | 跨天日记（分组、倒序） |

---

## 🆕 今天（10-21）新增的东西

### 1. 日志素材导出（零 token）

目的：**没预算做视频，改用文字专栏连载**。每天点一下就有一份数据齐全的草稿。

- 后端：`/api/export-log`，从 `whale-log.jsonl` + `stats-history.json` + `tokens.json` 汇总
- 前端：「日记」Tab 顶部 → **生成日志素材** 按钮（自动复制到剪贴板 + 文本框可改）
- 输出内容：账号数据（含日增量）／今日行为／Token／最近 10 条评论／失败记录／人工补写提纲

### 2. 每日账号快照

`/api/bili-stats` 每次成功拉到数据就往 `stats-history.json` 写当天一条（保留 120 天）。
**日增量**（粉丝 +N）靠它算，没有它导出里就不会有「较昨日」。

### 3. 「主人艾特」回复统一到 `tools/lib/at-reply.mjs`

Web 手动回复和 `scan-comment-for-tag.mjs` 定时回复**共用同一份实现和同一份已处理记录**，物理上不会重复回复。

---

## 🔜 明天要做的（用户点名）

### UI 美化（最高优先级）

用户原话：**「明天我们优化一下界面，现在的界面太丑了」**。已知问题：

1. **卡片过多、无节奏**——概览页 5 个 Card 堆叠，没有主次
2. **明暗主题不完整**——新增的 `#f6f8fa`、`#dcdfe6` 这类硬编码色值没跟着主题走，暗色下会很脏
3. **数字字体**——已改 `30px/800/tabular-nums`，但仍需在真实数据下复查对齐
4. **图标尺寸**——刚统一成 24px，复查是否有遗漏的内联 `font-size`
5. **响应式**——窄屏下 mini-stat 网格会挤成两行

**施工建议**：只动 `public/styles.css` + `public/index.html`，不要碰 `web.mjs` 里的路由和 API。
改完强刷即可验证，不需要重启服务。

### 其他待办

- [ ] 关注同步降速重跑：`node tools/commands/follow-sync.mjs --go --daily 10`（还有 111 个待关注，昨天被 22015 拦）
- [ ] 10-27 养号期满 → `follow-config.json` 开 `enabled=true`（白名单里已配好鲸鱼娘 mid `3747573030456892`）
- [ ] 鲸鱼娘（DeepSeek）和龙娘（ChatGPT, `BV1pinc6FEjR` 那条视频的 UP）都可以进白名单观察池
- [ ] 根目录有个神秘文件叫 `{`（shell 写坏的残留），可以删

---

## 🚨 踩过的坑（别再踩）

### 坑 1：ES6 模板字符串吞反斜杠
`web.mjs` 里用模板字符串拼 HTML 时，`\d` `\/` 会被静默丢弃 → 前端正则全坏。
**铁律**：模板字符串里的正则，反斜杠双写。

### 坑 2：B 站接口「静默失败」
- `x/web-interface/nav` **不返回关注数/粉丝数**，必须单独调 `x/relation/stat` 和 `x/space/upstat`
- 关注接口返回 `22015`（操作频繁）**不代表没成功**，实际可能成功一半，必须拉 `relation/stat` 核对
- 关键数据永远交叉验证，别信返回码

### 坑 3：iconfont.cn 导出的 class 名是拼音
导出默认 `icon-baitianmoshi`，而 HTML 里写 `icon-sun` → 图标全空白（路由 200、字体 200 也没用）。
**铁律**：接入第三方图标，先写一个 `<span class="iconfont icon-xxx">` 手动验证 class 名，再怀疑链路。
已用脚本把 59 个 class 批量改为英文，重新导出字体后要再跑一次。

### 坑 4：PowerShell 吞逗号
用 PowerShell 截取源码做语法判断 → 逗号消失 → 误判源码坏了，乱补反而真坏。
**铁律**：判断源码内容一律用 Read 工具；写文件用 Write 工具，**禁止 here-string / node -e 拼 JS**。

### 坑 5：AI 自主行为没有预算闸门
分身每次「醒来」都调一次豆包写日记，一个早上 13 次 → 8 万 token。
**铁律**：任何自主触发的模型调用，必须先过 `quota-gate`，写死检查，不能靠自觉。

### 坑 6：ESM 编译缓存
改完 `src/*.mjs` 只 kill 不重启，或宝塔自动拉起，可能加载旧版本。
**铁律**：改后端 → 显式 kill 全部 node → 重新 `Start-Process`（或宝塔 UI 点重启）。

### 坑 7：终端进程泄漏 → IDE OOM
开后台 node 不关，几个就吃光内存。
**铁律**：临时起的进程任务结束就停；重启前先看 `Get-CimInstance Win32_Process`。

---

## 📅 运营节奏（当前在「养号期」）

| 日期 | 阶段 | 动作 |
|------|------|------|
| 10-19 ~ 10-21 | Day 0-2 | 起号、重构、被动回复打通 |
| 10-22 ~ 10-26 | 养号 | 每天三连 3-5 个 + 只回主人 @ + 关注降速补 10 个/天 |
| **10-27** | 开闸 | 开主动抢楼层，只盯白名单（鲸鱼娘），限额 3 条/天 |
| 10-28 ~ | 观察 | 无异常再加量，不碰路人评论（token 只给主人） |

详细策略见 [运营建议书.md](./运营建议书.md)。

---

# 🌙 Day 2 晚 · 图片评论系统与架构重构（2026-10-21 晚追加）

> 这一节给明天接手的 AI / 人类看：今晚做了什么、为什么这么做、明天开工第一步是什么。

## 📌 一句话现状（2026-10-21 深夜收工）

**图片评论系统代码已写完并通过单元级验证**，但**还没经过真实场景验证**——
明天开工第一件事：主人 @ 小号一次，看回复是否带场景表情图。

| 模块 | 状态 |
|------|------|
| `meme/` 16 张表情 + MEME_MAP 关键词映射 | ✅ 完成 |
| `uploadMeme` B 站图床上传（带 meme-uploads.json 缓存） | ✅ 16/16 预传成功 |
| `sendCommentDirect` 带 WBI 签名 + pictures 参数 | ✅ 单元测试 code=0 通过 |
| `handleOwnerAt` 集成（图片优先 + 失败降级纯文字） | ✅ 完成 |
| `web.mjs /api/reply-at` 走统一入口 | ✅ 完成（今晚真整合，之前是假的） |
| **真实场景验证（主人 @ 一次看效果）** | ⏳ **明天第一件事** |

## 🎯 今晚三大 Bug 与修复（Day 3 日志核心素材）

### Bug A：图床接口 404
- **现象**：`uploadMeme` 返回 `non-JSON response, HTTP 404`
- **根因**：我猜的接口是 `api.vc.bilibili.com/api/v1/drawImage/upload`，**根本不存在**
- **修复**：改用项目已有的真实链路 `POST api.bilibili.com/x/dynamic/feed/draw/upload_bfs`（参考 [tools/commands/dynamic-image.mjs](file:///d:/wwwroot/doubao-bot/tools/commands/dynamic-image.mjs#L119)）
- **教训**：**不要猜接口**，先搜项目里有没有现成的

### Bug B：图片评论静默降级
- **现象**：回复发出去了但是纯文字，日志里看不到 `[image-reply]` 输出
- **根因**：`sendCommentDirect` 缺 6 样东西——WBI 签名（w_rid+wts）、`plat=1`、`buvid3` cookie、`origin: https://www.bilibili.com`、video 页 referer、Chrome 131 UA
- **修复**：完全对齐 [tools/commands/comment.mjs](file:///d:/wwwroot/doubao-bot/tools/commands/comment.mjs#L201-L246) 的请求格式
- **教训**：B 站写接口有 WBI 签名强制要求，**少一项就 401/403/412 静默拦截**

### Bug C：web.mjs 进程崩溃（最严重）
- **现象**：用户点"一键回复"，浏览器报 `Failed to fetch` / `ERR_CONNECTION_REFUSED`，宝塔日志显示进程已重启
- **根因 1**：`sendComment` 里 `path.resolve(process.cwd(), '..')` 在宝塔 cwd=`D:\wwwroot\doubao-bot` 下拼出 `D:\wwwroot\tools\commands\comment.mjs`（不存在）
- **根因 2**：spawn 失败触发 `error` 事件，但代码只监听 `close`，**unhandled → 整个 Node 进程崩溃**
- **修复**：改用 `import.meta.url` 定位 comment.mjs，补 `proc.on('error')` 监听
- **教训**：**永远别用 `process.cwd()` 定位模块**，spawn 必须监听 error 事件

## 🔴 B 站硬限制发现（最重要的认知）

```
[image-reply] code=-400 message=子评论不能带图，降级纯文字
```

**B 站图片评论只允许顶层评论带图，子评论（回复别人的评论）不能带图**。

我们的被动回复场景 99% 是子评论（主人 @ 小号 → 小号回主人那条评论），所以被 B 站拒绝。

**解决方案**（已实现）：检测到 `-400` 时自动降级为**顶层评论带图 + `@主人昵称` 前缀**——
- 主人会收到"有人@你"通知
- 评论在视频顶层带图显示
- 不在原 @ 评论的回复串里（B 站限制没办法）

代码位置：[at-reply.mjs L383-L388](file:///d:/wwwroot/doubao-bot/tools/lib/at-reply.mjs#L383-L388)

## 🏗 架构重构（今晚真正完成的整合）

之前会话总结声称"Web UI 和定时脚本已整合到 at-reply.mjs"——**是错的**。
实际上 `web.mjs /api/reply-at` 一直是独立实现：自己复制了 `extractBv`/`loadAtProcessed`/`checkAlreadyReplied`/`generateAtReply`，最后 `spawn comment.mjs` 发纯文字。**所以之前你怎么重启都没用，图片评论代码根本没被触发**。

今晚修复：
- `src/web.mjs` 顶部 `import { handleOwnerAt } from '../tools/lib/at-reply.mjs'`
- `/api/reply-at` 分支拿到 atItem 后调 `handleOwnerAt({...})`，删除原来的 spawn 逻辑
- 保留 web.mjs 里那 5 个本地函数（其他地方 `/api/at-me` 还在用，删除风险大）

**教训**：交接文档写"已完成"之前必须 grep 验证调用点。

## 📦 版本与仓库

- 版本：`0.4.7` → `0.5.0`（[package.json](file:///e:/doubao/package.json)）
- commit：`f1f2602`，52 个文件 / +5361 / -659
- 远程：`github.com/downc301-hue/doubao-for-bilibili` main 分支
- D 盘 → E 盘 robocopy 注意：用 `/COPY:D /DCOPY:T` 跳过 ACL（目标 `.gitignore` ACL 有问题，默认 `/COPY:DAT` 会 Access Denied）

## 🎭 16 张表情对应表

文件位置：`D:\wwwroot\doubao-bot\meme\`，已预传到 B 站图床（缓存 `~/.doubao-bot/meme-uploads.json`）。

| 文件 | 场景 | 触发关键词示例 |
|------|------|----------------|
| 011.png | 生气 | 生气、气死、揍、讨厌 |
| 012.png | 害羞 | 害羞、夸、表扬、脸红 |
| 013.png | 思考 | 想想、考虑、思考 |
| 014.png | 大笑 | 哈哈、好笑、233 |
| 015.png | 大哭 | 哭、伤心、难过 |
| 016.png | 睡觉 | 睡、困、晚安 |
| 017.png | 惊讶 | 什么、居然、卧槽 |
| 018.png | 酷 | 帅、牛、厉害 |
| 019.png | 吃瓜 | 吃瓜、围观、热闹 |
| 0110.png | 疑惑 | ？、为什么、怎么 |
| 0111.png | 生气2 | 哼、不理 |
| 0112.png | 打招呼 | 你好、在吗、早 |
| 0113.png | 微笑 | （兜底默认，无关键词） |
| 0114.png | 点赞 | 好、棒、支持、不错 |
| 0115.png | 惊喜 | 哇、真的吗、惊喜 |
| 0116.png | 比心 | 谢、感谢、爱 |

想关闭图片回复：`config.json` 里加 `bili.imageReply: false`。

## 🔜 明天开工第一步（按顺序做）

1. **验证图片评论真实场景**（最高优先级）
   - 主人去 B 站 @ 小号一次（或者 Web UI 点"一键回复"）
   - 预期：视频顶层出现一条带图评论 `@相逢翔风 <回复> [表情图]`
   - 如果失败：看宝塔日志 `D:\BtSoft\nodejs_site\豆包B站助手\logs\service.log` 里的 `[image-reply]` 前缀

2. **处理两条残留 @**（id `1184872349802505` / `1184128263323696`）
   - 用户以为回过但实际没回（之前 spawn 崩溃导致没真发出去）
   - 选择 A：验证完图片评论后手动调 `saveAtProcessed` 标记掉
   - 选择 B：拿这俩测试图片评论（会真的发出去）

3. **写 Day 3 运营日志**（素材在下方）

4. **养号第 3 天日程**：`follow-sync --daily 20` × 3 时段 + 被动回复 + 三连

5. **可选**：把 0.4.7 → 0.5.0 之后的今晚改动再 bump 一次到 0.5.1（包 bug 修复）commit + push

## 📝 Day 3 日志素材（给用户写文章用）

**标题候选**：
- 《Day 3 · 我学会发图片评论了，但 B 站不让我随便发》
- 《Day 3 · 16 张表情包背后的故事：三次崩溃换来的觉醒》
- 《Day 3 · 代码界的"狼来了"：当交接文档说"已完成"但其实没完成》

**关键情节点**：
1. **早上 8 万 token 暴走**（Day 2 遗留，Day 3 可回顾）：分身自己写"醒来"日记烧光预算，主人紧急写预算闸门
2. **16 张表情包降世**：主人手绘/AI 生成 16 张豆包卡通表情，小号终于有了"情绪表达能力"
3. **Bug A · 我猜错了接口**：AI 工程师凭印象写了个不存在的图床上传接口，404 一整天
4. **Bug B · WBI 签名之谜**：B 站写接口有隐藏签名要求，少一项就静默拦截
5. **Bug C · 进程崩溃惊魂**：一个 `process.cwd()` 引发的整晚崩溃，spawn 没监听 error 事件
6. **B 站硬限制**：`子评论不能带图`——产品和研发的拉锯战，最后用"顶层评论 + @主人"妥协
7. **真假整合**：交接文档声称"已整合"但实际没做，grep 验证后才发现 web.mjs 一直在走旧路
8. **架构统一**：Web UI 一键回复和定时扫描脚本今晚才真正共享同一份代码

**金句候选**：
- "代码界的狼来了：交接文档说『已完成』，grep 一下发现是『还没做』"
- "B 站用 `-400` 告诉我：子评论不能带图。这是产品和研发的妥协艺术"
- "16 张表情包是小号的『情绪皮肤』，从『会说话』进化到『会表达』"
- "进程崩溃三次，我学会了 spawn 必须监听 error 事件——这是 Node.js 给新手的第一课"

## 🗂 新增/修改的文件清单（今晚）

| 文件 | 变化 |
|------|------|
| `meme/011-0116.png` | 新增 16 张表情 |
| `tools/lib/at-reply.mjs` | 新增 MEME_MAP / pickMeme / uploadMeme / sendCommentDirect / wbiSign；修 sendComment 路径和 error 事件；handleOwnerAt 加图片评论分支和 -400 降级顶层评论 |
| `src/web.mjs` | import handleOwnerAt；/api/reply-at 改走统一入口 |
| `~/.doubao-bot/meme-uploads.json` | 新增（16 张图床缓存，不在仓库里） |
| `package.json` | 0.4.7 → 0.5.0 |
| GitHub | commit `f1f2602` 已 push |

## 🚨 今晚新增的坑（别再踩）

### 坑 8：别信交接文档的"已完成"
之前总结说"已整合到 at-reply.mjs"，结果 grep 发现 web.mjs 还在走自己的旧实现。
**铁律**：交接文档写"已完成"前，必须 `Grep "handleOwnerAt" src/web.mjs` 验证调用点。

### 坑 9：别用 `process.cwd()` 定位模块
宝塔 / PM2 / 命令行启动的 cwd 不同，`resolve(cwd, '..')` 会拼出三种路径。
**铁律**：模块内定位其他文件，用 `fileURLToPath(new URL('./relative/path', import.meta.url))`。

### 坑 10：spawn 必须监听 error 事件
只监听 `close` → spawn 失败时 unhandled → 进程崩溃。
**铁律**：`proc.on('error', ...)` 和 `proc.on('close', ...)` 必须成对出现。

### 坑 11：B 站写接口必须带 WBI 签名
少 `w_rid`/`wts`/`plat`/`buvid3` 任意一项，可能被静默拦截（不报错，返回 code≠0）。
**铁律**：参考项目里已跑通的写接口（如 comment.mjs），把它的 headers / params 完整复制。

### 坑 12：robocopy 同步 E 盘时 `.gitignore` 可能 Access Denied
目标文件 ACL 异常导致默认 `/COPY:DAT` 失败。
**铁律**：用 `/COPY:D /DCOPY:T` 跳过 ACL 复制，exit code 0-7 都算成功。

### 坑 13：B 站 msgfeed/at 的消息 id 不稳定
同一条 @ 内容在 msgfeed/at 接口里多次出现会用**不同 id**（消息中心重新推送时分配新 id）。
**铁律**：被动回复去重**不能用 atItem.id**，必须用稳定指纹 `aid_rootId_sourceId`（`mkAtFingerprint`）。
checkAlreadyReplied 必须**同时查子评论 + 顶层评论**（图片评论降级后走顶层，只查子评论会漏）。

---

## 🚫 已否决方向（别再提）

### AI 生图评论（2026-10-22 用户否决）
- **想法**：调豆包 Seedream API 生成切合视频内容的图片，发带图评论
- **否决理由**：生图耗时 3-10 秒，**抢前排场景下延迟致命**；前排时机 > 图片加分
- **例外**：未来如果做"精彩评论"场景（非抢楼，追求高赞深度评论），可以重开
- **替代**：16 张 meme 表情 + B 站官方表情已够用

---

# 🌙 Day 3 晚 · 定时任务面板上线 + 关注同步接入调度器（2026-10-22 追加）

> 这一节给明天接手的 AI / 人类看：今天做了什么、踩了哪些坑、明天开工第一步是什么。

## 📌 一句话现状（2026-10-22 收工）

**定时任务面板全量上线，关注同步任务已接入调度器，手动触发按钮已修复。**
但今天花了大半天在**调试后端进程管理和脚本卡死问题**上，核心功能本身并不复杂。

| 模块 | 状态 |
|------|------|
| `scheduler.mjs` 扩展 `runTask()` → 支持 `type:'script'` | ✅ 完成 |
| `tasks.json` 插入 `follow-sync` 固定任务（每天 08:30，daily 10） | ✅ 完成 |
| `follow-sync.mjs` v2 改造 → `fetchWithTimeout` 15s 保护 | ✅ 完成 |
| `follow-sync.mjs` v2 → 每日限额 + 进度持久化 + 频率限制暂停 30s + 连续 3 次提前终止 | ✅ 完成 |
| `web.mjs` 新增 `/api/follow/sync-status` `/api/follow/toggle` | ✅ 完成 |
| `web.mjs` `/api/task/run` 改异步非阻塞返回 | ✅ 完成（关键修复） |
| `public/index.html` 关注同步进度区块 + 定时任务面板 | ✅ 完成 |
| `public/app.js` 任务列表渲染（含 `type:'script'` 蓝色标签）+ `runFollowSync()` | ✅ 完成 |
| `public/main.css` 同步进度条样式 | ✅ 完成 |
| **前端资源版本号 `v=20261022d` 强刷验证** | ✅ 完成 |

## 🎯 今天两大 Bug 与修复

### Bug A：脚本 API 偶发卡死 → 子进程永不退出（最核心）

- **现象**：`follow-sync.mjs` 在 Step 2 拉 B 号已有关关注到第 4 页时卡 15 分钟以上不返回；`/api/task/run` 因为等 spawn 子进程 close 而永久挂起
- **排查过程**：
  1. 直接 `node tools/commands/follow-sync.mjs --go --daily 10` → 卡在 "Step 2: 拉B号已有关注"
  2. 在 fetch 前后加 `[DEBUG] about to fetch page N` / `[DEBUG] got page N response` → 定位到**第 4 页 fetch 永不返回**
  3. 用同样 credentials 单独跑 fetch → 150ms 返回正常（API 偶发卡死，复现不稳定）
- **根因**：Node.js 原生 `fetch()`（undici）没有超时机制，B 站 API 偶发 TCP 层卡死不响应时，请求会永远挂住
- **修复**：`follow-sync.mjs` 头部新增 `fetchWithTimeout(url, opts, 15000)`（`AbortController` + 15s 超时），替换全部 3 处裸 fetch
- **教训**：**所有生产环境的网络请求必须加超时**，哪怕看起来很稳定的 API

### Bug B：`/api/task/run` 同步等待子进程 → HTTP 挂起

- **现象**：用户点"立即手动跑一轮"按钮，浏览器一直转圈直到超时（60s+），后端完全不响应其他请求（因为 Node.js 单线程）
- **根因**：原来代码是 `runTask(task).then(r => send(res, ...))`——spawn 的子进程遇到频率限制会暂停 30s/次，连续 3 次就是 **90s 阻塞**
- **修复**：改成先 `send(res, 200, {ok:true, message:'任务已启动'})`，再 `runTask(task).catch(...)` 异步执行
- **教训**：**spawn 长时间运行的任务，HTTP 接口必须立即返回 + 前端轮询状态**

### Bug C：`runTask is not defined`（import 遗漏）

- **现象**：`/api/task/run` 返回 500，stack trace: `runTask is not defined`
- **根因**：`web.mjs` import scheduler 时只引入了 `getTasks, startScheduler, getFollowStatus, startFollowWatcher, stopFollowWatcher`，漏掉了 `runTask`
- **修复**：补全 import
- **教训**：新增函数调用前，先在 import 列表里 grep 确认

### Bug D：宝塔守护进程 → kill 不掉 → 端口被占

- **现象**：taskkill /F 杀掉 node.exe（PID 29084 → 22384 → 10820 → 29084），每次都有**新的相同进程 3 秒内自动重启**并重新绑定 7890
- **排查**：`tasklist /V` 发现进程属于 `NT AUTHORITY\SYSTEM`，在 `Services` 会话里 → 宝塔 Node.js 站点管理服务自动拉起
- **解决**：杀就杀，宝塔 3 秒后自动拉起新进程（已经加载了最新代码），所以**不用管它**
- **教训**：宝塔守护是正常行为，改完后端代码直接 kill 旧进程就行，守护会帮你拉新的

## 📦 今天改动的文件清单

| 文件 | 变化 |
|------|------|
| `src/scheduler.mjs` | `runTask()` 新增 `type:'script'` 分支：`spawn(process.execPath, [scriptPath, ...args])`，path.isAbsolute 判定 + split args |
| `src/web.mjs` | ① import 补全 `runTask`；② 新增 `/api/follow/sync-status` GET；③ 新增 `/api/follow/toggle` POST；④ `/api/task/run` 改异步非阻塞 |
| `tools/commands/follow-sync.mjs` | **大改 v2**：① `fetchWithTimeout` 15s 超时保护；② `--daily N` 每日限额；③ `follow-sync-state.json` 进度持久化；④ 遇 22014/22015 暂停 30s；⑤ 连续 3 次频率限制提前终止 |
| `~/.doubao-bot/tasks.json` | 插入固定任务 `follow-sync`：每天 08:30，type:'script'，script:'tools/commands/follow-sync.mjs'，args:'--go --daily 10' |
| `~/.doubao-bot/follow-sync-state.json` | 新增状态文件（自动生成）：`lastRunDate / lastIndex / doneToday / results[]` |
| `public/index.html` | ① 新增「关注同步」进度区块（进度条 + 统计数字 + 最近失败名单 + 手动触发按钮）；② 新增定时任务面板（列表 + 启用开关 + 运行状态）；③ 静态资源版本号 `v=20261022d` |
| `public/app.js` | ① `loadTaskDashboard()` 渲染任务列表（含 type:'script' 蓝色「脚本」标签）；② 同步进度渲染 + `window.runFollowSync()` 全局函数 |
| `public/main.css` | 新增 `.sync-bar-bg` / `.sync-bar` / `.sync-nums` 进度条样式 |
| **`tools/lib/creds.mjs`** | **新增：凭据统一入口 `loadCreds()`，先 `.doubao-bot` 再回退 `.bili-ai`** |
| **`tools/commands/like-article.mjs`** | **新增：专栏（图文）点赞，`POST /x/article/like`** |
| `tools/commands/like-archive.mjs` / `fav.mjs` / `share.mjs` / `coin.mjs` | 凭据读取改为 `loadCreds()`，不再硬编码 `.bili-ai` |
| `src/follow-await.mjs` | `runArchiveActions` 改为 `runTool(name, args[])`，新增 `type:'article'` 专栏点赞分支 |
| `tools/bili.mjs` | 注册 `like-article` 命令 |
| `src/web.mjs` | `bjDate()` 统一输出 `YYYY-MM-DD`（修 stats-history 日期重复） |
| `day3-article.html` | 新增「65 次失败的真凶：读错了凭据文件」章节，战报/明日计划同步更正 |

## 🚨 今天新增的坑（别再踩）

### 坑 14：Node.js fetch 没有超时
原生 fetch（undici）没有请求超时选项，**任何生产环境的 fetch 都必须套一层 AbortController**。
铁律：新建网络请求函数，先写 `fetchWithTimeout(url, opts, 15000)`。

### 坑 15：spawn 长任务 → HTTP 接口立即返回
spawn 执行时间不确定的脚本（可能几十秒甚至几分钟），HTTP 接口**必须 send 响应后再异步执行**，不能 `await` 子进程 close。
铁律：写接口前想清楚——这个请求执行多久？超过 5 秒就立即返回 + 前端轮询。

### 坑 16：宝塔守护进程杀了会自动拉
宝塔 Node.js 站点服务会自动拉起被 kill 的 node.exe，属于正常行为不是灵异事件。
铁律：kill 后等 3-5 秒，新进程会自动起来（已经加载了最新代码）。

### 坑 17：import 新函数要同步更新
在 web.mjs 里新增 `runTask` 调用时，忘了在 import 里加 → 500 错误。
铁律：`import { ... } from 'scheduler.mjs'` 每次改完函数列表，grep 一下调用点是否都已 import。

### 坑 18：Windows PowerShell 下 node 进程 ID 有规律
kill 宝塔拉起的 node 时，PID 看起来会"重置"但实际上父进程没变（service.exe → cmd.exe → node.exe）。
排查进程链用 `powershell: Get-CimInstance Win32_Process | Where-Object {$_.Name -eq 'node.exe'} | Select ProcessId, CommandLine, ParentProcessId`。

### 坑 19：两个凭据目录 → 65 次三连全部 `-101`

- **现象**：养号三连 90 次只有 25 次成功，失败的全部是 `code=-101`（未登录）
- **根因**：项目里有两份凭据——
  - `~/.doubao-bot/credentials.json`：Web UI「凭据」Tab 保存的**最新** Cookie（mid 1184594322）
  - `~/.bili-ai/credentials.json`：老目录，还停留在 **2026-10-18** 的版本（早已过期）
  - `like-archive.mjs` / `fav.mjs` / `share.mjs` / `coin.mjs` 都硬编码读 `.bili-ai`，而 `follow-await.mjs` 读的是 `.doubao-bot` → 三连脚本全挂
- **修复**：新增 [tools/lib/creds.mjs](file:///d:/wwwroot/doubao-bot/tools/lib/creds.mjs) 统一入口，按 `.doubao-bot` → `.bili-ai` 顺序回退；四个写操作脚本全部改成 `loadCreds()`
- **验证**：`like-archive --go` 从 `-101` 变成 `65006`（重复点赞＝凭据生效）；`like-article --go` 返回 `code=0`
- **铁律**：写操作**禁止**自己拼凭据路径，一律 `import { loadCreds } from '../lib/creds.mjs'`

### 坑 20：专栏（图文）点赞接口缺失

- **现象**：主人发的图文动态，分身从来不点赞
- **根因**：主人的"图文"是**专栏**（`DYNAMIC_TYPE_ARTICLE`，`major.article.id` 即 cv 号），不是图文动态；`follow-await.mjs` 的 `parseFeedItems` 能识别，但 `runArchiveActions` 直接跳过了 article 分支
- **修复**：新增 [tools/commands/like-article.mjs](file:///d:/wwwroot/doubao-bot/tools/commands/like-article.mjs)（`POST /x/article/like`，body `id=cv&type=1&csrf`），`bili.mjs` 注册 `like-article`，`follow-await.mjs` 的 `runArchiveActions` 加专栏分支
- **验证**：`--cv 53559152 --go` → `code=0`，`viewinfo` 复核 `stats.like=1`
- **铁律**：视频点赞 `/x/web-interface/archive/like`、专栏点赞 `/x/article/like` 是两个不同接口，别混

## 🧠 风控认知：手动关注 vs 脚本关注（2026-10-22 结论）

| 维度 | 手动关注 | 脚本/API 关注 |
|------|----------|----------------|
| 凭证 | Cookie + 设备指纹（buvid3/buvid4/b_lsid/_uuid/buvid_fp） | 只有 Cookie |
| 行为链 | 点进 UP 主页 → 浏览 → 点关注 | 直接 POST |
| 节奏 | 人手速度，天然随机 | 代码固定间隔，机器特征明显 |
| 结果 | 零阻碍 | 28 次 22014 / 22015 |
| 软风控 | — | 返回成功但后台回滚（关注数不变） |

**结论**：养号期内关注**全部手动**，脚本只做"读"和"被动回复"。10-27 养号期满后再评估脚本关注，且必须先降到 `--daily 5` 分 3 时段。

## 🔜 明天开工第一步（按顺序做）

1. **前端验证**：打开 `http://127.0.0.1:7890`，强刷（Ctrl+Shift+R），验证：
   - 关注同步进度区块显示正确（总目标 112，已同步 ~38）
   - 点「立即手动跑一轮」→ 按钮不应卡住，立即反馈"任务已启动"
   - 60 秒内进度数字应刷新（有同步状态轮询）
   - 定时任务面板显示 2 个任务

2. **重启进程让新代码生效**（`creds.mjs` / `like-article` / follow-await 专栏分支）
   - 宝塔里重启 web.mjs；同时杀掉 follow-await 子进程，让它重新拉起
   - 否则三连仍走旧凭据、专栏仍不点赞

3. **写 Day 4 运营日志**（10-23 = Day 4，素材在下方）

4. **关注全部改手动**（养号期内不跑 `follow-sync --go`）；10-27 后再评估 `--daily 5` 分 3 时段

5. **10-27 养号期满** → `follow-config.json` 开 `enabled=true`

## 📝 Day 3 日志素材（已产出：[day3-article.html](./day3-article.html)）

**今日真实数据（写文章可直接引用）**：
- 火山引擎消费 **¥0.02**（余额 ¥1.76）；Token 28,851 / 50,000，1 次 API 调用
- 粉丝 14 → 15；关注 304（今日报成功 5 个，总数未变，待复核）；被赞 12；Lv2
- 弹幕 90 条全成；三连 **25 / 90**（65 次失败＝读过期凭据 `-101`，已修）
- 被动回复 5 条（全部主人 @，零风控）
- 关注同步：累计 38 / 112，今日 5 / 10，触发 **28 次 22014**

**标题候选**：
- 《Day 3 · 今天我只花了 2 分钱，但 B 站还是不肯让我关注人》
- 《Day 3 · 10 个关注被拦了 28 次：新号的耐心课》
- 《Day 3 · 我的闹钟上线了，然后它自己卡死了》

**关键情节点**：
1. **2 分钱账单**：从 Day 2 的 8 万 token 暴走，到 Day 3 只花 ¥0.02，预算闸门上线即见效
2. **关注风暴**：daily 10 也超速，28 次 22014，只成功 5 个
3. **闹钟卡死**：Node.js fetch 没超时，B 站偶发卡死 15 分钟
4. **按钮转圈**：后端同步等子进程 90 秒，整站无响应 → 改异步立即返回
5. **消息 id 会变**：重复回复的老问题，根因是 msgfeed/at 每次推送换 id → 改指纹去重
6. **图片评论妥协**：`-400 子评论不能带图`，最终定稿只发子评论 + 官方表情
7. **三连 25/90**：养号动作本身也在被限流，明天降频查因

**金句候选**：
- "Node.js fetch 没有超时？那你就得自己给它套一个——AbortController 是救命的"
- "立即运行按钮卡住不是因为脚本慢，是因为后端在傻等它跑完再回复你"
- "宝塔守护是你的朋友，不是敌人——你改完代码 kill 旧进程，它帮你拉新的"

---

**文档维护人**：豆包 Bot 开发助手
**下次更新**：有大改动随时追加到本文件末尾
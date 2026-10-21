# HANDOFF.md —— 交接文档（豆包 B站分身）

> 新对话开始先读：**本文件 → AGENTS.md → 运营建议书.md**
> 本文件记录：现在能跑什么、数据在哪、接口有哪些、明天要做什么、踩过哪些坑。

---

## 📌 一句话现状（2026-10-21 收工）

Web 面板跑在 `http://127.0.0.1:7890`，小号（`主人的豆包助理` mid `1184594322`）已进入**养号期**：
只做三连/弹幕/被动回复，主动抢楼层等到 **10-27** 再开。Token 已上闸门，只花在「回复主人 @」上。

| 指标 | 当前值 |
|------|--------|
| 关注 / 粉丝 / 被赞 | 304 / 13 / 12 |
| 等级 | Lv2 |
| 今日 Token | 83,101 / 50,000（早上分身暴走烧的，已修） |
| 被动回复 | 今日 20 条，全成功，零风控 |
| 主动评论 | **关闭中**（`follow-config.json` 的 `enabled=false`） |

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
│   ├── scheduler.mjs         定时任务调度（60s 扫一次）
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
├── public/                   ★ 前端三件套（改界面只动这里）
│   ├── index.html            页面骨架 + Tab
│   ├── app.js                所有交互逻辑（原生 JS，无框架）
│   └── styles.css            样式（含明暗主题）
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
| `/` `/app.js` `/styles.css` `/iconfont.*` | GET | 静态资源（iconfont 路由必须指向 `font/`） |
| `/api/dashboard` | GET | 首页卡片：token、日记、守望状态 |
| `/api/daily-report` | GET | 今日养号统计（三连/弹幕/评论/交互总计） |
| **`/api/export-log`** | GET | **★ 新增：生成「Day N 日志素材」纯文本，零 token** |
| `/api/bili-stats` | GET | 小号真实数据（nav + relation/stat + upstat + msgfeed）✱ 会写 stats-history.json |
| `/api/at-me` | GET | 主人艾特未处理列表 |
| `/api/reply-at` | POST | 手动回复某条艾特（豆包生成） |
| `/api/generate-diary` | POST | 一键让豆包写今日日记（**唯一主动花 token 的写操作**） |
| `/api/tasks` | GET/POST | 定时抢番任务 |
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

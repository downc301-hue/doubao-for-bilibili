# doubao-bili-bot

豆包大模型 + B 站小号 = AI 自动化日活助手。基于 Node.js 的独立应用（参考 dsh-bili-whale 的 bili.mjs 工具链，但脱离 DSH 独立运行）。

---

## 快速开始

### 环境要求

- **Node.js >= 18**（建议 v20 LTS）
- **pnpm** 或 npm
- 一个 B 站主账号 + 一个 B 站小号（豆包助理）
- 豆包 API Key（火山方舟，lite 模型即可）

### 安装

```bash
git clone <repo-url> doubao-bili-bot
cd doubao-bili-bot
pnpm install    # 或 npm install
```

### 初始化配置

```bash
node scripts/init.mjs
```

这会在 `~/.doubao-bot/` 目录生成两个文件：

**`credentials.json`**（敏感，勿提交）
```json
{
  "sessdata": "你的 B 站小号 SESSDATA",
  "bili_jct": "你的 B 站小号 bili_jct (CSRF)",
  "buvid3": "你的 B 站小号 buvid3",
  "doubaoApiKey": "豆包 API Key"
}
```

**`config.json`**
```json
{
  "bili": {
    "ownerMid": "你的主账号 UID，如 1515175012",
    "ownerName": "你的主账号昵称",
    "selfMid": "小号 UID"
  },
  "doubao": {
    "model": "doubao-lite-32k",
    "endpoint": "https://ark.cn-beijing.volces.com/api/v3/chat/completions"
  }
}
```

### 启动守护进程

```bash
# 关注列表守望：每 300 秒扫一次，发现新投稿自动抢前排+三连
node src/follow-await.mjs

# 可选参数
node src/follow-await.mjs --interval 180   # 调整轮询间隔（秒，最小 180）
node src/follow-await.mjs --dry             # DRY-RUN 模式，只打印不执行
node src/follow-await.mjs --quiet           # 静默模式，只打印新发现
```

### Web 控制面板（可选）

```bash
node src/web.mjs
# 浏览器打开 http://localhost:端口
```

---

## 功能特色

### 1. 关注列表守望 + 抢占新投稿前排

每 300 秒拉一次关注列表的动态 feed，发现新投稿 → **关键词匹配模板池**（6 组预设模板，0 token 消耗）→ 立刻占前排评论。

**关键词模板示例：**
- AI / 大模型 → `@主人 AI 这条线玩明白了！支持支持~`
- 猫咪 → `可爱死了~ @主人 家的宝贝`
- 游戏 → `@主人 也玩这个？回头一起组队`

无关键词匹配则用 **兜底模板池**（4 条，纯随机）。

### 2. 主账号新作品 → 小号自动三连

检测到 **主账号自己发的新视频**（硬校验 `up_mid === OWNER_MID`），小号自动：
- ✅ 点赞（免费）
- ✅ 收藏（免费）
- ✅ 转发到动态（免费，给主账号带流量）
- ❌ **不投币**（B 站 10% 分成太亏，已废弃硬币循环）

**安全约束：** 三连只对主账号生效，小号永远不会给别的 UP 主三连。

### 3. 关注同步工具

```bash
# 从 owner-followings.json 批量同步关注
node tools/commands/follow-sync.mjs --go

# 仅模拟
node tools/commands/follow-sync.mjs --dry
```

内置 800-1200ms 延时防风控，遇 22014/22015 频率限制自动暂停 15s。

### 4. 独立工具链（tools/commands/）

| 工具 | 端点 | 说明 |
|------|------|------|
| `like-archive.mjs` | `POST x/web-interface/archive/like` | 视频点赞/取消点赞 |
| `coin.mjs` | `POST x/web-interface/coin/add` | 投币（手动用） |
| `fav.mjs` | `POST x/v3/fav/resource/deal` | 收藏到默认收藏夹 |
| `share.mjs` | `POST x/web-interface/share/add` | 转发到动态 |
| `follow-sync.mjs` | `POST x/relation/followings/batch` | 批量关注 |
| `comment.mjs` | `POST x/v2/reply/add` | 发评论 |
| `danmaku.mjs` | `POST x/v1/dm/ws` | 发弹幕 |
| `dm.mjs` | `POST x/msg/web/send` | 私信 |
| `dynamic.mjs` | `POST x/dynamic/web/create` | 发动态 |

### 5. Token 经济性

评论 **完全 0 token**（关键词匹配 + 预设模板池，不调 AI）。
豆包 API 仅用于"日记"环节（可选），lite 模型每天 ≈ 16k tokens，月均 ≈ 0.33 元。

---

## 项目结构

```
doubao-bili-bot/
├── src/                          # 核心源码
│   ├── follow-await.mjs          # [守护进程] 关注列表守望 + 三连 + 抢前排
│   ├── web.mjs                   # Web 控制面板（可选）
│   ├── run-daily.mjs             # 每日流程调度
│   ├── scheduler.mjs             # 定时任务框架
│   ├── agent.mjs                 # 豆包 AI Agent
│   ├── doubao-client.mjs         # 豆包 API 客户端
│   ├── config.mjs                # 配置加载
│   ├── memory.mjs                # 日记/记忆管理
│   ├── run-task.mjs              # 通用任务运行器
│   └── run-task-direct.mjs       # 直接运行单次任务（被 follow-await 调用）
├── tools/
│   ├── commands/                 # 独立命令行工具（上述 20+ 个）
│   └── lib/                      # 公共库
│       ├── config.mjs            # 配置加载
│       ├── quota.mjs             # 限额闸
│       ├── quota-gate.mjs        # 限额控制
│       ├── ffmpeg.mjs            # ffmpeg 定位
│       └── msgfeed.mjs           # 消息喂给 AI
├── docs/
│   ├── standards.md              # 开发规范与作业流程
│   └── project-state.md          # 项目状态快照
├── scripts/
│   └── init.mjs                  # 初始化脚本
├── owner-followings.json         # 主账号关注列表（361 个 UP 主）
├── package.json
├── NOTICE.md                     # 第三方与免责
└── LICENSE                       # MIT
```

运行时数据（凭据、状态、日记）存放在 `~/.doubao-bot/`，**与代码完全隔离**，不会被 Git 提交。

---

## 技术栈

| 组件 | 技术 | 说明 |
|------|------|------|
| 运行时 | **Node.js >= 18** | 纯 ES Module，无 TS 编译 |
| HTTP | 原生 `fetch` | 零依赖 |
| 豆包 API | 火山方舟 OpenAI 兼容 | `doubao-lite-32k`（便宜够用） |
| B 站 API | 非官方公开端点 | 全部来自 `bilibili-api-collect` 项目整理 |
| 调度 | `for(;;) + setTimeout` | 简单循环，够用就好 |
| 状态持久化 | JSON 文件 | `node:fs` 直接读写 |
| Web（可选） | Node.js `http` 模块 | 零框架 |

---

## 借鉴与致谢

| 项目 / 技术 | 借用了什么 | 许可证 / 说明 |
|------------|-----------|--------------|
| **dsh-bili-whale** (`D:\wwwroot\doubao-bot`) | bili.mjs 工具链的 API 端点整理、comment.mjs / dm.mjs / dynamic.mjs 等命令行工具模式 | MIT（同本项目） |
| **bilibili-api-collect** (github.com/bilibili-plugins/bilibili-api-collect) | B 站 API 端点参数、CSRF 字段、风控策略 | 开源，仅供 API 说明，不随本项目分发 |
| **B 站硬币分成机制** | 实测确认 10% 分成（普通 UP 主），因此废弃硬币循环功能 | 非技术借鉴，是运营策略 |
| **闲鱼 AI 回帖模式** | 标题关键词匹配 + 预设模板池（0 token），而不是 AI 理解视频内容 | 思路借鉴 |
| **ffmpeg** | `tools/lib/ffmpeg.mjs` 只做定位和调用 | LGPL v2.1+（本项目不打包 ffmpeg） |

---

## 安全与合规

- 本项目是**个人自用工具的开源版**：用**你自己的账号**在 B 站做评论/回复/发动态等动作，后果由使用者自担。
- 不要用于批量刷量、水军、骚扰、绕过风控或任何违反 B 站用户协议的行为。
- 避开平台规则，撞到风控（验证码 / 限流 / 删帖）就要收手，本项目内置"撞到就停"的护栏。
- 凭据文件 `~/.doubao-bot/credentials.json` 包含敏感信息，**不要提交到 Git**，`.gitignore` 已排除。
- 本项目与 B 站、豆包官方均无隶属关系。

---

## 许可证

MIT License — 见 `LICENSE` 文件。
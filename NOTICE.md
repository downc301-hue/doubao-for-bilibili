# NOTICE — 第三方与免责

本项目（`doubao-bili-bot`）自身代码以 **MIT** 许可发布（见 `LICENSE`）。

## 依赖 / 参考了这些第三方

| 名称 | 用途 | 许可证 / 说明 |
|---|---|---|
| **Bilibili API** | 全部功能都调 B 站公开端点（非官方） | 本项目*不包含* B 站任何代码或数据 |
| **bilibili-api-collect** (github.com/bilibili-plugins/bilibili-api-collect) | API 端点参数整理、CSRF 字段、风控策略参考 | 遵循其原项目许可；仅供 API 说明，不随本项目分发 |
| **dsh-bili-whale** (`D:\wwwroot\doubao-bot`) | bili.mjs 工具链的命令行模式、comment.mjs / dm.mjs / dynamic.mjs 等工具的参数约定 | MIT，同本项目；直接复用源码 |
| **闲鱼 AI 回帖模式** | "标题关键词匹配 + 预设模板池" 0 token 方案 | 思路借鉴，不涉及代码 |
| **ffmpeg** | `tools/lib/ffmpeg.mjs` 只做**定位并调用系统已安装的 ffmpeg** | LGPL v2.1+（若用 GPL 构建则为 GPL）。本项目**不打包** ffmpeg，请自行安装 |
| **Node.js** | 运行时 | MIT |
| **火山方舟 / 豆包** | AI API 提供商 | 其服务条款 |

## 免责

- 本项目是**个人自用工具的开源版**：它用*你自己的账号*在 B 站做评论/回复/发动态等动作，*后果由使用者自担*。
- 不要用于批量刷量、水军、骚扰、绕过风控或任何违反 B 站用户协议的行为。
- 避开平台规则，撞到风控（验证码 / 限流 / 删帖）就要收手，本项目内置"撞到就停"的护栏。
- 本项目与 B 站、豆包官方均无隶属关系。
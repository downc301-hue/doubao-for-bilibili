# HANDOFF.md —— AI 对话交接文档（豆包 B站分身）

> 当开启新对话时，**先读本文件 + AGENTS.md + docs/project-state.md**。
> 本文件聚焦于：**当前正在做什么、还有什么没搞定、踩过哪些坑**。

---

## 🔴 当前悬而未决的问题（下一个 AI 直接接手）

### 问题：Web UI "保存任务"按钮**无任何反馈**

**现象**：用户在「定时任务」Tab 填写完整表单（任务名称、视频链接、更新日、上线时间都填了）→ 点「保存任务」按钮 → **没有 toast 提示、没有红色输入框高亮、任务列表没刷新、没有任何反应**。

**已确认**：
- ✅ 渲染后的 HTML 里按钮有 `onclick="saveTask()"` 绑定（正确）
- ✅ 渲染后的 `<script>` block `node --check` 语法通过（exit code 0）
- ✅ `saveTask()` 函数完整存在（6 项校验 + toast + fetch POST + try-catch 全部在）
- ✅ `toast()` 函数完整存在（创建 div、设样式、appendChild 到 body、2.5s 自动消失）
- ✅ 6 个校验 if 分支都有 `toast('xxx','error')` 调用

**尚未排查**：
1. 用户浏览器缓存了旧 HTML？→ 让用户 **Ctrl+Shift+R 强刷** 后重试
2. toast 创建了 div 但被 CSS 遮住？→ 检查全局 CSS 有没有 `pointer-events:none` / `visibility:hidden` / z-index 覆盖问题
3. fetch POST 请求有没有真的发出去？→ **打开浏览器 DevTools → Network tab → 点保存按钮 → 看有没有 POST /api/tasks 请求**
4. POST 返回什么？→ 成功 `{"ok":true}` / 错误状态码 / 根本没发出去

**下一步 AI 必须做的**：
1. `node -e "import http..."` fetch 宝塔 `/` 页面 → 提取 saveTask → 手动模拟调用（或直接 curl POST 测试）
2. 或者让用户开 DevTools Network tab 再试一次，看请求到底发没发、返回什么

---

## ✅ 本次对话已完成的修复

### 1. 模板字符串吞反斜杠 → 前端 JS 正则全坏了

**文件**：`src/web.mjs` 行 1110、1114

**根因**：web.mjs 用 ES6 模板字符串（反引号）拼 HTML，内嵌 `<script>` 块的前端 JS。模板字符串里 `\d` 和 `\/` 不是合法转义序列，渲染后反斜杠被 **直接吞掉**：

| 源码写法 | 模板渲染后 | 浏览器实际解析 |
|---------|----------|--------------|
| `/^BV\d+/` | `/^BVd+/` ❌ | 字母 `d`，不是数字匹配 |
| `/^(https?:)?\/\//` | `/^(https?:)?///` ❌ | 三个斜杠，语法错乱 |
| `/^\d{1,2}:\d{2}$/` | `/^d{1,2}:d{2}$/` ❌ | 同上 |

**修复**：正则里的反斜杠**再加一倍**：`\d` → `\\d`、`\/` → `\\/`

```js
// 修复前（模板里单反斜杠会被吞）
if(!/^(https?:)?\/\//.test(...)&&!/^BV\d+/.test(...)&&!/^ss\d+/.test(...))

// 修复后（双反斜杠 → 模板渲染变单反斜杠 → 浏览器 JS 正则正确）
if(!/^(https?:)?\\/\\//.test(...)&&!/^BV\\d+/.test(...)&&!/^ss\\d+/.test(...))
```

**验证方式**（模板字符串内嵌正则后的标准检查流程）：
```bash
# 1. 启动 web.mjs，curl 拉回渲染后的 HTML
# 2. 提取 <script> 块，node --check 语法验证
# 3. hex 字节码确认反斜杠存在：
#    渲染后正则应该是 5c 64 = '\d'（一个反斜杠 + d）
#    源码里应该是    5c 5c 64 = '\\d'（两个反斜杠 + d）
```

### 2. GET /api/tasks 空值崩溃

**文件**：`src/web.mjs` 行 ~260

**根因**：任务列表里某些任务的 `time` 字段缺失，`t.time.split(':')` 直接抛 `Cannot read properties of undefined`，返回 HTTP 500。前端 fetch 静默失败 → 任务列表空白 → 用户以为"什么都没有"。

**修复**：加默认值 `t.time || '11:00'`，拆分前先判空。

### 3. saveTask 表单校验 + 提示（代码已写好，但用户说没效果）

**文件**：`src/web.mjs` 行 ~1085

**已写**：
- 6 项校验：任务名称、视频链接、链接格式（https/BV/ss）、更新日、上线时间格式、提前量
- 每项校验失败：对应输入框 `borderColor='#ff6b6b'` + `toast('提示文字','error')` + focus + return
- fetch try-catch：网络错误 toast、服务器错误 toast
- 成功 toast + 按钮 loading 状态
- 新增全局 `toast()` 函数（固定定位、右上角、2.5s 自动消失）

**状态**：代码写好了，渲染出来也是完整的，但**用户说没效果**（见上方待解决问题）。

### 4. 调试代码清理

- ✅ `scheduler.mjs` 里所有 scheduler-debug.log 写入代码已移除
- ✅ `web.mjs` POST /api/tasks handler 里所有 api-debug.log 写入代码已移除
- ✅ E 盘根目录 `_*.mjs`、`_*.js`、`_*.txt` 临时调试文件已全部清理
- ✅ D 盘（生产目录）遗留的 `_check.mjs`、`_debug.mjs`、`_live.html` 等还在，建议也清理

---

## 🏗️ 项目核心信息

### 双目录架构（AGENTS.md §1 有完整说明）

| 路径 | 角色 |
|------|------|
| `E:\doubao\` | **开发目录 + Git 仓库**（IDE 在这里打开） |
| `D:\wwwroot\doubao-bot\` | **宝塔生产目录**（实际运行的代码） |

同步命令：
```powershell
robocopy "E:\doubao\src" "D:\wwwroot\doubao-bot\src" /MIR /NFL /NDL /NJH /NJS /NC /NS /NP
robocopy "E:\doubao\tools" "D:\wwwroot\doubao-bot\tools" /MIR /NFL /NDL /NJH /NJS /NC /NS /NP
```
robocopy exit code 0-7 都是成功，PowerShell 报错忽略。

### 运行时数据位置

```
C:\Users\Administrator\.doubao-bot\
├── tasks.json          # 定时任务列表
├── scheduler-state.json # 调度器内部状态
├── credentials.json    # 🔒 Cookie + API Key（敏感！）
├── config.json
├── quota.json          # token 用量统计
├── diary.md            # AI 写的日记
└── logs/               # 运行日志
```

### 关键文件速查

| 文件 | 作用 | 关键函数/位置 |
|------|------|-------------|
| `src/web.mjs` | Web 管理界面（HTTP server, port 7890） | `resolveDataDir()` 行11+58；模板字符串 HTML 渲染；saveTask ~行1085 |
| `src/scheduler.mjs` | 定时任务调度器 | `setTasks()` 行39；两个独立的 `resolveDataDir()`（和 web.mjs 重复） |
| `src/agent.mjs` | 豆包 AI 分身主循环 | Function Call 循环 |
| `src/run-task-direct.mjs` | 纯脚本直达（0 token，抢前排） | |
| `src/run-task.mjs` | AI 驱动任务（耗 token） | |
| `src/follow-await.mjs` | 关注列表守望进程 | 轮询 B 站动态 API |
| `tools/commands/bangumi.mjs` | 番剧 ss→最新正片 BV 解析 | `SKIP_TOKENS` 过滤预告/花絮等 |

### 宝塔 Node 守护进程

```
进程名：node.exe
命令行：node src/web.mjs
父进程：pwsh.exe（宝塔面板拉起的 PowerShell）
监听端口：7890
代理配置：D:\BtSoft\panel\data\proxy\豆包B站助手.conf
  → toUrl: http://127.0.0.1:7890
```

**宝塔编译缓存陷阱**：
- kill node.exe 后宝塔自动重启，新进程可能命中 Node.js ESM 编译缓存
- 表现：磁盘文件内容 A，进程运行的却是旧版本 B
- **现象**：setTasks() 写磁盘成功了，但紧接着被旧版本的空数组覆盖
- 解决方式：在宝塔面板 UI 上手动点「重启」按钮（不是 taskkill 后等它自动拉）

---

## 🚨 踩过的坑（必读，避免浪费时间）

### 坑 1：ES6 模板字符串吞反斜杠 → 正则/转义全坏

**表现**：`node --check web.mjs` 通过，但浏览器里报正则语法错或正则不匹配。

**根因**：模板字符串里 `\d`、`\w`、`\s`、`\/` 这些不是合法 JS 转义序列。ES6 规范规定：未识别的转义序列 → **反斜杠被静默丢弃**。

**铁律**：模板字符串里写正则字面量，反斜杠**必须双写**。

### 坑 2：PowerShell 吞逗号 → 误报源码语法错误

**表现**：PowerShell 命令行打印源码片段，逗号全没了。AI 误以为源码丢逗号，瞎补一通反而引入 bug。

**根因**：PowerShell 把 `,` 识别为数组分隔符，在参数传递阶段吞掉。

**铁律**（AGENTS.md §4.6 已写）：
1. 判源码语法 → 用 **内置 Read 工具** 读文件，不要用 PowerShell 截取
2. 真要 shell 操作 → 用 CMD / Git Bash / WSL，**禁止 PowerShell**
3. 终极验证 → `node --check xxx.mjs` + hex 字节码对比

### 坑 3：IDE OOM 崩溃 → 终端进程没清理

**表现**：Trae/Cursor 直接闪退，exit code -536870904 = "oom"。

**根因**：反复 RunCommand 开后台 node 进程（web.mjs、测试脚本等），旧进程没 StopCommand，内存吃光。

**铁律**（AGENTS.md §4.5 已写）：
- 开后台长进程 → 任务完**必须 StopCommand**
- 端口占用 EADDRINUSE → `taskkill /F /IM node.exe` 清干净

### 坑 4：Node.js ESM 编译缓存

**表现**：磁盘文件改了，进程行为没变。setTasks() 写 tasks.json 立刻被空数组覆盖。

**根因**：kill 进程后宝塔自动拉起新 node，新进程命中 v8 编译缓存，加载的还是旧版 scheduler.mjs。

**铁律**：改了 scheduler.mjs 后，**不要 kill 让宝塔自动重启**，而是**去宝塔面板 UI 手动点"重启"**。

---

## 📝 AGENTS.md 里已有的重要规则（不要重复踩）

- §1 双目录架构 + robocopy 同步流程
- §2 敏感信息（Cookie/API Key）绝对不能进 Git
- §3.1 零依赖原则（全程原生 Node 模块）
- §4.5 终端进程管理（开后台必须关）
- §4.6 PowerShell 文本读取约束（禁止用 PowerShell 判源码语法）

---

## 🎯 下一步建议

1. **第一优先级**：排查 saveTask 无反馈问题（让用户 Ctrl+Shift+R 强刷 + 开 DevTools Network tab 看请求）
2. **清理 D 盘**：`D:\wwwroot\doubao-bot\` 下的 `_check.mjs`、`_debug.mjs`、`api-debug.log`、`_live.html` 等临时文件建议也清掉
3. **AGENTS.md 更新**：把「模板字符串里正则要双写反斜杠」这条加进 §4 开发规范
4. **scheduler.mjs 重复代码**：web.mjs 和 scheduler.mjs 各有一份 `resolveDataDir()`，逻辑完全一样，可以统一到 `src/config.mjs` 里 export 一份

---

## 📞 快速启动命令

```powershell
# 开发测试（E盘，端口 7890）
cd E:\doubao ; node src/web.mjs

# 同步到生产
robocopy "E:\doubao\src" "D:\wwwroot\doubao-bot\src" /MIR /NFL /NDL /NJH /NJS /NC /NS /NP

# 检查渲染后 JS 语法（排查模板字符串问题的标准流程）
node -e "import http,fs from 'node:http';const r=http.request({hostname:'127.0.0.1',port:7890,path:'/'},res=>{let b='';res.on('data',d=>b+=d);res.on('end',()=>{const s=[...b.matchAll(/<script>([\s\S]*?)<\/script>/g)];s.forEach((m,i)=>fs.writeFileSync('E:/doubao/_chk_'+i+'.js',m[1]))})});r.end()"
node --check E:\doubao\_chk_1.js

# curl POST 测试接口
node -e "import http from 'node:http';const b=JSON.stringify({action:'add',task:{id:'test-1',name:'测试',targetUrl:'https://b23.tv',day:[6],time:'21:00'}});const r=http.request({hostname:'127.0.0.1',port:7890,path:'/api/tasks',method:'POST',headers:{'Content-Type':'application/json','Content-Length':b.length}},x=>{let d='';x.on('data',c=>d+=c);x.on('end',()=>console.log(x.statusCode,d))});r.write(b);r.end()"
```
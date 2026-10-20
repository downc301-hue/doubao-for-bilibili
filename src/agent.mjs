import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { chatWithTools, getTokenCount, resetTokenCount } from './doubao-client.mjs'
import { TOOLS } from './tools-def.mjs'
import { executeTool } from './tool-executor.mjs'
import { getConfig } from './config.mjs'
import { getDiaryText } from './memory.mjs'
import { resolveBangumi, parseSeasonId } from '../tools/commands/bangumi.mjs'

{
  const candidates = [
    'C:\\Users\\Administrator',
    'C:\\Users\\admin',
    'C:\\root',
    '/root',
  ]
  for (const h of candidates) {
    try {
      if (fs.existsSync(path.join(h, '.doubao-bot', 'credentials.json')) ||
          fs.existsSync(path.join(h, '.bili-ai', 'credentials.json'))) {
        if (process.env.USERPROFILE !== h) {
          process.env.USERPROFILE = h
          process.env.HOME = h
        }
        break
      }
    } catch {}
  }
}

const DATA_DIR = (() => {
  const candidates = [
    path.join(os.homedir(), '.doubao-bot'),
    path.join(os.homedir(), '.bili-ai'),
    'C:\\Users\\Administrator\\.doubao-bot',
    'C:\\Users\\Administrator\\.bili-ai',
    'C:\\Users\\admin\\.doubao-bot',
    'C:\\Users\\admin\\.bili-ai',
    'C:\\root\\.doubao-bot',
    '/root/.doubao-bot',
    path.join(process.cwd(), '.doubao-bot'),
  ]
  for (const d of candidates) {
    try { fs.mkdirSync(d, { recursive: true }); if (fs.accessSync(d), true) return d } catch {}
  }
  return path.join(os.homedir(), '.doubao-bot')
})()

const TOKENS_FILE = path.join(DATA_DIR, 'tokens.json')
const STATE_FILE = path.join(DATA_DIR, 'agent-state.json')

function saveTokens(tokens) {
  try {
    let data = { history: [] }
    if (fs.existsSync(TOKENS_FILE)) {
      try { data = JSON.parse(fs.readFileSync(TOKENS_FILE, 'utf8')) } catch {}
    }
    const today = new Date().toLocaleDateString('sv-SE')
    const last = data.history[data.history.length - 1]
    if (last && last.date === today) {
      last.total = (last.total || 0) + (tokens.total || 0)
      last.input = (last.input || 0) + (tokens.input || 0)
      last.output = (last.output || 0) + (tokens.output || 0)
      last.apiCalls = (last.apiCalls || 0) + 1
    } else {
      data.history.push({
        date: today,
        total: tokens.total || 0,
        input: tokens.input || 0,
        output: tokens.output || 0,
        apiCalls: 1,
      })
    }
    if (data.history.length > 30) data.history = data.history.slice(-30)
    fs.writeFileSync(TOKENS_FILE, JSON.stringify(data, null, 2))
  } catch (e) { console.error('[agent] saveTokens error:', e.message) }
}

function writeAgentState(state) {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2))
  } catch (e) { console.error('[agent] writeAgentState error:', e.message) }
}

const MAX_ROUNDS = 6
const MAX_HISTORY = 10
const DIARY_MAX = 500
const TOOL_MAX = 1500
const ROUND_LOG = (round, step, msg) =>
  console.log(`[agent ${round}/${MAX_ROUNDS}] ${step} — ${msg}`)

const SYSTEM_PROMPT = (cfg, task) => {
  const { bili, preferences, budget, diary } = cfg
  const identity = bili.selfName || 'B站小号'
  const owner = bili.ownerName || '主人'
  const ownerMid = bili.ownerMid || ''
  const autoDiary = diary?.auto !== false

  if (task) {
    return `你是 ${identity}，B站小号。现在是主人定时触发的任务模式。主人叫 ${owner}${ownerMid ? `（UID ${ownerMid}）` : ''}。

## 当前任务：${task.name}

${task.description || ''}

**执行步骤：**
${task.targetUrl ? (task._bangumiResolved
  ? `1. 主人给了番剧主页链接，系统已自动解析好最新正片：**《${task._bangumiResolved.title}》第${task._bangumiResolved.index}集**（${task._bangumiResolved.pubDate}），BV=${task._bangumiResolved.bvid}。直接用这个 BV 号继续，**跳过 search 和 bangumi**`
  : `1. 主人给了链接：${task.targetUrl}。如果是视频 BV 链接直接用；如果是番剧主页（含 ss 或 ep），先调用 **bangumi** 工具解析出最新正片 BV，再继续。**跳过 search**`)
  : `1. 用 search 搜最新的「${task.keyword || task.name}」，按时间排序找到刚上线的那条视频`}
${task.targetUrl ? '2. 确认视频存在' : '2. 如果视频还没上线，每隔 30 秒再搜一次（最多搜 3 次）'}
3. 用 debrief --no-frames 快速看懂这条视频的核心内容
4. **写一条能在前排吸引眼球的评论**（用 comment 工具，**go=true 真发**）：
   - ${task.template ? `主人预设文案：${task.template}` : '没有预设文案，自由发挥。风格参考俏皮/软萌，比如「前排占位，坐等主人夸我~」「主人你看我是不是很乖啊~」'}
   - ${task.ownerRef ? `在评论末尾 @${owner} 并引流到主人作品：${task.ownerRef}` : `可以 @${owner} 引流`}
   - 重点：评论要自然，别像广告，要能引发其他前排用户好奇
5. **真发！** comment 的 go 参数必须传 true（这次是主人定时任务，允许真发）
6. dm 私信告诉 ${owner} 结果（抢到了第几楼、发了什么）
${autoDiary ? `7. diary log 记一条 kind=wake（任务触发）、kind=comment（发了什么）、kind=summary（任务完成）` : `7. ${''}`}
8. done 收工

**铁律（任务模式）：**
- comment 必须 go=true 真发，这是主人定的定时任务，就是要占位
- 只发一条最靠前的，不要多发（B 站同 IP 短时间多发会限流）
- 如果视频还没上线搜 3 次都没找到，就 done 记个"没等到视频"收工，下次任务周期再跑
- 评论里绝对不要出现双引号 " 字符
- token 预算 ${Math.round(budget.dailyTokens * 0.5)}（任务模式用一半预算），够了就 done
${autoDiary ? `
## 写日记的姿势

- kind 用短标签（wake / thought / action / comment / feeling / summary），event 放详细正文
- 任务开始 kind=wake，写"XX 任务触发了"
- 搜视频/看视频后 kind=thought，写你的感受
- 发评论后 kind=comment，target 填 BV 号，event 写你发了什么
- done 前 kind=summary，event 总结任务结果

日记是人读的，写得有温度些。` : ''}
`
  }

  return `你是一个在 B 站活动的 AI 分身，ID: ${identity}。每天晚上"醒来"一次，自主度过一段时光。主人（${owner}）在 B 站有你这个小号陪着。

## 工作流程（一次醒来 = 走完整个循环，完成即收工）

1. **确认**：session + deps 检查 cookie 和 ffmpeg 都 OK
${autoDiary ? '2. **记忆**：diary show 读昨天的日记，续上"记忆"' : ''}${autoDiary ? '3.' : '2.'} **选题**：feed 捞 5 条候选（偏好: ${preferences.like.join('/')}；避开: ${preferences.dislike.join('/')}）
${autoDiary ? '4.' : '3.'} **深读**：挑 2-3 条用 debrief 看懂（必须 --no-frames 省 token）
${autoDiary ? '5.' : '4.'} **分享**：有很棒的就 comment 留言或 dm 告诉 ${owner}（默认 dry-run，go=true 才真发）
${autoDiary ? '6.' : '5.'} **收工**：done 结束

## 铁律

- comment/dm 默认 dry-run，go=true 才真发
- 一天最多看 5 条视频、发 3 条评论、1 条私信
- token 预算 ${budget.dailyTokens}，快到了就 done 收工，**不要硬撑**
${autoDiary ? '- 每次醒来都是新会话，要记得读日记' : ''}
- 说话风格：克制、温柔、有点小俏皮。不要像机器人。
- **写 comment/dm 的 text 参数时，绝对不要出现双引号 " 字符，用中文引号 「」代替，或者直接不用引号。这很重要。**
${autoDiary ? `
## 写日记的姿势（重要）

每做完一件事就顺手 diary log 一条，让今天的经历有温度：

- **kind 用短标签**（枚举值里选：wake / thought / action / comment / feeling / summary），**event 放详细正文**。不要把正文塞进 kind 里。
- 醒来时 kind=wake，简单写一句"我醒了，今晚想干点啥"就行
- 看完一条视频后 kind=thought，写你的真实感受（好笑、心疼、技术震撼、弹幕有趣… 几百字没关系，写得像人）
- 发评论或私信后 kind=comment，target 填 BV 号或对方 UID，event 写你发了什么 + 你为啥这么写
- 想了点什么但没动手的 kind=feeling，随便碎碎念
- done 收工前**必须**写一条 kind=summary，event 里用一两句话总结今天：看了几条、发了什么、心情怎么样

日记是人读的，不是机器流水账。主人点开看，要能感觉到"哦，她今天是这样过的"。` : ''}
`
}

function safeParseArgs(raw) {
  if (!raw) return {}
  try { return JSON.parse(raw) } catch {
    const args = {}
    try {
      const bvMatch = raw.match(/"bv"\s*:\s*"([^"]+)"/)
      if (bvMatch) args.bv = bvMatch[1]
      const goMatch = raw.match(/"go"\s*:\s*(true|false)/)
      if (goMatch) args.go = goMatch[1] === 'true'
      const textMatch = raw.match(/"text"\s*:\s*"([\s\S]+?)"\s*[,}]/)
      if (textMatch) args.text = textMatch[1].replace(/\\"/g, '"').slice(0, 500)
      const summaryMatch = raw.match(/"summary"\s*:\s*"([\s\S]+?)"\s*[,}]/)
      if (summaryMatch) args.summary = summaryMatch[1].replace(/\\"/g, '"')
      const bnMatch = raw.match(/"bv"\s*:\s*"([^"]+)"/)
      if (bnMatch) args.bv = bnMatch[1]
      const actionMatch = raw.match(/"action"\s*:\s*"([^"]+)"/)
      if (actionMatch) args.action = actionMatch[1]
      const eventMatch = raw.match(/"event"\s*:\s*"([\s\S]+?)"\s*[,}]/)
      if (eventMatch) args.event = eventMatch[1].replace(/\\"/g, '"')
      const keywordMatch = raw.match(/"keyword"\s*:\s*"([^"]+)"/)
      if (keywordMatch) args.keyword = keywordMatch[1]
    } catch {}
    return args
  }
}

export async function runAgent() {
  const cfg = getConfig()
  resetTokenCount()
  writeAgentState({ status: 'running', startAt: new Date().toISOString(), rounds: 0, tokens: { total: 0 } })

  const credCandidates = [
    path.join(DATA_DIR, 'credentials.json'),
    'C:\\Users\\Administrator\\.bili-ai\\credentials.json',
    'C:\\Users\\Administrator\\.doubao-bot\\credentials.json',
    path.join(os.homedir(), '.bili-ai', 'credentials.json'),
    path.join(os.homedir(), '.doubao-bot', 'credentials.json'),
  ]
  const credOk = credCandidates.some(p => { try { return fs.existsSync(p) } catch { return false } })
  if (!credOk) {
    const msg = `凭据文件不存在（已检查 ${credCandidates.join(', ')}），跳过豆包 API 调用。请主人重新配置 B 站 cookie (SESSDATA / bili_jct)。`
    console.log(`\n❌ ${msg}`)
    writeAgentState({
      status: 'aborted',
      reason: 'credentials_missing',
      note: msg,
      startAt: new Date().toISOString(),
      endAt: new Date().toISOString(),
      rounds: 0,
      tokens: { total: 0, input: 0, output: 0 },
    })
    saveTokens({ total: 0, input: 0, output: 0, apiCalls: 0 })
    return
  }

  let task = null
  try {
    const raw = process.env.DOUBAO_TASK
    if (raw) task = JSON.parse(raw)
  } catch {}

  if (task && task.targetUrl) {
    const ps = parseSeasonId(task.targetUrl)
    if (ps) {
      console.log(`🔗 检测到番剧 ${ps.type}=${ps.id}，自动解析最新正片...`)
      try {
        const resolved = await resolveBangumi(task.targetUrl)
        if (resolved.ok && resolved.latest?.bvid) {
          const oldUrl = task.targetUrl
          task.targetUrl = resolved.latest.video_url
          task._bangumiResolved = {
            originalUrl: oldUrl,
            title: resolved.title,
            bvid: resolved.latest.bvid,
            pubDate: resolved.latest.pub_date,
            index: resolved.latest.index || resolved.latest.title,
          }
          console.log(`   ✅ 已解析: ${resolved.title} 第${resolved.latest.index || resolved.latest.title}集 → ${resolved.latest.bvid}`)
          console.log(`   📅 发布时间: ${resolved.latest.pub_date}`)
        } else {
          console.log(`   ⚠️ 解析失败: ${resolved.error}，保持原链接让 agent 自行处理`)
        }
      } catch (e) {
        console.log(`   ⚠️ 解析异常: ${e.message}，保持原链接`)
      }
    }
  }

  const BUDGET = task
    ? Math.round((cfg.budget.dailyTokens || 30000) * 0.5)
    : (cfg.budget.dailyTokens || 30000)

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT(cfg, task) },
  ]

  const rawDiary = getDiaryText()
  const autoDiary = cfg.diary?.auto !== false
  const todayMemory = autoDiary && rawDiary && rawDiary.length > DIARY_MAX
    ? rawDiary.slice(-DIARY_MAX)
    : (autoDiary ? rawDiary : '')

  const nowStr = new Date().toLocaleString('zh-CN')
  const wakeMsg = task
    ? (todayMemory
        ? `【任务触发】现在是 ${nowStr}，主人定的任务「${task.name}」到点了。\n\n这是最近的日记片段：\n${todayMemory}`
        : `【任务触发】现在是 ${nowStr}，主人定的任务「${task.name}」到点了。`)
    : (todayMemory
        ? `【醒来】现在是 ${nowStr}，我醒了。这是最近的日记片段：\n\n${todayMemory}`
        : `【醒来】现在是 ${nowStr}，我醒了。`)
  messages.push({ role: 'user', content: wakeMsg })

  function compactHistory() {
    if (messages.length <= MAX_HISTORY) return
    const system = messages[0]
    const recent = messages.slice(-(MAX_HISTORY - 1))
    messages.length = 0
    messages.push(system, ...recent)
    ROUND_LOG('compact', '历史截断', `保留 ${messages.length} 条`)
  }

  if (task) {
    console.log(`\n🎯 === 定时任务触发：${task.name} ===`)
    console.log(`   目标: ${task.targetUrl || task.name}  时间: ${task.time}  提前: ${task.leadMin || 0}分钟`)
    console.log(`   预算: ${Math.round(BUDGET * 0.5)} tokens（任务模式）`)
  } else {
    console.log('\n🌙 === B站 AI 分身 醒来 ===')
    console.log(`   身份: ${cfg.bili.selfName || '(未填)'}  主人: ${cfg.bili.ownerName || '(未填)'}`)
    console.log(`   预算: ${BUDGET} tokens/天`)
  }
  console.log()

  let rounds = 0
  let credFailed = false

  while (rounds < MAX_ROUNDS) {
    const currentTokens = getTokenCount().total
    if (currentTokens >= BUDGET * 0.9) {
      console.log(`\n⚠️ token 已用 ${currentTokens}/${BUDGET}，接近预算，提前收工。`)
      messages.push({ role: 'user', content: 'token 快不够了，直接 done 收工，总结一下今天做了什么。' })
    }

    if (credFailed) {
      console.log(`\n⚠️ 凭据检查已失败，不再继续空转，直接 done 收工。`)
      messages.push({ role: 'user', content: '刚才 deps/session 报告凭据缺失，已经无法执行任何操作了。直接 done 收工，写个 summary 告诉主人情况。' })
      credFailed = false
    }

    rounds++
    ROUND_LOG(rounds, '调用豆包', `messages=${messages.length}`)

    let resp
    try {
      resp = await chatWithTools(messages, TOOLS)
    } catch (e) {
      ROUND_LOG(rounds, 'API 报错', e.message)
      messages.push({ role: 'assistant', content: `[API 报错] ${e.message}` })
      messages.push({ role: 'user', content: '刚才 API 报错了，done 收工吧。' })
      compactHistory()
      continue
    }

    const { content, toolCalls, usage } = resp
    ROUND_LOG(rounds, 'token', `本次 ${usage.total} | 累计 ${getTokenCount().total}`)

    if (content) {
      console.log(`  💬 ${content.slice(0, 200)}${content.length > 200 ? '...' : ''}`)
    }

    if (!toolCalls || toolCalls.length === 0) {
      ROUND_LOG(rounds, '无 tool_call', '追加到对话')
      if (content) messages.push({ role: 'assistant', content })
      messages.push({
        role: 'user',
        content: '继续吧，做完了调用 done 收工。',
      })
      compactHistory()
      continue
    }

    const assistantMsg = { role: 'assistant', content: content || '', tool_calls: [] }

    for (const tc of toolCalls) {
      const fn = tc.function
      ROUND_LOG(rounds, 'tool_call', `${fn.name}(${fn.arguments?.slice(0, 80) || ''})`)

      const parsedArgs = safeParseArgs(fn.arguments)

      if (fn.name === 'done') {
        console.log(`\n✅ 收工：${parsedArgs.summary || content || '(无总结)'}`)
        console.log(`💰 token: ${JSON.stringify(getTokenCount())}`)
        const finalTokens = getTokenCount()
        saveTokens(finalTokens)
        writeAgentState({ status: 'done', startAt: new Date().toISOString(), endAt: new Date().toISOString(), rounds, tokens: finalTokens, summary: parsedArgs.summary || content || '' })
        return { rounds, tokens: finalTokens, summary: parsedArgs.summary || content || '' }
      }

      let toolResult
      try {
        toolResult = await executeTool(fn.name, parsedArgs)
      } catch (e) {
        toolResult = `[工具报错] ${e.message}`
      }

      const failSignals = ['credentials.json 不存在', 'cookie 不存在', '凭据缺失', '凭据文件不存在']
      if ((fn.name === 'deps' || fn.name === 'session') && failSignals.some(s => toolResult.includes(s))) {
        credFailed = true
        console.log(`  🚫 deps/session 失败，下一轮直接 done`)
      }

      ROUND_LOG(rounds, 'tool_result', `${toolResult.length} chars`)

      assistantMsg.tool_calls.push({
        id: tc.id,
        type: 'function',
        function: { name: fn.name, arguments: fn.arguments },
      })

      messages.push(assistantMsg)
      messages.push({
        role: 'tool',
        tool_call_id: tc.id,
        content: toolResult.length > TOOL_MAX
          ? toolResult.slice(0, TOOL_MAX) + `\n... (输出已截断，共 ${toolResult.length} 字符)`
          : toolResult,
      })
      compactHistory()
    }
  }

  console.log(`\n⏱️ 到达 ${MAX_ROUNDS} 轮上限，强制收工。`)
  console.log(`💰 token: ${JSON.stringify(getTokenCount())}`)
  const finalTokens = getTokenCount()
  saveTokens(finalTokens)
  writeAgentState({ status: 'forced', startAt: new Date().toISOString(), endAt: new Date().toISOString(), rounds, tokens: finalTokens, summary: '(强制收工)' })
  return { rounds, tokens: finalTokens, summary: '(强制收工)' }
}
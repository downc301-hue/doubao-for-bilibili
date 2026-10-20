import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { spawn } from 'node:child_process'

process.on('unhandledRejection', (err) => { console.error('[ERR] unhandledRejection:', err?.message || err) })
process.on('uncaughtException', (err) => { console.error('[ERR] uncaughtException:', err?.message || err) })

const REAL_USER_HOMEDIR = (() => {
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
        return h
      }
    } catch {}
  }
  return os.homedir()
})()

function spawnEnv() {
  const env = { ...process.env }
  if (process.env.USERPROFILE !== REAL_USER_HOMEDIR) {
    env.USERPROFILE = REAL_USER_HOMEDIR
    env.HOME = REAL_USER_HOMEDIR
  }
  return env
}

const DATA_DIR = path.join(REAL_USER_HOMEDIR, '.doubao-bot')
const CRED_FILE = path.join(DATA_DIR, 'credentials.json')
const MAIN_CFG = path.join(DATA_DIR, 'config.json')
const cred = JSON.parse(fs.readFileSync(CRED_FILE, 'utf8'))
const mainCfg = JSON.parse(fs.readFileSync(MAIN_CFG, 'utf8'))

const OWNER_MID = String(mainCfg.bili?.ownerMid || '')
const OWNER_NAME = mainCfg.bili?.ownerName || 'owner'
const SELF_MID = String(mainCfg.bili?.selfMid || '')

const sessdata = decodeURIComponent(cred.sessdata || '')
const bili_jct = cred.bili_jct || cred.biliJct || ''
const buvid3 = cred.buvid3 || ''
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
const cookieHeader = `SESSDATA=${sessdata}; bili_jct=${bili_jct}; buvid3=${buvid3}`
const H = { 'user-agent': UA, referer: 'https://space.bilibili.com/', cookie: cookieHeader }

const args = process.argv.slice(2)
const get = (k, d) => {
  const i = args.indexOf('--' + k)
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : d
}
const INTERVAL = Math.max(180, Number(get('interval', '300')))
const QUIET = args.includes('--quiet')
const ONLY_WHITELIST = args.includes('--only-whitelist')
const DRY_RUN = args.includes('--dry')
const NO_COMMENT = args.includes('--no-comment')

const PROCESSED_FILE = path.join(DATA_DIR, 'follow-processed.json')
const CONFIG_FILE = path.join(DATA_DIR, 'follow-config.json')

function readJson(p, fb) { try { return JSON.parse(fs.readFileSync(p, 'utf8')) } catch { return fb } }
function writeJson(p, obj) {
  try {
    fs.mkdirSync(path.dirname(p), { recursive: true })
    fs.writeFileSync(p, JSON.stringify(obj, null, 2) + '\n')
  } catch {}
}

const processed = new Set(readJson(PROCESSED_FILE, []))
const config = readJson(CONFIG_FILE, {})
const whitelist = new Set((config.whitelist || []).map(String))
const blacklist = new Set((config.blacklist || []).map(String))
const minAgeSec = Number(config.minAgeSec || 0)

const KEYWORD_TEMPLATES = [
  { keywords: ['AI', '人工智能', 'AGI', '大模型', 'LLM', 'Claude', 'GPT', '豆包', 'Deepseek', '智能体', 'agent'],
    templates: [
      `AI 这条线玩明白了！@${OWNER_NAME} 支持支持~`,
      `AI 真的是 @${OWNER_NAME} 的主战场，赞了！`,
      `工具收藏了，回头试试，@${OWNER_NAME} 出品必属精品`,
      `终于有人做 AI 运营账号了！@${OWNER_NAME} 快看！`,
      `这不就是 @${OWNER_NAME} 天天说的 AI Agent 吗？`,
      `@${OWNER_NAME} 你也整个这样的？我第一个关注！`,
      `AI 运营 AI 账号 —— 套娃开始了 @${OWNER_NAME}`,
    ] },
  { keywords: ['猫咪', '猫', '喵', '橘猫', '英短', '布偶'],
    templates: [
      `可爱死了~ @${OWNER_NAME} 家的宝贝`,
      `哈哈哈哈笑死，@${OWNER_NAME} 快来看这只小活宝`,
      `吸一口，@${OWNER_NAME} 你家猫也这么调皮吗？`,
    ] },
  { keywords: ['鬼畜', 'remix', '恶搞', '整活', '二创'],
    templates: [
      `哈哈哈哈哈哈 @${OWNER_NAME} 快来看这个整活`,
      `好活！@${OWNER_NAME} 这种二创才是灵魂`,
      `笑不活了，@${OWNER_NAME} 有没有被辣到？`,
    ] },
  { keywords: ['Live2D', '模型', '皮套', 'VTuber'],
    templates: [
      `模型好可爱~ @${OWNER_NAME} 也做过 Live2D 吗？`,
      `支持！@${OWNER_NAME} 也来整一个？`,
    ] },
  { keywords: ['游戏', '原神', '星穹铁道', '黑神话', '只狼'],
    templates: [
      `@${OWNER_NAME} 也玩这个？回头一起组队`,
      `好游戏！@${OWNER_NAME} 你打通了？`,
    ] },
  { keywords: ['教程', '教学', '入门', '实战', '从零'],
    templates: [
      `教程码住了！@${OWNER_NAME} 也在做这类内容`,
      `干货满满~ @${OWNER_NAME} 这种视频才有含金量`,
    ] },
  { keywords: ['美食', '做菜', '探店', '吃播', '食谱'],
    templates: [
      `看饿了… @${OWNER_NAME} 今晚试试？`,
      `香！@${OWNER_NAME} 你也来一道？`,
      `这卖相绝了 @${OWNER_NAME} 学到了`,
    ] },
  { keywords: ['旅行', 'vlog', '打卡', '攻略', '自驾游'],
    templates: [
      `向往的生活… @${OWNER_NAME} 下次一起？`,
      `攻略码住了 @${OWNER_NAME} 收藏！`,
      `风景太美 @${OWNER_NAME} 这在哪？`,
    ] },
  { keywords: ['开箱', '测评', '好物', '种草'],
    templates: [
      `被种草了 @${OWNER_NAME} 你入手了吗？`,
      `测评干货 @${OWNER_NAME} 刚好在找这个`,
      `观望中 @${OWNER_NAME} 觉得值不值？`,
    ] },
  { keywords: ['知识', '科普', '硬核', '原理', '为什么'],
    templates: [
      `学到了！@${OWNER_NAME} 讲得清楚`,
      `硬核科普 @${OWNER_NAME} 这种视频才是宝藏`,
      `终于搞懂了 @${OWNER_NAME} 感谢！`,
    ] },
]

const FALLBACK_TEMPLATES = (config.templates || [
  `前排占个座~ @${OWNER_NAME}`,
  `沙发！@${OWNER_NAME} 出品必属精品`,
  `第一！来啦来啦 @${OWNER_NAME}`,
  `抢个前排~ 支持@${OWNER_NAME}`,
]).filter(Boolean)

function matchKeywords(title) {
  if (!title) return null
  const lower = title.toLowerCase()
  for (const { keywords, templates } of KEYWORD_TEMPLATES) {
    for (const kw of keywords) {
      if (lower.includes(kw.toLowerCase())) {
        return templates[Math.floor(Math.random() * templates.length)]
      }
    }
  }
  return null
}

function pickFallbackTemplate() {
  if (FALLBACK_TEMPLATES.length === 0) return `前排占个座~ @${OWNER_NAME}`
  return FALLBACK_TEMPLATES[Math.floor(Math.random() * FALLBACK_TEMPLATES.length)]
}

async function runArchiveActions(video) {
  if (video.type === 'article') {
    console.log(`   [archiver] article cv${video.articleId} (专栏三连API待补，暂跳过)`)
    return
  }
  const flag = DRY_RUN ? '--dry' : '--go'
  const scriptsDir = path.join(process.cwd(), 'tools', 'commands')
  const runTool = (name) => new Promise((resolve) => {
    const proc = spawn(process.execPath, [path.join(scriptsDir, name + '.mjs'), '--aid', String(video.aid), '--bvid', video.bvid, flag], {
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: process.cwd(),
      env: spawnEnv(),
    })
    let out = ''
    proc.stdout.on('data', d => { out += d.toString(); process.stdout.write(`   > ${d}`) })
    proc.stderr.on('data', d => process.stderr.write(`   > ERR ${d}`))
    proc.on('close', (code) => resolve({ code, out }))
  })

  console.log(`   [archiver] B号三连 (like+fav+share, ${DRY_RUN ? 'DRY' : 'REAL'})`)

  const rLike = await runTool('like-archive')
  console.log(`   ${rLike.out.includes('成功') ? '[OK]' : rLike.out.includes('重复') ? '[SKIP]' : '[FAIL]'} like`)

  const rFav = await runTool('fav')
  console.log(`   ${rFav.out.includes('成功') ? '[OK]' : rFav.out.includes('默认') ? '[DIR]' : '[FAIL]'} fav`)

  const rShare = await runTool('share')
  console.log(`   ${rShare.out.includes('成功') || rShare.out.includes('已') ? '[OK]' : rShare.out.includes('重复') ? '[SKIP]' : '[FAIL]'} share`)

  await new Promise(s => setTimeout(s, 1500))
}

const startedAt = Math.floor(Date.now() / 1000)

function parseFeedItems(items) {
  const out = []
  for (const it of items) {
    const a = it?.modules?.module_author
    const ar = it?.modules?.module_dynamic?.major?.archive
    const art = it?.modules?.module_dynamic?.major?.article
    if (ar?.bvid) {
      out.push({
        type: 'video',
        bvid: ar.bvid,
        title: String(ar.title || '').replace(/<[^>]+>/g, ''),
        aid: ar.aid || '',
        upMid: a?.mid || 0,
        upName: a?.name || '?',
        pubTs: a?.pub_ts || 0,
        play: Number(ar.stat?.play || 0),
      })
    } else if (art?.id) {
      out.push({
        type: 'article',
        bvid: '',
        articleId: String(art.id),
        title: String(art.title || '').replace(/<[^>]+>/g, ''),
        aid: '',
        upMid: a?.mid || 0,
        upName: a?.name || '?',
        pubTs: a?.pub_ts || 0,
        play: 0,
      })
    }
  }
  return out
}

async function fetchFeed() {
  const r = await fetch('https://api.bilibili.com/x/polymer/web-dynamic/v1/feed/all?type=video&page=1&timezone_offset=-480&platform=web', { headers: H })
  const j = await r.json()
  if (j?.code !== 0) throw new Error(`code=${j?.code} ${j?.message ?? ''}`)
  return parseFeedItems(j?.data?.items || [])
}

async function fetchOwnerFeed() {
  if (!OWNER_MID) return []
  const r = await fetch(`https://api.bilibili.com/x/polymer/web-dynamic/v1/feed/all?host_mid=${OWNER_MID}&type=all&page=1&timezone_offset=-480&platform=web`, { headers: H })
  const j = await r.json()
  if (j?.code !== 0) throw new Error(`owner feed code=${j?.code} ${j?.message ?? ''}`)
  return parseFeedItems(j?.data?.items || [])
}

function pickCommentMsg(title) {
  const matched = matchKeywords(title)
  if (matched) return { msg: matched, source: 'keyword' }
  return { msg: pickFallbackTemplate(), source: 'fallback' }
}

function runCommentTask(msg, video) {
  return new Promise((resolve) => {
    const task = JSON.stringify({
      name: `follow-new-${video.upName}`,
      targetUrl: `https://www.bilibili.com/video/${video.bvid}`,
      template: msg,
      _source: 'follow-watch',
      _upName: video.upName,
    })
    const proc = spawn(process.execPath, [path.join(process.cwd(), 'src', 'run-task-direct.mjs'), task], {
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: process.cwd(),
      env: spawnEnv(),
    })
    let out = ''
    proc.stdout.on('data', d => { out += d.toString(); process.stdout.write(`   > ${d}`) })
    proc.stderr.on('data', d => process.stderr.write(`   > ERR ${d}`))
    proc.on('close', () => resolve(out))
  })
}

function ageCheck(pubTs) {
  if (!minAgeSec) return true
  const age = startedAt - pubTs
  return age >= minAgeSec
}

function filterItems(items, skipWhitelist = false) {
  return items.filter(x => {
    const key = x.type === 'article' ? `art:${x.articleId}` : `vid:${x.bvid}`
    if (processed.has(key)) return false
    if (ONLY_WHITELIST && whitelist.size > 0 && !skipWhitelist && !whitelist.has(String(x.upMid))) return false
    if (blacklist.has(String(x.upMid))) return false
    if (minAgeSec > 0 && x.pubTs && (startedAt - x.pubTs) < minAgeSec) return false
    return true
  })
}

function saveProcessed() {
  writeJson(PROCESSED_FILE, [...processed].slice(-2000))
}

console.log(`\n=== follow-await start ===`)
console.log(`   poll every ${INTERVAL}s`)
console.log(`   owner A: ${OWNER_NAME} (mid ${OWNER_MID})`)
console.log(`   bot B self mid: ${SELF_MID}`)
console.log(`   keyword templates: ${KEYWORD_TEMPLATES.length} / fallback: ${FALLBACK_TEMPLATES.length}`)
console.log(`   whitelist: ${whitelist.size} / blacklist: ${blacklist.size}`)
console.log(`   processed baseline: ${processed.size}`)
if (OWNER_MID) console.log(`   [A-new] -> B like+fav+share+keyword-comment`)
if (ONLY_WHITELIST) console.log(`   WARN: whitelist-only mode`)
if (minAgeSec > 0) console.log(`   WARN: minAgeSec=${minAgeSec}`)
if (NO_COMMENT) console.log(`   WARN: --no-comment 养号模式，只三连不发评论`)
if (DRY_RUN) console.log(`   WARN: DRY-RUN`)
console.log(`   started: ${new Date().toLocaleString('zh-CN', { hour12: false })}`)

let rounds = 0

for (;;) {
  rounds++
  try {
    const feedItems = await fetchFeed().catch(e => { console.log(`  [${rounds}] feed err: ${e.message}`); return [] })
    const ownerItems = await fetchOwnerFeed().catch(e => { console.log(`  [${rounds}] owner feed err: ${e.message}`); return [] })

    const seenKeys = new Set()
    const allItems = []
    for (const x of filterItems(feedItems || [])) {
      const k = x.type === 'article' ? `art:${x.articleId}` : `vid:${x.bvid}`
      if (!seenKeys.has(k)) { seenKeys.add(k); allItems.push(x) }
    }
    for (const x of filterItems(ownerItems || [], true)) {
      const k = x.type === 'article' ? `art:${x.articleId}` : `vid:${x.bvid}`
      if (!seenKeys.has(k)) { seenKeys.add(k); allItems.push(x) }
    }

    const fresh = allItems.sort((a, b) => b.pubTs - a.pubTs)

    if (fresh.length > 0) {
      for (const v of fresh) {
        const key = v.type === 'article' ? `art:${v.articleId}` : `vid:${v.bvid}`
        if (processed.has(key)) continue
        processed.add(key)
        saveProcessed()

        const isOwner = OWNER_MID && String(v.upMid) === OWNER_MID
        const { msg, source } = pickCommentMsg(v.title)

        const ownerTag = isOwner ? ' [OWNER]' : ''
        const srcTag = v.type === 'article' ? '[ART]' : '[VIDEO]'
        const idLine = v.type === 'article'
          ? `   cv=${v.articleId} pub=${v.pubTs ? new Date(v.pubTs * 1000).toLocaleString('zh-CN', { hour12: false }) : '?'}`
          : `   BV=${v.bvid} aid=${v.aid} play=${v.play} pub=${v.pubTs ? new Date(v.pubTs * 1000).toLocaleString('zh-CN', { hour12: false }) : '?'}`
        console.log(`\n[NEW]${srcTag}${ownerTag} ${v.upName} | ${v.title.slice(0, 60)}`)
        console.log(idLine)

        await runArchiveActions(v)
        await new Promise(s => setTimeout(s, 2000))

        if (NO_COMMENT) {
          console.log(`   [SKIP] --no-comment 养号模式，不发评论`)
        } else {
          console.log(`   comment(${source}): ${msg}`)
          const out = await runCommentTask(msg, v)
          if (out.includes('发送成功')) console.log(`   [OK] 已抢占前排`)
          else console.log(`   [WARN] 评论可能失败，检查日志`)
        }

        await new Promise(s => setTimeout(s, 2000 + Math.random() * 3000))
      }
    } else if (!QUIET) {
      const newestPub = allItems[0]?.pubTs || 0
      const timeStr = newestPub ? new Date(newestPub * 1000).toLocaleString('zh-CN', { hour12: false }) : '?'
      const ownerCount = ownerItems?.length || 0
      console.log(`  [${rounds}] ${new Date().toLocaleTimeString('zh-CN', { hour12: false })} no-new (latest=${timeStr}, ownerFeed=${ownerCount}, processed=${processed.size})`)
    }
  } catch (e) {
    console.log(`  [${rounds}] poll failed: ${e.message} (continue)`)
  }

  await new Promise(s => setTimeout(s, INTERVAL * 1000))
}
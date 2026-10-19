import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const credFile = path.join(os.homedir(), '.bili-ai', 'credentials.json')
const cred = JSON.parse(fs.readFileSync(credFile, 'utf8'))
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
const cookieHeader = `SESSDATA=${cred.sessdata}; bili_jct=${cred.bili_jct}; buvid3=${cred.buvid3}`
const H = { 'user-agent': UA, referer: 'https://space.bilibili.com/', cookie: cookieHeader }

const args = process.argv.slice(2)
const get = (k, d) => {
  const i = args.indexOf('--' + k)
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : d
}
const INTERVAL = Math.max(180, Number(get('interval', '300')))
const QUIET = args.includes('--quiet')
const ONLY_WHITELIST = args.includes('--only-whitelist')

const DATA_DIR = path.join(os.homedir(), '.doubao-bot')
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
const templates = (config.templates || ['前排占个座~', '沙发！支持UP主', '第一！来啦来啦', '抢个前排~']).filter(Boolean)
const minAgeSec = Number(config.minAgeSec || 0)

const startedAt = Math.floor(Date.now() / 1000)

async function fetchFeed() {
  const r = await fetch('https://api.bilibili.com/x/polymer/web-dynamic/v1/feed/all?type=video&page=1&timezone_offset=-480&platform=web', { headers: H })
  const j = await r.json()
  if (j?.code !== 0) throw new Error(`code=${j?.code} ${j?.message ?? ''}`)
  const items = j?.data?.items || []
  const out = []
  for (const it of items) {
    const a = it?.modules?.module_author
    const ar = it?.modules?.module_dynamic?.major?.archive
    if (!ar?.bvid) continue
    out.push({
      bvid: ar.bvid,
      title: String(ar.title || '').replace(/<[^>]+>/g, ''),
      aid: ar.aid || '',
      upMid: a?.mid || 0,
      upName: a?.name || '?',
      pubTs: a?.pub_ts || 0,
      play: Number(ar.stat?.play || 0),
    })
  }
  return out
}

function pickTemplate() {
  if (templates.length === 0) return '前排占个座~'
  return templates[Math.floor(Math.random() * templates.length)]
}

function ageCheck(pubTs) {
  if (!minAgeSec) return true
  const age = startedAt - pubTs
  return age >= minAgeSec
}

function filterItems(items) {
  return items.filter(x => {
    if (processed.has(x.bvid)) return false
    if (ONLY_WHITELIST && whitelist.size > 0 && !whitelist.has(String(x.upMid))) return false
    if (blacklist.has(String(x.upMid))) return false
    if (minAgeSec > 0 && x.pubTs && (startedAt - x.pubTs) < minAgeSec) return false
    return true
  })
}

function saveProcessed() {
  writeJson(PROCESSED_FILE, [...processed].slice(-2000))
}

console.log(`\n🎬 === 关注列表守望启动 ===`)
console.log(`   每 ${INTERVAL} 秒扫一次关注列表`)
console.log(`   白名单 ${whitelist.size} 个 / 黑名单 ${blacklist.size} 个 / 模板 ${templates.length} 条`)
console.log(`   已处理缓存: ${processed.size} 条（启动基线）`)
if (ONLY_WHITELIST) console.log(`   ⚠️  仅响应白名单 UP 主`)
if (minAgeSec > 0) console.log(`   ⚠️  只响应发布超过 ${minAgeSec} 秒的视频`)
console.log(`   启动时间: ${new Date().toLocaleString('zh-CN', { hour12: false })}`)

let rounds = 0
const { spawn } = await import('node:child_process')

for (;;) {
  rounds++
  try {
    const items = await fetchFeed()
    const fresh = filterItems(items).sort((a, b) => b.pubTs - a.pubTs)

    if (fresh.length > 0) {
      for (const v of fresh) {
        if (processed.has(v.bvid)) continue
        processed.add(v.bvid)
        saveProcessed()

        const msg = pickTemplate()
        console.log(`\n🔥 发现新视频: ${v.upName} | ${v.title.slice(0, 40)}`)
        console.log(`   BV=${v.bvid}  aid=${v.aid}  发布: ${v.pubTs ? new Date(v.pubTs * 1000).toLocaleString('zh-CN', { hour12: false }) : '?'}  播放: ${v.play}`)
        console.log(`   📝 评论: ${msg}`)

        const task = JSON.stringify({
          name: `关注抢新-${v.upName}`,
          targetUrl: `https://www.bilibili.com/video/${v.bvid}`,
          template: msg,
          _source: 'follow-watch',
          _upName: v.upName,
        })

        const proc = spawn(process.execPath, [path.join(process.cwd(), 'src', 'run-task-direct.mjs'), task], {
          stdio: ['ignore', 'pipe', 'pipe'],
          cwd: process.cwd(),
        })
        let out = ''
        proc.stdout.on('data', d => { out += d.toString(); process.stdout.write(`   → ${d}`) })
        proc.stderr.on('data', d => process.stderr.write(`   → ERR ${d}`))
        await new Promise(resolve => proc.on('close', () => resolve()))

        if (out.includes('发送成功')) console.log(`   ✅ 已抢占前排`)
        else console.log(`   ⚠️  可能失败，检查日志`)

        await new Promise(s => setTimeout(s, 2000 + Math.random() * 3000))
      }
    } else if (!QUIET) {
      const newestPub = items[0]?.pubTs || 0
      const timeStr = newestPub ? new Date(newestPub * 1000).toLocaleString('zh-CN', { hour12: false }) : '?'
      console.log(`  [${rounds}] ${new Date().toLocaleTimeString('zh-CN', { hour12: false })} 无新投稿（最新 ${timeStr}，已处理 ${processed.size}）`)
    }
  } catch (e) {
    console.log(`  [${rounds}] 这一轮失败：${e.message}（继续守望）`)
  }

  await new Promise(s => setTimeout(s, INTERVAL * 1000))
}
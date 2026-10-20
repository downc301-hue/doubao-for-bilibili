import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { getTasks, setTasks, getState, markDone, markFail, startScheduler, startFollowWatcher, stopFollowWatcher, getFollowStatus, getNextRun } from './scheduler.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function resolveDataDir() {
  const candidates = [
    path.join(os.homedir(), '.doubao-bot'),
    'C:\\Users\\Administrator\\.doubao-bot',
    'C:\\Users\\admin\\.doubao-bot',
    'C:\\root\\.doubao-bot',
    '/root/.doubao-bot',
    path.join(process.cwd(), '.doubao-bot'),
  ]
  for (const dir of candidates) {
    try {
      if (fs.existsSync(path.join(dir, 'credentials.json')) || fs.existsSync(path.join(dir, 'config.json'))) {
        return dir
      }
    } catch {}
  }
  return candidates[0]
}

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

function findFile(candidates) {
  for (const p of candidates) {
    try { if (fs.existsSync(p)) return p } catch {}
  }
  return null
}

function readWhaleLog() {
  const candidates = [
    path.join(os.homedir(), '.dsh', 'whale-log.jsonl'),
    'C:\\Users\\Administrator\\.dsh\\whale-log.jsonl',
    'C:\\Users\\admin\\.dsh\\whale-log.jsonl',
    'C:\\root\\.dsh\\whale-log.jsonl',
    'C:\\WINDOWS\\system32\\config\\systemprofile\\.dsh\\whale-log.jsonl',
    path.join(process.cwd(), '.dsh', 'whale-log.jsonl'),
    '/root/.dsh/whale-log.jsonl',
  ]
  const p = findFile(candidates)
  if (!p) return []
  try {
    const raw = fs.readFileSync(p, 'utf8').trim()
    if (!raw) return []
    return raw.split('\n').map(line => {
      try { return JSON.parse(line) } catch { return null }
    }).filter(Boolean)
  } catch { return [] }
}

const DATA_DIR = resolveDataDir()
const PORT = process.env.PORT || 7890
const VERSION = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8')).version || '0.0.0'

function readData(name) {
  const p = path.join(DATA_DIR, name)
  try {
    return fs.readFileSync(p, 'utf8')
  } catch {
    return null
  }
}

function writeData(name, content) {
  const p = path.join(DATA_DIR, name)
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, content, 'utf8')
}

function getJson(name) {
  const raw = readData(name)
  if (!raw) return {}
  try { return JSON.parse(raw) } catch { return {} }
}

function setJson(name, obj) {
  writeData(name, JSON.stringify(obj, null, 2) + '\n')
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', c => chunks.push(c))
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8')
      if (!raw) return resolve({})
      try { resolve(JSON.parse(raw)) } catch { resolve({}) }
    })
    req.on('error', reject)
  })
}

function send(res, status, body, type = 'application/json') {
  res.writeHead(status, {
    'Content-Type': type + '; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  })
  res.end(body)
}

function sendHtml(res, html) {
  send(res, 200, html, 'text/html')
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', chunk => data += chunk)
    req.on('end', () => resolve(data))
    req.on('error', reject)
  })
}

async function api(req, res, pathname) {
  if (req.method === 'OPTIONS') return send(res, 200, 'ok')

  if (pathname === '/' && req.method === 'GET') {
    return sendHtml(res, renderDashboard())
  }
  if (pathname === '/config' && req.method === 'GET') {
    const cfg = getJson('config.json')
    const creds = getJson('credentials.json')
    const publicCreds = {
      hasDoubaoKey: !!creds.doubaoApiKey,
      doubaoKeyMasked: creds.doubaoApiKey ? creds.doubaoApiKey.slice(0, 8) + '...' : '',
      endpointId: creds.doubaoEndpointId || '',
      biliCookieSet: !!(creds.sessdata && (creds.biliJct || creds.bili_jct)),
    }
    return send(res, 200, JSON.stringify({ ...cfg, _creds: publicCreds }))
  }
  if (pathname === '/config' && req.method === 'POST') {
    const body = await parseBody(req)
    const cfg = getJson('config.json')
    if (body.preferences) cfg.preferences = body.preferences
    if (body.budget) cfg.budget = body.budget
    if (body.bili?.ownerMid) cfg.bili.ownerMid = body.bili.ownerMid
    if (body.bili?.ownerName) cfg.bili.ownerName = body.bili.ownerName
    if (body.bili?.sessionCookie) cfg.bili.sessionCookie = body.bili.sessionCookie
    if (body.persona) cfg.persona = body.persona
    setJson('config.json', cfg)
    return send(res, 200, JSON.stringify({ ok: true }))
  }
  if (pathname === '/creds' && req.method === 'POST') {
    const body = await parseBody(req)
    const creds = getJson('credentials.json')
    if (body.doubaoApiKey) creds.doubaoApiKey = body.doubaoApiKey
    if (body.doubaoEndpointId) creds.doubaoEndpointId = body.doubaoEndpointId
    if (body.biliCookie) {
      const cookie = body.biliCookie
      creds.sessdata = extractCookie(cookie, 'SESSDATA') || creds.sessdata
      creds.bili_jct = extractCookie(cookie, 'bili_jct') || creds.bili_jct
      creds.buvid3 = extractCookie(cookie, 'buvid3') || creds.buvid3
    }
    setJson('credentials.json', creds)
    return send(res, 200, JSON.stringify({ ok: true }))
  }
  if (pathname === '/follow-config' && req.method === 'POST') {
    const body = await parseBody(req)
    const cfg = {
      enabled: !!body.enabled,
      interval: Math.max(180, Number(body.interval) || 300),
      onlyWhitelist: !!body.onlyWhitelist,
      whitelist: (body.whitelist || '').split(/[,，\s]+/).filter(Boolean),
      blacklist: (body.blacklist || '').split(/[,，\s]+/).filter(Boolean),
      templates: (body.templates || '').split('\n').map(s => s.trim()).filter(Boolean),
    }
    setJson('follow-config.json', cfg)
    try { stopFollowWatcher() } catch {}
    if (cfg.enabled) startFollowWatcher()
    return send(res, 200, JSON.stringify({ ok: true, cfg }))
  }
  if (pathname === '/follow-test' && req.method === 'GET') {
    const creds = getJson('credentials.json')
    const cookie = `SESSDATA=${creds.sessdata}; bili_jct=${creds.bili_jct}; buvid3=${creds.buvid3}`
    const H = { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36', referer: 'https://space.bilibili.com/', cookie }
    try {
      const r = await fetch('https://api.bilibili.com/x/polymer/web-dynamic/v1/feed/all?type=video&page=1&timezone_offset=-480&platform=web', { headers: H })
      const j = await r.json()
      if (j?.code !== 0) return send(res, 200, JSON.stringify({ error: `code=${j?.code} ${j?.message || ''}` }))
      const items = (j?.data?.items || []).slice(0, 15)
      const out = []
      for (const it of items) {
        const a = it?.modules?.module_author
        const ar = it?.modules?.module_dynamic?.major?.archive
        if (!ar?.bvid) continue
        out.push({
          bvid: ar.bvid,
          title: String(ar.title || '').slice(0, 50),
          up: a?.name || '?',
          mid: a?.mid || 0,
          pub: (a?.pub_ts || 0) ? new Date(a.pub_ts * 1000).toLocaleString('zh-CN', { hour12: false }) : '?',
        })
      }
      return send(res, 200, JSON.stringify({ count: out.length, items: out }))
    } catch (e) {
      return send(res, 200, JSON.stringify({ error: String(e.message) }))
    }
  }
  if (pathname === '/diary' && req.method === 'GET') {
    const logs = readWhaleLog()
    const grouped = {}
    for (const e of logs) {
      const d = String(e.at || '').slice(0, 10)
      if (!d) continue
      if (!grouped[d]) grouped[d] = []
      let kind = e.kind || ''
      let note = e.note || ''
      let target = e.target || ''
      if (kind && kind.length > 30 && !note) {
        note = kind
        kind = 'thought'
      }
      if (!note && kind.length > 5) {
        note = kind
        kind = 'event'
      }
      if (!note) continue
      grouped[d].push({
        kind: kind,
        target: target,
        note: note,
        time: String(e.at || '').slice(11, 16),
      })
    }
    const diary = Object.entries(grouped).map(([date, events]) => {
      const summaryEvt = events.find(e => e.kind === 'summary')
      const summary = summaryEvt ? summaryEvt.note : `今天共 ${events.length} 条记录`
      const body = events.filter(e => e.kind !== 'summary')
      return { date, summary, events: body }
    })
    return send(res, 200, JSON.stringify(diary))
  }
  if (pathname === '/api/version' && req.method === 'GET') {
    return send(res, 200, JSON.stringify({ version: VERSION }))
  }
  if (pathname === '/api/tasks' && req.method === 'GET') {
    const all = (() => {
      try { return JSON.parse(fs.readFileSync(path.join(resolveDataDir(), 'tasks.json'), 'utf8')) } catch { return [] }
    })()
    const state = getState()
    const today = new Date().toLocaleDateString('sv-SE')
    const enriched = all.map(t => {
      const st = state[t.id || t.name]
      const dowNames = ['周日','周一','周二','周三','周四','周五','周六']
      const dayRaw = t.day
      const days = Array.isArray(dayRaw) ? dayRaw.map(d => dowNames[d] || d).join('/') : (typeof dayRaw==='number' ? dowNames[dayRaw] : '每天')
      const timeStr = t.time || '11:00'
      const lead = t.leadMin || 0
      const triggerH = parseInt(timeStr.split(':')[0] || '11') - Math.floor(lead / 60)
      const triggerM = parseInt(timeStr.split(':')[1] || '0') - (lead % 60)
      const nextRun = t.enabled === false ? null : `${days} ${String(Math.max(0,triggerH)).padStart(2,'0')}:${String(Math.max(0,triggerM)).padStart(2,'0')}`
      const done = st?.date === today
      return {
        ...t,
        days,
        nextRun,
        todayDone: done,
        todayStatus: done ? (st.status || 'done') : 'pending',
        lastRun: st?.date ? `${st.date} ${st.time||''} ${st.status==='fail'?'❌':'✅'}` : null,
      }
    })
    return send(res, 200, JSON.stringify(enriched))
  }
  if (pathname === '/api/tasks' && req.method === 'POST') {
    const body = JSON.parse(await readBody(req))
    const all = (() => {
      try { return JSON.parse(fs.readFileSync(path.join(resolveDataDir(), 'tasks.json'), 'utf8')) } catch { return [] }
    })()
    if (body.action === 'add') {
      const newTask = {
        id: body.task.id || ('task-' + Date.now()),
        name: body.task.name,
        targetUrl: body.task.targetUrl || '',
        day: body.task.day,
        time: body.task.time,
        leadMin: body.task.leadMin || 15,
        template: body.task.template || '',
        ownerRef: body.task.ownerRef || '',
        enabled: body.task.enabled !== false,
        description: body.task.description || '',
      }
      const existingIdx = all.findIndex(t => t.id === newTask.id)
      if (existingIdx >= 0) all[existingIdx] = newTask
      else all.push(newTask)
    } else if (body.action === 'delete') {
      const id = body.id
      const filtered = all.filter(t => t.id !== id)
      const s = getState(); delete s[id]; fs.writeFileSync(path.join(resolveDataDir(), 'scheduler-state.json'), JSON.stringify(s, null, 2) + '\n')
      setTasks(filtered)
      return send(res, 200, JSON.stringify({ ok: true }))
    } else if (body.action === 'toggle') {
      const id = body.id
      const t = all.find(x => x.id === id)
      if (t) { t.enabled = !t.enabled; setTasks(all) }
      return send(res, 200, JSON.stringify({ ok: true, enabled: t?.enabled }))
    }
    setTasks(all)
    return send(res, 200, JSON.stringify({ ok: true }))
  }
  if (pathname === '/tokens' && req.method === 'GET') {
    return send(res, 200, readData('tokens.json') || '{}')
  }
  if (pathname === '/debug' && req.method === 'GET') {
    const paths = [
      path.join(os.homedir(), '.doubao-bot', 'credentials.json'),
      path.join(os.homedir(), '.doubao-bot', 'config.json'),
      path.join(os.homedir(), '.bili-ai', 'credentials.json'),
      'C:\\Users\\Administrator\\.doubao-bot\\credentials.json',
      'C:\\Users\\Administrator\\.doubao-bot\\config.json',
      'C:\\Users\\Administrator\\.bili-ai\\credentials.json',
    ]
    const info = paths.map(p => ({
      path: p,
      exists: fs.existsSync(p),
      size: fs.existsSync(p) ? fs.statSync(p).size : 0,
    }))
    return send(res, 200, JSON.stringify({
      homedir: os.homedir(),
      cwd: process.cwd(),
      paths: info,
    }, null, 2))
  }
  if (pathname === '/run' && req.method === 'POST') {
    return runDaily(req, res)
  }
  if (pathname === '/tools/search' && req.method === 'GET') {
    const q = new URL(req.url, 'http://x').searchParams.get('q')
    if (!q) return send(res, 400, JSON.stringify({ error: 'q required' }))
    return runTool(res, ['search', q])
  }
  if (pathname === '/tools/video' && req.method === 'GET') {
    const bvid = new URL(req.url, 'http://x').searchParams.get('bvid')
    if (!bvid) return send(res, 400, JSON.stringify({ error: 'bvid required' }))
    return runTool(res, ['video-content', bvid])
  }
  if (pathname === '/tools/whois' && req.method === 'GET') {
    const mid = new URL(req.url, 'http://x').searchParams.get('mid')
    if (!mid) return send(res, 400, JSON.stringify({ error: 'mid required' }))
    return runTool(res, ['whois', mid])
  }
  if (pathname === '/tools/feed' && req.method === 'GET') {
    return runTool(res, ['feed'])
  }

  if (pathname === '/api/bili/self' && req.method === 'GET') {
    return biliSelf(res)
  }
  if (pathname === '/api/bili/followings' && req.method === 'GET') {
    const url = new URL('http://x' + req.url)
    const pn = Number(url.searchParams.get('pn')) || 1
    const ps = Math.min(50, Number(url.searchParams.get('ps')) || 20)
    return biliFollowings(res, pn, ps)
  }
  if (pathname === '/api/bili/up' && req.method === 'GET') {
    const url = new URL('http://x' + req.url)
    const mid = Number(url.searchParams.get('mid'))
    if (!mid) return send(res, 400, JSON.stringify({ error: 'mid required' }))
    return biliUpInfo(res, mid)
  }
  if (pathname === '/api/bili/follow' && req.method === 'POST') {
    const body = await parseBody(req)
    const mid = Number(body.mid)
    if (!mid) return send(res, 400, JSON.stringify({ error: 'mid required' }))
    return biliModifyRelation(res, mid, 1)
  }
  if (pathname === '/api/bili/unfollow' && req.method === 'POST') {
    const body = await parseBody(req)
    const mid = Number(body.mid)
    if (!mid) return send(res, 400, JSON.stringify({ error: 'mid required' }))
    return biliModifyRelation(res, mid, 2)
  }

  return send(res, 404, JSON.stringify({ error: 'not found' }))
}

function biliReqHeaders() {
  const creds = getJson('credentials.json')
  const sess = creds.sessdata
  const jct = creds.bili_jct || creds.biliJct
  const buvid = creds.buvid3
  if (!sess || !jct) return null
  return {
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    referer: 'https://space.bilibili.com/',
    cookie: `SESSDATA=${sess}; bili_jct=${jct}; buvid3=${buvid}`,
  }
}

async function biliSelf(res) {
  const H = biliReqHeaders()
  if (!H) return send(res, 401, JSON.stringify({ error: 'B 站 Cookie 未配置' }))
  try {
    const r = await fetch('https://api.bilibili.com/x/web-interface/nav', { headers: H })
    const j = await r.json()
    if (j?.code !== 0) return send(res, 200, JSON.stringify({ error: `code=${j?.code} ${j?.message || ''}` }))
    const d = j.data
    return send(res, 200, JSON.stringify({
      mid: d.mid,
      name: d.uname,
      face: d.face,
      level: d.level_info?.current_level || 0,
      following: d.following || 0,
      follower: d.follower || 0,
      sign: d.sign || '',
    }))
  } catch (e) {
    return send(res, 200, JSON.stringify({ error: String(e.message) }))
  }
}

async function biliFollowings(res, pn, ps) {
  const H = biliReqHeaders()
  if (!H) return send(res, 401, JSON.stringify({ error: 'B 站 Cookie 未配置' }))
  try {
    const myR = await fetch('https://api.bilibili.com/x/web-interface/nav', { headers: H })
    const myJ = await myR.json()
    const myMid = myJ?.data?.mid
    if (!myMid) return send(res, 200, JSON.stringify({ error: `无法获取自身 UID` }))

    const r = await fetch(`https://api.bilibili.com/x/relation/followings?vmid=${myMid}&pn=${pn}&ps=${ps}&order=desc`, { headers: H })
    const j = await r.json()
    if (j?.code !== 0) return send(res, 200, JSON.stringify({ error: `code=${j?.code} ${j?.message || ''}` }))
    const list = (j?.data?.list || []).map(u => ({
      mid: u.mid,
      name: u.uname,
      face: u.face,
      sign: u.sign || '',
      official: u.official?.title || '',
      fans: u.fans || 0,
      live: u.live_status ? { status: u.live_status, title: u.live_title || '', cover: u.live_cover || '' } : null,
    }))
    return send(res, 200, JSON.stringify({
      total: j?.data?.total || 0,
      pn, ps,
      list,
    }))
  } catch (e) {
    return send(res, 200, JSON.stringify({ error: String(e.message) }))
  }
}

async function biliUpInfo(res, mid) {
  const H = biliReqHeaders()
  if (!H) return send(res, 401, JSON.stringify({ error: 'B 站 Cookie 未配置' }))
  try {
    const r = await fetch(`https://api.bilibili.com/x/space/wbi/acc/info?mid=${mid}`, { headers: H })
    const j = await r.json()
    if (j?.code !== 0) return send(res, 200, JSON.stringify({ error: `code=${j?.code} ${j?.message || ''}` }))
    const d = j.data
    return send(res, 200, JSON.stringify({
      mid: d.mid,
      name: d.name,
      face: d.face,
      sign: d.sign || '',
      official: d.official?.title || '',
      level: d.level || 0,
      follower: d.follower || 0,
      following: d.following || 0,
    }))
  } catch (e) {
    return send(res, 200, JSON.stringify({ error: String(e.message) }))
  }
}

async function biliModifyRelation(res, fid, act) {
  const creds = getJson('credentials.json')
  const jct = creds.bili_jct || creds.biliJct
  const sess = creds.sessdata
  const buvid = creds.buvid3
  if (!sess || !jct) return send(res, 401, JSON.stringify({ error: 'B 站 Cookie 未配置' }))
  const H = {
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    referer: `https://space.bilibili.com/${fid}`,
    cookie: `SESSDATA=${sess}; bili_jct=${jct}; buvid3=${buvid}`,
    'Content-Type': 'application/x-www-form-urlencoded',
  }
  const body = `fid=${fid}&act=${act}&re_src=11&csrf=${jct}`
  try {
    const r = await fetch('https://api.bilibili.com/x/relation/modify', { method: 'POST', headers: H, body })
    const j = await r.json()
    if (j?.code !== 0) return send(res, 200, JSON.stringify({ ok: false, error: `code=${j?.code} ${j?.message || ''}` }))
    return send(res, 200, JSON.stringify({ ok: true, action: act === 1 ? 'followed' : 'unfollowed', mid: fid }))
  } catch (e) {
    return send(res, 200, JSON.stringify({ ok: false, error: String(e.message) }))
  }
}

function extractCookie(cookieStr, name) {
  const m = cookieStr.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]+)'))
  return m ? decodeURIComponent(m[1]) : null
}

function runDaily(req, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  })

  const child = spawn('node', ['src/run-daily.mjs'], {
    cwd: path.resolve(__dirname, '..'),
    env: spawnEnv(),
  })

  const sendEvent = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`)
  }

  sendEvent({ type: 'start', time: new Date().toISOString() })

  child.stdout.on('data', (buf) => {
    const lines = buf.toString().split('\n').filter(Boolean)
    for (const line of lines) {
      sendEvent({ type: 'stdout', text: line })
    }
  })

  child.stderr.on('data', (buf) => {
    sendEvent({ type: 'stderr', text: buf.toString() })
  })

  child.on('close', (code) => {
    sendEvent({ type: 'done', code, time: new Date().toISOString() })
    res.end()
  })

  child.on('error', (err) => {
    sendEvent({ type: 'error', text: err.message })
    res.end()
  })

  req.on('close', () => {
    if (!child.killed) child.kill()
  })
}

function runTool(res, args) {
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' })
  const child = spawn('node', ['tools/bili.mjs', ...args], {
    cwd: path.resolve(__dirname, '..'),
    env: spawnEnv(),
  })
  child.stdout.on('data', (b) => res.write(b))
  child.stderr.on('data', (b) => res.write(b))
  child.on('close', () => res.end())
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost')
  api(req, res, url.pathname).catch(err => {
    send(res, 500, JSON.stringify({ error: err.message }))
  })
})

server.listen(PORT, () => {
  console.log(`\n🌐 doubao-bot v${VERSION}  running at http://localhost:${PORT}`)
  console.log(`   Dashboard:   http://localhost:${PORT}/`)
  console.log(`   Port: ${PORT}  (set PORT env var to change)\n`)
  startScheduler()
  startFollowWatcher()
})

function renderDashboard() {
  const cfg = getJson('config.json')
  const creds = getJson('credentials.json')
  const whaleLogs = readWhaleLog()
  const tokens = getJson('tokens.json')
  const fwCfg = getJson('follow-config.json')
  const fwRunning = getFollowStatus()
  const fwEnabled = fwCfg.enabled === true
  const fwInterval = fwCfg.interval || 300
  const fwOL = fwCfg.onlyWhitelist === true
  const fwWL = (fwCfg.whitelist || []).join(', ')
  const fwBL = (fwCfg.blacklist || []).join(', ')
  const fwTpls = (fwCfg.templates || ['前排占个座~','沙发！支持UP主','第一！来啦来啦','抢个前排~']).join('\n')

  const diaryMap = {}
  for (const e of whaleLogs) {
    const d = String(e.at || '').slice(0, 10)
    if (!d) continue
    if (!diaryMap[d]) diaryMap[d] = []
    let kind = e.kind || ''
    let note = e.note || ''
    let target = e.target || ''
    if (kind && kind.length > 30 && !note) { note = kind; kind = 'thought' }
    if (!note && kind.length > 5) { note = kind; kind = 'event' }
    if (!note) continue
    diaryMap[d].push({ kind, target, note, time: String(e.at || '').slice(11, 16) })
  }
  const diaryDates = Object.keys(diaryMap).sort().reverse()
  const latestDate = diaryDates[0] || null
  const latestDiary = latestDate ? {
    date: latestDate,
    summary: (diaryMap[latestDate].find(e => e.kind === 'summary')?.note) || `今天 ${diaryMap[latestDate].length} 条`,
    events: diaryMap[latestDate].filter(e => e.kind !== 'summary').slice(-2),
  } : null

  const tokenHistory = tokens.history || []
  const todayTokens = tokenHistory.length > 0
    ? tokenHistory[tokenHistory.length - 1].total || 0
    : 0
  const budget = cfg.budget?.dailyTokens || 50000
  const tokenPct = Math.min(100, Math.round(todayTokens / budget * 100))

  const persona = cfg.persona || {}
  const preferences = cfg.preferences || {}
  const bili = cfg.bili || {}

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>豆包 B站分身 · 控制台</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
:root{
  --c-bg:#0f1115;--c-bg2:#1a1d25;--c-bg3:#22252e;--c-bg4:#2a2d36;
  --c-border:#252830;--c-border2:#2e3139;
  --c-text:#e6e6e6;--c-text-dim:#889;--c-text-mid:#aab;--c-text-title:#c0c8d4;
  --c-accent:#0ea5e9;--c-accent-hover:#38bdf8;
  --c-ok:#52c41a;--c-warn:#faad14;--c-err:#ff4d4f;
  --c-log:#0a0b0e;--c-log-border:#252830;
  --c-tag-online-bg:#f6ffed;--c-tag-online-border:#b7eb8f;--c-tag-online-text:#52c41a;
  --c-tag-offline-bg:#fff2f0;--c-tag-offline-border:#ffccc7;--c-tag-offline-text:#ff4d4f;
  --fs-base:19px;
}
html[data-theme="light"]{
  --c-bg:#f5f7fa;--c-bg2:#ffffff;--c-bg3:#f0f2f5;--c-bg4:#e4e7ed;
  --c-border:#e4e7ed;--c-border2:#dcdfe6;
  --c-text:#1f2937;--c-text-dim:#9aa5b1;--c-text-mid:#6b7280;--c-text-title:#374151;
  --c-log:#1a1d25;--c-log-border:#dcdfe6;
  --c-tag-online-bg:#f6ffed;--c-tag-online-border:#b7eb8f;--c-tag-online-text:#52c41a;
  --c-tag-offline-bg:#fff2f0;--c-tag-offline-border:#ffccc7;--c-tag-offline-text:#ff4d4f;
}
html[data-theme="light"] header{background:#0ea5e9}
body{font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;background:var(--c-bg);color:var(--c-text);min-height:100vh;font-size:var(--fs-base)}
header{background:var(--c-accent);padding:28px 36px}
header h1{font-size:30px;font-weight:600;color:#fff}
header h1 .ver-badge{display:inline-block;font-size:13px;font-weight:500;background:rgba(255,255,255,.2);color:#fff;padding:3px 10px;border-radius:12px;margin-left:10px;vertical-align:middle;backdrop-filter:blur(4px)}
header p{font-size:17px;color:#fff;opacity:.85;margin-top:8px}
main{max-width:1200px;margin:32px auto;padding:0 28px}
.card{background:var(--c-bg2);border-radius:16px;padding:28px;margin-bottom:22px;border:1px solid var(--c-border)}
.card h2{font-size:22px;margin-bottom:18px;color:var(--c-text-title);display:flex;align-items:center;gap:12px;font-weight:600}
.card h2::before{content:"";width:6px;height:24px;background:var(--c-accent);border-radius:3px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px}
.stat{background:var(--c-bg3);border-radius:12px;padding:20px}
.stat .label{font-size:15px;color:var(--c-text-dim)}
.stat .value{font-size:44px;font-weight:700;margin-top:4px;letter-spacing:-1px}
.stat.ok .value{color:var(--c-ok)}
.stat.warn .value{color:var(--c-warn)}
.stat.err .value{color:var(--c-err)}
.bar{height:12px;background:var(--c-bg4);border-radius:5px;margin-top:12px;overflow:hidden}
.bar>div{height:100%;background:var(--c-accent);border-radius:5px;transition:width .3s}
.bar.warn>div{background:linear-gradient(90deg,var(--c-warn),#ff7a45)}
.bar.crit>div{background:linear-gradient(90deg,#ff7a45,var(--c-err))}
.btn{background:var(--c-accent);color:#fff;border:none;padding:14px 26px;border-radius:12px;font-size:var(--fs-base);cursor:pointer;font-weight:500;transition:transform .15s,background .2s;white-space:nowrap;flex-shrink:0;min-width:110px}
.btn:hover{transform:translateY(-1px);background:var(--c-accent-hover)}
.btn:active{transform:translateY(0)}
.btn.ghost{background:transparent;border:1px solid var(--c-accent);color:var(--c-accent)}
.btn.danger{background:linear-gradient(135deg,#ff7a45,var(--c-err));color:#fff;border:1px solid var(--c-err)}
.btn.ghost.danger{background:linear-gradient(135deg,#ff7a45,var(--c-err));color:#fff;border:1px solid var(--c-err)}
textarea,input,select{background:var(--c-bg3);border:1px solid var(--c-border2);border-radius:10px;color:var(--c-text);padding:12px 16px;font-size:var(--fs-base);width:100%;font-family:inherit}
textarea{min-height:100px;resize:vertical}
.row{display:flex;gap:14px;align-items:center;margin-bottom:14px}
.row label{font-size:var(--fs-base);color:var(--c-text-mid);width:110px;flex-shrink:0}
.tag{display:inline-block;background:var(--c-bg3);border:1px solid var(--c-border2);border-radius:22px;padding:5px 14px;font-size:15px;margin:2px}
.tag.online{background:var(--c-tag-online-bg);border-color:var(--c-tag-online-border);color:var(--c-tag-online-text)}
.tag.offline{background:var(--c-tag-offline-bg);border-color:var(--c-tag-offline-border);color:var(--c-tag-offline-text)}
#run-log{background:var(--c-log);border:1px solid var(--c-log-border);border-radius:12px;padding:16px;font-family:"Cascadia Code","Consolas",monospace;font-size:15px;line-height:1.6;max-height:500px;overflow-y:auto;white-space:pre-wrap;word-break:break-all;color:#d0d4dc}
html[data-theme="light"] #run-log{color:#e6e6e6}
#run-log .streaming::after{content:"▌";animation:blink 1s infinite}
@keyframes blink{0%,50%{opacity:1}51%,100%{opacity:0}}
.tabs{display:flex;gap:0;border-bottom:1px solid var(--c-border);margin-bottom:22px}
.tab{padding:16px 26px;font-size:18px;cursor:pointer;border-bottom:2px solid transparent;color:var(--c-text-dim);font-weight:500}
.tab.active{color:var(--c-accent);border-bottom-color:var(--c-accent)}
.tab:hover{color:var(--c-text-mid)}
.pane{display:none}
.pane.active{display:block}
.diary-day{background:var(--c-bg2);border-radius:16px;padding:24px;margin-bottom:20px;border:1px solid var(--c-border)}
.diary-day-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;padding-bottom:14px;border-bottom:1px dashed var(--c-border2)}
.diary-date{font-size:22px;font-weight:700;color:var(--c-text-title)}
.diary-summary{font-size:var(--fs-base);color:var(--c-accent);font-weight:500}
.diary-event{display:flex;gap:12px;margin-bottom:14px;padding:14px 16px;background:var(--c-bg3);border-radius:12px;border-left:4px solid var(--c-border2);transition:transform .15s}
.diary-event:hover{transform:translateX(2px)}
.diary-event .evt-tag{flex-shrink:0;font-size:14px;font-weight:600;padding:4px 10px;border-radius:8px;align-self:flex-start;text-transform:uppercase;letter-spacing:.5px}
.diary-event .evt-body{flex:1;min-width:0}
.diary-event .evt-head{display:flex;align-items:center;gap:8px;margin-bottom:4px}
.diary-event .evt-time{font-size:13px;color:var(--c-text-dim);font-family:"Cascadia Code","Consolas",monospace}
.diary-event .evt-target{font-size:14px;color:var(--c-accent);background:rgba(14,165,233,.1);padding:2px 8px;border-radius:6px}
.diary-event .evt-note{font-size:var(--fs-base);color:var(--c-text);line-height:1.8;white-space:pre-wrap;word-break:break-word}
.evt-wake{background:rgba(114,46,209,.15);color:#b37feb;border-left-color:#b37feb}
.evt-thought{background:rgba(14,165,233,.12);color:#38bdf8;border-left-color:#0ea5e9}
.evt-feeling{background:rgba(245,34,45,.12);color:#ff7875;border-left-color:#f5222d}
.evt-action{background:rgba(82,196,26,.12);color:#73d13d;border-left-color:#52c41a}
.evt-comment{background:rgba(250,173,20,.12);color:#ffc53d;border-left-color:#faad14}
.evt-summary{background:rgba(19,194,194,.15);color:#5cdbd3;border-left-color:#13c2c2}
.evt-event{background:rgba(140,140,140,.1);color:var(--c-text-mid);border-left-color:var(--c-border2)}
html[data-theme="light"] .evt-wake{background:rgba(114,46,209,.08);color:#531dab;border-left-color:#722ed1}
html[data-theme="light"] .evt-thought{background:rgba(14,165,233,.08);color:#0369a1;border-left-color:#0ea5e9}
html[data-theme="light"] .evt-feeling{background:rgba(245,34,45,.08);color:#cf1322;border-left-color:#f5222d}
html[data-theme="light"] .evt-action{background:rgba(82,196,26,.08);color:#389e0d;border-left-color:#52c41a}
html[data-theme="light"] .evt-comment{background:rgba(250,173,20,.1);color:#d48806;border-left-color:#faad14}
html[data-theme="light"] .evt-summary{background:rgba(19,194,194,.08);color:#08979c;border-left-color:#13c2c2}
html[data-theme="light"] .evt-event{background:rgba(0,0,0,.04);color:var(--c-text-mid);border-left-color:#dcdfe6}
.mini{font-size:15px;color:var(--c-text-dim);margin-top:8px}
.tool-btn{min-width:120px;text-align:center}
.tool-label{width:110px;font-size:var(--fs-base);color:var(--c-text-mid);flex-shrink:0}
.tool-input{flex:1}
#tool-result{background:var(--c-log);border:1px solid var(--c-log-border);border-radius:12px;padding:16px;margin-top:16px;font-family:"Cascadia Code","Consolas",monospace;font-size:15px;line-height:1.6;white-space:pre-wrap;max-height:400px;overflow-y:auto;color:#d0d4dc}
html[data-theme="light"] #tool-result{color:#e6e6e6}
a{color:var(--c-accent)}
.task-card{background:var(--c-bg2);border-radius:14px;padding:18px;margin-bottom:14px;border:1px solid var(--c-border);transition:border-color .15s}
.task-card:hover{border-color:var(--c-accent)}
.task-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}
.task-name{font-size:18px;font-weight:700;color:var(--c-text-title)}
.task-meta{display:flex;flex-wrap:wrap;gap:8px;font-size:15px;color:var(--c-text-mid)}
.task-chip{background:rgba(14,165,233,.12);color:#38bdf8;padding:3px 10px;border-radius:6px;font-size:14px;font-weight:500}
.task-chip.done{background:rgba(82,196,26,.15);color:#73d13d}
.task-chip.pending{background:rgba(250,173,20,.15);color:#ffc53d}
.task-chip.disabled{background:rgba(140,140,140,.15);color:var(--c-text-dim)}
.task-actions{display:flex;gap:8px;margin-top:12px}
.task-desc{font-size:var(--fs-base);color:var(--c-text);margin-top:8px;opacity:.8}
.task-empty{text-align:center;padding:40px;color:var(--c-text-dim);font-size:var(--fs-base)}
.theme-bar{display:flex;gap:8px;align-items:center}
.theme-bar button{background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.3);color:#fff;padding:6px 14px;border-radius:20px;font-size:14px;cursor:pointer;font-weight:500}
.theme-bar button.active{background:#fff;color:var(--c-accent);border-color:#fff}
html[data-theme="light"] header .theme-bar button{background:rgba(255,255,255,.25);border-color:rgba(255,255,255,.5)}
html[data-theme="light"] header .theme-bar button.active{background:#fff;color:var(--c-accent);border-color:#fff}
</style>
</head>
<body>

<script>
(function(){
  var t=localStorage.getItem('theme')||'dark';
  var s=localStorage.getItem('fs')||'17';
  document.documentElement.setAttribute('data-theme',t);
  document.documentElement.style.setProperty('--fs-base',s+'px');
})();
</script>
<header style="display:flex;justify-content:space-between;align-items:center">
  <div>
    <h1>豆包 B站分身 <span class="ver-badge" id="ver-badge">v0.0.0</span></h1>
    <p>自主刷B站 · 自己写日记 · 帮用户引流</p>
  </div>
  <div class="theme-bar">
    <button id="btn-fs-sm" title="小字体">小</button>
    <button id="btn-fs-md" title="中字体" class="active">中</button>
    <button id="btn-fs-lg" title="大字体">大</button>
    <button id="btn-theme" title="切换明/暗模式">🌙</button>
  </div>
</header>
<main>

<div class="tabs">
  <div class="tab active" data-tab="overview">概览</div>
  <div class="tab" data-tab="run">唤醒分身</div>
  <div class="tab" data-tab="diary">日记</div>
  <div class="tab" data-tab="tasks">定时任务</div>
  <div class="tab" data-tab="config">设置</div>
  <div class="tab" data-tab="creds">凭据</div>
  <div class="tab" data-tab="tools">工具</div>
</div>

<div class="pane active" id="pane-overview">
  <div class="card">
    <h2>快速状态</h2>
    <div class="grid">
      <div class="stat ${todayTokens > budget ? 'warn' : 'ok'}">
        <div class="label">今日 Token / 预算</div>
        <div class="value">${todayTokens.toLocaleString()} / ${budget.toLocaleString()}</div>
        <div class="bar ${tokenPct > 80 ? (tokenPct > 95 ? 'crit' : 'warn') : ''}"><div style="width:${tokenPct}%"></div></div>
      </div>
      <div class="stat ${creds.doubaoApiKey ? 'ok' : 'err'}">
        <div class="label">豆包 API</div>
        <div class="value">${creds.doubaoApiKey ? '已配置' : '未配置'}</div>
      </div>
      <div class="stat ${creds.sessdata ? 'ok' : 'err'}">
        <div class="label">B站小号</div>
        <div class="value">${creds.sessdata ? 'Cookie OK' : '请登录'}</div>
      </div>
      <div class="stat ${bili.ownerMid ? 'ok' : 'err'}">
        <div class="label">用户</div>
        <div class="value">${bili.ownerName || '未设置'}</div>
      </div>
    </div>
  </div>
  ${latestDiary ? `
  <div class="card">
    <h2>最新日记 · ${latestDiary.date || ''}</h2>
    <div class="diary-event evt-thought">
      <div class="evt-body">
        <div class="evt-note">${latestDiary.summary?.slice(0,200) || '...'}</div>
      </div>
    </div>
    ${(latestDiary.events || []).map(ev => `
    <div class="diary-event evt-${ev.kind || 'event'}">
      <div class="evt-body">
        <div class="evt-head">
          <span class="evt-time">${ev.time || ''}</span>
          ${ev.target ? `<span class="evt-target">${ev.target}</span>` : ''}
        </div>
        <div class="evt-note">${ev.note?.slice(0,150) || ''}</div>
      </div>
    </div>`).join('')}
  </div>` : ''}
</div>

<div class="pane" id="pane-run">
  <div class="card">
    <h2>一键唤醒分身</h2>
    <p class="mini">点击按钮后，分身将自动执行「醒来 → 选题 → 深读 → 评论 → 写日记」全流程。下方会实时输出运行日志。</p>
    <div class="row" style="margin-top:12px">
      <button class="btn" id="btn-run">现在就唤醒</button>
      <span id="run-status" class="tag offline">待运行</span>
    </div>
    <div id="run-log">点击上方按钮开始运行...</div>
  </div>
</div>

<div class="pane" id="pane-diary">
  <div class="card">
    <h2>分身日记（跨天记忆）</h2>
    <div id="diary-list">加载中...</div>
  </div>
</div>

<div class="pane" id="pane-tasks">
  <div class="card">
    <h2>定时抢番任务</h2>
    <p class="mini" style="margin-bottom:16px;">调度器每 60 秒扫一次任务表，到点自动触发。进程在 Web 服务启动时常驻运行。</p>
    <div id="task-list">加载中...</div>
  </div>

  <div class="card">
    <h2>新增任务</h2>
    <div class="row">
      <label>任务名称</label>
      <input id="tk-name" placeholder="例如：凡人修仙传" style="flex:1">
    </div>
    <div class="row">
      <label>视频链接</label>
      <input id="tk-target-url" placeholder="番剧主页 ss 链接 / 单集 BV 链接（填 ss 自动解析最新正片）" style="flex:1">
    </div>
    <div class="row">
      <label>更新日</label>
      <select id="tk-day" style="flex:1">
        <option value="0">周日</option><option value="1">周一</option><option value="2">周二</option>
        <option value="3">周三</option><option value="4">周四</option><option value="5">周五</option>
        <option value="6" selected>周六</option>
      </select>
    </div>
    <div class="row">
      <label>上线时间</label>
      <input id="tk-time" type="time" value="11:00" style="flex:1">
    </div>
    <div class="row">
      <label>提前量</label>
      <input id="tk-lead" type="number" value="20" min="0" max="120" style="flex:1">
      <span class="mini">分钟</span>
    </div>
    <div class="row">
      <label>关联视频</label>
      <input id="tk-owner-ref" placeholder="可选：引流用的 BV 号" style="flex:1">
    </div>
    <div class="row" style="align-items:flex-start">
      <label>预设文案</label>
      <textarea id="tk-template" rows="3" style="flex:1" placeholder="留空让 AI 自由发挥，例如：前排占位，等 UP 主翻牌~"></textarea>
    </div>
    <div class="row">
      <label>备注</label>
      <input id="tk-desc" placeholder="可选，给 AI 的额外指令" style="flex:1">
    </div>
    <div style="margin-top:16px">
      <button class="btn primary" id="tk-save-btn" onclick="saveTask()">保存任务</button>
    </div>
  </div>
</div>

<div class="pane" id="pane-config">
  <div class="card">
    <h2>人设与偏好</h2>
    <div class="row">
      <label>分身昵称</label>
      <input id="cf-name" value="${persona.name || '豆包 B 站助理'}">
    </div>
    <div class="row">
      <label>性格标签</label>
      <input id="cf-tags" value="${(persona.tags || []).join(', ')}" placeholder="如：爱刷AI视频, 喜欢猫咪, 话不多">
    </div>
    <div class="row">
      <label>喜欢的内容</label>
      <input id="cf-like" value="${(preferences.like || []).join(', ')}">
    </div>
    <div class="row">
      <label>不喜欢的内容</label>
      <input id="cf-dislike" value="${(preferences.dislike || []).join(', ')}">
    </div>
    <button class="btn" id="btn-save-persona">保存人设</button>
  </div>

  <div class="card">
    <h2>Token 预算</h2>
    <div class="row">
      <label>每日预算</label>
      <input id="cf-budget" type="number" value="${budget}">
    </div>
    <button class="btn" id="btn-save-budget">保存预算</button>
  </div>

  <div class="card">
    <h2>用户信息</h2>
    <div class="row">
      <label>B 站昵称</label>
      <input id="cf-owner-name" value="${bili.ownerName || ''}">
    </div>
    <div class="row">
      <label>B 站 UID</label>
      <input id="cf-owner-mid" value="${bili.ownerMid || ''}">
    </div>
    <button class="btn" id="btn-save-owner">保存用户信息</button>
  </div>

  <div class="card">
    <h2>🎬 关注列表抢前排 <span id="fw-status" class="tag ${fwEnabled && fwRunning.running ? 'online' : 'offline'}">${fwEnabled ? (fwRunning.running ? '运行中' : '已启用但未启动') : '未启用'}</span></h2>
    <p class="mini">后台 0 token 守望关注的 UP 主，一旦有新投稿立刻用预设文案抢前排。Web 服务启动时自动拉起。</p>
    <div class="row">
      <label>启用守望</label>
      <label class="switch"><input type="checkbox" id="fw-enabled" ${fwEnabled ? 'checked' : ''}><span></span></label>
    </div>
    <div class="row">
      <label>扫一眼频率</label>
      <input id="fw-interval" type="number" min="180" step="30" value="${fwInterval}">
      <span class="mini">秒（最少 180 秒，防 B 站限频）</span>
    </div>
    <div class="row">
      <label>仅白名单</label>
      <label class="switch"><input type="checkbox" id="fw-ol" ${fwOL ? 'checked' : ''}><span></span></label>
      <span class="mini">只响应下面白名单的 UP 主 MID（关闭则响应所有关注）</span>
    </div>
    <div class="row">
      <label>白名单 MID</label>
      <input id="fw-wl" value="${fwWL}" placeholder="如 123456, 789012">
    </div>
    <div class="row">
      <label>黑名单 MID</label>
      <input id="fw-bl" value="${fwBL}" placeholder="永远不响应的 UP 主 MID">
    </div>
    <div class="row" style="align-items:flex-start">
      <label>评论模板</label>
      <textarea id="fw-templates" rows="4" placeholder="每行一条，随机选一条发">${fwTpls}</textarea>
    </div>
    <div class="row">
      <button class="btn" id="btn-save-fw">保存并重启守望</button>
      <button class="btn ghost" onclick="testFollowFetch()">测试拉一次关注列表</button>
    </div>
  </div>
</div>

<div class="pane" id="pane-creds">
  <div class="card">
    <h2>豆包 API</h2>
    <p class="mini">在 <a href="https://console.volcengine.com/ark" target="_blank">火山方舟控制台</a> 创建 API Key 和接入点。</p>
    <div class="row">
      <label>API Key</label>
      <input id="cred-doubao-key" type="password" placeholder="sk-... （粘贴后自动隐藏）">
    </div>
    <div class="row">
      <label>Endpoint ID</label>
      <input id="cred-endpoint" value="${creds.doubaoEndpointId || ''}" placeholder="ep-2025xxxxxx-xxxxx">
    </div>
    <button class="btn" id="btn-save-doubao">保存豆包凭据</button>
  </div>

  <div class="card">
    <h2>B站小号 Cookie</h2>
    <p class="mini">浏览器登录小号 → F12 → Application → Cookies → bilibili.com → 复制整行 Cookie 粘贴进来。</p>
    <textarea id="cred-bili-cookie" placeholder="buvid3=...; SESSDATA=...; bili_jct=..."></textarea>
    <div class="row" style="margin-top:10px">
      <button class="btn" id="btn-save-bili">保存 B站 Cookie</button>
      <span id="bili-status" class="tag offline">${creds.sessdata ? 'Cookie 已配置' : '未配置'}</span>
    </div>
  </div>
</div>

<div class="pane" id="pane-tools">
  <div class="card">
    <h2>B站工具快捷入口</h2>
    <div class="row">
      <label>搜索视频</label>
      <input id="tool-search-q" placeholder="如：AI 插件">
      <button class="btn ghost" onclick="runTool('search')">搜索</button>
    </div>
    <div class="row">
      <label>视频详情</label>
      <input id="tool-video-bvid" placeholder="BV1xx411c7mu">
      <button class="btn ghost" onclick="runTool('video')">查询</button>
    </div>
    <div class="row">
      <label>UP主信息</label>
      <input id="tool-whois-mid" placeholder="1515175012">
      <button class="btn ghost" onclick="runTool('whois')">查询</button>
    </div>
    <div class="row">
      <label>刷新 Feed</label>
      <button class="btn ghost" onclick="runTool('feed')">获取推荐</button>
    </div>
    <div id="tool-result" style="background:#0a0b0e;border:1px solid #252830;border-radius:12px;padding:16px;margin-top:16px;font-family:monospace;font-size:15px;white-space:pre-wrap;max-height:400px;overflow-y:auto">工具输出会显示在这里...</div>
  </div>
</div>

</main>
<script>
document.querySelectorAll('.tab').forEach(function(t){t.onclick=function(){
  document.querySelectorAll('.tab').forEach(function(x){x.classList.remove('active')})
  document.querySelectorAll('.pane').forEach(function(x){x.classList.remove('active')})
  t.classList.add('active')
  document.getElementById('pane-'+t.dataset.tab).classList.add('active')
}})

var btnRun=document.getElementById('btn-run');if(btnRun)btnRun.onclick=async function(){
  var btn=document.getElementById('btn-run')
  var log=document.getElementById('run-log')
  var status=document.getElementById('run-status')
  btn.disabled=true;btn.textContent='运行中...'
  status.className='tag online';status.textContent='运行中'
  log.textContent=''
  var es=new EventSource('/run')
  var started=false
  es.onmessage=function(e){
    var d=JSON.parse(e.data)
    if(d.type==='start'){started=true;log.textContent+='分身开始醒来...\\n'}
    else if(d.type==='stdout'){log.textContent+=d.text+'\\n';log.classList.add('streaming');log.scrollTop=log.scrollHeight}
    else if(d.type==='stderr'){log.textContent+='[错误] '+d.text+'\\n'}
    else if(d.type==='done'){
      log.classList.remove('streaming')
      log.textContent+=('\\n完成，退出码: '+d.code+' 于 '+new Date(d.time).toLocaleTimeString()+'\\n')
      status.className=d.code===0?'tag online':'tag offline'
      status.textContent=d.code===0?'完成 (码0)':'退出码 '+d.code
      btn.disabled=false;btn.textContent='唤醒分身'
      es.close()
    }
  }
  es.onerror=function(){if(!started){log.textContent='连接失败，检查服务端口\\n';btn.disabled=false;btn.textContent='唤醒分身';es.close()}}
}

var btnSaveC=document.getElementById('btn-save-owner');if(btnSaveC)btnSaveC.onclick=async function(){
  var body={bili:{}}
  var n=document.getElementById('cf-owner-name').value.trim();if(n)body.bili.ownerName=n
  var m=document.getElementById('cf-owner-mid').value.trim();if(m)body.bili.ownerMid=m
  await fetch('/config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})
  alert('已保存');location.reload()
}

var btnSaveFW=document.getElementById('btn-save-fw');if(btnSaveFW)btnSaveFW.onclick=async function(){
  var body={
    enabled:document.getElementById('fw-enabled').checked,
    interval:document.getElementById('fw-interval').value,
    onlyWhitelist:document.getElementById('fw-ol').checked,
    whitelist:document.getElementById('fw-wl').value,
    blacklist:document.getElementById('fw-bl').value,
    templates:document.getElementById('fw-templates').value,
  }
  await fetch('/follow-config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})
  alert('关注守望已保存并重启');location.reload()
}
window.testFollowFetch=async function(){
  var r=await fetch('/follow-test').then(function(r){return r.json()})
  var items=r.items||[]
  var msg=''
  if(items.length>0){
    msg='API OK! '+items.length+' feeds:\\n'
    items.slice(0,5).forEach(function(i){msg+='  '+i.pub+' '+i.up+'('+i.mid+') '+i.title+' BV='+i.bvid+'\\n'})
  }else{
    msg='API returned: '+(r.error||'empty, cookie expired?')
  }
  alert(msg)
}
var d=document.getElementById('btn-save-doubao');if(d)d.onclick=async function(){
  var k=document.getElementById('cred-doubao-key').value
  var e=document.getElementById('cred-endpoint').value
  if(!k&&!e){alert('请至少填一项');return}
  await fetch('/creds',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({doubaoApiKey:k,doubaoEndpointId:e})})
  alert('豆包凭据已保存');location.reload()
}
var bi=document.getElementById('btn-save-bili');if(bi)bi.onclick=async function(){
  var cookie=document.getElementById('cred-bili-cookie').value
  if(!cookie.trim()){alert('请粘贴 Cookie');return}
  await fetch('/creds',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({biliCookie:cookie})})
  alert('B站 Cookie 已保存');location.reload()
}

async function loadDiary(){
  var KIND_LABEL={wake:'醒来',thought:'想法',feeling:'心情',action:'动作',comment:'评论',summary:'总结',event:'事件'}
  var diary=await fetch('/diary').then(function(r){return r.json()})
  var list=document.getElementById('diary-list')
  if(!list)return
  if(!Array.isArray(diary)||diary.length===0){list.innerHTML='<p class="mini">还没有日记，唤醒分身一次就会有了~</p>';return}
  list.innerHTML=diary.slice().reverse().map(function(d){
    var evts=(d.events||[]).map(function(ev){
      var cls='evt-'+(ev.kind||'event')
      var label=KIND_LABEL[ev.kind]||ev.kind||'事件'
      return '<div class="diary-event '+cls+'">'+
        '<span class="evt-tag">'+label+'</span>'+
        '<div class="evt-body">'+
          '<div class="evt-head">'+
            '<span class="evt-time">'+(ev.time||'')+'</span>'+
            (ev.target?'<span class="evt-target">'+ev.target+'</span>':'')+
          '</div>'+
          '<div class="evt-note">'+(ev.note||'')+'</div>'+
        '</div>'+
      '</div>'
    }).join('')
    return '<div class="diary-day">'+
      '<div class="diary-date">'+d.date+' <span class="mini">'+(d.summary||'')+'</span></div>'+
      evts+
    '</div>'
  }).join('')
}
loadDiary()

var btnRunDaily=document.getElementById('btn-run-daily');if(btnRunDaily)btnRunDaily.onclick=async function(){
  await fetch('/run-daily',{method:'POST'})
  alert('已触发日常唤醒')
}

function toast(msg,type){
  var t=document.createElement('div')
  t.textContent=msg
  t.style.cssText='position:fixed;top:24px;right:24px;padding:12px 20px;border-radius:10px;color:#fff;z-index:9999;font-weight:500;box-shadow:0 4px 12px rgba(0,0,0,.3);transition:opacity .3s;opacity:0'
  t.style.background=type==='error'?'#ff4d4f':type==='ok'?'#52c41a':'#0ea5e9'
  document.body.appendChild(t)
  requestAnimationFrame(function(){t.style.opacity=1})
  setTimeout(function(){t.style.opacity=0;setTimeout(function(){t.remove()},300)},2500)
}

var editingTaskId=null
async function saveTask(){
  console.log('[saveTask] called')
  var nameEl=document.getElementById('tk-name')
  var urlEl=document.getElementById('tk-target-url')
  var dayEl=document.getElementById('tk-day')
  var timeEl=document.getElementById('tk-time')
  var leadEl=document.getElementById('tk-lead')
  var task={
    id:editingTaskId||('task-'+Date.now()),
    name:nameEl.value.trim(),
    targetUrl:urlEl.value.trim(),
    day:parseInt(dayEl.value),
    time:timeEl.value,
    leadMin:parseInt(leadEl.value)||15,
    template:document.getElementById('tk-template').value.trim(),
    ownerRef:document.getElementById('tk-owner-ref').value.trim(),
    description:document.getElementById('tk-desc').value.trim(),
    enabled:true,
  }
  if(!task.name){nameEl.focus();nameEl.style.borderColor='#ff6b6b';toast('请填任务名称','error');return}
  if(!task.targetUrl){urlEl.focus();urlEl.style.borderColor='#ff6b6b';toast('请填视频链接','error');return}
  if(!/^(https?:)?\\/\\//.test(task.targetUrl)&&!/^BV\\d+/.test(task.targetUrl)&&!/^ss\\d+/.test(task.targetUrl)){
    urlEl.focus();urlEl.style.borderColor='#ff6b6b';toast('视频链接格式不对','error');return
  }
  if(isNaN(task.day)||task.day<0||task.day>6){dayEl.focus();dayEl.style.borderColor='#ff6b6b';toast('请选更新日','error');return}
  if(!task.time||!/^\\d{1,2}:\\d{2}$/.test(task.time)){timeEl.focus();timeEl.style.borderColor='#ff6b6b';toast('上线时间格式应为 HH:MM','error');return}
  if(task.leadMin<0||task.leadMin>120){leadEl.focus();leadEl.style.borderColor='#ff6b6b';toast('提前量在 0-120 分钟之间','error');return}
  ;[nameEl,urlEl,dayEl,timeEl,leadEl].forEach(function(el){if(el)el.style.borderColor=''})
  var saveBtn=document.getElementById('tk-save-btn')
  if(saveBtn){saveBtn.disabled=true;saveBtn.textContent='保存中...'}
  var resp=await fetch('/api/tasks',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'add',task})})
  var result=await resp.json()
  if(saveBtn){saveBtn.disabled=false;saveBtn.textContent='保存任务'}
  if(result.ok){
    toast('任务已保存 ✓','ok')
    editingTaskId=null
    var hint=document.getElementById('tk-editor-hint');if(hint)hint.remove()
    ;['tk-name','tk-target-url','tk-template','tk-owner-ref','tk-desc'].forEach(function(id){var e=document.getElementById(id);if(e)e.value=''})
    if(dayEl)dayEl.value='6'
    if(timeEl)timeEl.value='11:00'
    if(leadEl)leadEl.value='20'
    loadTasks()
    window.scrollTo({top:document.getElementById('pane-tasks').offsetTop-40,behavior:'smooth'})
  }else{
    toast('保存失败','error')
  }
}

async function loadTasks(){
  var list=await fetch('/api/tasks').then(function(r){return r.json()})
  var wrap=document.getElementById('task-list')
  if(!wrap)return
  if(!list||list.length===0){wrap.innerHTML='<div class="task-empty">还没有定时任务，下面加一个吧~</div>';return}
  wrap.innerHTML=list.map(function(t){
    var chip='<span class="task-chip '+(t.enabled===false?'disabled':(t.todayDone?'done':'pending'))+'">'+
      (t.enabled===false?'已暂停':(t.todayDone?(t.todayStatus==='fail'?'失败':'今日已完成'):'待触发'))+'</span>'
    var meta='<div class="task-meta">'+
      '<span class="task-chip">'+(t.days||'每天')+'</span>'+
      '<span class="task-chip">'+(t.time||'--:--')+'</span>'+
      '<span class="task-chip">提前'+(t.leadMin||0)+'分钟</span>'+
      (t.ownerRef?'<span class="task-chip">引流: '+t.ownerRef+'</span>':'')+
      (t.lastRun?'<span class="mini">上次: '+t.lastRun+'</span>':'')+
    '</div>'
    var desc='';if(t.description)desc='<div class="task-desc">'+t.description+'</div>'
    var tmpl='';if(t.template)tmpl='<div class="task-desc" style="opacity:.6">预设文案: '+t.template.slice(0,60)+(t.template.length>60?'...':'')+'</div>'
    var act='<div class="task-actions">'+
      '<button class="btn ghost" data-id="'+t.id+'" onclick="editTask(this)">编辑</button>'+
      '<button class="btn ghost" data-id="'+t.id+'" onclick="toggleTask(this)">'+(t.enabled===false?'启用':'暂停')+'</button>'+
      '<button class="btn ghost danger" data-id="'+t.id+'" onclick="deleteTask(this)">删除</button>'+
    '</div>'
    return '<div class="task-card">'+
      '<div class="task-head">'+
        '<span class="task-name">'+(t.name||'')+'</span>'+
        chip+
      '</div>'+
      meta+desc+tmpl+act+
    '</div>'
  }).join('')
}

async function editTask(btn){
  var id=btn.dataset.id
  var list=await fetch('/api/tasks').then(function(r){return r.json()})
  var t=list.find(function(x){return x.id===id})
  if(!t)return
  editingTaskId=id
  document.getElementById('tk-name').value=t.name||''
  document.getElementById('tk-target-url').value=t.targetUrl||''
  document.getElementById('tk-day').value=t.day!=null?t.day:''
  document.getElementById('tk-time').value=t.time||''
  document.getElementById('tk-lead').value=t.leadMin||15
  document.getElementById('tk-template').value=t.template||''
  document.getElementById('tk-owner-ref').value=t.ownerRef||''
  document.getElementById('tk-desc').value=t.description||''
  var hint=document.getElementById('tk-editor-hint')
  if(!hint){
    hint=document.createElement('div')
    hint.id='tk-editor-hint'
    hint.style.cssText='background:#fff7e6;border:1px solid #ffd591;border-radius:8px;padding:10px 14px;margin-bottom:14px;font-size:14px;color:#d46b08;display:flex;justify-content:space-between;align-items:center'
    hint.innerHTML='正在编辑任务，保存会覆盖原有设置 <button class="btn ghost danger" style="padding:4px 10px;min-width:auto" onclick="cancelEdit()">取消编辑</button>'
    var card=document.querySelector('#pane-tasks .card:last-of-type')||document.body
    card.insertBefore(hint, card.firstChild)
  }
  var saveBtn=document.getElementById('tk-save-btn')
  if(saveBtn)saveBtn.textContent='更新任务'
  window.scrollTo({top:document.getElementById('pane-tasks').offsetTop-40,behavior:'smooth'})
}
function cancelEdit(){
  editingTaskId=null
  var hint=document.getElementById('tk-editor-hint');if(hint)hint.remove()
  ;['tk-name','tk-target-url','tk-template','tk-owner-ref','tk-desc'].forEach(function(id){var e=document.getElementById(id);if(e)e.value=''})
  var d=document.getElementById('tk-day');if(d)d.value='6'
  var ti=document.getElementById('tk-time');if(ti)ti.value='11:00'
  var l=document.getElementById('tk-lead');if(l)l.value='20'
  var saveBtn=document.getElementById('tk-save-btn');if(saveBtn)saveBtn.textContent='保存任务'
}

async function toggleTask(btn){
  var id=btn.dataset.id
  await fetch('/api/tasks',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'toggle',id:id})})
  loadTasks()
}
async function deleteTask(btn){
  var id=btn.dataset.id
  if(!confirm('确定删除这个任务吗？'))return
  await fetch('/api/tasks',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'delete',id:id})})
  loadTasks()
}

var biliFlPage=1
var biliFlPs=20
async function refreshBiliSelf(){
  var nameEl=document.getElementById('bili-self-name');var faceEl=document.getElementById('bili-self-face')
  if(!nameEl&&!faceEl)return
  var r=await fetch('/api/bili/self').then(function(r){return r.json()})
  if(r.error){if(nameEl)nameEl.textContent='⚠ '+r.error;return}
  if(faceEl)faceEl.src=r.face||''
  if(nameEl)nameEl.textContent=r.name||'?'
  var midEl=document.getElementById('bili-self-mid');if(midEl)midEl.textContent='UID: '+r.mid+'  ·  Lv.'+(r.level||0)
  var statsEl=document.getElementById('bili-self-stats');if(statsEl)statsEl.textContent='关注 '+(r.following||0)+'  ·  粉丝 '+(r.follower||0)+(r.sign?'  ·  '+r.sign:'')
}
async function loadBiliFollowings(pn){
  if(pn)biliFlPage=pn
  var listEl=document.getElementById('bili-fl-list')
  var pager=document.getElementById('bili-fl-pager')
  var countEl=document.getElementById('bili-fl-count')
  if(!listEl&&!pager&&!countEl)return
  var r=await fetch('/api/bili/followings?pn='+biliFlPage+'&ps='+biliFlPs).then(function(r){return r.json()})
  if(countEl)countEl.textContent='(共 '+r.total+' 人)'
  if(r.error){if(listEl)listEl.innerHTML='<div class="mini" style="color:var(--c-err)">'+r.error+'</div>';if(pager)pager.innerHTML='';return}
  var list=r.list||[]
  if(list.length===0){if(listEl)listEl.innerHTML='<div class="mini" style="color:var(--c-text-dim)">还没有关注任何人</div>';if(pager)pager.innerHTML='';return}
  var html=''
  for(var i=0;i<list.length;i++){
    var u=list[i]
    html+='<div style="display:flex;align-items:center;gap:12px;padding:10px 12px;background:var(--c-bg3);border-radius:10px;margin-bottom:8px">'
    html+='<img src="'+u.face+'" style="width:40px;height:40px;border-radius:50%;background:#333">'
    html+='<div style="flex:1;min-width:0">'
    html+='<div style="font-weight:500">'+u.name+(u.official?' <span class="mini" style="color:var(--c-accent)">'+u.official+'</span>':'')+(u.live?' <span class="mini" style="color:var(--c-err)">直播中</span>':'')+'</div>'
    html+='<div class="mini">UID: '+u.mid+(u.fans?'  ·  粉丝 '+u.fans:'')+(u.sign?'  ·  '+u.sign.slice(0,40):'')+'</div>'
    html+='</div>'
    html+='<button class="btn ghost danger" style="padding:6px 14px;min-width:auto" onclick="doUnfollow('+u.mid+')">取关</button>'
    html+='</div>'
  }
  if(listEl)listEl.innerHTML=html
  var totalPages=Math.max(1,Math.ceil(r.total/biliFlPs))
  var pg=''
  if(biliFlPage>1)pg+='<button class="btn ghost" style="padding:4px 12px;min-width:auto" onclick="loadBiliFollowings('+(biliFlPage-1)+')">上一页</button>'
  pg+='<span class="mini" style="align-self:center">'+biliFlPage+'/'+totalPages+'</span>'
  if(biliFlPage<totalPages)pg+='<button class="btn ghost" style="padding:4px 12px;min-width:auto" onclick="loadBiliFollowings('+(biliFlPage+1)+')">下一页</button>'
  if(pager)pager.innerHTML=pg
}
async function doFollow(){
  var mid=document.getElementById('bili-follow-mid').value.trim()
  if(!mid){alert('请输入 MID');return}
  if(!confirm('确认关注 MID '+mid+' ?'))return
  var r=await fetch('/api/bili/follow',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mid:Number(mid)})}).then(function(r){return r.json()})
  if(r.ok){refreshBiliSelf();loadBiliFollowings();toast('关注成功','ok')}
  else toast('关注失败: '+(r.error||''),'error')
}
async function doUnfollow(mid){
  if(!confirm('确认取关 MID '+mid+' ?'))return
  var r=await fetch('/api/bili/unfollow',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mid:mid})}).then(function(r){return r.json()})
  if(r.ok){refreshBiliSelf();loadBiliFollowings()}
  else toast('取关失败: '+(r.error||''),'error')
}

async function runTool(kind){
  var resultEl=document.getElementById('tool-result')
  function showErr(msg){ toast(msg,'error'); if(resultEl)resultEl.textContent='❌ '+msg }
  var url='', q, label=''
  if(kind==='search'){
    q=document.getElementById('tool-search-q'); if(!q)return
    var v=q.value.trim()
    if(!v){ toast('请输入搜索关键词','error'); q.focus(); q.style.borderColor='#ff6b6b'; return }
    q.style.borderColor=''
    url='/tools/search?q='+encodeURIComponent(v); label='搜索: '+v
  }else if(kind==='video'){
    q=document.getElementById('tool-video-bvid'); if(!q)return
    var v=q.value.trim()
    if(!v){ toast('请输入视频 BV 号','error'); q.focus(); q.style.borderColor='#ff6b6b'; return }
    if(!/^BV[A-Za-z0-9]+$/i.test(v)){ toast('BV 号格式不对，应以 BV 开头，如 BV1xx411c7mu','error'); q.focus(); q.select(); q.style.borderColor='#ff6b6b'; return }
    q.style.borderColor=''
    url='/tools/video?bvid='+v; label='视频: '+v
  }else if(kind==='whois'){
    q=document.getElementById('tool-whois-mid'); if(!q)return
    var v=q.value.trim()
    if(!v){ toast('请输入 UP 主 MID','error'); q.focus(); q.style.borderColor='#ff6b6b'; return }
    if(!/^\\d+$/.test(v)){ toast('MID 必须是纯数字','error'); q.focus(); q.select(); q.style.borderColor='#ff6b6b'; return }
    q.style.borderColor=''
    url='/tools/whois?mid='+v; label='MID: '+v
  }else if(kind==='feed'){
    url='/tools/feed'; label='刷新 Feed'
  }else{ toast('未知工具: '+kind,'error'); return }
  toast('请求中...','info')
  if(resultEl){ resultEl.textContent='⏳ '+label+'\\n请求中，请稍候...\\n'; resultEl.scrollTop=0 }
  try{
    var r=await fetch(url)
    var text=await r.text()
    if(!r.ok){ if(resultEl)resultEl.textContent='❌ HTTP '+r.status+'\\n\\n'+text; toast('请求失败: '+r.status,'error'); return }
    if(resultEl)resultEl.textContent=text || '(空输出)'
    toast('完成 ✓','ok')
  }catch(e){
    if(resultEl)resultEl.textContent='❌ 网络错误: '+e.message
    toast('网络错误','error')
  }
}

loadTasks()
setInterval(loadTasks,30000)
refreshBiliSelf()
loadBiliFollowings()
</script>
</body>
</html>`
}
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
        if (process.env.USERPROFILE !== h) {
          process.env.USERPROFILE = h
          process.env.HOME = h
        }
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

function toBeijingDate(isoStr) {
  try { return new Date(isoStr).toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' }) } catch { return '' }
}
function toBeijingTime(isoStr) {
  try { return new Date(isoStr).toLocaleTimeString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false }).slice(0, 5) } catch { return '' }
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

let _agentChild = null
function abortAgentRun() {
  if (_agentChild) {
    try { _agentChild.kill('SIGTERM') } catch {}
    _agentChild = null
  }
  try {
    const st = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'agent-state.json'), 'utf8'))
    if (st.status === 'running') {
      st.status = 'aborted'
      st.endAt = new Date().toISOString()
      st.reason = 'user_abort'
      fs.writeFileSync(path.join(DATA_DIR, 'agent-state.json'), JSON.stringify(st, null, 2))
    }
  } catch {}
}

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

function sendStatic(res, relPath, contentType) {
  const absPath = path.join(path.resolve(__dirname, '..'), relPath)
  try {
    const data = fs.readFileSync(absPath)
    res.writeHead(200, {
      'Content-Type': contentType + '; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
    })
    res.end(data)
  } catch {
    send(res, 404, JSON.stringify({ error: 'not found' }))
  }
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
    return sendStatic(res, 'public/index.html', 'text/html')
  }
  if (pathname === '/styles.css' && req.method === 'GET') {
    return sendStatic(res, 'public/styles.css', 'text/css')
  }
  if (pathname === '/app.js' && req.method === 'GET') {
    return sendStatic(res, 'public/app.js', 'application/javascript')
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
      const atStr = String(e.at || '')
      let d = toBeijingDate(atStr) || atStr.slice(0, 10)
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
        time: (() => { try { return new Date(e.at).toLocaleTimeString('zh-CN', {hour12:false}).slice(0,5) } catch { return String(e.at||'').slice(11,16) } })(),
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
  if (pathname === '/api/dashboard' && req.method === 'GET') {
    const cfg = getJson('config.json')
    const creds = getJson('credentials.json')
    const tokens = getJson('tokens.json')
    const whaleLogs = readWhaleLog()
    const tokenHistory = tokens.history || []
    const todayStr = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' })
    const todayRec = tokenHistory.find(h => h.date === todayStr)
    const todayTokens = todayRec ? (todayRec.total || 0) : 0
    const budget = cfg.budget?.dailyTokens || 50000
    const diaryMap = {}
    for (const e of whaleLogs) {
      const d = toBeijingDate(e.at) || String(e.at || '').slice(0, 10)
      if (!d) continue
      if (!diaryMap[d]) diaryMap[d] = []
      let kind = e.kind || ''
      let note = e.note || ''
      let target = e.target || ''
      if (kind && kind.length > 30 && !note) { note = kind; kind = 'thought' }
      if (!note && kind.length > 5) { note = kind; kind = 'event' }
      if (!note) continue
      diaryMap[d].push({ kind, target, note, time: toBeijingTime(e.at) || String(e.at || '').slice(11, 16) })
    }
    const diaryDates = Object.keys(diaryMap).sort().reverse()
    const latestDate = diaryDates[0] || null
    const latestDiary = latestDate ? {
      date: latestDate,
      summary: (diaryMap[latestDate].find(e => e.kind === 'summary')?.note) || `今天 ${diaryMap[latestDate].length} 条`,
      events: diaryMap[latestDate].filter(e => e.kind !== 'summary').slice(-2),
    } : null
    return send(res, 200, JSON.stringify({
      todayTokens, budget, latestDiary,
      creds: { doubaoApiKey: !!creds.doubaoApiKey, sessdata: !!creds.sessdata },
      bili: cfg.bili || {},
    }))
  }
  if (pathname === '/api/fw-config' && req.method === 'GET') {
    const fwCfg = getJson('follow-config.json')
    const fwRunning = getFollowStatus()
    return send(res, 200, JSON.stringify({
      enabled: fwCfg.enabled === true,
      interval: fwCfg.interval || 300,
      onlyWhitelist: fwCfg.onlyWhitelist === true,
      whitelist: fwCfg.whitelist || [],
      blacklist: fwCfg.blacklist || [],
      templates: fwCfg.templates || [],
      running: fwRunning?.running === true,
    }))
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
  if (pathname === '/api/test-creds' && req.method === 'POST') {
    const creds = getJson('credentials.json')
    const results = {}
    if (creds.doubaoApiKey) {
      try {
        const r = await fetch('https://ark.cn-beijing.volces.com/api/v3/chat/completions', {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + creds.doubaoApiKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: creds.doubaoEndpointId || '', messages: [{ role: 'user', content: 'hi' }], max_tokens: 5 })
        })
        const j = await r.json()
        results.doubao = { ok: !!j?.choices, message: j?.choices ? 'API key有效' : (j?.error?.message || JSON.stringify(j).slice(0, 80)) }
      } catch (e) {
        results.doubao = { ok: false, message: String(e.message) }
      }
    } else {
      results.doubao = { ok: false, message: '未配置 API Key' }
    }
    try {
      const h = biliReqHeaders()
      if (!h) {
        results.bili = { ok: false, message: 'Cookie缺失SESSDATA或bili_jct' }
      } else {
        const r = await fetch('https://api.bilibili.com/x/web-interface/nav', { headers: h })
        const j = await r.json()
        if (j?.code === 0) results.bili = { ok: true, message: 'UID ' + j.data.mid + ' ' + j.data.uname }
        else results.bili = { ok: false, message: 'code=' + j?.code + ' ' + (j?.message || '') }
      }
    } catch (e) {
      results.bili = { ok: false, message: String(e.message) }
    }
    return send(res, 200, JSON.stringify(results))
  }
  if (pathname === '/api/abort' && req.method === 'POST') {
    try {
      abortAgentRun()
    } catch (e) {}
    return send(res, 200, JSON.stringify({ ok: true }))
  }
  if (pathname === '/api/trajectory' && req.method === 'GET') {
    let runs = []
    let tools = []
    try {
      const agent = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'agent-state.json'), 'utf8'))
      if (agent) {
        if (agent.status === 'running') runs.push({ event: 'start', time: agent.startAt })
        else if (agent.status === 'done') {
          runs.push({ event: 'start', time: agent.startAt })
          runs.push({ event: 'done', time: agent.endAt, usage: agent.tokens || {} })
        } else if (agent.status === 'aborted') {
          runs.push({ event: 'start', time: agent.startAt })
          runs.push({ event: 'aborted', time: agent.endAt || agent.startAt, reason: agent.reason })
        } else {
          runs.push({ event: agent.status, time: agent.startAt })
        }
      }
    } catch {}
    const whaleLogs = readWhaleLog()
    for (const e of whaleLogs) {
      if (e.kind === 'tool_call' || e.kind === 'action') {
        tools.push({
          time: e.at,
          status: e.success ? 'ok' : (e.success === false ? 'fail' : 'ok'),
          label: e.note || e.tool || e.target || '',
          resultSize: e.note ? String(e.note).length : 0,
          durationMs: e.durationMs || 0,
        })
      } else if (e.kind === 'thought' || e.kind === 'event' || e.kind === 'summary') {
        if (e.at) runs.push({ event: 'thought', time: e.at, content: String(e.event || e.note || '').slice(0, 60) })
      }
    }
    runs = runs.sort((a, b) => new Date(a.time) - new Date(b.time))
    tools = tools.sort((a, b) => new Date(a.time) - new Date(b.time))
    return send(res, 200, JSON.stringify({ runs, tools }))
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
  _agentChild = child

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
    _agentChild = null
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
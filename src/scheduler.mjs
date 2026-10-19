import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { spawn } from 'node:child_process'

const DATA_DIRS = [
  path.join(os.homedir(), '.doubao-bot'),
  path.join(process.cwd(), '.doubao-bot'),
  path.join(os.homedir(), '.dsh'),
  path.join(process.cwd(), '.dsh'),
]
function resolveDataDir() {
  for (const d of DATA_DIRS) {
    try { if (fs.existsSync(d)) { fs.mkdirSync(d, { recursive: true }); return d } } catch {}
  }
  const p = path.join(os.homedir(), '.doubao-bot')
  try { fs.mkdirSync(p, { recursive: true }) } catch {}
  return p
}

const TASKS_FILE = path.join(resolveDataDir(), 'tasks.json')
const STATE_FILE = path.join(resolveDataDir(), 'scheduler-state.json')

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')) } catch { return fallback }
}
function writeJson(file, obj) {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, JSON.stringify(obj, null, 2) + '\n')
  } catch {}
}

export function getTasks() {
  const list = readJson(TASKS_FILE, [])
  if (!Array.isArray(list)) return []
  return list.filter(t => t && t.enabled !== false)
}
export function setTasks(list) { writeJson(TASKS_FILE, list) }

export function getState() { return readJson(STATE_FILE, {}) }
export function setState(s) { writeJson(STATE_FILE, s) }

function todayStr() { return new Date().toLocaleDateString('sv-SE') }
function dayOfWeek() { return new Date().getDay() }
function nowHHMM() {
  const d = new Date()
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0')
}
function parseHHMM(s) {
  const [h, m] = String(s).split(':').map(Number)
  return h * 60 + (m || 0)
}
function nowMinutes() {
  const d = new Date()
  return d.getHours() * 60 + d.getMinutes()
}

export function checkTasks() {
  const tasks = getTasks()
  const state = getState()
  const today = todayStr()
  const dow = dayOfWeek()
  const cur = nowMinutes()
  const triggered = []

  for (const t of tasks) {
    if (t.enabled === false) continue
    if (Array.isArray(t.day) && t.day.length > 0 && !t.day.includes(dow)) continue
    if (typeof t.day === 'number' && t.day !== dow) continue
    const trigger = parseHHMM(t.time) - (Number(t.leadMin) || 0)
    if (cur < trigger) continue
    const key = t.id || t.name
    if (state[key] && state[key].date === today) continue
    triggered.push(t)
  }

  return triggered
}

export function markDone(taskId) {
  const state = getState()
  state[taskId] = { date: todayStr(), time: nowHHMM(), status: 'done' }
  setState(state)
}

export function markFail(taskId, err) {
  const state = getState()
  state[taskId] = { date: todayStr(), time: nowHHMM(), status: 'fail', error: String(err || '').slice(0, 200) }
  setState(state)
}

export function runTask(task) {
  const hasTemplate = !!(task.template && String(task.template).trim())
  const mode = hasTemplate ? 'direct' : 'agent'
  const script = path.join(process.cwd(), 'src', hasTemplate ? 'run-task-direct.mjs' : 'run-task.mjs')

  if (hasTemplate) {
    task._direct = true
  }

  return new Promise((resolve) => {
    const proc = spawn(process.execPath, [script, JSON.stringify(task)], {
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: process.cwd(),
    })
    let out = '', err = ''
    proc.stdout.on('data', d => { out += d.toString(); process.stdout.write(`[task ${task.name}] ${d}`) })
    proc.stderr.on('data', d => { err += d.toString(); process.stderr.write(`[task ${task.name}] ERR ${d}`) })
    proc.on('close', (code) => {
      if (code === 0) markDone(task.id || task.name)
      else markFail(task.id || task.name, err || `exit code ${code}`)
      resolve({ code, out, err, mode })
    })
    proc.on('error', (e) => { markFail(task.id || task.name, e.message); resolve({ code: -1, err: e.message }) })
  })
}

let running = false
let followProc = null

export function startScheduler() {
  if (running) return
  running = true
  console.log(`⏰ 定时调度器启动（每 60s 扫一次任务表）`)
  setInterval(async () => {
    if (runTask._active) return
    const tasks = checkTasks()
    if (tasks.length === 0) return
    runTask._active = true
    try {
      for (const t of tasks) {
        console.log(`🎯 触发任务: ${t.name} @ ${nowHHMM()}`)
        await runTask(t)
      }
    } finally {
      runTask._active = false
    }
  }, 60 * 1000)
}

export function startFollowWatcher() {
  if (followProc) {
    console.log(`🎬 关注守望已在运行（pid ${followProc.pid}）`)
    return
  }
  const config = getJson('follow-config.json')
  if (!config.enabled) {
    console.log(`🎬 关注守望未启用（设置 follow-config.json 的 enabled=true）`)
    return
  }

  const interval = Math.max(180, Number(config.interval || 300))
  const onlyWl = config.onlyWhitelist ? '--only-whitelist' : ''
  const script = path.join(process.cwd(), 'src', 'follow-await.mjs')

  console.log(`🎬 启动关注列表守望（每 ${interval}s 扫一次${onlyWl ? ' · 仅白名单' : ''}）`)

  function launch() {
    const args = [script, '--interval', String(interval), onlyWl].filter(Boolean)
    const p = spawn(process.execPath, args, {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    p.stdout.on('data', d => process.stdout.write(d.toString()))
    p.stderr.on('data', d => process.stderr.write(d.toString()))
    p.on('close', (code) => {
      console.log(`🎬 守望进程退出（code=${code}），5 秒后重启...`)
      followProc = null
      setTimeout(launch, 5000)
    })
    p.on('error', (e) => {
      console.error(`🎬 守望进程启动失败: ${e.message}`)
      followProc = null
      setTimeout(launch, 15000)
    })
    followProc = p
  }

  launch()
}

export function stopFollowWatcher() {
  if (followProc) {
    followProc.kill('SIGTERM')
    followProc = null
    console.log(`🎬 已停止关注守望`)
  }
}

export function getFollowStatus() {
  return {
    running: !!followProc,
    pid: followProc?.pid || null,
  }
}

function getJson(name) {
  try { return JSON.parse(fs.readFileSync(path.join(
    path.join(os.homedir(), '.doubao-bot'), name
  ), 'utf8')) } catch { return {} }
}

export function getNextRun(task) {
  const state = getState()
  const key = task.id || task.name
  const todayDone = state[key]?.date === todayStr()
  if (todayDone) return null
  const trigger = parseHHMM(task.time) - (Number(task.leadMin) || 0)
  const cur = nowMinutes()
  if (trigger > cur) {
    const h = Math.floor(trigger / 60)
    const m = trigger % 60
    return `今天 ${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`
  }
  return null
}
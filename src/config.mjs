import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'

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

function resolveBiliAiDir() {
  const candidates = [
    path.join(os.homedir(), '.bili-ai'),
    'C:\\Users\\Administrator\\.bili-ai',
    'C:\\Users\\admin\\.bili-ai',
    'C:\\root\\.bili-ai',
    '/root/.bili-ai',
  ]
  for (const dir of candidates) {
    try {
      if (fs.existsSync(path.join(dir, 'credentials.json'))) return dir
    } catch {}
  }
  return candidates[0]
}

const DATA_DIR = resolveDataDir()
const BILI_AI_DIR = resolveBiliAiDir()
const CRED_FILE = path.join(DATA_DIR, 'credentials.json')
const CFG_FILE = path.join(DATA_DIR, 'config.json')
const BILI_AI_CRED = path.join(BILI_AI_DIR, 'credentials.json')

function readJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')) } catch { return null }
}

function writeJson(p, obj) {
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, JSON.stringify(obj, null, 2) + '\n')
}

export const PATHS = {
  credFile: CRED_FILE,
  configFile: CFG_FILE,
  dataDir: DATA_DIR,
  biliAiDir: BILI_AI_DIR,
  biliAiCredFile: BILI_AI_CRED,
  toolsDir: path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'tools'),
}

const DEFAULT_CONFIG = {
  doubao: {
    apiKey: '',
    endpointId: '',
    model: 'doubao-lite-32k',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
  },
  bili: {
    sessdata: '',
    biliJct: '',
    buvid3: '',
    selfMid: '',
    selfName: '',
    ownerMid: '',
    ownerName: '',
  },
  budget: {
    dailyTokens: 30000,
    modelFallback: 'doubao-lite-32k',
  },
  night: {
    windows: [{ start: '20:00', end: '24:00', wakes: 1 }],
    skipChance: 0.3,
    maxVideos: 5,
  },
  preferences: {
    like: ['AI 工具与插件', '鬼畜与怀旧向剪辑', '猫咪', 'Live2D/模型'],
    dislike: ['带货', '擦边', '标题党', '纯搬运'],
  },
  quota: { shareDaily: 3 },
}

export function getCredentials() {
  const main = readJson(CRED_FILE) || {}
  const biliAi = readJson(BILI_AI_CRED) || {}
  return {
    ...main,
    sessdata: main.sessdata || biliAi.sessdata || '',
    biliJct: main.biliJct || biliAi.biliJct || biliAi.bili_jct || '',
    buvid3: main.buvid3 || biliAi.buvid3 || '',
  }
}

export function getConfig() {
  const cred = getCredentials()
  const cfg = readJson(CFG_FILE) || {}
  const merged = deepMerge(DEFAULT_CONFIG, cfg)
  if (cred.doubaoApiKey) merged.doubao.apiKey = cred.doubaoApiKey
  if (cred.doubaoEndpointId) merged.doubao.endpointId = cred.doubaoEndpointId
  if (cred.sessdata) merged.bili.sessdata = cred.sessdata
  if (cred.biliJct) merged.bili.biliJct = cred.biliJct
  if (cred.buvid3) merged.bili.buvid3 = cred.buvid3
  return merged
}

export function saveCredentials(cred) {
  writeJson(CRED_FILE, cred)
}

export function saveConfig(cfg) {
  writeJson(CFG_FILE, cfg)
}

function deepMerge(base, over) {
  const out = { ...base }
  for (const [k, v] of Object.entries(over || {})) {
    out[k] = (v && typeof v === 'object' && !Array.isArray(v)) ? deepMerge(base[k] ?? {}, v) : v
  }
  return out
}
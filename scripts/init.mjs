#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { spawnSync } from 'node:child_process'

const DBOT_DIR = path.join(os.homedir(), '.doubao-bot')
const BILI_DIR = path.join(os.homedir(), '.bili-ai')

function ensureDir(p) { fs.mkdirSync(p, { recursive: true }) }

function writeIfMissing(p, content) {
  if (fs.existsSync(p)) {
    console.log(`  ⏭️  已存在，跳过: ${p}`)
    return false
  }
  ensureDir(path.dirname(p))
  fs.writeFileSync(p, content)
  console.log(`  ✅ 已创建: ${p}`)
  return true
}

// 1. 豆包 API key 凭据
const doubaoCred = {
  doubaoApiKey: '',
  doubaoEndpointId: '',
  _note: '从火山方舟控制台拿。Endpoint ID 格式像 ep-2025xxxxxx-xxxxx',
}

// 2. B站 cookie 凭据
const biliCred = {
  sessdata: '',
  bili_jct: '',
  buvid3: '',
  _note: '浏览器登录 B 站后，F12 → Application → Cookies → bilibili.com 里复制这三个',
}

// 3. 运行 bili.mjs deps 看当前状态
console.log('🔍 检查 bili.mjs 环境...')
const biliMjs = path.join(process.cwd(), 'tools', 'bili.mjs')
const deps = spawnSync(process.execPath, [biliMjs, 'deps', '--json'], {
  encoding: 'utf8', timeout: 30000, windowsHide: true,
})
console.log(deps.stdout || deps.stderr || '(无输出)')

console.log('\n📝 正在生成凭据文件模板...\n')
const created1 = writeIfMissing(path.join(DBOT_DIR, 'credentials.json'), JSON.stringify(doubaoCred, null, 2) + '\n')
const created2 = writeIfMissing(path.join(BILI_DIR, 'credentials.json'), JSON.stringify(biliCred, null, 2) + '\n')

console.log('\n' + '='.repeat(60))
console.log('  初始化完成！接下来你需要做：')
console.log('='.repeat(60))
if (created1) {
  console.log(`\n  1️⃣  打开 ${path.join(DBOT_DIR, 'credentials.json')}`)
  console.log('     填入：doubaoApiKey 和 doubaoEndpointId')
  console.log('     （从火山方舟控制台复制，Endpoint ID 格式像 ep-2025xxxxxx）')
}
if (created2) {
  console.log(`\n  2️⃣  打开 ${path.join(BILI_DIR, 'credentials.json')}`)
  console.log('     填入：sessdata / bili_jct / buvid3（浏览器 F12 → Cookies 里复制）')
}
console.log('\n  3️⃣  填完之后跑：')
console.log('     npm run run-daily')
console.log('\n     验证 API 和 cookie 都 OK 后，脚本会自动启动 agent。')
console.log('='.repeat(60))
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const args = Object.fromEntries(
  process.argv.slice(2).map((a, i, arr) => {
    if (a.startsWith('--')) {
      const next = arr[i + 1]
      return [a.slice(2), next && !next.startsWith('--') ? next : true]
    }
    return null
  }).filter(Boolean)
)

const oid = args.oid
const bvid = args.bvid
const msg = args.message || args.msg || '有意思～'
const dry = !!args.dry
const go = !!args.go

if (!oid || !bvid) {
  console.error('usage: --oid <avid> --bvid <BV...> --message "<text>" [--dry | --go]')
  process.exit(2)
}
if (!dry && !go) {
  console.error('need --dry or --go')
  process.exit(2)
}

const credentialDir = path.resolve(__dirname, '..', '..', '..', '.doubao-bot')
const credPath = path.join(credentialDir, 'credentials.json')
let cred
try {
  cred = JSON.parse(fs.readFileSync(credPath, 'utf8'))
} catch {
  try {
    cred = JSON.parse(fs.readFileSync(path.join(process.env.USERPROFILE || '', '.doubao-bot', 'credentials.json'), 'utf8'))
  } catch {
    console.error('credentials.json not found')
    process.exit(3)
  }
}
const missing = ['sessdata', 'bili_jct', 'buvid3'].filter((k) => !cred[k] || String(cred[k]).trim() === '')
if (missing.length) {
  console.error('credentials missing:', missing.join(', '))
  process.exit(3)
}

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
const cookieHeader = `SESSDATA=${cred.sessdata}; bili_jct=${cred.bili_jct}; buvid3=${cred.buvid3}`

const body = new URLSearchParams({
  type: '1',
  oid: String(oid),
  msg: msg.slice(0, 25),
  mode: '1',
  fontsize: '25',
  color: '16777215',
  rnd: String(Math.floor(Math.random() * 1e9)),
  buvid3: cred.buvid3,
  csrf: cred.bili_jct,
  csrf_token: cred.bili_jct,
  plat: '1',
})

console.log(`\n[danmu] bvid=${bvid} oid=${oid}`)
console.log(`  msg="${body.get('msg')}" len=${body.get('msg').length}`)
console.log(`  color=${body.get('color')} mode=滚动 fontsize=${body.get('fontsize')}`)

if (dry) {
  console.log('\n[dry] would POST https://api.bilibili.com/x/v2/dm/post')
  console.log('  body:', body.toString().replace(/SESSDATA=[^&]+/, 'SESSDATA=***').replace(/bili_jct=[^&]+/, 'bili_jct=***'))
  process.exit(0)
}

if (go) {
  console.log('\n[go] sending...')
  const res = await fetch('https://api.bilibili.com/x/v2/dm/post', {
    method: 'POST',
    headers: {
      'user-agent': UA,
      referer: `https://www.bilibili.com/video/${bvid}`,
      origin: 'https://www.bilibili.com',
      'content-type': 'application/x-www-form-urlencoded',
      cookie: cookieHeader,
    },
    body: body.toString(),
  })
  const out = await res.json().catch(async () => ({ raw: await res.text() }))
  console.log(`  HTTP ${res.status}  code=${out.code}  msg=${out.message ?? ''}`)
  if (out.code === 0) {
    console.log('  ✅ 弹幕已发出')
  } else {
    console.log('  ❌ 失败:', JSON.stringify(out).slice(0, 200))
    process.exit(1)
  }
}
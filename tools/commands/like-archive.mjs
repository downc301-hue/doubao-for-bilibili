import fs from 'node:fs'
import path from 'node:path'

const args = new Map()
for (let i = 2; i < process.argv.length; i += 1) {
  const a = process.argv[i]
  if (a.startsWith('--')) args.set(a.slice(2), process.argv[i + 1]?.startsWith('--') ? true : process.argv[++i] ?? true)
}
const aid = args.get('aid')
const bvid = args.get('bvid')
const dry = args.has('dry')
const go = args.has('go')

if (!aid || !bvid) { console.error('usage: --aid <av> --bvid <BV...> [--dry | --go]'); process.exit(2) }
if (dry && go) { console.error('pick either --dry or --go'); process.exit(2) }
if (!dry && !go) { console.error('refusing to run without --dry or --go'); process.exit(2) }

const credPath = path.join((process.env.USERPROFILE || process.env.HOME || '/'), '.bili-ai', 'credentials.json')
const cred = JSON.parse(fs.readFileSync(credPath, 'utf8'))
const cookieHeader = `SESSDATA=${cred.sessdata}; bili_jct=${cred.bili_jct}; buvid3=${cred.buvid3}`
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
const referer = `https://www.bilibili.com/video/${bvid}/`

const nav = await (await fetch('https://api.bilibili.com/x/web-interface/nav', { headers: { 'user-agent': UA, referer: 'https://www.bilibili.com/', cookie: cookieHeader } })).json()
if (nav.code !== 0) { console.error(`cookie invalid: code=${nav.code}`); process.exit(4) }
console.log(`账号: ${nav.data.uname} (mid ${nav.data.mid})`)

const body = `aid=${aid}&bvid=${encodeURIComponent(bvid)}&like=1&csrf=${encodeURIComponent(cred.bili_jct)}`
console.log(`\nPOST x/web-interface/archive/like`)
console.log(`  aid=${aid} bvid=${bvid}`)

if (dry) { console.log('[dry] 未发送'); process.exit(0) }

const res = await fetch('https://api.bilibili.com/x/web-interface/archive/like', {
  method: 'POST',
  headers: { 'user-agent': UA, referer, origin: 'https://www.bilibili.com', 'content-type': 'application/x-www-form-urlencoded', cookie: cookieHeader },
  body,
})
const out = await res.json()
console.log(`  HTTP ${res.status}  code=${out.code}  msg=${out.message ?? ''}`)
if (out.code === 0) {
  console.log(`  ✅ 点赞成功 like=${out.data?.like}`)
  process.exit(0)
} else {
  const hints = { '-101': 'cookie失效', '-111': 'csrf不对', '36101': '已点过赞（取消）', '36102': '已点过赞', '65006': '重复点赞（之前点过了）' }
  if (hints[String(out.code)]) console.log(`  提示：${hints[String(out.code)]}`)
  process.exit(6)
}
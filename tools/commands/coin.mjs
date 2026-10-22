import { loadCreds } from '../lib/creds.mjs'

const args = new Map()
for (let i = 2; i < process.argv.length; i += 1) {
  const a = process.argv[i]
  if (a.startsWith('--')) args.set(a.slice(2), process.argv[i + 1]?.startsWith('--') ? true : process.argv[++i] ?? true)
}
const aid = args.get('aid')
const bvid = args.get('bvid')
const multiply = Number(args.get('multiply') ?? 1)
const like = args.has('like') || args.has('select-like')
const dry = args.has('dry')
const go = args.has('go')

if (!aid || !bvid) { console.error('usage: --aid <av> --bvid <BV...> [--multiply 1|2] [--like] [--dry | --go]'); process.exit(2) }
if (dry && go) { console.error('pick either --dry or --go'); process.exit(2) }
if (!dry && !go) { console.error('refusing to run without --dry or --go'); process.exit(2) }
if (multiply < 1 || multiply > 2) { console.error('--multiply must be 1 or 2'); process.exit(2) }

const cred = loadCreds()
const cookieHeader = `SESSDATA=${cred.sessdata}; bili_jct=${cred.bili_jct}; buvid3=${cred.buvid3}`
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
const referer = `https://www.bilibili.com/video/${bvid}/`

const nav = await (await fetch('https://api.bilibili.com/x/web-interface/nav', { headers: { 'user-agent': UA, referer: 'https://www.bilibili.com/', cookie: cookieHeader } })).json()
if (nav.code !== 0) { console.error(`cookie invalid: code=${nav.code}`); process.exit(4) }
console.log(`账号: ${nav.data.uname} (mid ${nav.data.mid})`)
console.log(`硬币余额（nav.money）: ${nav.data.money ?? '未知'}`)

const body = `aid=${aid}&multiply=${multiply}&select_like=${like ? 1 : 0}&csrf=${encodeURIComponent(cred.bili_jct)}`
console.log(`\nPOST x/web-interface/coin/add`)
console.log(`  aid=${aid} multiply=${multiply} select_like=${like ? 1 : 0}`)

if (dry) { console.log('[dry] 未发送'); process.exit(0) }

const res = await fetch('https://api.bilibili.com/x/web-interface/coin/add', {
  method: 'POST',
  headers: { 'user-agent': UA, referer, origin: 'https://www.bilibili.com', 'content-type': 'application/x-www-form-urlencoded', cookie: cookieHeader },
  body,
})
const out = await res.json()
console.log(`  HTTP ${res.status}  code=${out.code}  msg=${out.message ?? ''}`)
if (out.code === 0) {
  console.log(`  ✅ 投币成功 like=${out.data?.like ?? '?'} thanks=${out.data?.thanks ?? '?'}`)
  process.exit(0)
} else {
  const hints = {
    '-101': 'cookie失效',
    '-104': '硬币不足',
    '-111': 'csrf不对',
    '34002': '已投过币',
    '34003': '已投过币（thanks已领）',
    '34005': '该视频禁止投币',
    '34006': '投币等级不够',
    '34008': '重复投币（之前投过了）',
  }
  if (hints[String(out.code)]) console.log(`  提示：${hints[String(out.code)]}`)
  process.exit(6)
}
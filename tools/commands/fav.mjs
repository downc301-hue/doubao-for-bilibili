import fs from 'node:fs'
import path from 'node:path'

const args = new Map()
for (let i = 2; i < process.argv.length; i += 1) {
  const a = process.argv[i]
  if (a.startsWith('--')) args.set(a.slice(2), process.argv[i + 1]?.startsWith('--') ? true : process.argv[++i] ?? true)
}
const aid = args.get('aid')
const favId = args.get('fav-id') || args.get('favid') || args.get('fav_id')
const dry = args.has('dry')
const go = args.has('go')

if (!aid) { console.error('usage: --aid <av> [--fav-id <id>] [--dry | --go]'); process.exit(2) }
if (dry && go) { console.error('pick either --dry or --go'); process.exit(2) }
if (!dry && !go) { console.error('refusing to run without --dry or --go'); process.exit(2) }

const credPath = path.join((process.env.USERPROFILE || process.env.HOME || '/'), '.bili-ai', 'credentials.json')
const cred = JSON.parse(fs.readFileSync(credPath, 'utf8'))
const cookieHeader = `SESSDATA=${cred.sessdata}; bili_jct=${cred.bili_jct}; buvid3=${cred.buvid3}`
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

const nav = await (await fetch('https://api.bilibili.com/x/web-interface/nav', { headers: { 'user-agent': UA, referer: 'https://www.bilibili.com/', cookie: cookieHeader } })).json()
if (nav.code !== 0) { console.error(`cookie invalid: code=${nav.code}`); process.exit(4) }
const myMid = nav.data.mid
const referer = 'https://www.bilibili.com/' + myMid + '/favlist'
console.log(`账号: ${nav.data.uname} (mid ${myMid})`)

let useFavId = favId
if (!useFavId) {
  const favR = await fetch(`https://api.bilibili.com/x/v3/fav/folder/created/list-all?up_mid=${myMid}`, { headers: { 'user-agent': UA, referer: 'https://www.bilibili.com/', cookie: cookieHeader } })
  const favJ = await favR.json()
  if (favJ.code === 0 && favJ.data?.list?.length) {
    useFavId = favJ.data.list[0].id
    console.log(`[收藏夹] 未指定，用默认夹 id=${useFavId} 标题=${favJ.data.list[0].title}`)
  } else {
    console.error('未指定 --fav-id 且查不到收藏夹'); process.exit(2)
  }
} else {
  console.log(`[收藏夹] 用指定 fav_id=${useFavId}`)
}

const body = `rid=${aid}&type=2&add_media_ids=${useFavId}&del_media_ids=&platform=web&csrf=${encodeURIComponent(cred.bili_jct)}`
console.log(`\nPOST x/v3/fav/resource/deal`)
console.log(`  aid=${aid} → fav_id=${useFavId}`)

if (dry) { console.log('[dry] 未发送'); process.exit(0) }

const res = await fetch('https://api.bilibili.com/x/v3/fav/resource/deal', {
  method: 'POST',
  headers: { 'user-agent': UA, referer, origin: 'https://www.bilibili.com', 'content-type': 'application/x-www-form-urlencoded', cookie: cookieHeader },
  body,
})
const out = await res.json()
console.log(`  HTTP ${res.status}  code=${out.code}  msg=${out.message ?? ''}`)
if (out.code === 0) {
  const sn = out.data?.success_num ?? '?'
  const prompt = out.data?.prompt
  if (sn > 0) {
    console.log(`  ✅ 收藏成功 success_num=${sn}`)
    process.exit(0)
  } else {
    console.log(`  ⚠️ 返回 0，但 success_num=${sn} prompt=${prompt}（可能已收藏过，或被风控弹窗拦截）`)
    process.exit(sn > 0 ? 0 : 7)
  }
} else {
  const hints = { '-101': 'cookie失效', '-111': 'csrf不对', '2001000': '参数错误（fav_id 或 rid 类型不对）' }
  if (hints[String(out.code)]) console.log(`  提示：${hints[String(out.code)]}`)
  process.exit(6)
}
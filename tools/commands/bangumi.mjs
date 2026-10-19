import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const BILI = path.join(__dirname, '..', 'bili.mjs')

const SKIP_TOKENS = ['预告', '花絮', 'pv', '特典', '番外', 'sp', 'ova', '先行', '短片', '小剧场']

export async function fetchBiliJson(u) {
  const res = await fetch(u, {
    headers: {
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'referer': 'https://www.bilibili.com/',
    },
  })
  return res.json()
}

export function parseSeasonId(url) {
  if (!url) return null
  const ss = url.match(/ss(\d+)/)
  if (ss) return { type: 'ss', id: ss[1] }
  const ep = url.match(/ep(\d+)/)
  if (ep) return { type: 'ep', id: ep[1] }
  return null
}

function isNon正片(ep) {
  const hay = ((ep.title || '') + ' ' + (ep.index_title || '')).toLowerCase()
  return SKIP_TOKENS.some(t => hay.includes(t))
}

export async function resolveBangumi(rawUrl) {
  const parsed = parseSeasonId(rawUrl)
  if (!parsed) return { ok: false, error: '链接里找不到 ss 或 ep 号' }

  let seasonId = ''
  if (parsed.type === 'ss') {
    seasonId = parsed.id
  } else {
    const j = await fetchBiliJson(`https://api.bilibili.com/pgc/view/web/season?ep_id=${parsed.id}`)
    seasonId = String(j?.result?.season_id || '')
    if (!seasonId) return { ok: false, error: '无法从 ep 链接反查 season_id' }
  }

  const info = await fetchBiliJson(`https://api.bilibili.com/pgc/view/web/season?season_id=${seasonId}`)
  if (info.code !== 0) return { ok: false, error: info.message || `API code=${info.code}` }

  const result = info.result || {}
  const allEps = result.episodes || []

  const 正片 = allEps
    .filter(e => (e.pub_time || 0) > 0)
    .filter(e => !isNon正片(e))
    .sort((a, b) => (b.pub_time || 0) - (a.pub_time || 0))

  const latest = 正片[0]
  if (!latest) return { ok: false, error: '这个番剧里找不到已上线的正片（可能还没开播）' }

  const videoUrl = latest.bvid
    ? `https://www.bilibili.com/video/${latest.bvid}`
    : `https://www.bilibili.com/bangumi/play/ep${latest.id}`

  const pubDate = latest.pub_time
    ? new Date(latest.pub_time * 1000).toLocaleString('zh-CN')
    : ''

  return {
    ok: true,
    title: result.title || '',
    season_id: seasonId,
    total_eps: 正片.length,
    latest: {
      ep_id: latest.id,
      bvid: latest.bvid || '',
      aid: latest.aid || '',
      index: latest.index || '',
      title: latest.title || latest.long_title || '',
      index_title: latest.index_title || '',
      pub_time: latest.pub_time || 0,
      pub_date: pubDate,
      url: `https://www.bilibili.com/bangumi/play/ep${latest.id}`,
      video_url: videoUrl,
    },
  }
}

async function cliMain() {
  const raw = process.argv.slice(2)
  const args = {}
  for (let i = 0; i < raw.length; i++) {
    const a = raw[i]
    if (a.startsWith('--')) args[a.slice(2)] = raw[++i] ?? true
  }
  const url = args.url || args.u || ''
  if (!url) { console.log(JSON.stringify({ error: '需要 --url <番剧链接>' })); process.exit(1) }

  const r = await resolveBangumi(url)
  if (!r.ok) { console.log(JSON.stringify({ error: r.error })); process.exit(1) }
  console.log(JSON.stringify(r, null, 2))
}

const isDirectRun = process.argv[1] && path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1])
if (isDirectRun) {
  cliMain().catch(e => console.log(JSON.stringify({ error: String(e?.message || e) })))
}
// at-reply.mjs —— 主人艾特回复库（web.mjs 和 scan-comment-for-tag.mjs 共用）
//
// 从 src/web.mjs 抽出，两处共用：
//   - Web UI /api/at-me + /api/reply-at（手动点一键回复）
//   - scan-comment-for-tag.mjs（定时自动跑）
//
// 职责：
//   1. 查 @收件箱，过滤主人未处理的
//   2. 防重复：at-processed.json + checkAlreadyReplied 评论区查
//   3. 生成回复：豆包 AI + fallback 模板
//   4. 发回复：spawn comment.mjs --go
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import https from 'node:https'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const DATA_DIR = path.join(os.homedir(), '.doubao-bot')
const AT_PROCESSED_FILE = path.join(DATA_DIR, 'at-processed.json')

function getJson(name) {
  const p = path.join(DATA_DIR, name)
  try { return JSON.parse(fs.readFileSync(p, 'utf8')) } catch { return {} }
}

// ── B站请求头 ──
export function biliReqHeaders() {
  const creds = getJson('credentials.json')
  const sess = creds.sessdata
  const jj = creds.bili_jct || creds.biliJct || ''
  const buvid3 = creds.buvid3 || ''
  if (!sess) return null
  return {
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    referer: 'https://www.bilibili.com/',
    cookie: 'SESSDATA=' + decodeURIComponent(sess) + '; bili_jct=' + jj + '; buvid3=' + buvid3,
  }
}

// ── 豆包 HTTPS ──
export function doubaoHttps(payload, apiKey, endpointId) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ model: endpointId || '', max_tokens: 2000, ...payload })
    const req = https.request({
      hostname: 'ark.cn-beijing.volces.com',
      path: '/api/v3/chat/completions',
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + apiKey,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
      family: 4,
    }, (res) => {
      const chunks = []
      res.on('data', c => chunks.push(c))
      res.on('end', () => {
        try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))) }
        catch (e) { reject(new Error('JSON parse: ' + e.message)) }
      })
    })
    req.on('error', reject)
    req.setTimeout(10000, () => { req.destroy(new Error('timeout 10s')) })
    req.write(body)
    req.end()
  })
}

// ── BV 提取 ──
export function extractBv(uri) {
  const m = String(uri || '').match(/(BV[\w]+)/)
  return m ? m[1] : ''
}

// ── 已处理 @ 持久化 ──
// 注意：B 站 msgfeed/at 接口里同一条 @ 内容多次出现会用不同消息 id，所以不能用 atItem.id 去重
// 必须用稳定指纹（aid + root_id + source_id）作为去重 key
export function mkAtFingerprint({ aid, root_id, source_id }) {
  return `${aid || 0}_${root_id || 0}_${source_id || 0}`
}

export function loadAtProcessed() {
  try {
    const raw = fs.readFileSync(AT_PROCESSED_FILE, 'utf8')
    const arr = JSON.parse(raw)
    if (!Array.isArray(arr)) return new Set()
    // 清洗污染数据：只保留合法 id（纯数字串 10+ 位）或稳定指纹（数字_数字_数字）
    const clean = arr.filter(x => typeof x === 'string' && (/^\d{10,}$/.test(x) || /^\d+_\d+_\d+$/.test(x)))
    return new Set(clean)
  } catch { return new Set() }
}
export function saveAtProcessed(id) {
  try {
    const s = loadAtProcessed()
    s.add(String(id))
    fs.mkdirSync(path.dirname(AT_PROCESSED_FILE), { recursive: true })
    fs.writeFileSync(AT_PROCESSED_FILE, JSON.stringify(Array.from(s), null, 2))
  } catch {}
}

// ── 查评论区是否已有小号回复（同时查顶层 + 子评论） ──
export async function checkAlreadyReplied(H, aid, rootId, sourceId, myMid) {
  if (!aid || !myMid) return false
  try {
    // 1. 查子评论（root 下的回复）
    const root = sourceId && Number(sourceId) > 0 ? Number(sourceId)
               : rootId && Number(rootId) > 0 ? Number(rootId)
               : Number(aid)
    const r1 = await fetch(`https://api.bilibili.com/x/v2/reply/reply?type=1&oid=${aid}&root=${root}`, { headers: H })
    const j1 = await r1.json()
    if (j1.code === 0) {
      const replies = j1.data?.replies || []
      if (replies.some(c => String(c.member?.mid) === String(myMid))) return true
    }
    // 2. 查顶层评论（图片评论降级后走顶层，/x/v2/reply/main）
    const r2 = await fetch(`https://api.bilibili.com/x/v2/reply/main?type=1&oid=${aid}&mode=3&ps=20`, { headers: H })
    const j2 = await r2.json()
    if (j2.code === 0) {
      const replies = j2.data?.replies || []
      if (replies.some(c => String(c.member?.mid) === String(myMid))) return true
    }
    return false
  } catch { return false }
}

// ── 表情图库（meme/ 目录，16 张豆包卡通表情，按场景关键词匹配） ──
const MEME_DIR = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..', '..', 'meme')
const MEME_CACHE_FILE = path.join(DATA_DIR, 'meme-uploads.json')
// file → 触发关键词（在 @内容 + 回复文案里命中越多越优先）
const MEME_MAP = [
  { file: '011.png',  name: '生气',  kw: ['生气', '气死', '揍', '讨厌', '烦'] },
  { file: '012.png',  name: '害羞',  kw: ['害羞', '夸', '表扬', '脸红'] },
  { file: '013.png',  name: '思考',  kw: ['想想', '考虑', '思考', '让我看', '研究'] },
  { file: '014.png',  name: '大笑',  kw: ['哈哈', '好笑', '笑死', '233', '逗'] },
  { file: '015.png',  name: '大哭',  kw: ['哭', '伤心', '难过', '泪', '惨'] },
  { file: '016.png',  name: '睡觉',  kw: ['睡', '困', '晚安', '摸鱼'] },
  { file: '017.png',  name: '惊讶',  kw: ['什么', '居然', '卧槽', '慌', '不会吧'] },
  { file: '018.png',  name: '酷',    kw: ['帅', '酷', '牛', '厉害', '强'] },
  { file: '019.png',  name: '吃瓜',  kw: ['吃瓜', '围观', '热闹', '瓜'] },
  { file: '0110.png', name: '疑惑',  kw: ['？', '?', '为什么', '怎么', '啥'] },
  { file: '0111.png', name: '生气2', kw: ['哼', '不理', '讨厌'] },
  { file: '0112.png', name: '打招呼', kw: ['你好', 'hello', '在吗', '来了', '早'] },
  { file: '0113.png', name: '微笑',  kw: [] }, // 默认兜底
  { file: '0114.png', name: '点赞',  kw: ['好', '棒', '赞', '支持', '可以', '不错'] },
  { file: '0115.png', name: '惊喜',  kw: ['哇', '惊喜', '真的吗', '天啊'] },
  { file: '0116.png', name: '比心',  kw: ['谢', '感谢', '爱', '心'] },
]

function loadMemeCache() {
  try { return JSON.parse(fs.readFileSync(MEME_CACHE_FILE, 'utf8')) } catch { return {} }
}
function saveMemeCache(c) {
  try { fs.mkdirSync(path.dirname(MEME_CACHE_FILE), { recursive: true }); fs.writeFileSync(MEME_CACHE_FILE, JSON.stringify(c, null, 2)) } catch {}
}

// 按关键词命中数选最贴切的表情，无命中用默认微笑
export function pickMeme(content, replyText) {
  const text = `${content || ''} ${replyText || ''}`
  let best = MEME_MAP[MEME_MAP.length - 4] // 0113.png 微笑
  let bestScore = 0
  for (const m of MEME_MAP) {
    const score = m.kw.reduce((s, k) => s + (text.includes(k) ? 1 : 0), 0)
    if (score > bestScore) { bestScore = score; best = m }
  }
  return best
}

// 上传表情图到 B站图床（带缓存，同一文件只传一次）
export async function uploadMeme(fileName) {
  const cache = loadMemeCache()
  if (cache[fileName]?.img_src) return cache[fileName]
  const creds = getJson('credentials.json')
  const sess = creds.sessdata
  const jct = creds.bili_jct || creds.biliJct || ''
  const buvid3 = creds.buvid3 || ''
  const filePath = path.join(MEME_DIR, fileName)
  if (!fs.existsSync(filePath)) return null
  const buf = fs.readFileSync(filePath)
  // 参考 tools/commands/dynamic-image.mjs 的真实上传链路
  const form = new FormData()
  form.append('file_up', new Blob([buf], { type: 'image/png' }), 'upload.png')
  form.append('category', 'daily')
  form.append('csrf', jct)
  const r = await fetch('https://api.bilibili.com/x/dynamic/feed/draw/upload_bfs', {
    method: 'POST',
    headers: {
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      referer: 'https://t.bilibili.com/',
      cookie: 'SESSDATA=' + decodeURIComponent(sess) + '; bili_jct=' + jct + '; buvid3=' + buvid3,
    },
    body: form,
  })
  const text = await r.text()
  let j
  try { j = JSON.parse(text) } catch { console.log('[meme-upload] non-JSON response, HTTP ' + r.status); return null }
  if (j.code !== 0 || !j.data?.image_url) { console.log('[meme-upload] fail:', j.code, j.message); return null }
  const info = {
    img_src: j.data.image_url,
    img_width: j.data.image_width || 300,
    img_height: j.data.image_height || 300,
    img_size: j.data.img_size || Math.ceil(buf.length / 1024),
  }
  cache[fileName] = info
  saveMemeCache(cache)
  return info
}

// 直接调 /x/v2/reply/add 发评论（支持 pictures 图片评论）
// 完全对齐 tools/commands/comment.mjs 的请求格式：WBI 签名 + plat=1 + buvid3 + video referer
import crypto from 'node:crypto'
const WBI_MIXIN_TAB = [46,47,18,2,53,8,23,32,15,50,10,31,58,3,45,35,27,43,5,49,33,9,42,19,29,28,14,39,12,38,41,13,37,48,7,16,24,55,40,61,26,17,0,1,60,51,30,4,22,25,54,21,56,59,6,63,57,62,11,36,20,34,44,52]
const _wbiKeyOf = (u) => u.slice(u.lastIndexOf('/') + 1, u.lastIndexOf('.'))
async function wbiSign(params, cookieHeader) {
  try {
    const nav = await (await fetch('https://api.bilibili.com/x/web-interface/nav', {
      headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36', referer: 'https://www.bilibili.com/', cookie: cookieHeader },
    })).json()
    const img = nav?.data?.wbi_img?.img_url
    const sub = nav?.data?.wbi_img?.sub_url
    if (!img || !sub) return null
    const raw = _wbiKeyOf(img) + _wbiKeyOf(sub)
    const mixin = WBI_MIXIN_TAB.map((i) => raw[i]).join('').slice(0, 32)
    const wts = Math.round(Date.now() / 1000)
    const clean = (v) => String(v).replace(/[!'()*]/g, '')
    const query = Object.keys({ ...params, wts })
      .sort()
      .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(clean(k === 'wts' ? wts : params[k]))}`)
      .join('&')
    const w_rid = crypto.createHash('md5').update(query + mixin).digest('hex')
    return { w_rid, wts }
  } catch { return null }
}

export async function sendCommentDirect({ aid, bvid, message, root, parent, pictures }) {
  const creds = getJson('credentials.json')
  const sess = creds.sessdata
  const jct = creds.bili_jct || creds.biliJct || ''
  const buvid3 = creds.buvid3 || ''
  const cookieHeader = 'SESSDATA=' + decodeURIComponent(sess) + '; bili_jct=' + jct + '; buvid3=' + buvid3
  const params = {
    type: '1',
    oid: String(aid),
    message: message || '分享图片',
    plat: '1',
    csrf: jct,
  }
  if (root) params.root = String(root)
  if (parent) params.parent = String(parent)
  if (pictures) params.pictures = JSON.stringify([pictures])
  const signed = await wbiSign(params, cookieHeader)
  const url = signed
    ? `https://api.bilibili.com/x/v2/reply/add?w_rid=${signed.w_rid}&wts=${signed.wts}`
    : 'https://api.bilibili.com/x/v2/reply/add'
  const r = await fetch(url, {
    method: 'POST',
    headers: {
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      referer: bvid ? `https://www.bilibili.com/video/${bvid}/` : 'https://www.bilibili.com/',
      origin: 'https://www.bilibili.com',
      'content-type': 'application/x-www-form-urlencoded',
      cookie: cookieHeader,
    },
    body: new URLSearchParams(params).toString(),
  })
  return r.json()
}
const EMOTE_WHITELIST = new Set([
  '[doge]', '[脱单doge]', '[doge_金箍]', '[笑哭]', '[星星眼]', '[吃瓜]', '[打call]', '[OK]',
  '[大哭]', '[辣眼睛]', '[滑稽]', '[呲牙]', '[调皮]', '[妙啊]', '[嗑瓜子]', '[藏狐]',
  '[笑]', '[给心心]', '[脸红]', '[喜欢]', '[酸了]', '[害羞]', '[偷笑]', '[惊讶]',
  '[捂脸]', '[呆]', '[抠鼻]', '[大笑]', '[惊喜]', '[点赞]', '[无语]', '[鼓掌]',
  '[尴尬]', '[傲娇]', '[委屈]', '[思考]', '[翻白眼]', '[奋斗]', '[墨镜]', '[难过]',
  '[鸡腿]', '[干杯]', '[加油]', '[抱拳]', '[拥抱]', '[跪了]', '[怪我咯]', '[支持]', '[奶茶干杯]', '[锦鲤]',
])
const EMOTE_PROMPT_LIST = '[doge] [笑哭] [星星眼] [吃瓜] [打call] [大哭] [滑稽] [妙啊] [嗑瓜子] [给心心] [害羞] [偷笑] [捂脸] [大笑] [惊喜] [点赞] [鼓掌] [傲娇] [委屈] [墨镜] [鸡腿] [干杯] [加油] [拥抱] [奶茶干杯] [锦鲤]'

// 清洗回复文本：剔除白名单外的 [xxx]（模型瞎编的表情名会原样显示成文字，很难看），最多保留 2 个表情
function sanitizeEmotes(text) {
  let kept = 0
  return String(text || '').replace(/\[[^\[\]]{1,40}\]/g, (m) => {
    if (EMOTE_WHITELIST.has(m) && kept < 2) { kept++; return m }
    return ''
  }).replace(/\s{2,}/g, ' ').trim()
}

// ── 豆包 AI 生成回复（主人艾特专属） ──
export async function generateAtReply(creds, cfg, nickname, content, bvid) {
  const ownerName = cfg.bili?.ownerName || '主人'
  const sys = `你是${ownerName}的B站分身，现在主人在B站@了你，说了：「${content}」。请你用主人分身的身份，写一句简短、自然、贴合语境的回复。要求：15-50字，口语化，像真人在B站评论区的回复，不要开头加"主人好"之类的称呼。结尾可以带 1 个B站表情（从这些里选：${EMOTE_PROMPT_LIST}），不带也可以，别带emoji。直接输出回复文本，不要任何其他内容。`
  try {
    const j = await doubaoHttps({ messages: [{ role: 'system', content: sys }], max_tokens: 200 }, creds.doubaoApiKey, creds.doubaoEndpointId)
    const text = (j?.choices?.[0]?.message?.content || '').trim()
    if (text) {
      const cleaned = sanitizeEmotes(text.replace(/^["「『]|["」』]$/g, '').trim())
      if (cleaned) return cleaned
    }
  } catch (e) { console.log('[doubao]', e?.message || e) }
  const fallbacks = [
    '收到收到！这条我记下啦～[doge]',
    '哈哈懂你意思了，稍后看一下～[吃瓜]',
    '好的好的，让我看看这条内容~[星星眼]',
    '嗯嗯，我回头去看看！[点赞]',
    'Get到了，马上安排～[打call]',
  ]
  return fallbacks[Math.floor(Math.random() * fallbacks.length)]
}

// ── 拉主人未处理的 @ ──
export async function fetchOwnerUntprocessedAts() {
  const H = biliReqHeaders()
  if (!H) throw new Error('凭据缺失')
  const cfg = getJson('config.json')
  const ownerMid = String(cfg.bili?.ownerMid || '')
  const myMid = String(cfg.bili?.selfMid || '')
  const processed = loadAtProcessed()

  const r = await fetch('https://api.bilibili.com/x/msgfeed/at?build=0&mobi_app=web', { headers: H })
  const j = await r.json()
  if (j.code !== 0) throw new Error(`at-me code=${j.code} ${j.message}`)

  const rawItems = j.data?.items || []
  const checked = await Promise.all(rawItems.map(async x => {
    const isOwner = String(x.user?.mid) === ownerMid
    const id = String(x.id)
    let replied = processed.has(id)
    if (!replied && isOwner && myMid) {
      replied = await checkAlreadyReplied(H, x.item?.subject_id, x.item?.root_id, x.item?.source_id, myMid)
      if (replied) saveAtProcessed(id)
    }
    return {
      id,
      at_time: x.at_time,
      nickname: x.user?.nickname || '',
      mid: String(x.user?.mid || ''),
      content: x.item?.source_content || '',
      bvid: extractBv(x.item?.uri || ''),
      aid: x.item?.subject_id || '',
      root_id: x.item?.root_id || 0,
      source_id: x.item?.source_id || '',
      is_owner: isOwner,
      processed: replied,
    }
  }))
  return checked.filter(x => x.is_owner && !x.processed)
}

// ── 发回复（spawn comment.mjs） ──
export function sendComment({ aid, bvid, message, root, parent }) {
  return new Promise((resolve) => {
    // 用 import.meta.url 定位，不受 process.cwd() 影响（宝塔/命令行 cwd 不同）
    const commentScript = fileURLToPath(new URL('../commands/comment.mjs', import.meta.url))
    const args = ['--oid', String(aid), '--bvid', bvid, '--message', message, '--root', String(root), '--parent', String(parent), '--go']
    const proc = spawn(process.execPath, [commentScript, ...args])
    let out = '', err = ''
    proc.stdout.on('data', b => out += b.toString())
    proc.stderr.on('data', b => err += b.toString())
    proc.on('error', e => resolve({ code: -1, out, err: 'spawn error: ' + e.message }))
    proc.on('close', code => resolve({ code, out, err }))
  })
}

// ── 完整处理一条主人 @（生成 + 检查 + 发送 + 记状态） ──
export async function handleOwnerAt(atItem, opts = {}) {
  const { dry = false } = opts
  const H = biliReqHeaders()
  if (!H) return { ok: false, error: '凭据缺失' }
  const cfg = getJson('config.json')
  const creds = getJson('credentials.json')
  const myMid = String(cfg.bili?.selfMid || '')
  const nickname = atItem.nickname || cfg.bili?.ownerName || '主人'
  const aid = atItem.aid
  const sourceId = atItem.source_id || atItem.root_id
  const root = sourceId
  const parent = sourceId

  // 重复检查（fingerprint 优先，atItem.id 兜底——msgfeed id 不稳定）
  const fp = mkAtFingerprint(atItem)
  if (loadAtProcessed().has(fp)) {
    return { ok: true, skipped: true, reason: '指纹已处理过（fingerprint）' }
  }
  if (myMid && await checkAlreadyReplied(H, aid, root, parent, myMid)) {
    saveAtProcessed(fp)
    return { ok: true, skipped: true, reason: '评论区已存在我的回复' }
  }

  // 生成回复
  let replyText = ''
  if (creds.doubaoApiKey) {
    replyText = await generateAtReply(creds, cfg, nickname, atItem.content, atItem.bvid)
  } else {
    const fallbacks = ['收到收到！这条我记下啦～[doge]', '嗯嗯，我回头去看看！[点赞]', 'Get到了，马上安排～[打call]']
    replyText = fallbacks[Math.floor(Math.random() * fallbacks.length)]
  }

  if (dry) return { ok: true, dry: true, message: replyText }

  // 发送（默认走子评论+B站官方表情；config.json 显式开 bili.imageReply=true 才尝试自定义图片评论）
  // 注：B 站硬限制 code=-400 子评论不能带图，所以自定义图只能走顶层评论+@ 形式，互动感差
  if (cfg.bili?.imageReply === true) {
    try {
      const meme = pickMeme(atItem.content, replyText)
      const pic = await uploadMeme(meme.file)
      if (pic) {
        // 只试子评论带图（B站硬限制 code=-400 子评论不能带图）
        // 规则：主人已经在原评论里 @ 过小号，小号只回子评论盖楼，绝不再发顶层评论
        const j = await sendCommentDirect({ aid, bvid: atItem.bvid, message: replyText, root, parent, pictures: pic })
        if (j.code === 0) {
          saveAtProcessed(fp)
          return { ok: true, message: replyText, meme: meme.name }
        }
        console.log('[image-reply] code=' + j.code + ' message=' + (j.message || '') + '，降级子评论纯文字')
      }
    } catch (e) { console.log('[image-reply]', e?.message || e, '，降级纯文字') }
  }
  const r = await sendComment({ aid, bvid: atItem.bvid, message: replyText, root, parent })
  if (r.code !== 0) return { ok: false, error: `评论发送失败(code=${r.code}): ${r.err.trim() || r.out.trim()}` }

  saveAtProcessed(fp)
  return { ok: true, message: replyText }
}

import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolveBangumi, parseSeasonId } from '../tools/commands/bangumi.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const BILI_MJS = path.join(ROOT, 'tools', 'bili.mjs')

function runBili(args) {
  const result = spawnSync(process.execPath, [BILI_MJS, ...args], {
    encoding: 'utf8', timeout: 120_000, cwd: ROOT, env: process.env,
  })
  const out = String(result.stdout || '').trim()
  const err = String(result.stderr || '').trim()
  return { code: result.status ?? 1, out, err }
}

function bvToAid(bv) {
  const r = spawnSync(process.execPath, ['-e', `
    fetch('https://api.bilibili.com/x/web-interface/view?bvid=${bv}')
      .then(r=>r.json())
      .then(j=>{console.log(j?.data?.aid || '')})
      .catch(()=>{})
  `], { encoding: 'utf8', timeout: 30_000 })
  return String(r.stdout || '').trim()
}

async function expandMessage(template, vars) {
  let msg = template
  for (const [k, v] of Object.entries(vars)) {
    msg = msg.replace(new RegExp('\\{' + k + '\\}', 'g'), String(v || ''))
  }
  return msg
}

async function main() {
  const raw = process.argv[2]
  let task
  try { task = JSON.parse(raw) } catch {
    console.error('direct-runner 需要一个 JSON task 参数')
    process.exit(1)
  }

  console.log(`\n🚀 === 纯脚本直达模式（0 token）===`)
  console.log(`   任务: ${task.name}`)
  console.log(`   目标: ${task.targetUrl || '(无)'}`)

  let bv = ''
  let bangumiInfo = null

  const ps = parseSeasonId(task.targetUrl)
  if (ps) {
    console.log(`   🔗 检测到番剧 ${ps.type}=${ps.id}，解析最新正片...`)
    const r = await resolveBangumi(task.targetUrl)
    if (!r.ok) {
      console.error(`   ❌ 番剧解析失败: ${r.error}`)
      process.exit(1)
    }
    bv = r.latest.bvid
    bangumiInfo = r
    console.log(`   ✅ 《${r.title}》第${r.latest.index || r.latest.title || '?'}集 → ${bv}`)
  } else if (task.targetUrl) {
    const bvMatch = task.targetUrl.match(/(BV[\w]+)/)
    if (bvMatch) {
      bv = bvMatch[1]
      console.log(`   ✅ 从链接提取 BV: ${bv}`)
    } else {
      console.error(`   ❌ 无法从链接提取 BV 号: ${task.targetUrl}`)
      process.exit(1)
    }
  } else {
    console.error(`   ❌ 任务没有 targetUrl`)
    process.exit(1)
  }

  const aid = bvToAid(bv)
  if (!aid) {
    console.error(`   ❌ BV ${bv} 查不到 aid`)
    process.exit(1)
  }
  console.log(`   📌 aid=${aid}`)

  const vars = {
    bv,
    aid,
    title: bangumiInfo?.title || '',
    index: bangumiInfo?.latest?.index || bangumiInfo?.latest?.title || '',
    date: bangumiInfo?.latest?.pub_date || new Date().toLocaleDateString('sv-SE'),
    owner: task.ownerRef || '',
    ownerBV: task.ownerRef || '',
  }
  let message = await expandMessage(task.template || '前排占位~', vars)
  if (task.ownerRef && !message.includes('@') && !message.includes(task.ownerRef)) {
    message = message + ` @${task.ownerRef} 来看呀`
  }
  message = message.replace(/"/g, '「').slice(0, 900)

  console.log(`\n   📝 评论内容: ${message.slice(0, 120)}${message.length > 120 ? '...' : ''}`)
  console.log(`   📤 发送中...`)

  const result = runBili(['comment', '--oid', aid, '--bvid', bv, '--message', message, '--go'])
  console.log(result.out.split('\n').map(l => '   ' + l).join('\n'))
  if (result.err) console.log(result.err.split('\n').map(l => '   ERR: ' + l).join('\n'))

  if (result.code === 0) {
    console.log(`\n   ✅ 发送成功！0 token 消耗`)
    console.log(`   📊 豆包 token 预算 ${task._direct === true ? '完全没碰' : '(未使用)'}`)
  } else {
    console.error(`\n   ❌ 发送失败（exit ${result.code}）`)
    process.exit(result.code)
  }
}

main().catch(e => {
  console.error('   💥 异常:', e.message)
  process.exit(1)
})
// scan-comment-for-tag.mjs —— 主人艾特自动回复（定时版）
//
// 整合自 src/web.mjs 的主人艾特逻辑，共用 tools/lib/at-reply.mjs。
// 和 Web UI 手动点一键回复**完全一致**：
//   - 只回主人的 @（其他人的一律不回）
//   - 防重复：at-processed.json + checkAlreadyReplied 评论区查
//   - 生成回复：豆包 AI + fallback 模板
//
// 用法:
//   node scan-comment-for-tag.mjs --dry           # 只扫描，不发
//   node scan-comment-for-tag.mjs --go            # 扫描 + 自动回复
//   node scan-comment-for-tag.mjs --go --max 5    # 每次最多处理 5 条（默认 3）
//
// 调度建议: 每 5 分钟跑一次
//   scheduler 加 interval=300 的任务
//
// 和 Web UI 的关系:
//   - Web UI /api/reply-at 手动点 → 手动回复
//   - scan-comment-for-tag.mjs 定时跑 → 自动回复
//   - 两者共用 at-processed.json，不会重复回同一条
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  fetchOwnerUntprocessedAts,
  handleOwnerAt,
} from '../lib/at-reply.mjs'

process.on('uncaughtException', e => console.error('💥 EX:', e?.message))
process.on('unhandledRejection', e => console.error('💥 UR:', e?.message || e))

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ── 参数 ──
const args = new Map()
for (let i = 2; i < process.argv.length; i += 1) {
  const a = process.argv[i]
  if (a.startsWith('--')) args.set(a.slice(2), process.argv[i + 1]?.startsWith('--') ? true : process.argv[++i] ?? true)
}
const DRY = args.has('dry')
const GO = args.has('go')
const MAX = Math.max(1, Number(args.get('max') || 3))
const QUIET = args.has('quiet')

if (!DRY && !GO) { console.error('用 --dry 先验，或 --go 真发'); process.exit(2) }

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function main() {
  if (!QUIET) console.log('=== scan-comment-for-tag（主人艾特自动回复）===')
  if (!QUIET) console.log(`  模式: ${DRY ? '🔒 DRY' : '🔥 GO'}  每次最多: ${MAX} 条`)

  // Step 1: 拉主人未处理的 @
  let ownerAts = []
  try {
    ownerAts = await fetchOwnerUntprocessedAts()
  } catch (e) {
    console.error('  ❌ 拉收件箱失败:', e.message)
    process.exit(1)
  }

  if (!QUIET) console.log(`  主人未处理的 @: ${ownerAts.length} 条`)

  if (!ownerAts.length) {
    if (!QUIET) console.log('\n  ✅ 没有主人的新艾特')
    return
  }

  // Step 2: 逐个处理（最多 MAX 条）
  let done = 0, skipped = 0, failed = 0
  const limit = Math.min(MAX, ownerAts.length)

  for (let i = 0; i < limit; i++) {
    const at = ownerAts[i]
    if (!QUIET) console.log(`\n  [${i + 1}/${limit}] ${at.nickname} @ 小号`)
    if (!QUIET) console.log(`    视频 BV=${at.bvid || '(无)'} aid=${at.aid}`)
    if (!QUIET) console.log(`    对方说: "${at.content.slice(0, 50)}"`)

    const r = await handleOwnerAt(at, { dry: DRY })

    if (r.skipped) {
      if (!QUIET) console.log(`    ⏭️ ${r.reason}，跳过`)
      skipped++
    } else if (r.ok) {
      if (!QUIET) console.log(`    ${DRY ? '🔒 DRY' : '✅ 回复成功'}: "${r.message}"`)
      done++
    } else {
      console.error(`    ❌ ${r.error}`)
      failed++
    }

    // 间隔
    if (i < limit - 1) await sleep(DRY ? 500 : 15000 + Math.random() * 10000)
  }

  console.log(`\n=== 汇总 ===`)
  console.log(`  ✅ 回复成功: ${done}  ⏭️ 跳过: ${skipped}  ❌ 失败: ${failed}`)
}

main().catch(e => { console.error('💥 主流程异常:', e.message); process.exit(1) })

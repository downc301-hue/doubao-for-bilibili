import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

process.on('uncaughtException', e => console.error('💥 EX:', e?.message))
process.on('unhandledRejection', e => console.error('💥 UR:', e?.message || e))

const DATA_DIR = path.join(os.homedir(), '.doubao-bot')
const cred = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'credentials.json'), 'utf8'))
const mainCfg = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'config.json'), 'utf8'))

const sess = decodeURIComponent(cred.sessdata || '')
const jj = cred.bili_jct || cred.biliJct || ''
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
const ck = 'SESSDATA=' + sess + '; bili_jct=' + jj + '; buvid3=' + (cred.buvid3 || '')
const HC = { 'user-agent': UA, referer: 'https://space.bilibili.com/', cookie: ck }
const HP = { ...HC, 'content-type': 'application/x-www-form-urlencoded' }

const OWNER_MID = String(mainCfg.bili?.ownerMid || '')
const SELF_MID = String(mainCfg.bili?.selfMid || '')
const DRY = process.argv.includes('--dry')
const GO = process.argv.includes('--go')

const FOLLOW_FILE = path.resolve(process.cwd(), 'owner-followings.json')
if (!fs.existsSync(FOLLOW_FILE)) { console.error('没找到 owner-followings.json，请先在浏览器拉取完整列表'); process.exit(1) }

if (!DRY && !GO) { console.error('用 --dry 先验，或 --go 真关注'); process.exit(2) }

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function main() {
  console.log('=== 登录态 ===')
  const navR = await fetch('https://api.bilibili.com/x/web-interface/nav', { headers: HC })
  const navJ = await navR.json()
  console.log('  B号:', navJ.data?.uname, '(mid', navJ.data?.mid, ') 硬币:', navJ.data?.money)
  
  console.log('\n=== Step 1: 读A的完整关注列表 ===')
  const raw = JSON.parse(fs.readFileSync(FOLLOW_FILE, 'utf8'))
  const all = raw.filter(u => String(u.mid) !== SELF_MID)
  console.log('  owner-followings.json:', raw.length, '个, 过滤掉自己后:', all.length, '个')
  
  console.log('\n=== Step 2: 拉B号已有关注 ===')
  const mineSet = new Set()
  for (let p = 1; p <= 3; p++) {
    const rMine = await fetch(`https://api.bilibili.com/x/relation/followings?vmid=${SELF_MID}&pn=${p}&ps=50&order=desc`, { headers: HC })
    const mineJ = await rMine.json()
    const list = mineJ.data?.list || []
    if (!list.length) break
    list.forEach(u => mineSet.add(String(u.mid)))
  }
  console.log('  B号已关注:', mineSet.size, '个（扫3页）')
  
  const toFollow = all.filter(u => !mineSet.has(String(u.mid)))
  console.log('\n=== Step 3: 待关注 ===', toFollow.length, '个')
  
  if (!toFollow.length) { console.log('  B号已经全部关注了 ✅'); return }
  
  console.log('\n=== Step 4: 执行关注（模式:', DRY ? '🔒 DRY' : '🔥 真实', '）===')
  console.log('  每个间隔 800-1200ms, 遇风控暂停 15s')
  const codeMap = {
    0:'✅', 22001:'⏭️自己', 22002:'⏭️已关',
    22003:'⏭️黑名单', 22007:'⏭️隐私', 22011:'❌上限', 22013:'⏭️注销',
    22014:'⛔频率限',
    '-101':'❌cookie', '-111':'❌csrf', '-400':'❌参数错误'
  }
  
  let ok = 0, dup = 0, fail = 0, skip = 0
  const results = []
  
  for (let i = 0; i < toFollow.length; i++) {
    const u = toFollow[i]
    const body = 'fid=' + u.mid + '&act=1&re_src=11&event=1&csrf=' + jj
    let j
    if (DRY) {
      j = { code: 0 }
    } else {
      try {
        const r = await fetch('https://api.bilibili.com/x/relation/modify', { method: 'POST', headers: HP, body })
        j = await r.json()
      } catch (e) {
        j = { code: -999, message: e.message }
      }
    }
    const code = j.code
    const label = codeMap[code] || (code === 0 ? '✅' : '❌code=' + code)
    const pct = ((i+1)/toFollow.length*100).toFixed(1) + '%'
    
    if ((i+1) % 10 === 0 || i === 0 || i === toFollow.length-1) {
      console.log('  [' + (i+1) + '/' + toFollow.length + ' ' + pct + '] ' + String(u.uname).slice(0,18).padEnd(20) + ' ' + label + (DRY ? ' (DRY)' : ''))
    }
    
    if (code === 0) { ok++ }
    else if (code === 22002) { dup++ }
    else if (code === 22001 || code === 22003 || code === 22007 || code === 22013) { skip++ }
    else if (code === 22014) {
      fail++
      console.log('  ⛔ 触发频率限制，暂停 15s...')
      await sleep(15000)
    } else { fail++ }
    
    results.push({ mid: u.mid, uname: u.uname, code, label })
    
    if (!DRY) await sleep(800 + Math.random()*400)
  }
  
  console.log('\n=== 汇总 ===')
  console.log('✅成功:', ok, '  ⏭️已关:', dup, '  跳过:', skip, '  ❌失败:', fail)
  
  const state = {
    syncedAt: new Date().toISOString(),
    ownerScanned: all.length,
    bHad: mineSet.size,
    bAdded: ok,
    bDup: dup,
    bSkipped: skip,
    bFailed: fail,
    results,
  }
  fs.writeFileSync(path.join(DATA_DIR, 'follow-sync-state.json'), JSON.stringify(state, null, 2))
  console.log('\n状态已保存到 follow-sync-state.json')
  
  if (fail > 0) process.exit(1)
}

main()
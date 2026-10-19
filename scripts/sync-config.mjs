import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const p = path.join(os.homedir(), '.doubao-bot', 'config.json')
let cfg = {}
try { cfg = JSON.parse(fs.readFileSync(p, 'utf8')) } catch {}

cfg.bili = cfg.bili || {}
cfg.bili.selfMid = '1184594322'
cfg.bili.selfName = '主人的豆包助理'

fs.writeFileSync(p, JSON.stringify(cfg, null, 2) + '\n')
console.log('✅ config.json 已更新')
console.log('   selfName:', cfg.bili.selfName)
console.log('   selfMid:', cfg.bili.selfMid)
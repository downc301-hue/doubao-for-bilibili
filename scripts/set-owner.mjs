import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const p = path.join(os.homedir(), '.doubao-bot', 'config.json')
let cfg = JSON.parse(fs.readFileSync(p, 'utf8'))

cfg.bili.ownerMid = '1515175012'
cfg.bili.ownerName = '相逢翔风'

fs.writeFileSync(p, JSON.stringify(cfg, null, 2) + '\n')
console.log('✅ 主人信息已同步')
console.log('   ownerName:', cfg.bili.ownerName)
console.log('   ownerMid:', cfg.bili.ownerMid)
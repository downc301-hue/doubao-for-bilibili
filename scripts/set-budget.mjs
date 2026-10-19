import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const p = path.join(os.homedir(), '.doubao-bot', 'config.json')
let cfg = JSON.parse(fs.readFileSync(p, 'utf8'))
cfg.budget = cfg.budget || {}
cfg.budget.dailyTokens = 50000
fs.writeFileSync(p, JSON.stringify(cfg, null, 2) + '\n')
console.log('✅ token 预算调整到', cfg.budget.dailyTokens)
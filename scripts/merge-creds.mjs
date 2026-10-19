import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const dbPath = path.join(os.homedir(), '.doubao-bot', 'credentials.json')
const baPath = path.join(os.homedir(), '.bili-ai', 'credentials.json')

const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'))
const ba = JSON.parse(fs.readFileSync(baPath, 'utf8'))

if (ba.sessdata) db.sessdata = ba.sessdata
if (ba.bili_jct) db.biliJct = ba.bili_jct
else if (ba.biliJct) db.biliJct = ba.biliJct
if (ba.buvid3) db.buvid3 = ba.buvid3

fs.writeFileSync(dbPath, JSON.stringify(db, null, 2) + '\n')
console.log('✅ 凭据已合并到 .doubao-bot/credentials.json')
console.log('  doubaoApiKey:', db.doubaoApiKey ? '✅' : '❌')
console.log('  doubaoEndpointId:', db.doubaoEndpointId ? '✅' : '❌')
console.log('  sessdata:', db.sessdata ? '✅' : '❌')
console.log('  biliJct:', db.biliJct ? '✅' : '❌')
console.log('  buvid3:', db.buvid3 ? '✅' : '❌')
import fs from 'node:fs'
import path from 'node:path'

// 凭据统一入口：优先 ~/.doubao-bot（Web UI 保存的最新 Cookie），
// 回退 ~/.bili-ai（老目录，2026-10-18 之后可能已过期）。
export function loadCreds() {
  const home = process.env.USERPROFILE || process.env.HOME || '/'
  for (const dir of ['.doubao-bot', '.bili-ai']) {
    const p = path.join(home, dir, 'credentials.json')
    try {
      const c = JSON.parse(fs.readFileSync(p, 'utf8'))
      if (c && c.sessdata) {
        c.bili_jct = c.bili_jct || c.biliJct || ''
        return c
      }
    } catch {}
  }
  throw new Error('credentials.json 在 .doubao-bot 和 .bili-ai 都不存在或无效')
}

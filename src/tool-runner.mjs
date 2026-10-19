import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { PATHS } from './config.mjs'

const BILI_MJS = path.join(PATHS.toolsDir, 'bili.mjs')

export function runBili(args = []) {
  const nodePath = process.execPath
  const result = spawnSync(nodePath, [BILI_MJS, ...args], {
    encoding: 'utf8',
    timeout: 180_000,
    windowsHide: true,
    env: process.env,
  })
  const out = String(result.stdout || '').trim()
  const err = String(result.stderr || '').trim()
  if (result.status !== 0 && !out) {
    return `[工具报错 exit=${result.status}] ${err || '(无 stderr)'}`
  }
  return out || err || `[exit=${result.status}]`
}

export function runBiliTruncated(args = [], maxChars = 3000) {
  const result = runBili(args)
  if (result.length <= maxChars) return result
  return result.slice(0, maxChars) + `\n... [truncated ${result.length - maxChars} chars]`
}
import { runBili, runBiliTruncated } from './tool-runner.mjs'

const MAX_TOOL_OUTPUT = 3000

async function bvToAid(bv) {
  try {
    const url = `https://api.bilibili.com/x/web-interface/view?bvid=${bv}`
    const r = await fetch(url)
    const j = await r.json()
    return j?.data?.aid
  } catch {}
  return null
}

export async function executeToolAsync(name, args) {
  const a = args || {}
  switch (name) {
    case 'session':
      return runBili(['session'])
    case 'deps':
      return runBili(['deps'])
    case 'feed': {
      const cmd = ['feed']
      if (a.seedBv) cmd.push(a.seedBv)
      if (a.n) cmd.push('--n', String(a.n))
      if (a.per) cmd.push('--per', String(a.per))
      return runBiliTruncated(cmd, MAX_TOOL_OUTPUT)
    }
    case 'debrief': {
      const cmd = ['debrief', a.bv]
      if (a.noFrames !== false) cmd.push('--no-frames')
      if (a.top) cmd.push('--top', String(a.top))
      return runBiliTruncated(cmd, MAX_TOOL_OUTPUT + 2000)
    }
    case 'search':
      return runBiliTruncated(['search', a.keyword], MAX_TOOL_OUTPUT)
    case 'bangumi':
      return runBiliTruncated(['bangumi', '--url', a.url], MAX_TOOL_OUTPUT)
    case 'diary': {
      if (a.action === 'log') {
        const cmd = ['diary', 'log', a.kind || 'event']
        if (a.target) cmd.push('--target', String(a.target))
        if (a.event) cmd.push('--note', a.event)
        return runBili(cmd)
      }
      if (a.action === 'tail') return runBili(['diary', 'tail'])
      return runBili(['diary', 'show'])
    }
    case 'comment': {
      const aid = await bvToAid(a.bv)
      if (!aid) return `[comment] 无法从 ${a.bv} 解析 aid`
      const text = (a.text || '').replace(/"/g, '「').slice(0, 990)
      const cmd = ['comment', '--oid', String(aid), '--bvid', a.bv, '--message', text]
      cmd.push(a.go ? '--go' : '--dry')
      return runBili(cmd)
    }
    case 'dm': {
      const text = (a.text || '').replace(/"/g, '「').slice(0, 990)
      const cmd = ['dm', '--msg', text]
      cmd.push(a.go ? '--go' : '--dry')
      return runBili(cmd)
    }
    default:
      return `[未知工具: ${name}]`
  }
}

export function executeTool(name, args) {
  return executeToolAsync(name, args)
}
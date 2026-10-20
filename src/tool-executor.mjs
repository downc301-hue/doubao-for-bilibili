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
      const text = (a.text || '').replace(/"/g, '「').slice(0, 490)
      const cmd = ['reply-draft', 'add', '--oid', String(aid), '--bvid', a.bv, '--message', text]
      if (a.who) cmd.push('--who', String(a.who).slice(0, 60))
      cmd.push('--root', String(aid))
      cmd.push('--parent', String(aid))
      return runBili(cmd)
    }
    case 'reply': {
      if (!a.bv || !a.root || !a.parent || !a.text) return `[reply] 需要 bv, root, parent, text`
      const aid = await bvToAid(a.bv)
      if (!aid) return `[reply] 无法从 ${a.bv} 解析 aid`
      const text = (a.text || '').replace(/"/g, '「').slice(0, 490)
      const cmd = ['reply-draft', 'add', '--oid', String(aid), '--bvid', a.bv, '--root', String(a.root), '--parent', String(a.parent), '--message', text]
      if (a.who) cmd.push('--who', String(a.who).slice(0, 60))
      if (a.src) cmd.push('--src', String(a.src).slice(0, 300))
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
import { runBili } from './tool-runner.mjs'

export function getDiaryText() {
  try {
    const show = runBili(['diary', 'show'])
    const tail = runBili(['diary', 'tail'])
    return [
      show && show.length > 0 ? show : null,
      tail && tail.length > 0 ? `--- 最近事件 ---\n${tail}` : null,
    ].filter(Boolean).join('\n\n')
  } catch {
    return ''
  }
}
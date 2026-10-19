import { runAgent } from './agent.mjs'

const raw = process.argv[2]
let task
try { task = JSON.parse(raw) } catch {
  console.error('run-task 需要一个 JSON task 参数')
  process.exit(1)
}

process.env.DOUBAO_TASK = JSON.stringify(task)

const result = await runAgent()

if (result.summary) {
  console.log(`\n📋 任务「${task.name}」完成: ${result.summary.slice(0, 200)}`)
} else {
  console.log(`\n📋 任务「${task.name}」跑完了（${result.rounds} 轮 / ${result.tokens?.total || 0} tokens）`)
}
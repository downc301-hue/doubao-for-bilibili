#!/usr/bin/env node
import { runAgent } from './agent.mjs'

const result = await runAgent()

console.log('\n=== 执行完毕 ===')
console.log(`轮次: ${result.rounds}`)
console.log(`tokens: ${JSON.stringify(result.tokens)}`)
if (process.env.DOUBAO_EXIT_AFTER_AGENT === '1') process.exit(0)
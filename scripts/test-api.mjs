import { chat, chatWithTools } from '../src/doubao-client.mjs'
import { TOOLS } from '../src/tools-def.mjs'

console.log('🧪 测试 1: 简单对话')
try {
  const r1 = await chat([{ role: 'user', content: '你好，只回复"好的"两个字。' }])
  console.log('✅ 回复:', r1.content)
  console.log('💰 tokens:', JSON.stringify(r1.usage))
} catch (e) {
  console.error('❌ 报错:', e.message)
}

console.log('\n🧪 测试 2: Function Call 能力')
try {
  const r2 = await chatWithTools(
    [
      { role: 'system', content: '你是一个B站AI分身。' },
      { role: 'user', content: '我刚醒，帮我确认一下身份' },
    ],
    TOOLS
  )
  console.log('✅ tool_calls:', JSON.stringify(r2.toolCalls, null, 2))
  console.log('💬 content:', r2.content)
  console.log('💰 tokens:', JSON.stringify(r2.usage))
} catch (e) {
  console.error('❌ 报错:', e.message)
}
import { getConfig } from './config.mjs'

let totalInput = 0
let totalOutput = 0

export function resetTokenCount() {
  totalInput = 0
  totalOutput = 0
}

export function getTokenCount() {
  return { input: totalInput, output: totalOutput, total: totalInput + totalOutput }
}

export async function chat(messages, opts = {}) {
  const cfg = getConfig()
  const { apiKey, endpointId, baseUrl } = cfg.doubao

  if (!apiKey) throw new Error('缺少豆包 API Key，请在 credentials.json 里填 doubaoApiKey')
  if (!endpointId) throw new Error('缺少豆包 Endpoint ID（接入点 ID），请在 credentials.json 里填 doubaoEndpointId')

  const body = {
    model: endpointId,
    messages,
    stream: false,
    ...opts,
  }

  const url = `${baseUrl}/chat/completions`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`豆包 API ${res.status}: ${text.slice(0, 300)}`)
  }

  const data = await res.json()
  const usage = data.usage || {}
  totalInput += usage.prompt_tokens || 0
  totalOutput += usage.completion_tokens || 0

  return {
    content: data.choices?.[0]?.message?.content || '',
    toolCalls: data.choices?.[0]?.message?.tool_calls || null,
    usage: {
      prompt: usage.prompt_tokens || 0,
      completion: usage.completion_tokens || 0,
      total: usage.total_tokens || 0,
    },
    raw: data,
  }
}

export async function chatWithTools(messages, tools, opts = {}) {
  return chat(messages, { tools, tool_choice: opts.toolChoice || 'auto', ...opts })
}
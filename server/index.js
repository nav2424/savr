/* Simple proxy server for SAGE with multi-provider fallback */
require('dotenv').config()
const express = require('express')
const cors = require('cors')
const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args))

const app = express()
app.use(cors())
app.use(express.json({ limit: '1mb' }))

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'

const CONFIG = {
  openaiApiKey: process.env.OPENAI_API_KEY || process.env.EXPO_PUBLIC_OPENAI_API_KEY || '',
  openaiModel: process.env.PRIMARY_MODEL || 'gpt-4o',
  openaiFallbackModel: process.env.FALLBACK_MODEL || 'gpt-4o-mini',
  openrouterApiKey: process.env.OPENROUTER_API_KEY || process.env.EXPO_PUBLIC_OPENROUTER_API_KEY || '',
  openrouterModel: process.env.OPENROUTER_MODEL || 'openrouter/auto',
  maxRetries: parseInt(process.env.MAX_RETRIES || '2', 10),
  initialDelayMs: parseInt(process.env.INITIAL_DELAY_MS || '600', 10)
}

async function callProvider(url, key, body) {
  return await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`
    },
    body: JSON.stringify(body)
  })
}

app.post('/api/sage/chat', async (req, res) => {
  try {
    const { messages, temperature = 0.7, max_tokens = 500 } = req.body || {}
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages required' })
    }

    // Try OpenAI primary with retries
    const bodyBase = { messages, temperature, max_tokens }
    let attempt = 0
    let response = await callProvider(OPENAI_URL, CONFIG.openaiApiKey, { ...bodyBase, model: CONFIG.openaiModel })
    while (!response.ok && attempt < CONFIG.maxRetries) {
      attempt += 1
      const delay = Math.floor(CONFIG.initialDelayMs * Math.pow(2, attempt - 1) * (0.75 + Math.random()*0.5))
      await new Promise(r => setTimeout(r, delay))
      response = await callProvider(OPENAI_URL, CONFIG.openaiApiKey, { ...bodyBase, model: CONFIG.openaiModel })
    }

    if (!response.ok) {
      let errorData = {}
      try { errorData = await response.json() } catch {}
      const code = errorData?.error?.code || ''

      // OpenAI fallback model
      if (code === 'insufficient_quota' || response.status === 429) {
        try {
          const r2 = await callProvider(OPENAI_URL, CONFIG.openaiApiKey, { ...bodyBase, model: CONFIG.openaiFallbackModel })
          if (r2.ok) {
            const data = await r2.json()
            return res.json({ provider: 'openai', model: CONFIG.openaiFallbackModel, ...data })
          }
        } catch {}

        // Provider failover: OpenRouter
        if (CONFIG.openrouterApiKey) {
          try {
            const r3 = await callProvider(OPENROUTER_URL, CONFIG.openrouterApiKey, { ...bodyBase, model: CONFIG.openrouterModel })
            if (r3.ok) {
              const data = await r3.json()
              return res.json({ provider: 'openrouter', model: CONFIG.openrouterModel, ...data })
            }
          } catch {}
        }
      }

      return res.status(502).json({ error: 'provider_failure', detail: errorData })
    }

    const data = await response.json()
    return res.json({ provider: 'openai', model: CONFIG.openaiModel, ...data })
  } catch (e) {
    return res.status(500).json({ error: 'proxy_error', message: e?.message || String(e) })
  }
})

const port = parseInt(process.env.PORT || '3000', 10)
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`SAGE proxy running on http://localhost:${port}`)
})



/* Simple proxy server for SAGE with Google Cloud Vision OCR */
require('dotenv').config()
const express = require('express')
const cors = require('cors')
const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args))

// Google Cloud Vision API Key (required)
const GOOGLE_CLOUD_VISION_API_KEY = process.env.GOOGLE_CLOUD_VISION_API_KEY
if (!GOOGLE_CLOUD_VISION_API_KEY) {
  console.error('❌ GOOGLE_CLOUD_VISION_API_KEY not set - OCR will fail')
} else {
  console.log('✅ Google Cloud Vision API key configured')
}

const app = express()
app.use(cors())
app.use(express.json({ limit: '15mb' }))

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'

const CONFIG = {
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  openaiModel: process.env.PRIMARY_MODEL || 'gpt-4o',
  openaiFallbackModel: process.env.FALLBACK_MODEL || 'gpt-4o-mini',
  openrouterApiKey: process.env.OPENROUTER_API_KEY || process.env.EXPO_PUBLIC_OPENROUTER_API_KEY || '',
  openrouterModel: process.env.OPENROUTER_MODEL || 'openrouter/auto',
  maxRetries: parseInt(process.env.MAX_RETRIES || '2', 10),
  initialDelayMs: parseInt(process.env.INITIAL_DELAY_MS || '600', 10)
}

// Google Cloud Vision REST API endpoint
const GOOGLE_VISION_API_URL = 'https://vision.googleapis.com/v1/images:annotate'

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

// OCR endpoint - Google Cloud Vision REST API (DOCUMENT_TEXT_DETECTION)
app.post('/api/ocr', async (req, res) => {
  try {
    const { imageBase64 } = req.body || {}
    if (!imageBase64) {
      console.error('❌ OCR request missing imageBase64')
      return res.status(400).json({ error: 'imageBase64 required' })
    }

    if (!GOOGLE_CLOUD_VISION_API_KEY) {
      console.error('❌ GOOGLE_CLOUD_VISION_API_KEY not configured')
      return res.status(500).json({ error: 'ocr_error', message: 'Google Vision API key not configured' })
    }

    console.log(`📥 OCR request received: ${imageBase64.length} chars base64`)

    // Remove data URL prefix if present (must be raw base64)
    const base64Data = imageBase64.replace(/^data:image\/[a-z]+;base64,/, '')
    
    console.log('🔍 Calling Google Cloud Vision REST API (DOCUMENT_TEXT_DETECTION)...')
    
    // Call Google Cloud Vision REST API
    const visionUrl = `${GOOGLE_VISION_API_URL}?key=${GOOGLE_CLOUD_VISION_API_KEY}`
    const visionRequest = {
      requests: [
        {
          image: {
            content: base64Data
          },
          features: [
            {
              type: 'DOCUMENT_TEXT_DETECTION',
              maxResults: 1
            }
          ]
        }
      ]
    }
    
    const visionResponse = await fetch(visionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(visionRequest)
    })
    
    if (!visionResponse.ok) {
      const errorData = await visionResponse.text().catch(() => 'Unknown error')
      console.error(`❌ Google Vision API error (status ${visionResponse.status}):`, errorData.substring(0, 200))
      return res.status(500).json({ 
        error: 'ocr_error', 
        message: `Google Vision API error: ${visionResponse.status}`,
        detail: errorData.substring(0, 200)
      })
    }
    
    const visionData = await visionResponse.json()
    
    // Extract text from fullTextAnnotation
    const fullTextAnnotation = visionData?.responses?.[0]?.fullTextAnnotation
    if (!fullTextAnnotation || !fullTextAnnotation.text) {
      const extractedLength = fullTextAnnotation?.text?.trim().length || 0
      console.log(`⚠️ Google Vision OCR returned insufficient text: ${extractedLength} characters`)
      return res.status(422).json({ 
        error: 'ocr_failed', 
        message: 'OCR returned insufficient text',
        detail: visionData
      })
    }
    
    const text = fullTextAnnotation.text.trim()
    if (text.length < 10) {
      console.log(`⚠️ Google Vision OCR returned insufficient text: ${text.length} characters`)
      return res.status(422).json({ 
        error: 'ocr_failed', 
        message: 'OCR returned insufficient text'
      })
    }
    
    console.log(`✅ Google Vision OCR success: ${text.length} characters extracted`)
    return res.json({ 
      text,
      provider: 'google_vision',
      textLength: text.length
    })
  } catch (e) {
    const errorMsg = e?.message || String(e)
    console.error('❌ OCR endpoint error:', errorMsg)
    return res.status(500).json({ error: 'ocr_error', message: errorMsg })
  }
})

// Legacy endpoint (redirects to /api/ocr)
app.post('/api/sage/ocr', async (req, res) => {
  // Forward to main OCR endpoint
  req.url = '/api/ocr'
  return app._router.handle(req, res)
})

const port = parseInt(process.env.PORT || '3000', 10)
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`SAGE proxy running on http://localhost:${port}`)
})



import { createSign } from 'node:crypto'

type ServiceAccount = { client_email: string; private_key: string; project_id: string; token_uri?: string }
let cachedToken: { value: string; expiresAt: number } | null = null

function base64Url(value: string | Buffer) {
  return Buffer.from(value).toString('base64url')
}

function serviceAccount(): ServiceAccount {
  const raw = String(process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '').trim()
  if (!raw) throw new Error('A conta de serviço do Google Cloud não está configurada.')
  let parsed: any
  try {
    parsed = JSON.parse(raw)
  } catch {
    try {
      parsed = JSON.parse(Buffer.from(raw, 'base64').toString('utf8'))
    } catch {
      throw new Error('A conta de serviço do Google Cloud está em formato inválido.')
    }
  }
  if (!parsed?.client_email || !parsed?.private_key || !parsed?.project_id) {
    throw new Error('A conta de serviço do Google Cloud está incompleta.')
  }
  return parsed as ServiceAccount
}

export function getVeoVertexConfig() {
  const account = serviceAccount()
  return {
    account,
    projectId: process.env.GOOGLE_CLOUD_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || account.project_id,
    location: process.env.GOOGLE_CLOUD_LOCATION || process.env.VERTEX_AI_LOCATION || 'us-central1',
    model: process.env.VEO_LAB_MODEL || 'veo-3.1-generate-001',
  }
}

export async function getGoogleCloudAccessToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value
  const { account } = getVeoVertexConfig()
  const now = Math.floor(Date.now() / 1000)
  const tokenUri = account.token_uri || 'https://oauth2.googleapis.com/token'
  const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claim = base64Url(JSON.stringify({
    iss: account.client_email,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
    aud: tokenUri,
    iat: now,
    exp: now + 3600,
  }))
  const unsigned = `${header}.${claim}`
  const signer = createSign('RSA-SHA256')
  signer.update(unsigned)
  signer.end()
  const assertion = `${unsigned}.${signer.sign(account.private_key).toString('base64url')}`
  const response = await fetch(tokenUri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
    cache: 'no-store',
  })
  const result = await response.json().catch(() => null)
  if (!response.ok || !result?.access_token) {
    throw new Error(result?.error_description || 'Não foi possível autenticar no Google Cloud.')
  }
  cachedToken = { value: String(result.access_token), expiresAt: Date.now() + Number(result.expires_in || 3600) * 1000 }
  return cachedToken.value
}

export function getVeoVertexModelUrl() {
  const { projectId, location, model } = getVeoVertexConfig()
  return `https://${location}-aiplatform.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/locations/${encodeURIComponent(location)}/publishers/google/models/${encodeURIComponent(model)}`
}

export function getVertexPublisherModelUrl(model: string) {
  const { projectId, location } = getVeoVertexConfig()
  return `https://${location}-aiplatform.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/locations/${encodeURIComponent(location)}/publishers/google/models/${encodeURIComponent(model)}`
}

export async function downloadVertexGcsVideo(gcsUri: string, accessToken: string) {
  const match = gcsUri.match(/^gs:\/\/([^/]+)\/(.+)$/)
  if (!match) throw new Error('O Google retornou um endereço de vídeo inválido.')
  const [, bucket, object] = match
  const response = await fetch(`https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(object)}?alt=media`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  })
  if (!response.ok) throw new Error('Não foi possível baixar o vídeo concluído do Google Cloud.')
  return Buffer.from(await response.arrayBuffer())
}

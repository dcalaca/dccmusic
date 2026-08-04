import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(process.cwd(), '.env.local') })

async function main() {
  const { getStudioAccess, getStudioCreditUsage } = await import('../lib/studio')
  const composerId = '5b46799f-a037-49d4-8895-87478a40c046'
  const { limits } = await getStudioAccess(composerId)
  const usage = await getStudioCreditUsage(composerId, limits)
  console.log({ remaining: usage.remaining, used: usage.used, limit: (usage as any).limit })
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

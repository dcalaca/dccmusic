export const STUDIO_CAMPAIGN: {
  slug: string
  name: string
  startsAt: string
  endsAt: string
  unitPrice: number
  musicQuantity: number
} = {
  slug: '',
  name: '',
  startsAt: '',
  endsAt: '',
  unitPrice: 0,
  musicQuantity: 1,
}

export function isStudioCampaignActive() {
  return false
}

export function isComposerCreatedDuringStudioCampaign() {
  return false
}

export function getStudioCampaignState() {
  return {
    ...STUDIO_CAMPAIGN,
    active: false,
    startsAtDisplay: '',
    endsAtDisplay: '',
  }
}

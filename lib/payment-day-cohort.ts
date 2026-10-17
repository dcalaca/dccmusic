/** Payments must be visited in chronological order. Day keys use São Paulo time. */
export function createPaymentDayClassifier(priorBuyers: ReadonlySet<string>) {
  const firstDays = new Map<string, string>()
  return (composerId: string, day: string): 'new' | 'recurring' => {
    if (priorBuyers.has(composerId)) return 'recurring'
    if (!firstDays.has(composerId)) firstDays.set(composerId, day)
    return firstDays.get(composerId) === day ? 'new' : 'recurring'
  }
}

export type TrustLevel = 'trusted' | 'partial' | 'untrusted'

export function computeTrustLevel(spf: string | null, dkim: string | null): TrustLevel {
  const spfPass = spf?.toLowerCase() === 'pass'
  const dkimPass = dkim?.toLowerCase() === 'pass'

  if (spfPass && dkimPass) return 'trusted'
  if (spfPass || dkimPass) return 'partial'
  return 'untrusted'
}

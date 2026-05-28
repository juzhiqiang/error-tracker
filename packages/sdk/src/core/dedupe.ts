export class DedupeFilter {
  private seen = new Map<string, number>()

  constructor(private readonly ttlMs = 5000) {}

  shouldSend(fingerprint: string): boolean {
    const lastSeen = this.seen.get(fingerprint)
    const now = Date.now()
    if (lastSeen !== undefined && now - lastSeen < this.ttlMs) return false
    this.seen.set(fingerprint, now)
    return true
  }
}

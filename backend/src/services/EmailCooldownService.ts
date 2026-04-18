/**
 * Per-(shop, conversation) in-memory cooldown to prevent email spam when a
 * customer sends many messages in a short window and the shop is not
 * actively viewing the thread.
 *
 * First send passes; subsequent sends within cooldownMs are suppressed.
 * After cooldownMs elapses, the next send is allowed again.
 */
export class EmailCooldownService {
  private lastSent: Map<string, number> = new Map();
  private readonly cooldownMs: number;
  private readonly sweepIntervalMs = 10 * 60 * 1000;

  constructor(cooldownMs: number = 15 * 60 * 1000) {
    this.cooldownMs = cooldownMs;
    setInterval(() => this.sweep(), this.sweepIntervalMs).unref?.();
  }

  shouldSend(shopId: string, conversationId: string): boolean {
    const key = `${shopId}:${conversationId}`;
    const last = this.lastSent.get(key) ?? 0;
    const now = Date.now();
    if (now - last < this.cooldownMs) return false;
    this.lastSent.set(key, now);
    return true;
  }

  private sweep(): void {
    const cutoff = Date.now() - this.cooldownMs;
    for (const [key, ts] of this.lastSent.entries()) {
      if (ts < cutoff) this.lastSent.delete(key);
    }
  }
}

export const emailCooldownService = new EmailCooldownService();

import type { Policy, PaymentRequest, Verdict, PolicyReason, Decision } from './types';

interface TransactionRecord {
  amount: number;
  recipient?: string;
  timestamp: number;
}

const history: TransactionRecord[] = [];

const FIVE_MINUTES = 5 * 60 * 1000;
const ONE_HOUR = 60 * 60 * 1000;
const ONE_DAY = 24 * ONE_HOUR;
const ONE_MINUTE = 60 * 1000;

function pruneHistory(): void {
  const cutoff = Date.now() - ONE_DAY;
  while (history.length > 0 && history[0].timestamp < cutoff) {
    history.shift();
  }
}

function getDomain(recipient: string): string | null {
  if (recipient.includes('@')) {
    return recipient.split('@')[1]?.toLowerCase() ?? null;
  }
  try {
    const url = new URL(recipient);
    return url.hostname.toLowerCase();
  } catch {
    if (recipient.includes('.')) {
      return recipient.toLowerCase();
    }
    return null;
  }
}

function isOutsideOperatingHours(
  operatingHours: { start: string; end: string; timezone?: string },
  now: Date
): boolean {
  const timeStr = now.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    timeZone: operatingHours.timezone || undefined,
  });

  const [startH, startM] = operatingHours.start.split(':').map(Number);
  const [endH, endM] = operatingHours.end.split(':').map(Number);
  const [nowH, nowM] = timeStr.split(':').map(Number);

  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;
  const nowMinutes = nowH * 60 + nowM;

  if (startMinutes <= endMinutes) {
    return nowMinutes < startMinutes || nowMinutes >= endMinutes;
  }
  // Wraps midnight (e.g. 22:00 - 06:00)
  return nowMinutes >= endMinutes && nowMinutes < startMinutes;
}

export async function evaluate(
  request: PaymentRequest,
  policy: Policy
): Promise<Verdict> {
  const now = new Date();
  const nowMs = now.getTime();
  const blockReasons: PolicyReason[] = [];
  const escalateReasons: PolicyReason[] = [];

  pruneHistory();

  // 11. AMOUNT_ZERO_OR_NEGATIVE
  if (request.amount <= 0) {
    blockReasons.push('AMOUNT_ZERO_OR_NEGATIVE');
  }

  // 12. POLICY_EXPIRED
  if (policy.expiresAt && new Date(policy.expiresAt).getTime() <= nowMs) {
    blockReasons.push('POLICY_EXPIRED');
  }

  // 1. EXCEEDS_SINGLE_LIMIT
  if (policy.maxSingle !== undefined && request.amount > policy.maxSingle) {
    blockReasons.push('EXCEEDS_SINGLE_LIMIT');
  }

  // 2. EXCEEDS_DAILY_BUDGET
  if (policy.dailyBudget !== undefined) {
    const dailyCutoff = nowMs - ONE_DAY;
    const dailyTotal = history
      .filter((t) => t.timestamp >= dailyCutoff)
      .reduce((sum, t) => sum + t.amount, 0);
    if (dailyTotal + request.amount > policy.dailyBudget) {
      blockReasons.push('EXCEEDS_DAILY_BUDGET');
    }
  }

  // 3. EXCEEDS_HOURLY_BUDGET
  if (policy.hourlyBudget !== undefined) {
    const hourlyCutoff = nowMs - ONE_HOUR;
    const hourlyTotal = history
      .filter((t) => t.timestamp >= hourlyCutoff)
      .reduce((sum, t) => sum + t.amount, 0);
    if (hourlyTotal + request.amount > policy.hourlyBudget) {
      blockReasons.push('EXCEEDS_HOURLY_BUDGET');
    }
  }

  // 4. UNFAMILIAR_RECIPIENT
  if (
    policy.trustedRecipients &&
    policy.trustedRecipients.length > 0 &&
    request.recipient
  ) {
    const trusted = policy.trustedRecipients.map((r) => r.toLowerCase());
    if (!trusted.includes(request.recipient.toLowerCase())) {
      blockReasons.push('UNFAMILIAR_RECIPIENT');
    }
  }

  // 5. BLOCKED_DOMAIN
  if (
    policy.blockedDomains &&
    policy.blockedDomains.length > 0 &&
    request.recipient
  ) {
    const domain = getDomain(request.recipient);
    if (domain) {
      const blocked = policy.blockedDomains.map((d) => d.toLowerCase());
      if (blocked.includes(domain)) {
        blockReasons.push('BLOCKED_DOMAIN');
      }
    }
  }

  // 6. SUSPICIOUS_PATTERN - same recipient 3+ times in 5 minutes
  if (request.recipient) {
    const fiveMinAgo = nowMs - FIVE_MINUTES;
    const recentSameRecipient = history.filter(
      (t) =>
        t.timestamp >= fiveMinAgo &&
        t.recipient?.toLowerCase() === request.recipient!.toLowerCase()
    );
    if (recentSameRecipient.length >= 2) {
      // 2 in history + this one = 3
      blockReasons.push('SUSPICIOUS_PATTERN');
    }
  }

  // 7. CURRENCY_MISMATCH
  if (
    policy.allowedCurrencies &&
    policy.allowedCurrencies.length > 0 &&
    request.currency
  ) {
    const allowed = policy.allowedCurrencies.map((c) => c.toUpperCase());
    if (!allowed.includes(request.currency.toUpperCase())) {
      blockReasons.push('CURRENCY_MISMATCH');
    }
  }

  // 8. RATE_LIMIT_EXCEEDED
  if (policy.maxRequestsPerMinute !== undefined) {
    const oneMinAgo = nowMs - ONE_MINUTE;
    const recentCount = history.filter((t) => t.timestamp >= oneMinAgo).length;
    if (recentCount >= policy.maxRequestsPerMinute) {
      blockReasons.push('RATE_LIMIT_EXCEEDED');
    }
  }

  // 9. ABOVE_ESCALATION_THRESHOLD
  if (policy.askMeAbove !== undefined && request.amount > policy.askMeAbove) {
    escalateReasons.push('ABOVE_ESCALATION_THRESHOLD');
  }

  // 10. OUTSIDE_OPERATING_HOURS
  if (policy.operatingHours) {
    if (isOutsideOperatingHours(policy.operatingHours, now)) {
      blockReasons.push('OUTSIDE_OPERATING_HOURS');
    }
  }

  // Determine decision
  let decision: Decision;
  let reasons: PolicyReason[];
  let message: string;

  if (blockReasons.length > 0) {
    decision = 'BLOCK';
    reasons = blockReasons;
    message = `Payment blocked: ${blockReasons.join(', ')}`;
  } else if (escalateReasons.length > 0) {
    decision = 'ESCALATE';
    reasons = escalateReasons;
    message = `Payment requires approval: ${escalateReasons.join(', ')}`;
  } else {
    decision = 'ALLOW';
    reasons = [];
    message = 'Payment allowed';
  }

  // Record transaction in history (even blocked ones, for pattern detection)
  history.push({
    amount: request.amount,
    recipient: request.recipient,
    timestamp: nowMs,
  });

  return {
    decision,
    reasons,
    message,
    request,
    timestamp: now,
  };
}

/** Reset transaction history - useful for testing */
export function _resetHistory(): void {
  history.length = 0;
}

/** Inject a transaction record - useful for testing */
export function _addToHistory(
  amount: number,
  recipient?: string,
  timestamp?: number
): void {
  history.push({
    amount,
    recipient,
    timestamp: timestamp ?? Date.now(),
  });
}

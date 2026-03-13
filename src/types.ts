export type Decision = 'ALLOW' | 'BLOCK' | 'ESCALATE';

export type PolicyReason =
  | 'EXCEEDS_SINGLE_LIMIT'
  | 'EXCEEDS_DAILY_BUDGET'
  | 'EXCEEDS_HOURLY_BUDGET'
  | 'UNFAMILIAR_RECIPIENT'
  | 'BLOCKED_DOMAIN'
  | 'SUSPICIOUS_PATTERN'
  | 'CURRENCY_MISMATCH'
  | 'RATE_LIMIT_EXCEEDED'
  | 'ABOVE_ESCALATION_THRESHOLD'
  | 'OUTSIDE_OPERATING_HOURS'
  | 'AMOUNT_ZERO_OR_NEGATIVE'
  | 'POLICY_EXPIRED';

export interface OperatingHours {
  start: string;
  end: string;
  timezone?: string;
}

export interface Policy {
  maxSingle?: number;
  dailyBudget?: number;
  hourlyBudget?: number;
  askMeAbove?: number;
  trustedRecipients?: string[];
  blockedDomains?: string[];
  allowedCurrencies?: string[];
  maxRequestsPerMinute?: number;
  operatingHours?: OperatingHours;
  expiresAt?: Date;
}

export interface PaymentRequest {
  amount: number;
  currency?: string;
  recipient?: string;
  metadata?: Record<string, unknown>;
}

export interface Verdict {
  decision: Decision;
  reasons: PolicyReason[];
  message: string;
  request: PaymentRequest;
  timestamp: Date;
}

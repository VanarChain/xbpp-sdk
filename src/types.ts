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
  | 'POLICY_EXPIRED'
  | 'DACS_MANDATE_CEILING_EXCEEDED'
  | 'DACS_SUBMANDATE_ATTENUATION_VIOLATION';

export interface DacsMandateMeta {
  /** Signed DACS mandate identifier or URI. */
  dacsMandate?: string;
  /** Active DACS session identifier. */
  dacsSessionId?: string;
  /** Hard authorized spend ceiling. */
  dacsMaxAmount?: number | string | bigint;
  /** Optional parent manager mandate ceiling for hierarchical swarm attenuation. */
  dacsParentMaxAmount?: number | string | bigint;
}

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
  /** Optional policy-level DACS mandate guardrail (§9.5.7 & §14.4). */
  dacs?: DacsMandateMeta;
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

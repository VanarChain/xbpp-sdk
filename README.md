# @vanar/xbpp

[![npm version](https://img.shields.io/npm/v/@vanar/xbpp.svg)](https://www.npmjs.com/package/@vanar/xbpp)
[![CI](https://github.com/VanarChain/xbpp-sdk/actions/workflows/ci.yml/badge.svg)](https://github.com/VanarChain/xbpp-sdk/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

**xBPP - Execution Boundary Permission Protocol** for AI agent payments.

A policy engine that evaluates every payment request against 12 configurable checks and returns `ALLOW`, `BLOCK`, or `ESCALATE`.

> **Status: Beta** - This package is `0.1.0-beta.1`. The API may change before `1.0.0`.



## Install

```bash
npm install @vanar/xbpp
```

## Quick Start

```typescript
import { evaluate, balanced } from '@vanar/xbpp';

// API call
const v1 = await evaluate(
  { amount: 25, currency: 'USD', recipient: 'api.openai.com' },
  balanced
);

// On-chain transfer
const v2 = await evaluate(
  { amount: 500, currency: 'USDC', recipient: '0x1a2b...3c4d' },
  balanced
);

// SaaS subscription
const v3 = await evaluate(
  { amount: 99, currency: 'USD', recipient: 'billing.vercel.com' },
  balanced
);

// Handle the verdict
if (v1.decision === 'ALLOW') {
  // proceed with payment
} else if (v1.decision === 'ESCALATE') {
  // ask the user for approval
} else {
  // payment blocked - verdict.reasons explains why
  console.log(v1.message);
}
```

## The 12 Policy Checks

| # | Check | Triggers |
|---|-------|----------|
| 1 | `EXCEEDS_SINGLE_LIMIT` | Amount > `policy.maxSingle` |
| 2 | `EXCEEDS_DAILY_BUDGET` | Running daily total would exceed `policy.dailyBudget` |
| 3 | `EXCEEDS_HOURLY_BUDGET` | Running hourly total would exceed `policy.hourlyBudget` |
| 4 | `UNFAMILIAR_RECIPIENT` | Recipient not in `policy.trustedRecipients` |
| 5 | `BLOCKED_DOMAIN` | Recipient domain in `policy.blockedDomains` |
| 6 | `SUSPICIOUS_PATTERN` | Same recipient 3+ times in 5 minutes |
| 7 | `CURRENCY_MISMATCH` | Currency not in `policy.allowedCurrencies` |
| 8 | `RATE_LIMIT_EXCEEDED` | More than `policy.maxRequestsPerMinute` in last 60s |
| 9 | `ABOVE_ESCALATION_THRESHOLD` | Amount > `policy.askMeAbove` (returns ESCALATE, not BLOCK) |
| 10 | `OUTSIDE_OPERATING_HOURS` | Current time outside `policy.operatingHours` |
| 11 | `AMOUNT_ZERO_OR_NEGATIVE` | Amount <= 0 |
| 12 | `POLICY_EXPIRED` | `policy.expiresAt` has passed |

## Policy Presets

```typescript
import { aggressive, balanced, riskAverse } from '@vanar/xbpp';
```

| Preset | maxSingle | dailyBudget | hourlyBudget | askMeAbove | maxReq/min |
|--------|-----------|-------------|--------------|------------|------------|
| `aggressive` | 10,000 | 100,000 | 50,000 | 50,000 | 100 |
| `balanced` | 100 | 1,000 | 200 | 500 | 20 |
| `riskAverse` | 10 | 50 | 20 | 5 | 5 |

## Custom Policy

```typescript
import { evaluate } from '@vanar/xbpp';
import type { Policy } from '@vanar/xbpp';

const myPolicy: Policy = {
  maxSingle: 50,
  dailyBudget: 500,
  hourlyBudget: 100,
  askMeAbove: 25,
  trustedRecipients: ['api.openai.com', 'api.anthropic.com'],
  blockedDomains: ['evil.com'],
  allowedCurrencies: ['USD', 'USDC'],
  maxRequestsPerMinute: 30,
  operatingHours: { start: '09:00', end: '17:00', timezone: 'America/New_York' },
  expiresAt: new Date('2025-12-31'),
};

const verdict = await evaluate({ amount: 10, currency: 'USD' }, myPolicy);
```

## Wrapping Fetch

Intercept outgoing HTTP calls that carry x402 payment headers:

```typescript
import { wrap, balanced } from '@vanar/xbpp';

const safeFetch = wrap(fetch, balanced);

// This will be evaluated against the policy before executing
await safeFetch('https://api.example.com/data', {
  headers: {
    'X-Payment': JSON.stringify({ amount: 10, currency: 'USD', recipient: 'api.example.com' }),
  },
});
```

## Error Handling

```typescript
import { evaluate, BlockedError, EscalateError, balanced } from '@vanar/xbpp';

try {
  const verdict = await evaluate({ amount: 200 }, balanced);

  if (verdict.decision === 'BLOCK') {
    throw new BlockedError(verdict);
  }

  if (verdict.decision === 'ESCALATE') {
    const err = new EscalateError(verdict, {
      onApprove: async () => { /* proceed */ },
      onDeny: () => { /* cancel */ },
    });
    // Present to user for decision
    throw err;
  }
} catch (err) {
  if (err instanceof BlockedError) {
    console.error('Blocked:', err.verdict.reasons);
  }
  if (err instanceof EscalateError) {
    // Ask user, then call err.onApprove() or err.onDeny()
  }
}
```

## Types

```typescript
type Decision = 'ALLOW' | 'BLOCK' | 'ESCALATE';

interface Policy {
  maxSingle?: number;
  dailyBudget?: number;
  hourlyBudget?: number;
  askMeAbove?: number;
  trustedRecipients?: string[];
  blockedDomains?: string[];
  allowedCurrencies?: string[];
  maxRequestsPerMinute?: number;
  operatingHours?: { start: string; end: string; timezone?: string };
  expiresAt?: Date;
}

interface PaymentRequest {
  amount: number;
  currency?: string;
  recipient?: string;
  metadata?: Record<string, unknown>;
}

interface Verdict {
  decision: Decision;
  reasons: PolicyReason[];
  message: string;
  request: PaymentRequest;
  timestamp: Date;
}
```

## Architecture Notes

**Transaction history is process-scoped.** The evaluator maintains an in-memory transaction history array at the module level. All agents running in the same Node.js process share rate-limit and budget tracking. This is by design for single-agent use cases (CLIs, edge functions, embedded agents).

For multi-tenant or multi-agent servers, isolate each agent in its own process or worker.

## Documentation

Full specification, architecture guides, and interactive examples are available at [xbpp.org](https://xbpp.org).

- [Quick Start](https://xbpp.org/docs/quick-start)
- [Core Concepts](https://xbpp.org/docs/concepts)
- [Architecture](https://xbpp.org/docs/architecture)
- [API Reference](https://xbpp.org/docs/sdk/api-reference)
- [Full Specification](https://xbpp.org/spec)

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development setup, testing, and contribution guidelines.

## License

MIT - see [LICENSE](./LICENSE) for details.

---

**[xbpp.org](https://xbpp.org)** - The open standard for agent transaction governance.

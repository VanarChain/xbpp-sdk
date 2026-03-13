/**
 * xBPP SDK - Hands-On Playground
 *
 * Run: npx tsx examples/playground/index.ts
 *
 * This walks you through every check the evaluator performs,
 * one at a time, so you can see exactly what triggers each verdict.
 */

import { evaluate, _resetHistory, _addToHistory } from '../../src/evaluator';
import type { Policy, PaymentRequest, Verdict } from '../../src/types';
import { wrap } from '../../src/wrapper';
import { BlockedError, EscalateError } from '../../src/errors';

// ─── Helpers ───────────────────────────────────────────────

function header(title: string) {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  ${title}`);
  console.log(`${'═'.repeat(60)}`);
}

function subheader(title: string) {
  console.log(`\n  ── ${title} ${'─'.repeat(Math.max(0, 50 - title.length))}`);
}

function printVerdict(v: Verdict) {
  const icon = v.decision === 'ALLOW' ? '✅' : v.decision === 'BLOCK' ? '🛑' : '⏸️';
  console.log(`     ${icon} Decision: ${v.decision}`);
  if (v.reasons.length > 0) {
    console.log(`     Reasons:  ${v.reasons.join(', ')}`);
  }
  console.log(`     Message:  ${v.message}`);
}

async function test(label: string, request: PaymentRequest, policy: Policy) {
  console.log(`\n  → ${label}`);
  console.log(`     Request:  $${request.amount} ${request.currency || 'USD'} → ${request.recipient || '(no recipient)'}`);
  const verdict = await evaluate(request, policy);
  printVerdict(verdict);
  return verdict;
}

// ─── Start ─────────────────────────────────────────────────

async function main() {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║       @vanar/xbpp - Under The Hood Playground        ║
║                                                            ║
║  Each section triggers ONE specific check so you can see   ║
║  exactly what the evaluator does at each step.             ║
╚════════════════════════════════════════════════════════════╝`);

  // ─────────────────────────────────────────────────────────
  // CHECK 1: Single transaction limit
  // ─────────────────────────────────────────────────────────
  header('CHECK 1: EXCEEDS_SINGLE_LIMIT');
  console.log('  Policy: maxSingle = $100');
  console.log('  What it does: Blocks any single payment above the limit.');
  _resetHistory();

  const singlePolicy: Policy = { maxSingle: 100 };

  await test('$50 payment (under limit)', { amount: 50 }, singlePolicy);
  await test('$100 payment (at limit)', { amount: 100 }, singlePolicy);
  await test('$101 payment (over limit)', { amount: 101 }, singlePolicy);

  // ─────────────────────────────────────────────────────────
  // CHECK 2: Daily budget (cumulative)
  // ─────────────────────────────────────────────────────────
  header('CHECK 2: EXCEEDS_DAILY_BUDGET');
  console.log('  Policy: dailyBudget = $200');
  console.log('  What it does: Tracks all payments in last 24h.');
  console.log('  Blocks when cumulative total would exceed budget.');
  _resetHistory();

  const dailyPolicy: Policy = { dailyBudget: 200 };

  await test('$80 payment (first of day)', { amount: 80 }, dailyPolicy);
  await test('$80 payment (running total: $160)', { amount: 80 }, dailyPolicy);
  await test('$50 payment (would push to $210 - over $200)', { amount: 50 }, dailyPolicy);

  // ─────────────────────────────────────────────────────────
  // CHECK 3: Hourly budget
  // ─────────────────────────────────────────────────────────
  header('CHECK 3: EXCEEDS_HOURLY_BUDGET');
  console.log('  Policy: hourlyBudget = $50');
  console.log('  What it does: Same as daily but 1-hour rolling window.');
  _resetHistory();

  const hourlyPolicy: Policy = { hourlyBudget: 50 };

  await test('$30 payment', { amount: 30 }, hourlyPolicy);
  await test('$25 payment (would push to $55 - over $50)', { amount: 25 }, hourlyPolicy);

  // ─────────────────────────────────────────────────────────
  // CHECK 4: Unfamiliar recipient
  // ─────────────────────────────────────────────────────────
  header('CHECK 4: UNFAMILIAR_RECIPIENT');
  console.log('  Policy: trustedRecipients = [api.trusted.com, api.safe.io]');
  console.log('  What it does: If a trust list exists, blocks any recipient NOT on it.');
  _resetHistory();

  const trustPolicy: Policy = {
    trustedRecipients: ['api.trusted.com', 'api.safe.io'],
  };

  await test('Payment to trusted recipient', { amount: 10, recipient: 'api.trusted.com' }, trustPolicy);
  await test('Payment to unknown recipient', { amount: 10, recipient: 'api.shady.xyz' }, trustPolicy);

  // ─────────────────────────────────────────────────────────
  // CHECK 5: Blocked domains
  // ─────────────────────────────────────────────────────────
  header('CHECK 5: BLOCKED_DOMAIN');
  console.log('  Policy: blockedDomains = [casino.com, darkmarket.io]');
  console.log('  What it does: Extracts domain from recipient URL/email, blocks if on list.');
  _resetHistory();

  const domainPolicy: Policy = {
    blockedDomains: ['casino.com', 'darkmarket.io'],
  };

  await test('Payment to normal site', { amount: 10, recipient: 'https://api.legit.com/pay' }, domainPolicy);
  await test('Payment to blocked domain', { amount: 10, recipient: 'https://casino.com/api' }, domainPolicy);
  await test('Payment to blocked email domain', { amount: 10, recipient: 'payments@darkmarket.io' }, domainPolicy);

  // ─────────────────────────────────────────────────────────
  // CHECK 6: Suspicious pattern detection
  // ─────────────────────────────────────────────────────────
  header('CHECK 6: SUSPICIOUS_PATTERN');
  console.log('  Policy: (no config needed - always active)');
  console.log('  What it does: Blocks if 3+ payments to same recipient in 5 minutes.');
  console.log('  This catches rapid drain attacks.');
  _resetHistory();

  const patternPolicy: Policy = {};

  await test('1st payment to api.target.com', { amount: 5, recipient: 'api.target.com' }, patternPolicy);
  await test('2nd payment to api.target.com', { amount: 5, recipient: 'api.target.com' }, patternPolicy);
  await test('3rd payment to api.target.com (triggers!)', { amount: 5, recipient: 'api.target.com' }, patternPolicy);
  await test('Payment to DIFFERENT recipient (fine)', { amount: 5, recipient: 'api.other.com' }, patternPolicy);

  // ─────────────────────────────────────────────────────────
  // CHECK 7: Currency mismatch
  // ─────────────────────────────────────────────────────────
  header('CHECK 7: CURRENCY_MISMATCH');
  console.log('  Policy: allowedCurrencies = [USD, USDC]');
  console.log('  What it does: Only allows payments in approved currencies.');
  _resetHistory();

  const currencyPolicy: Policy = {
    allowedCurrencies: ['USD', 'USDC'],
  };

  await test('$10 USDC payment', { amount: 10, currency: 'USDC' }, currencyPolicy);
  await test('$10 ETH payment (not allowed)', { amount: 10, currency: 'ETH' }, currencyPolicy);

  // ─────────────────────────────────────────────────────────
  // CHECK 8: Rate limiting
  // ─────────────────────────────────────────────────────────
  header('CHECK 8: RATE_LIMIT_EXCEEDED');
  console.log('  Policy: maxRequestsPerMinute = 3');
  console.log('  What it does: Blocks if too many requests in 60-second window.');
  _resetHistory();

  const ratePolicy: Policy = { maxRequestsPerMinute: 3 };

  await test('Request 1 of 3', { amount: 1 }, ratePolicy);
  await test('Request 2 of 3', { amount: 1 }, ratePolicy);
  await test('Request 3 of 3', { amount: 1 }, ratePolicy);
  await test('Request 4 - rate limited!', { amount: 1 }, ratePolicy);

  // ─────────────────────────────────────────────────────────
  // CHECK 9: Escalation threshold (ESCALATE, not BLOCK)
  // ─────────────────────────────────────────────────────────
  header('CHECK 9: ABOVE_ESCALATION_THRESHOLD');
  console.log('  Policy: askMeAbove = $500');
  console.log('  What it does: Returns ESCALATE (not BLOCK) - asks human to approve.');
  console.log('  Key difference: BLOCK = hard stop. ESCALATE = pause for approval.');
  _resetHistory();

  const escalatePolicy: Policy = { askMeAbove: 500 };

  await test('$200 payment (under threshold)', { amount: 200 }, escalatePolicy);
  await test('$600 payment (needs human approval)', { amount: 600 }, escalatePolicy);

  // ─────────────────────────────────────────────────────────
  // CHECK 10: Zero/negative amounts
  // ─────────────────────────────────────────────────────────
  header('CHECK 10: AMOUNT_ZERO_OR_NEGATIVE');
  console.log('  Policy: (always active)');
  console.log('  What it does: Blocks zero or negative payment amounts.');
  _resetHistory();

  await test('$0 payment', { amount: 0 }, {});
  await test('-$50 payment', { amount: -50 }, {});

  // ─────────────────────────────────────────────────────────
  // CHECK 11: Policy expiration
  // ─────────────────────────────────────────────────────────
  header('CHECK 11: POLICY_EXPIRED');
  console.log('  What it does: Blocks ALL payments if the policy has expired.');
  _resetHistory();

  const expiredPolicy: Policy = {
    expiresAt: new Date('2025-01-01'),
  };
  const validPolicy: Policy = {
    expiresAt: new Date('2030-01-01'),
  };

  await test('Payment with expired policy', { amount: 10 }, expiredPolicy);
  await test('Payment with valid policy', { amount: 10 }, validPolicy);

  // ─────────────────────────────────────────────────────────
  // CHECK 12: Operating hours
  // ─────────────────────────────────────────────────────────
  header('CHECK 12: OUTSIDE_OPERATING_HOURS');
  console.log('  What it does: Blocks payments outside business hours.');
  _resetHistory();

  const now = new Date();
  const currentHour = now.getHours();

  // Create a window that EXCLUDES current time
  const outsidePolicy: Policy = {
    operatingHours: {
      start: `${String((currentHour + 2) % 24).padStart(2, '0')}:00`,
      end: `${String((currentHour + 4) % 24).padStart(2, '0')}:00`,
    },
  };
  // Create a window that INCLUDES current time
  const insidePolicy: Policy = {
    operatingHours: {
      start: `${String((currentHour - 1 + 24) % 24).padStart(2, '0')}:00`,
      end: `${String((currentHour + 2) % 24).padStart(2, '0')}:00`,
    },
  };

  console.log(`  Current time: ${now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })}`);
  console.log(`  Outside window: ${outsidePolicy.operatingHours!.start} - ${outsidePolicy.operatingHours!.end}`);
  console.log(`  Inside window:  ${insidePolicy.operatingHours!.start} - ${insidePolicy.operatingHours!.end}`);

  await test('Payment outside operating hours', { amount: 10 }, outsidePolicy);
  await test('Payment during operating hours', { amount: 10 }, insidePolicy);

  // ─────────────────────────────────────────────────────────
  // DECISION PRIORITY: BLOCK beats ESCALATE
  // ─────────────────────────────────────────────────────────
  header('DECISION PRIORITY: BLOCK > ESCALATE > ALLOW');
  console.log('  What happens when multiple checks fire?');
  console.log('  BLOCK always wins over ESCALATE.');
  _resetHistory();

  const comboPolicy: Policy = {
    maxSingle: 100,
    askMeAbove: 50,
  };

  await test('$30 (under both)', { amount: 30 }, comboPolicy);
  await test('$75 (over escalation, under single limit → ESCALATE)', { amount: 75 }, comboPolicy);
  await test('$150 (over both → BLOCK wins)', { amount: 150 }, comboPolicy);

  // ─────────────────────────────────────────────────────────
  // BONUS: wrap() - x402 fetch interceptor
  // ─────────────────────────────────────────────────────────
  header('BONUS: wrap() - How the x402 interceptor works');
  console.log('  wrap() takes a fetch function and a policy.');
  console.log('  It reads X-Payment headers and evaluates BEFORE the request fires.');
  _resetHistory();

  const wrapPolicy: Policy = { maxSingle: 50 };

  // Mock fetch that just returns success
  const mockFetch = async (url: string) => {
    return { status: 200, body: `Response from ${url}` };
  };

  const protectedFetch = wrap(mockFetch as any, wrapPolicy) as any;

  subheader('No payment headers → pass-through');
  try {
    const res = await protectedFetch('https://api.example.com/free', {
      headers: {},
    });
    console.log(`     ✅ Pass-through: ${JSON.stringify(res)}`);
  } catch (e: any) {
    console.log(`     ❌ ${e.message}`);
  }

  subheader('X-Payment header with $20 → ALLOW');
  try {
    const res = await protectedFetch('https://api.example.com/paid', {
      headers: { 'X-Payment': JSON.stringify({ amount: 20, currency: 'USD', recipient: 'api.example.com' }) },
    });
    console.log(`     ✅ Payment allowed: ${JSON.stringify(res)}`);
  } catch (e: any) {
    console.log(`     ❌ ${e.message}`);
  }

  subheader('X-Payment header with $200 → BLOCK (throws BlockedError)');
  try {
    await protectedFetch('https://api.example.com/expensive', {
      headers: { 'X-Payment': JSON.stringify({ amount: 200, currency: 'USD', recipient: 'api.example.com' }) },
    });
    console.log('     ✅ (should not reach here)');
  } catch (e: any) {
    if (e instanceof BlockedError) {
      console.log(`     🛑 BlockedError caught!`);
      console.log(`        Reasons: ${e.reasons.join(', ')}`);
      console.log(`        Verdict: ${JSON.stringify(e.verdict.decision)}`);
    } else {
      console.log(`     ❌ Unexpected: ${e.message}`);
    }
  }

  subheader('Individual X-Payment-Amount header → also works');
  _resetHistory();
  try {
    await protectedFetch('https://api.example.com/alt', {
      headers: {
        'X-Payment-Amount': '999',
        'X-Payment-Currency': 'USDC',
        'X-Payment-Recipient': 'api.example.com',
      },
    });
  } catch (e: any) {
    if (e instanceof BlockedError) {
      console.log(`     🛑 BlockedError: $999 blocked (maxSingle=$50)`);
      console.log(`        Reasons: ${e.reasons.join(', ')}`);
    }
  }

  // ─────────────────────────────────────────────────────────
  console.log(`
${'═'.repeat(60)}
  Done! You've seen every check the xBPP evaluator performs.

  The evaluation order:
    1.  AMOUNT_ZERO_OR_NEGATIVE  (always)
    2.  POLICY_EXPIRED           (if expiresAt set)
    3.  EXCEEDS_SINGLE_LIMIT     (if maxSingle set)
    4.  EXCEEDS_DAILY_BUDGET     (if dailyBudget set)
    5.  EXCEEDS_HOURLY_BUDGET    (if hourlyBudget set)
    6.  UNFAMILIAR_RECIPIENT     (if trustedRecipients set)
    7.  BLOCKED_DOMAIN           (if blockedDomains set)
    8.  SUSPICIOUS_PATTERN       (always - 3+ same recipient/5min)
    9.  CURRENCY_MISMATCH        (if allowedCurrencies set)
    10. RATE_LIMIT_EXCEEDED      (if maxRequestsPerMinute set)
    11. ABOVE_ESCALATION_THRESHOLD (if askMeAbove set → ESCALATE)
    12. OUTSIDE_OPERATING_HOURS  (if operatingHours set)

  Decision priority: BLOCK > ESCALATE > ALLOW
  All block reasons are collected (not short-circuited).
${'═'.repeat(60)}`);
}

main().catch(console.error);

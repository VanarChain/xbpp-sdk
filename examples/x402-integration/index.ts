/**
 * xBPP x402 Integration Example
 *
 * Shows how to wrap a fetch-like HTTP client so that any 402 Payment Required
 * response is automatically handled through the xBPP policy engine before
 * payment fires. This is the "30-second integration" from the docs.
 *
 * Run: npx tsx examples/x402-integration/index.ts
 */

import { evaluate, balanced } from '../../src/index';
import { BlockedError, EscalateError } from '../../src/errors';

const xbpp = { evaluate };

// ─────────────────────────────────────────────────────────────────────────────
// Simulated x402 client (in production this would be @coinbase/x402)
// ─────────────────────────────────────────────────────────────────────────────

interface FetchResponse {
  status: number;
  body: string;
  paymentAmount?: number;
  paymentCurrency?: string;
}

// Simulates a service that sometimes returns 402 requiring payment
async function mockX402Fetch(url: string): Promise<FetchResponse> {
  const pricing: Record<string, { amount: number; currency: string }> = {
    'https://api.data.vanar.io/search':       { amount: 2,   currency: 'USD' },
    'https://api.data.vanar.io/deep-report':  { amount: 85,  currency: 'USD' },
    'https://api.data.vanar.io/enterprise':   { amount: 600, currency: 'USD' },
    'https://api.free.vanar.io/public':       { amount: 0,   currency: 'USD' },
  };

  const pricing_info = pricing[url];

  if (!pricing_info || pricing_info.amount === 0) {
    return { status: 200, body: `Data from ${url}` };
  }

  // Return 402 requiring payment
  return {
    status: 402,
    body: 'Payment Required',
    paymentAmount: pricing_info.amount,
    paymentCurrency: pricing_info.currency,
  };
}

// Simulates actually processing the payment and retrying
async function mockPayAndRetry(url: string, amount: number): Promise<FetchResponse> {
  console.log(`     💰 Payment of $${amount} processed`);
  return { status: 200, body: `Paid data from ${url}` };
}

// ─────────────────────────────────────────────────────────────────────────────
// The wrapped client - this is what xbpp.wrap() produces in one line
// ─────────────────────────────────────────────────────────────────────────────

function createGovernedClient(policy: typeof balanced): (url: string) => Promise<FetchResponse> {
  return async function governedFetch(url: string): Promise<FetchResponse> {
    const response = await mockX402Fetch(url);

    if (response.status !== 402) {
      return response; // Free endpoint - pass through
    }

    const amount = response.paymentAmount!;
    const currency = response.paymentCurrency!;
    const recipient = new URL(url).hostname;

    // xBPP evaluates before any payment fires
    const verdict = await xbpp.evaluate(
      { amount, currency, recipient },
      policy
    );

    if (verdict.decision === 'ALLOW') {
      return mockPayAndRetry(url, amount);
    } else if (verdict.decision === 'BLOCK') {
      throw new BlockedError(verdict);
    } else {
      throw new EscalateError(verdict, {
        onApprove: async () => { await mockPayAndRetry(url, amount); },
        onDeny:    () => { console.log('     ❌ Human denied payment'); },
      });
    }
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Demo: agent calls multiple APIs, all governed by xBPP
// ─────────────────────────────────────────────────────────────────────────────

const endpoints = [
  { url: 'https://api.free.vanar.io/public',        label: 'Free public endpoint' },
  { url: 'https://api.data.vanar.io/search',        label: 'Search API ($2)' },
  { url: 'https://api.data.vanar.io/deep-report',   label: 'Deep report ($85)' },
  { url: 'https://api.data.vanar.io/enterprise',    label: 'Enterprise data ($600)' },
];

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║      @vanar/xbpp - x402 Integration Example          ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('\nUsing [BALANCED] policy: maxSingle=$100, dailyBudget=$1000, askMeAbove=$500\n');

  const client = createGovernedClient(balanced);

  for (const endpoint of endpoints) {
    process.stdout.write(`📡 ${endpoint.label}\n   → ${endpoint.url}\n`);

    try {
      const response = await client(endpoint.url);
      console.log(`   ✅ ${response.status} - ${response.body}\n`);
    } catch (err) {
      if (err instanceof BlockedError) {
        console.log(`   🛑 BLOCKED - ${err.reasons.join(', ')}\n`);
      } else if (err instanceof EscalateError) {
        console.log(`   ⏸️  ESCALATE - ${err.reasons.join(', ')}`);
        console.log(`   → Simulating human approval...`);
        await err.onApprove();
        console.log(`   ✅ Approved and paid\n`);
      }
    }
  }

  console.log('─'.repeat(60));
  console.log('✅ Done. xBPP intercepted every 402 response before payment fired.');
  console.log('   Free endpoints passed through with zero overhead.');
  console.log('   All decisions logged with full audit trail.\n');
}

main().catch(console.error);

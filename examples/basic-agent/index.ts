/**
 * xBPP Basic Agent Example
 *
 * Demonstrates an autonomous AI agent making payment decisions
 * governed by xBPP policy - no human in the loop unless escalation triggers.
 *
 * Run: npx tsx examples/basic-agent/index.ts
 */

import { evaluate, _resetHistory, balanced, riskAverse, aggressive } from '../../src/index';
import type { Policy } from '../../src/types';

// Convenience namespace matching the public API
const xbpp = { evaluate };

// ─────────────────────────────────────────────────────────────────────────────
// Simulated agent task: research task that needs to pay for data APIs
// ─────────────────────────────────────────────────────────────────────────────

interface DataPurchase {
  service: string;
  amount: number;
  currency: string;
  description: string;
}

async function runAgentWithPolicy(
  purchases: DataPurchase[],
  policyName: string,
  policy: Policy
) {
  // Reset history between policy runs so each is independent
  _resetHistory();

  console.log(`\n${'─'.repeat(60)}`);
  console.log(`🤖 Agent running with [${policyName.toUpperCase()}] policy`);
  console.log('─'.repeat(60));

  let totalSpent = 0;

  for (const purchase of purchases) {
    process.stdout.write(`\n  💳 ${purchase.description} ($${purchase.amount} ${purchase.currency})`);

    const verdict = await xbpp.evaluate(
      {
        amount: purchase.amount,
        currency: purchase.currency,
        recipient: purchase.service,
      },
      policy
    );

    if (verdict.decision === 'ALLOW') {
      totalSpent += purchase.amount;
      console.log(` → ✅ ALLOW`);
      console.log(`     Proceeding with payment to ${purchase.service}`);
    } else if (verdict.decision === 'BLOCK') {
      console.log(` → 🛑 BLOCK`);
      console.log(`     Reasons: ${verdict.reasons.join(', ')}`);
    } else if (verdict.decision === 'ESCALATE') {
      console.log(` → ⏸️  ESCALATE - human approval required`);
      console.log(`     Reasons: ${verdict.reasons.join(', ')}`);
      console.log(`     Agent paused - waiting for human sign-off`);
    }
  }

  console.log(`\n  📊 Total spent: $${totalSpent}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Test purchases - a mix of small, medium, and large payments
// ─────────────────────────────────────────────────────────────────────────────

const agentPurchases: DataPurchase[] = [
  {
    service: 'api.companysearch.com',
    amount: 2.50,
    currency: 'USD',
    description: 'Company registry lookup',
  },
  {
    service: 'api.courtrecords.io',
    amount: 45.00,
    currency: 'USD',
    description: 'Court records search',
  },
  {
    service: 'api.deepdata.ai',
    amount: 180.00,
    currency: 'USD',
    description: 'Deep background report',
  },
  {
    service: 'api.realtime-trading.com',
    amount: 750.00,
    currency: 'USD',
    description: 'Real-time market data subscription',
  },
  {
    service: 'casino-api.io',           // Blocked domain example
    amount: 10.00,
    currency: 'USD',
    description: 'Third-party data (blocked domain)',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Custom policy example - tailored for a specific use case
// ─────────────────────────────────────────────────────────────────────────────

const dueDiligencePolicy: Policy = {
  ...balanced,
  maxSingle: 200,
  dailyBudget: 500,
  askMeAbove: 150,
  trustedRecipients: [
    'api.companysearch.com',
    'api.courtrecords.io',
    'api.deepdata.ai',
  ],
  blockedDomains: ['casino-api.io', 'gambling.com', 'adult.io'],
  allowedCurrencies: ['USD', 'EUR', 'GBP'],
};

// ─────────────────────────────────────────────────────────────────────────────
// Run examples
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║         @vanar/xbpp - Working Example                ║');
  console.log('║         Execution Boundary Permission Protocol             ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  // 1. Risk-Averse agent (cautious - human approval for almost everything)
  await runAgentWithPolicy(agentPurchases, 'risk-averse', riskAverse);

  // 2. Balanced agent (sensible defaults)
  await runAgentWithPolicy(agentPurchases, 'balanced', balanced);

  // 3. Aggressive agent (high autonomy)
  await runAgentWithPolicy(agentPurchases, 'aggressive', aggressive);

  // 4. Custom due-diligence policy
  await runAgentWithPolicy(agentPurchases, 'due-diligence (custom)', dueDiligencePolicy);

  console.log('\n\n✅ Example complete. See above for how each policy governs the same payments differently.\n');
}

main().catch(console.error);

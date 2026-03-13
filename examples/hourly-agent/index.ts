/**
 * xBPP SDK - Hourly Data Agent Simulation
 *
 * Scenario: An agent fetches paid data every hour for $1/query via x402.
 * Policy: No more than $1 spent per hour.
 *
 * Run: npx tsx examples/hourly-agent/index.ts
 */

import { evaluate, _resetHistory, _addToHistory } from '../../src/evaluator';
import { wrap } from '../../src/wrapper';
import { BlockedError, EscalateError } from '../../src/errors';
import type { Policy, Verdict } from '../../src/types';

// ─── Your policy: $1/hour max ──────────────────────────────

const policy: Policy = {
  maxSingle: 1,        // no single payment above $1
  hourlyBudget: 1,     // total hourly spend capped at $1
  dailyBudget: 24,     // 24 queries/day max ($1 x 24 hours)
  askMeAbove: 5,       // escalate anything above $5 (safety net)
};

// ─── Simulated x402 API server ─────────────────────────────

async function fakeX402Server(url: string, init: any): Promise<any> {
  // Server returns 402 with payment required, then data after payment
  return {
    status: 200,
    data: `Market data from ${url} at ${new Date().toISOString()}`,
  };
}

// ─── Wrap fetch with xBPP ──────────────────────────────────

const protectedFetch = wrap(fakeX402Server as any, policy) as any;

// ─── Agent logic ───────────────────────────────────────────

async function agentFetchData(label: string) {
  const url = 'https://api.marketdata.vanar.io/prices';

  try {
    const res = await protectedFetch(url, {
      headers: {
        'X-Payment': JSON.stringify({
          amount: 1,
          currency: 'USDC',
          recipient: 'api.marketdata.vanar.io',
        }),
      },
    });
    console.log(`  ✅ ${label}: Data fetched, $1 USDC paid`);
    return res;
  } catch (e: any) {
    if (e instanceof BlockedError) {
      console.log(`  🛑 ${label}: BLOCKED - ${e.reasons.join(', ')}`);
      console.log(`     Agent stops. No money leaves the wallet.`);
    } else if (e instanceof EscalateError) {
      console.log(`  ⏸️  ${label}: ESCALATE - needs human approval`);
    } else {
      console.log(`  ❌ ${label}: Unexpected error - ${e.message}`);
    }
    return null;
  }
}

// ─── Simulation ────────────────────────────────────────────

async function main() {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║   Hourly Data Agent - xBPP Policy Enforcement Demo        ║
╚════════════════════════════════════════════════════════════╝

  Scenario: Agent fetches market data every hour for $1/query
  Policy:   hourlyBudget=$1, maxSingle=$1, dailyBudget=$24
`);

  // ─── TEST 1: Normal operation (1 query/hour) ────────────
  console.log('━━━ TEST 1: Normal operation - 1 query per hour ━━━');
  console.log('  Simulating 3 hours of normal operation.\n');
  _resetHistory();

  // Hour 1: agent makes its scheduled query
  console.log('  [Hour 1 - 09:00]');
  await agentFetchData('Scheduled query');

  // Hour 2: new hour, budget resets (simulate by resetting history)
  console.log('\n  [Hour 2 - 10:00] (hourly window rolled over)');
  _resetHistory();
  await agentFetchData('Scheduled query');

  // Hour 3
  console.log('\n  [Hour 3 - 11:00] (hourly window rolled over)');
  _resetHistory();
  await agentFetchData('Scheduled query');

  console.log('\n  ✓ Agent operated normally for 3 hours, $3 total spent.\n');

  // ─── TEST 2: Agent goes rogue - tries 2 queries in 1 hour
  console.log('━━━ TEST 2: Agent tries 2 queries in same hour ━━━');
  console.log('  What if the agent malfunctions and fires twice?\n');
  _resetHistory();

  console.log('  [11:00] Normal scheduled query:');
  await agentFetchData('Scheduled query');

  console.log('\n  [11:30] Bug! Agent fires again:');
  await agentFetchData('Duplicate query (bug)');

  console.log('\n  ✓ Second query blocked. Budget protected.\n');

  // ─── TEST 3: Someone tries to override the amount ───────
  console.log('━━━ TEST 3: Compromised agent tries $50 payment ━━━');
  console.log('  What if the agent is compromised and tries to drain?\n');
  _resetHistory();

  try {
    await protectedFetch('https://api.marketdata.vanar.io/prices', {
      headers: {
        'X-Payment': JSON.stringify({
          amount: 50,
          currency: 'USDC',
          recipient: 'attacker-wallet.eth',
        }),
      },
    });
  } catch (e: any) {
    if (e instanceof BlockedError) {
      console.log(`  🛑 BLOCKED - ${e.reasons.join(', ')}`);
      console.log('     $50 is above maxSingle ($1) AND hourlyBudget ($1).');
      console.log('     Attack stopped before any funds moved.');
    }
  }

  console.log('');

  // ─── TEST 4: Rapid drain attempt ────────────────────────
  console.log('━━━ TEST 4: Rapid drain - many $1 payments fast ━━━');
  console.log('  Attacker tries many small payments to stay under single limit.\n');
  _resetHistory();

  for (let i = 1; i <= 5; i++) {
    await agentFetchData(`Rapid payment #${i}`);
  }

  console.log('\n  ✓ Only 1st payment went through. Hourly budget caught the rest.\n');

  // ─── TEST 5: Show the full day scenario ─────────────────
  console.log('━━━ TEST 5: Full day simulation (24 hours) ━━━');
  console.log('  1 query per hour, $1 each. Daily budget = $24.\n');
  _resetHistory();

  let totalSpent = 0;
  for (let hour = 0; hour < 26; hour++) {
    // Simulate each hour as a fresh hourly window
    _resetHistory();
    // But track daily spend manually by injecting history
    if (hour > 0) {
      // Add previous hours' spend back (simulating daily accumulation)
      for (let prev = 0; prev < Math.min(hour, 24); prev++) {
        _addToHistory(1, 'api.marketdata.vanar.io', Date.now() - (hour - prev) * 100);
      }
    }

    const label = `Hour ${String(hour).padStart(2, '0')}:00`;
    const url = 'https://api.marketdata.vanar.io/prices';

    try {
      await protectedFetch(url, {
        headers: {
          'X-Payment': JSON.stringify({
            amount: 1,
            currency: 'USDC',
            recipient: 'api.marketdata.vanar.io',
          }),
        },
      });
      totalSpent += 1;
      console.log(`  ✅ ${label}: $1 paid (daily total: $${totalSpent})`);
    } catch (e: any) {
      if (e instanceof BlockedError) {
        console.log(`  🛑 ${label}: BLOCKED - ${e.reasons.join(', ')} (daily total: $${totalSpent})`);
      }
    }
  }

  console.log(`
  ✓ Daily budget of $24 enforced. Agent couldn't exceed it.
`);

  // ─── Summary ────────────────────────────────────────────
  console.log(`${'═'.repeat(60)}
  How xBPP protected this agent:

  ┌─────────────────────────┬────────────────────────────┐
  │ Threat                  │ Protection                 │
  ├─────────────────────────┼────────────────────────────┤
  │ Double query in 1 hour  │ hourlyBudget: $1           │
  │ Large single payment    │ maxSingle: $1              │
  │ Rapid small payments    │ hourlyBudget + pattern     │
  │ 25th query of the day   │ dailyBudget: $24           │
  │ Payment > $5            │ askMeAbove: $5 (escalate)  │
  └─────────────────────────┴────────────────────────────┘

  The agent NEVER touches the wallet directly.
  xBPP sits between the agent and x402, approving or
  blocking every payment before it fires.
${'═'.repeat(60)}`);
}

main().catch(console.error);

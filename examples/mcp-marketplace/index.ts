/**
 * xBPP + MCP Marketplace - Policy Enforcement Demo
 *
 * Scenario: Claude (AI agent) browses a skill marketplace and wants to
 * buy skills. xBPP enforces: max $1 per skill, 1 purchase per minute.
 *
 * Run: npx tsx examples/mcp-marketplace/index.ts
 */

import { evaluate, _resetHistory, _addToHistory } from '../../src/evaluator';
import { BlockedError } from '../../src/errors';
import type { Policy, Verdict } from '../../src/types';

// ─── Mock Marketplace (simulates MCP acquire_skill) ────────

interface SkillListing {
  id: number;
  name: string;
  price: number;
  currency: string;
  seller: string;
  domain: string;
}

const MARKETPLACE_CATALOG: SkillListing[] = [
  { id: 1, name: 'React Best Practices',     price: 0.50, currency: 'USDC', seller: 'devskills.io',       domain: 'react' },
  { id: 2, name: 'Python Data Pipelines',    price: 0.75, currency: 'USDC', seller: 'pymaster.dev',       domain: 'python' },
  { id: 3, name: 'AWS Architecture Patterns', price: 1.00, currency: 'USDC', seller: 'cloudpro.io',       domain: 'devops' },
  { id: 4, name: 'Enterprise AI Toolkit',    price: 5.00, currency: 'USDC', seller: 'premium-skills.com', domain: 'ai' },
  { id: 5, name: 'Solidity Exploits 101',    price: 0.25, currency: 'USDC', seller: 'shady-skills.xyz',   domain: 'security' },
  { id: 6, name: 'Go Microservices',         price: 0.60, currency: 'USDC', seller: 'godev.io',           domain: 'golang' },
];

/**
 * Simulates: mcp__inflectiv__inflectiv_acquire_skill({ listing_id })
 * In production, this would be the actual MCP tool call.
 */
async function mcpAcquireSkill(listingId: number): Promise<{ success: boolean; skill: SkillListing }> {
  const skill = MARKETPLACE_CATALOG.find(s => s.id === listingId);
  if (!skill) throw new Error(`Skill ${listingId} not found`);

  // Simulate network delay
  await new Promise(r => setTimeout(r, 50));

  return { success: true, skill };
}

// ─── xBPP-Protected Marketplace Client ─────────────────────

const AGENT_POLICY: Policy = {
  maxSingle: 1,                // no skill above $1
  hourlyBudget: 5,             // $5/hour total
  maxRequestsPerMinute: 1,     // 1 purchase per minute
  blockedDomains: ['shady-skills.xyz'],  // block sketchy sellers
};

/**
 * This is the key function: xBPP sits between the agent and the MCP call.
 *
 *   Agent intent → xBPP evaluate() → ALLOW? → MCP acquire_skill()
 *                                   → BLOCK? → Stop. No credits spent.
 */
async function protectedAcquireSkill(listingId: number): Promise<{
  acquired: boolean;
  verdict: Verdict;
  skill?: SkillListing;
}> {
  const skill = MARKETPLACE_CATALOG.find(s => s.id === listingId);
  if (!skill) throw new Error(`Skill ${listingId} not found in catalog`);

  // Step 1: xBPP evaluates the purchase BEFORE any MCP call
  const verdict = await evaluate(
    {
      amount: skill.price,
      currency: skill.currency,
      recipient: skill.seller,
    },
    AGENT_POLICY
  );

  // Step 2: Act on the verdict
  if (verdict.decision === 'BLOCK') {
    // Purchase NEVER reaches the marketplace
    return { acquired: false, verdict };
  }

  if (verdict.decision === 'ESCALATE') {
    // In production: pause and ask human. Here we just log it.
    return { acquired: false, verdict };
  }

  // Step 3: ALLOW - now we call the actual MCP tool
  const result = await mcpAcquireSkill(listingId);
  return { acquired: true, verdict, skill: result.skill };
}

// ─── Helpers ───────────────────────────────────────────────

function printResult(label: string, result: { acquired: boolean; verdict: Verdict; skill?: SkillListing }) {
  const icon = result.acquired ? '✅' : '🛑';
  console.log(`  ${icon} ${label}`);
  if (result.acquired) {
    console.log(`     Acquired: "${result.skill!.name}" for $${result.skill!.price} ${result.skill!.currency}`);
    console.log(`     Seller: ${result.skill!.seller}`);
  } else {
    console.log(`     Decision: ${result.verdict.decision}`);
    console.log(`     Reasons: ${result.verdict.reasons.join(', ')}`);
    console.log(`     MCP acquire_skill was NEVER called. No credits spent.`);
  }
  console.log('');
}

// ─── Test Scenarios ────────────────────────────────────────

async function main() {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║    xBPP + MCP Marketplace - Policy Enforcement Demo       ║
║                                                            ║
║    Agent: Claude (AI)                                      ║
║    Marketplace: Skill Marketplace (via MCP)                ║
║    Policy: max $1/skill, 1 purchase/minute, $5/hour        ║
╚════════════════════════════════════════════════════════════╝

  Architecture:
  ┌────────┐     ┌──────────┐     ┌─────────────────────┐
  │ Claude │ ──▶ │   xBPP   │ ──▶ │ MCP acquire_skill() │
  │ (Agent)│     │ evaluate │     │   (marketplace)     │
  └────────┘     └──────────┘     └─────────────────────┘
                   │    │
                 ALLOW  BLOCK
                   │    └──▶ Stop. No credits spent.
                   └──────▶ Proceed with purchase.
`);

  // ─── TEST 1: Normal purchase ────────────────────────────
  console.log('━━━ TEST 1: Normal purchase ($0.50 skill) ━━━');
  console.log('  Claude wants: "React Best Practices" for $0.50\n');
  _resetHistory();

  const r1 = await protectedAcquireSkill(1);
  printResult('Purchase attempt', r1);

  // ─── TEST 2: Second purchase within same minute ─────────
  console.log('━━━ TEST 2: Second purchase in same minute ━━━');
  console.log('  Claude immediately wants: "Python Data Pipelines" for $0.75');
  console.log('  Policy: maxRequestsPerMinute = 1\n');

  const r2 = await protectedAcquireSkill(2);
  printResult('Purchase attempt', r2);

  // ─── TEST 3: Overpriced skill ───────────────────────────
  console.log('━━━ TEST 3: Overpriced skill ($5.00) ━━━');
  console.log('  Claude wants: "Enterprise AI Toolkit" for $5.00');
  console.log('  Policy: maxSingle = $1\n');
  _resetHistory();

  const r3 = await protectedAcquireSkill(4);
  printResult('Purchase attempt', r3);

  // ─── TEST 4: After cooldown ─────────────────────────────
  console.log('━━━ TEST 4: Purchase after 1-minute cooldown ━━━');
  console.log('  Simulating 1 minute passing...');
  console.log('  Claude wants: "Go Microservices" for $0.60\n');

  // Reset and inject a purchase from >1 minute ago
  _resetHistory();
  _addToHistory(0.50, 'devskills.io', Date.now() - 65_000); // 65 seconds ago

  const r4 = await protectedAcquireSkill(6);
  printResult('Purchase attempt', r4);

  // ─── TEST 5: Rapid burst ────────────────────────────────
  console.log('━━━ TEST 5: Rapid burst - 5 purchases in seconds ━━━');
  console.log('  Compromised agent tries to drain credits fast.\n');
  _resetHistory();

  const skills = [1, 2, 3, 6, 1]; // listing IDs
  for (let i = 0; i < skills.length; i++) {
    const skill = MARKETPLACE_CATALOG.find(s => s.id === skills[i])!;
    const result = await protectedAcquireSkill(skills[i]);
    printResult(`Attempt ${i + 1}: "${skill.name}" ($${skill.price})`, result);
  }

  // ─── TEST 6: Blocked seller ─────────────────────────────
  console.log('━━━ TEST 6: Skill from blocked seller ━━━');
  console.log('  Claude wants: "Solidity Exploits 101" from shady-skills.xyz');
  console.log('  Policy: blockedDomains includes shady-skills.xyz\n');
  _resetHistory();

  const r6 = await protectedAcquireSkill(5);
  printResult('Purchase attempt', r6);

  // ─── Summary ────────────────────────────────────────────
  console.log(`${'═'.repeat(60)}
  How xBPP protected Claude in this session:

  ┌───────────────────────────┬──────────────────────────────┐
  │ Threat                    │ Policy check that caught it  │
  ├───────────────────────────┼──────────────────────────────┤
  │ 2nd purchase in <1 min    │ maxRequestsPerMinute: 1      │
  │ $5 skill (too expensive)  │ maxSingle: $1                │
  │ Rapid burst (5 in a row)  │ maxRequestsPerMinute + hourly│
  │ Sketchy seller domain     │ blockedDomains list          │
  └───────────────────────────┴──────────────────────────────┘

  Key insight: MCP acquire_skill() was NEVER called when
  xBPP returned BLOCK. The agent couldn't spend credits
  it wasn't authorized to spend.

  In production, replace mockAcquireSkill() with the real
  MCP tool call:

    mcp__inflectiv__inflectiv_acquire_skill({ listing_id })

  xBPP evaluates BEFORE the MCP call fires.
${'═'.repeat(60)}`);
}

main().catch(console.error);

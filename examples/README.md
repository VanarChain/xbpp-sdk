# @vanar/xbpp - Working Examples

Two runnable examples showing xBPP in action.

## Setup

```bash
cd xbpp-sdk
npm install
npm run build
```

## Example 1: Basic Agent

Shows an autonomous agent making multiple payment decisions across 4 different policy profiles - risk-averse, balanced, aggressive, and a custom due-diligence policy.

```bash
npx tsx examples/basic-agent/index.ts
```

**What you'll see:**
- Same set of purchases evaluated under 4 different policies
- How `ALLOW`, `BLOCK`, and `ESCALATE` differ per policy
- Custom policy with trusted recipient allowlist + blocked domains
- Total spend tracked per policy run

**Sample output:**
```
── RISK-AVERSE policy ──────────────────────────────────────
  💳 Company registry lookup ($2.50 USD) → ✅ ALLOW
  💳 Court records search ($45.00 USD)   → ⏸️  ESCALATE
  💳 Deep background report ($180 USD)   → 🛑 BLOCK

── BALANCED policy ──────────────────────────────────────────
  💳 Company registry lookup ($2.50 USD) → ✅ ALLOW
  💳 Court records search ($45.00 USD)   → ✅ ALLOW
  💳 Deep background report ($180 USD)   → ⏸️  ESCALATE
  💳 Real-time market data ($750 USD)    → 🛑 BLOCK
```

## Example 2: x402 Integration

Shows how xBPP wraps a fetch-based HTTP client so that `402 Payment Required` responses are intercepted and evaluated by the policy engine *before* any payment fires.

```bash
npx tsx examples/x402-integration/index.ts
```

**What you'll see:**
- Free endpoints pass through with zero overhead
- Paid endpoints trigger xBPP policy evaluation
- `ALLOW` → payment fires automatically
- `ESCALATE` → pauses, simulates human approval, then pays
- `BLOCK` → payment rejected, error surfaced to agent

**This is the real x402 integration pattern:**
```typescript
// One line to add xBPP governance to any fetch-based client
const client = xbpp.wrap(x402Client, balanced);

// All subsequent calls are now governed
const data = await client.fetch('https://api.data.vanar.io/search');
```

## Example 3: Hourly Agent

Demonstrates hourly budget tracking - an agent that makes purchases over time and hits the `hourlyBudget` limit.

```bash
npx tsx examples/hourly-agent/index.ts
```

## Example 4: MCP Marketplace

Shows xBPP as a policy layer in front of an MCP skill marketplace. The agent browses and buys skills, but xBPP enforces per-skill price caps, rate limits, and blocked-seller rules.

```bash
npx tsx examples/mcp-marketplace/index.ts
```

## Example 5: Playground

An interactive playground for experimenting with custom policies and payment requests.

```bash
npx tsx examples/playground/index.ts
```

## Policy Comparison

| Policy | maxSingle | dailyBudget | askMeAbove |
|--------|-----------|-------------|------------|
| `riskAverse` | $10 | $50 | $5 |
| `balanced` | $100 | $1,000 | $500 |
| `aggressive` | $10,000 | $100,000 | $50,000 |
| Custom | You decide | You decide | You decide |

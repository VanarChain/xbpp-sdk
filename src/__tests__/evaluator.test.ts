import { describe, it, expect, beforeEach } from 'vitest';
import { evaluate, _resetHistory, _addToHistory } from '../evaluator';
import type { Policy, PaymentRequest } from '../types';

beforeEach(() => {
  _resetHistory();
});

describe('evaluate', () => {
  const basePolicy: Policy = {
    maxSingle: 100,
    dailyBudget: 1000,
    hourlyBudget: 200,
    askMeAbove: 50,
    maxRequestsPerMinute: 10,
    allowedCurrencies: ['USD', 'EUR'],
    blockedDomains: ['evil.com', 'scam.org'],
    trustedRecipients: ['alice@trusted.com', 'bob@trusted.com'],
  };

  it('should ALLOW a valid payment within all limits', async () => {
    const request: PaymentRequest = {
      amount: 10,
      currency: 'USD',
      recipient: 'alice@trusted.com',
    };
    const verdict = await evaluate(request, basePolicy);
    expect(verdict.decision).toBe('ALLOW');
    expect(verdict.reasons).toHaveLength(0);
    expect(verdict.message).toBe('Payment allowed');
  });

  it('should BLOCK when amount exceeds maxSingle', async () => {
    const request: PaymentRequest = { amount: 150 };
    const verdict = await evaluate(request, basePolicy);
    expect(verdict.decision).toBe('BLOCK');
    expect(verdict.reasons).toContain('EXCEEDS_SINGLE_LIMIT');
  });

  it('should BLOCK when daily budget exceeded', async () => {
    // Add history that nearly fills the daily budget
    _addToHistory(950);
    const request: PaymentRequest = { amount: 60 };
    const verdict = await evaluate(request, basePolicy);
    expect(verdict.decision).toBe('BLOCK');
    expect(verdict.reasons).toContain('EXCEEDS_DAILY_BUDGET');
  });

  it('should BLOCK when hourly budget exceeded', async () => {
    _addToHistory(180);
    const request: PaymentRequest = { amount: 30 };
    const verdict = await evaluate(request, basePolicy);
    expect(verdict.decision).toBe('BLOCK');
    expect(verdict.reasons).toContain('EXCEEDS_HOURLY_BUDGET');
  });

  it('should ESCALATE when amount above askMeAbove but within limits', async () => {
    const request: PaymentRequest = {
      amount: 75,
      currency: 'USD',
      recipient: 'alice@trusted.com',
    };
    const verdict = await evaluate(request, basePolicy);
    expect(verdict.decision).toBe('ESCALATE');
    expect(verdict.reasons).toContain('ABOVE_ESCALATION_THRESHOLD');
  });

  it('should BLOCK (not escalate) when both block and escalate reasons exist', async () => {
    // Amount 150 exceeds maxSingle (100) AND askMeAbove (50)
    const request: PaymentRequest = { amount: 150 };
    const verdict = await evaluate(request, basePolicy);
    expect(verdict.decision).toBe('BLOCK');
    expect(verdict.reasons).toContain('EXCEEDS_SINGLE_LIMIT');
    expect(verdict.reasons).not.toContain('ABOVE_ESCALATION_THRESHOLD');
  });

  it('should BLOCK suspicious pattern (3+ same recipient in 5min)', async () => {
    const now = Date.now();
    _addToHistory(10, 'merchant@shop.com', now - 60_000);
    _addToHistory(10, 'merchant@shop.com', now - 30_000);

    const request: PaymentRequest = {
      amount: 10,
      recipient: 'merchant@shop.com',
    };
    // Use a policy without trustedRecipients to avoid UNFAMILIAR_RECIPIENT
    const verdict = await evaluate(request, { maxSingle: 100 });
    expect(verdict.decision).toBe('BLOCK');
    expect(verdict.reasons).toContain('SUSPICIOUS_PATTERN');
  });

  it('should BLOCK when recipient domain is blocked', async () => {
    const request: PaymentRequest = {
      amount: 10,
      recipient: 'user@evil.com',
    };
    const verdict = await evaluate(request, basePolicy);
    expect(verdict.decision).toBe('BLOCK');
    expect(verdict.reasons).toContain('BLOCKED_DOMAIN');
  });

  it('should BLOCK unfamiliar recipient', async () => {
    const request: PaymentRequest = {
      amount: 10,
      currency: 'USD',
      recipient: 'stranger@unknown.com',
    };
    const verdict = await evaluate(request, basePolicy);
    expect(verdict.decision).toBe('BLOCK');
    expect(verdict.reasons).toContain('UNFAMILIAR_RECIPIENT');
  });

  it('should BLOCK currency mismatch', async () => {
    const request: PaymentRequest = {
      amount: 10,
      currency: 'BTC',
      recipient: 'alice@trusted.com',
    };
    const verdict = await evaluate(request, basePolicy);
    expect(verdict.decision).toBe('BLOCK');
    expect(verdict.reasons).toContain('CURRENCY_MISMATCH');
  });

  it('should BLOCK rate limit exceeded', async () => {
    const now = Date.now();
    for (let i = 0; i < 10; i++) {
      _addToHistory(1, undefined, now - 30_000);
    }
    const request: PaymentRequest = { amount: 1 };
    const verdict = await evaluate(request, basePolicy);
    expect(verdict.decision).toBe('BLOCK');
    expect(verdict.reasons).toContain('RATE_LIMIT_EXCEEDED');
  });

  it('should BLOCK zero amount', async () => {
    const request: PaymentRequest = { amount: 0 };
    const verdict = await evaluate(request, {});
    expect(verdict.decision).toBe('BLOCK');
    expect(verdict.reasons).toContain('AMOUNT_ZERO_OR_NEGATIVE');
  });

  it('should BLOCK negative amount', async () => {
    const request: PaymentRequest = { amount: -5 };
    const verdict = await evaluate(request, {});
    expect(verdict.decision).toBe('BLOCK');
    expect(verdict.reasons).toContain('AMOUNT_ZERO_OR_NEGATIVE');
  });

  it('should BLOCK expired policy', async () => {
    const expiredPolicy: Policy = {
      expiresAt: new Date('2020-01-01'),
    };
    const request: PaymentRequest = { amount: 10 };
    const verdict = await evaluate(request, expiredPolicy);
    expect(verdict.decision).toBe('BLOCK');
    expect(verdict.reasons).toContain('POLICY_EXPIRED');
  });

  it('should ALLOW with empty policy (all defaults)', async () => {
    const request: PaymentRequest = { amount: 50 };
    const verdict = await evaluate(request, {});
    expect(verdict.decision).toBe('ALLOW');
  });

  it('should include request and timestamp in verdict', async () => {
    const request: PaymentRequest = { amount: 10, currency: 'USD' };
    const verdict = await evaluate(request, {});
    expect(verdict.request).toBe(request);
    expect(verdict.timestamp).toBeInstanceOf(Date);
  });

  it('should collect multiple block reasons', async () => {
    const request: PaymentRequest = {
      amount: 0,
      currency: 'BTC',
      recipient: 'user@evil.com',
    };
    const verdict = await evaluate(request, basePolicy);
    expect(verdict.decision).toBe('BLOCK');
    expect(verdict.reasons).toContain('AMOUNT_ZERO_OR_NEGATIVE');
    expect(verdict.reasons).toContain('CURRENCY_MISMATCH');
    expect(verdict.reasons).toContain('BLOCKED_DOMAIN');
  });
});

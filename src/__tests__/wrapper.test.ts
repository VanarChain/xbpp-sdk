import { describe, it, expect, vi, beforeEach } from 'vitest';
import { wrap } from '../wrapper';
import { BlockedError, EscalateError } from '../errors';
import { _resetHistory } from '../evaluator';
import type { Policy } from '../types';

const permissivePolicy: Policy = {
  maxSingle: 10000,
  dailyBudget: 100000,
};

const strictPolicy: Policy = {
  maxSingle: 5,
  dailyBudget: 10,
};

const escalatePolicy: Policy = {
  maxSingle: 10000,
  askMeAbove: 10,
};

beforeEach(() => {
  _resetHistory();
});

describe('wrap', () => {
  it('passes through when no payment headers are present', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ status: 200 });
    const safeFetch = wrap(mockFetch, permissivePolicy);

    const result = await safeFetch('https://example.com', { headers: {} });

    expect(mockFetch).toHaveBeenCalledOnce();
    expect(result).toEqual({ status: 200 });
  });

  it('passes through when no init object is provided', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    const safeFetch = wrap(mockFetch, permissivePolicy);

    await safeFetch('https://example.com');

    expect(mockFetch).toHaveBeenCalledOnce();
  });

  it('allows payment within policy limits via X-Payment JSON header', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ status: 200 });
    const safeFetch = wrap(mockFetch, permissivePolicy);

    const result = await safeFetch('https://api.example.com', {
      headers: {
        'X-Payment': JSON.stringify({ amount: 10, currency: 'USD', recipient: 'api.example.com' }),
      },
    });

    expect(mockFetch).toHaveBeenCalledOnce();
    expect(result).toEqual({ status: 200 });
  });

  it('allows payment via x-payment lowercase header', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ status: 200 });
    const safeFetch = wrap(mockFetch, permissivePolicy);

    await safeFetch('https://api.example.com', {
      headers: {
        'x-payment': JSON.stringify({ amount: 5, currency: 'USD' }),
      },
    });

    expect(mockFetch).toHaveBeenCalledOnce();
  });

  it('allows payment via individual X-Payment-Amount headers', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ status: 200 });
    const safeFetch = wrap(mockFetch, permissivePolicy);

    await safeFetch('https://api.example.com', {
      headers: {
        'X-Payment-Amount': '15',
        'X-Payment-Currency': 'USD',
        'X-Payment-Recipient': 'api.example.com',
      },
    });

    expect(mockFetch).toHaveBeenCalledOnce();
  });

  it('throws BlockedError when payment exceeds policy limits', async () => {
    const mockFetch = vi.fn();
    const safeFetch = wrap(mockFetch, strictPolicy);

    await expect(
      safeFetch('https://api.example.com', {
        headers: {
          'X-Payment': JSON.stringify({ amount: 100, currency: 'USD' }),
        },
      })
    ).rejects.toThrow(BlockedError);

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('BlockedError contains verdict with reasons', async () => {
    const mockFetch = vi.fn();
    const safeFetch = wrap(mockFetch, strictPolicy);

    try {
      await safeFetch('https://api.example.com', {
        headers: {
          'X-Payment': JSON.stringify({ amount: 100 }),
        },
      });
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(BlockedError);
      const blocked = err as BlockedError;
      expect(blocked.verdict.decision).toBe('BLOCK');
      expect(blocked.verdict.reasons).toContain('EXCEEDS_SINGLE_LIMIT');
    }
  });

  it('throws EscalateError when payment exceeds askMeAbove threshold', async () => {
    const mockFetch = vi.fn();
    const safeFetch = wrap(mockFetch, escalatePolicy);

    await expect(
      safeFetch('https://api.example.com', {
        headers: {
          'X-Payment': JSON.stringify({ amount: 50, currency: 'USD' }),
        },
      })
    ).rejects.toThrow(EscalateError);

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('EscalateError.onApprove calls the original fetch', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ status: 200 });
    const safeFetch = wrap(mockFetch, escalatePolicy);

    try {
      await safeFetch('https://api.example.com', {
        headers: {
          'X-Payment': JSON.stringify({ amount: 50 }),
        },
      });
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(EscalateError);
      const escalated = err as EscalateError;
      expect(escalated.verdict.decision).toBe('ESCALATE');
      expect(escalated.verdict.reasons).toContain('ABOVE_ESCALATION_THRESHOLD');

      // Approve the escalation - should call original fetch
      await escalated.onApprove();
      expect(mockFetch).toHaveBeenCalledOnce();
    }
  });

  it('ignores invalid JSON in x-payment header and passes through', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ status: 200 });
    const safeFetch = wrap(mockFetch, permissivePolicy);

    await safeFetch('https://example.com', {
      headers: {
        'X-Payment': 'not-json',
      },
    });

    expect(mockFetch).toHaveBeenCalledOnce();
  });
});

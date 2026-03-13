import type { Policy, PaymentRequest } from './types';
import { evaluate } from './evaluator';
import { BlockedError, EscalateError } from './errors';

type FetchLike = (...args: unknown[]) => Promise<unknown>;

interface X402PaymentHeader {
  amount?: number;
  currency?: string;
  recipient?: string;
}

function extractPaymentFromHeaders(args: unknown[]): PaymentRequest | null {
  if (!args[1] || typeof args[1] !== 'object') return null;

  const init = args[1] as Record<string, unknown>;
  const headers = init.headers as Record<string, string> | undefined;
  if (!headers) return null;

  // Check for x402 payment headers
  const paymentHeader = headers['x-payment'] || headers['X-Payment'];
  if (paymentHeader) {
    try {
      const parsed: X402PaymentHeader = JSON.parse(paymentHeader);
      if (parsed.amount !== undefined) {
        return {
          amount: parsed.amount,
          currency: parsed.currency,
          recipient: parsed.recipient,
        };
      }
    } catch {
      // Not valid JSON, skip
    }
  }

  // Check for individual payment headers
  const amount = headers['x-payment-amount'] || headers['X-Payment-Amount'];
  if (amount) {
    return {
      amount: parseFloat(amount),
      currency:
        headers['x-payment-currency'] || headers['X-Payment-Currency'],
      recipient:
        headers['x-payment-recipient'] || headers['X-Payment-Recipient'],
    };
  }

  return null;
}

export function wrap(fetchFn: FetchLike, policy: Policy): FetchLike {
  return async (...args: unknown[]): Promise<unknown> => {
    const paymentRequest = extractPaymentFromHeaders(args);

    if (!paymentRequest) {
      // No payment detected, pass through
      return fetchFn(...args);
    }

    const verdict = await evaluate(paymentRequest, policy);

    if (verdict.decision === 'BLOCK') {
      throw new BlockedError(verdict);
    }

    if (verdict.decision === 'ESCALATE') {
      throw new EscalateError(verdict, {
        onApprove: async () => {
          await fetchFn(...args);
        },
        onDeny: () => {
          // No-op: payment denied by user
        },
      });
    }

    // ALLOW - proceed with the original fetch
    return fetchFn(...args);
  };
}

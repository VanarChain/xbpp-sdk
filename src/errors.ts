import type { PolicyReason, Verdict } from './types';

export class BlockedError extends Error {
  readonly reasons: PolicyReason[];
  readonly verdict: Verdict;

  constructor(verdict: Verdict) {
    super(verdict.message);
    this.name = 'BlockedError';
    this.reasons = verdict.reasons;
    this.verdict = verdict;
  }
}

export class EscalateError extends Error {
  readonly reasons: PolicyReason[];
  readonly verdict: Verdict;
  private _onApprove?: () => Promise<void>;
  private _onDeny?: () => void;

  constructor(
    verdict: Verdict,
    callbacks?: { onApprove?: () => Promise<void>; onDeny?: () => void }
  ) {
    super(verdict.message);
    this.name = 'EscalateError';
    this.reasons = verdict.reasons;
    this.verdict = verdict;
    this._onApprove = callbacks?.onApprove;
    this._onDeny = callbacks?.onDeny;
  }

  async onApprove(): Promise<void> {
    if (this._onApprove) {
      await this._onApprove();
    }
  }

  onDeny(): void {
    if (this._onDeny) {
      this._onDeny();
    }
  }
}

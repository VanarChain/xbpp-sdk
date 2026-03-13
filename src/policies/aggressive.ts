import type { Policy } from '../types';

export const aggressive: Policy = {
  maxSingle: 10000,
  dailyBudget: 100000,
  hourlyBudget: 50000,
  askMeAbove: 50000,
  maxRequestsPerMinute: 100,
};

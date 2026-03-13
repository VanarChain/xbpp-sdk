import type { Policy } from '../types';

export const riskAverse: Policy = {
  maxSingle: 10,
  dailyBudget: 50,
  hourlyBudget: 20,
  askMeAbove: 5,
  maxRequestsPerMinute: 5,
};

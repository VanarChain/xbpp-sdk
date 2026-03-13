import type { Policy } from '../types';

export const balanced: Policy = {
  maxSingle: 100,
  dailyBudget: 1000,
  hourlyBudget: 200,
  askMeAbove: 500,
  maxRequestsPerMinute: 20,
};

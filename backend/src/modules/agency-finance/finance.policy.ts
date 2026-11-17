/** Product policy: changes ship with code and a migration, never through an admin form. */
export const FIXED_POLICY_ID = 'e1000000-0000-4000-8000-000000000007';
export const FIXED_SETTLEMENT_POLICY = Object.freeze({
  holdDays: 7, autoSettlement: true, minWithdrawal: '100000', maxWithdrawal: '500000000',
  dailyWithdrawalLimit: '1000000000', processingHours: 48, includeExistingReports: true,
});

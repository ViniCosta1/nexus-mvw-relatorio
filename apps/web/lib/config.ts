// This ad account was under a different agency's management before this date.
// Spend/insights before it belong to that prior period and must never appear in
// our reports — traffic under our management started 2026-06-01. Override per
// client via REPORT_START_DATE (YYYY-MM-DD) if this dashboard is reused.
export const ACCOUNT_START_DATE = new Date(
  `${process.env.REPORT_START_DATE ?? "2026-06-01"}T00:00:00.000Z`,
)

/** YYYY-MM-DD form of ACCOUNT_START_DATE, for string-date comparisons. */
export const ACCOUNT_START_DAY = ACCOUNT_START_DATE.toISOString().slice(0, 10)

/** Clamp a range's lower bound so nothing before the account start is ever queried. */
export function clampFrom(from: Date): Date {
  return from < ACCOUNT_START_DATE ? ACCOUNT_START_DATE : from
}

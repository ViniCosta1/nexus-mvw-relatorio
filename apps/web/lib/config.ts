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

// Daily Instagram collection is driven by a Make scenario that started running
// on this date. Insights the Graph API still had in its ~30-day retention were
// backfilled in the first run, so older days exist but were not collected daily
// — the /social page states this instead of hiding those rows.
export const SOCIAL_COLLECTION_START_DATE = new Date(
  `${process.env.SOCIAL_START_DATE ?? "2026-07-29"}T00:00:00.000Z`,
)

/** YYYY-MM-DD form of SOCIAL_COLLECTION_START_DATE. */
export const SOCIAL_COLLECTION_START_DAY = SOCIAL_COLLECTION_START_DATE.toISOString().slice(0, 10)

// The day content production for the profile actually began. May and the first
// three weeks of June are in the exports as the "before" — the /social page
// marks this date on the daily chart so a rise isn't read as starting earlier
// than the work did.
export const SOCIAL_CONTENT_START_DATE = new Date(
  `${process.env.SOCIAL_CONTENT_START_DATE ?? "2026-06-24"}T00:00:00.000Z`,
)

/** YYYY-MM-DD form of SOCIAL_CONTENT_START_DATE. */
export const SOCIAL_CONTENT_START_DAY = SOCIAL_CONTENT_START_DATE.toISOString().slice(0, 10)

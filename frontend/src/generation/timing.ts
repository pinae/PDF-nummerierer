/** Poll intervals in milliseconds (mutable so tests can speed them up). */
export const timing = {
  /** While a job runs. */
  jobPollMs: 500,
  /** On the done screen, until the server has deleted the exam. */
  documentPollMs: 2000,
  /** Keep-alive while an exam is open; the server's idle limit is 15 minutes. */
  keepAliveMs: 60_000,
};

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

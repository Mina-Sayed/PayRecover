import { describe, expect, it } from 'vitest';
import {
  isLatestInvoiceListRequest,
  nextInvoiceListRequestVersion,
} from '@/lib/invoice-list-state';

describe('invoice list request ordering', () => {
  it('ignores stale responses when requests resolve out of order', async () => {
    let latestVersion = 0;
    let committedData: string | null = null;

    const issueRequest = async (payload: string, delayMs: number) => {
      const requestVersion = nextInvoiceListRequestVersion(latestVersion);
      latestVersion = requestVersion;

      await new Promise((resolve) => setTimeout(resolve, delayMs));

      if (isLatestInvoiceListRequest(requestVersion, latestVersion)) {
        committedData = payload;
      }
    };

    await Promise.all([
      issueRequest('stale-page-two-data', 25),
      issueRequest('latest-page-one-data', 5),
    ]);

    expect(committedData).toBe('latest-page-one-data');
  });
});

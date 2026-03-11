export function isDatabaseConnectivityError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const candidate = error as {
    code?: string;
    message?: string;
  };

  const code = candidate.code?.toUpperCase();
  if (
    code &&
    ['ENETUNREACH', 'ECONNREFUSED', 'ETIMEDOUT', 'ECONNRESET', 'EHOSTUNREACH'].includes(code)
  ) {
    return true;
  }

  const message = candidate.message?.toLowerCase() || '';
  return (
    message.includes('connect enetunreach') ||
    message.includes('connection refused') ||
    message.includes('timeout expired') ||
    message.includes('can\'t reach database server') ||
    message.includes('can not reach database server')
  );
}

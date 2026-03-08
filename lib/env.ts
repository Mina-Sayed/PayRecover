const requiredEnvCache = new Map<string, string>();

export function requireEnv(name: string): string {
  if (requiredEnvCache.has(name)) {
    return requiredEnvCache.get(name)!;
  }

  const value = process.env[name];
  if (!value || value.trim() === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  requiredEnvCache.set(name, value);
  return value;
}

export function getEnv(name: string): string | null {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    return null;
  }

  return value;
}

export function validateRequiredEnvVars(names: string[]): void {
  for (const name of names) {
    requireEnv(name);
  }
}

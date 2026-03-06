const requiredEnvCache = new Map<string, string>();

/**
 * Retrieve a required environment variable by name and cache its value.
 *
 * @param name - The environment variable name to read
 * @returns The environment variable's string value
 * @throws Error when the variable is not set or contains only whitespace; the error message is `Missing required environment variable: {name}`
 */
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

/**
 * Validates that each named environment variable exists and is non-empty.
 *
 * @param names - Array of environment variable names to validate
 * @throws Error if any named environment variable is missing or contains only whitespace
 */
export function validateRequiredEnvVars(names: string[]): void {
  for (const name of names) {
    requireEnv(name);
  }
}

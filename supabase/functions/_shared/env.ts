// Minimal env-var accessor. Works in Deno (Supabase Edge Functions runtime)
// and Node (local tests). Fails loud if a required variable is missing.

declare const Deno: { env: { get(name: string): string | undefined } } | undefined;

function readEnv(name: string): string | undefined {
  if (typeof Deno !== "undefined" && Deno.env) return Deno.env.get(name);
  if (typeof process !== "undefined" && process.env) return process.env[name];
  return undefined;
}

export function requireEnv(name: string): string {
  const v = readEnv(name);
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export function optionalEnv(name: string, fallback?: string): string | undefined {
  return readEnv(name) ?? fallback;
}

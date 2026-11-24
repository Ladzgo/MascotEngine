/** Remove secrets from text: exact values from .env-style KEY=VALUE lines for secret-looking keys, plus common token shapes. */
export function secretValues(env: Record<string, string | undefined>): string[] {
  return Object.entries(env).filter(([k, v]) => /KEY|TOKEN|SECRET|PASSWORD|VOICE_ID/i.test(k) && v && v.length >= 6).map(([, v]) => v!);
}
export function redact(text: string, secrets: string[] = []): string {
  let out = text;
  for (const s of secrets) out = out.split(s).join('[redacted]');
  return out
    .replace(/\b(sk-[A-Za-z0-9_-]{16,}|AIza[0-9A-Za-z_-]{20,}|xi-[A-Za-z0-9]{16,})\b/g, '[redacted]')
    .replace(/^([A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD)[A-Z0-9_]*)=.*$/gm, '$1=[redacted]')
    .replace(new RegExp(`${process.env.HOME ?? '/Users/__none__'}`, 'g'), '~');
}

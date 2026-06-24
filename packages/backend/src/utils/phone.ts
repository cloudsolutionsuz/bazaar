// Strips everything but digits so "+998 90 123-45-67" and "998901234567"
// resolve to the same Customer - phone is the mini-account's identity key.
export function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, "");
}

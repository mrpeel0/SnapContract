export function phoneDigits(raw: string) {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 15) {
    throw new Error("Enter a phone number with country code, like +1 415 555 0100");
  }
  return digits;
}

export function formatPhone(digits?: string) {
  if (!digits) return "";
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+1 ${digits.slice(1, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  }
  return `+${digits}`;
}

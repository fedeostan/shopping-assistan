/**
 * Pure validation functions for payment card data.
 * No Node.js crypto imports — safe for client-side use.
 */

/** Luhn algorithm check for card number validity. */
export function luhnCheck(cardNumber: string): boolean {
  const digits = cardNumber.replace(/\D/g, "");
  if (digits.length < 13 || digits.length > 19) return false;

  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = parseInt(digits[i], 10);
    if (double) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    double = !double;
  }
  return sum % 10 === 0;
}

/** Detect card brand from number prefix. */
export function detectBrand(
  cardNumber: string
): "visa" | "mastercard" | "amex" | "discover" | "unknown" {
  const digits = cardNumber.replace(/\D/g, "");
  if (/^4/.test(digits)) return "visa";
  if (/^5[1-5]/.test(digits) || /^2[2-7]/.test(digits)) return "mastercard";
  if (/^3[47]/.test(digits)) return "amex";
  if (/^6(?:011|5)/.test(digits)) return "discover";
  return "unknown";
}

/** Check if the expiry month/year is in the future. */
export function isExpiryValid(month: number, year: number): boolean {
  if (month < 1 || month > 12) return false;
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  // Accept 2-digit or 4-digit year
  const fullYear = year < 100 ? 2000 + year : year;
  if (fullYear < currentYear) return false;
  if (fullYear === currentYear && month < currentMonth) return false;
  return true;
}

/** Extract last 4 digits from a card number. */
export function getLast4(cardNumber: string): string {
  const digits = cardNumber.replace(/\D/g, "");
  return digits.slice(-4);
}

/** Expected CVV length for a card brand. */
export function cvvLength(brand: string): number {
  return brand === "amex" ? 4 : 3;
}

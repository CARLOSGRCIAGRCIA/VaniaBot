export function isValidWhatsAppNumber(number: string): boolean {
  const cleaned = number.replace(/[^\d]/g, "");
  return /^\d{10,15}$/.test(cleaned);
}

export function isGroupJid(jid: string): boolean {
  return jid.endsWith("@g.us");
}

export function isUserJid(jid: string): boolean {
  return jid.endsWith("@s.whatsapp.net");
}

export function cleanPhoneNumber(number: string): string {
  return number.replace(/[^\d+]/g, "");
}

export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export function isNumeric(text: string): boolean {
  return /^\d+$/.test(text);
}

export function isAlphanumeric(text: string): boolean {
  return /^[a-zA-Z0-9]+$/.test(text);
}

export function minLength(text: string, min: number): boolean {
  return text.length >= min;
}

export function maxLength(text: string, max: number): boolean {
  return text.length <= max;
}

export function inRange(num: number, min: number, max: number): boolean {
  return num >= min && num <= max;
}

export function hasRequiredProps<T extends object>(
  obj: T,
  props: (keyof T)[],
): boolean {
  return props.every((prop) => prop in obj && obj[prop] !== undefined);
}

export function isValidDate(date: string): boolean {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(date)) return false;

  const d = new Date(date);
  return d instanceof Date && !isNaN(d.getTime());
}

export function isValidTime(time: string): boolean {
  const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
  return timeRegex.test(time);
}

export function sanitizeInput(input: string): string {
  return input.replace(/[<>]/g, "").replace(/['"]/g, "").trim();
}

export function isNonEmptyArray<T>(arr: T[]): boolean {
  return Array.isArray(arr) && arr.length > 0;
}

export function isOneOf<T>(value: T, options: T[]): boolean {
  return options.includes(value);
}

export function isAlpha(text: string): boolean {
  return /^[a-zA-Z]+$/.test(text);
}

export function isValidHex(hex: string): boolean {
  return /^#?[0-9A-Fa-f]{6}$/.test(hex);
}

export function isInteger(value: number): boolean {
  return Number.isInteger(value);
}

export function isPositive(value: number): boolean {
  return value > 0;
}

export function hasSpecialChars(text: string): boolean {
  return /[^a-zA-Z0-9\s]/.test(text);
}

export function isValidUsername(username: string): boolean {
  return /^[a-zA-Z0-9_-]{3,20}$/.test(username);
}

export function isPlainObject(value: any): value is object {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isValidJSON(str: string): boolean {
  try {
    JSON.parse(str);
    return true;
  } catch {
    return false;
  }
}

export function isStrongPassword(password: string): boolean {
  return (
    password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /\d/.test(password)
  );
}

export function containsProfanity(text: string, badWords: string[]): boolean {
  const lowerText = text.toLowerCase();
  return badWords.some((word) => lowerText.includes(word.toLowerCase()));
}

export function isWhatsAppLink(url: string): boolean {
  return /chat\.whatsapp\.com\//.test(url);
}

export function isDomainLink(url: string, domain: string): boolean {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.includes(domain);
  } catch {
    return false;
  }
}

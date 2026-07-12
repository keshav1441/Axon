export type ParsedTransaction = {
  amount: number;
  direction: 'debit' | 'credit';
  merchant: string | null;
  accountTail: string | null;
  bankName: string | null;
  occurredAt: number;
  dedupeKey: string;
  source: 'sms' | 'notification';
};

type RawInput = {
  source: 'sms' | 'notification';
  body: string;
  timestampMs: number;
};

const AMOUNT_RE = /(?:rs\.?|inr|₹)\s?([\d,]+(?:\.\d{1,2})?)/i;
const DEBIT_RE = /\b(debited|debit|spent|paid|withdrawn|sent)\b/i;
const CREDIT_RE = /\b(credited|credit|received|deposited)\b/i;
const REF_RE = /(?:ref|txn|utr|rrn)[\s.:no]*([a-z0-9]{6,})/i;
const ACCOUNT_TAIL_RE = /\b(?:a\/?c|acct|card)\D{0,5}(?:no\.?\s?)?[x*]{2,}(\d{2,6})\b/i;
const OTP_RE = /\botp\b|one time password/i;

const MERCHANT_PATTERNS: RegExp[] = [
  /\bat\s+([A-Za-z0-9][A-Za-z0-9 &.\-]{2,29})/i,
  /\btowards\s+([A-Za-z0-9][A-Za-z0-9 &.\-@]{2,39})/i,
  /\bto\s+([A-Za-z0-9][A-Za-z0-9 &.\-@]{2,39})/i,
  /\bfrom\s+([A-Za-z0-9][A-Za-z0-9 &.\-@]{2,39})/i,
  /vpa\s+([\w.\-]+@[\w.\-]+)/i,
];

function extractMerchant(body: string): string | null {
  for (const pattern of MERCHANT_PATTERNS) {
    const match = body.match(pattern);
    if (match) return match[1].trim().replace(/\s{2,}/g, ' ');
  }
  return null;
}

const KNOWN_BANKS = [
  'ICICI', 'HDFC', 'SBI', 'State Bank', 'Axis', 'Kotak', 'PNB', 'Punjab National',
  'Bank of Baroda', 'BOB', 'Canara', 'Union Bank', 'IDFC', 'IndusInd', 'Yes Bank',
  'RBL', 'IDBI', 'Federal Bank', 'Bank of India', 'Central Bank', 'Indian Bank',
  'UCO Bank', 'Bandhan', 'AU Small Finance', 'Paytm Payments',
];

function extractBankName(body: string): string | null {
  const lower = body.toLowerCase();
  for (const bank of KNOWN_BANKS) {
    if (lower.includes(bank.toLowerCase())) return bank;
  }
  return null;
}

/**
 * Rule-based only, per spec - never sends the SMS/notification body anywhere.
 * Returns null for anything that isn't clearly a transaction (OTPs, promos,
 * balance-enquiry pings, etc.) so noise never reaches the DB.
 */
export function parseTransactionText(input: RawInput): ParsedTransaction | null {
  const { body, source, timestampMs } = input;

  if (OTP_RE.test(body)) return null;

  const amountMatch = body.match(AMOUNT_RE);
  if (!amountMatch) return null;
  const amount = Number(amountMatch[1].replace(/,/g, ''));
  if (!Number.isFinite(amount) || amount <= 0) return null;

  const debitMatch = body.match(DEBIT_RE);
  const creditMatch = body.match(CREDIT_RE);
  if (!debitMatch && !creditMatch) return null;
  // Common UPI pattern has both keywords ("debited A/c... and credited to
  // MERCHANT") - whichever comes first describes what happened to the
  // user's own account, so it wins.
  const direction: ParsedTransaction['direction'] =
    debitMatch && (!creditMatch || debitMatch.index! <= creditMatch.index!) ? 'debit' : 'credit';

  const merchant = extractMerchant(body);
  const accountTail = body.match(ACCOUNT_TAIL_RE)?.[1] ?? null;
  const bankName = extractBankName(body);
  const refMatch = body.match(REF_RE)?.[1];

  const dedupeKey = refMatch
    ? `ref:${refMatch}`
    : `heuristic:${direction}:${amount}:${Math.floor(timestampMs / 60_000)}`;

  return {
    amount,
    direction,
    merchant,
    accountTail,
    bankName,
    occurredAt: timestampMs,
    dedupeKey,
    source,
  };
}

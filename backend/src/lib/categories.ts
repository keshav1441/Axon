export const CATEGORIES = [
  'Food',
  'Travel',
  'Shopping',
  'Bills',
  'Subscriptions',
  'Groceries',
  'Health',
  'Entertainment',
  'Transfer',
  'Uncategorized',
] as const;

export type Category = (typeof CATEGORIES)[number];

const DEFAULT_KEYWORD_RULES: Record<string, Category> = {
  swiggy: 'Food',
  zomato: 'Food',
  dominos: 'Food',
  starbucks: 'Food',
  mcdonald: 'Food',
  uber: 'Travel',
  ola: 'Travel',
  irctc: 'Travel',
  redbus: 'Travel',
  indigo: 'Travel',
  amazon: 'Shopping',
  flipkart: 'Shopping',
  myntra: 'Shopping',
  ajio: 'Shopping',
  netflix: 'Subscriptions',
  spotify: 'Subscriptions',
  hotstar: 'Subscriptions',
  prime: 'Subscriptions',
  youtube: 'Subscriptions',
  airtel: 'Bills',
  jio: 'Bills',
  vodafone: 'Bills',
  vi: 'Bills',
  electricity: 'Bills',
  broadband: 'Bills',
  bigbasket: 'Groceries',
  blinkit: 'Groceries',
  zepto: 'Groceries',
  dmart: 'Groceries',
  apollo: 'Health',
  pharmeasy: 'Health',
  practo: 'Health',
  bookmyshow: 'Entertainment',
  pvr: 'Entertainment',
};

export function guessCategory(merchant: string | null | undefined, learnedRules: Record<string, string>): string {
  if (!merchant) return 'Uncategorized';
  const lower = merchant.toLowerCase();

  for (const [keyword, category] of Object.entries(learnedRules)) {
    if (lower.includes(keyword)) return category;
  }
  for (const [keyword, category] of Object.entries(DEFAULT_KEYWORD_RULES)) {
    if (lower.includes(keyword)) return category;
  }
  return 'Uncategorized';
}

/** Same rule this app has always used: first word of the merchant name, min 3 chars, becomes the learned keyword. */
export function deriveKeyword(merchant: string): string | null {
  const keyword = merchant.toLowerCase().split(/\s+/)[0];
  return keyword && keyword.length >= 3 ? keyword : null;
}

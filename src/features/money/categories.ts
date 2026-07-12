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

export type BuiltInCategory = (typeof CATEGORIES)[number];
/** Widened to string - users can add custom categories beyond the built-in list. */
export type Category = string;

/** Built-in default keyword -> category map. User corrections override this via the category_rules table. */
export const DEFAULT_KEYWORD_RULES: Record<string, Category> = {
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

export function guessCategory(merchant: string | null, learnedRules: Record<string, Category>): Category {
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

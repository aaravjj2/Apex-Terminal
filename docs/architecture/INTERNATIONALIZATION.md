# Internationalization

> Multi-locale translation, financial data formatting, and RTL layout support powered by the `I18nEngine` in `lib/platform/i18n.ts`.

---

## Table of Contents

- [Overview](#overview)
- [Locale Configuration](#locale-configuration)
- [Translation Key Structure](#translation-key-structure)
- [Namespace Organization](#namespace-organization)
- [Pluralization](#pluralization)
- [Interpolation](#interpolation)
- [Financial Data Formatting](#financial-data-formatting)
- [RTL Support](#rtl-support)
- [Dynamic Locale Bundles](#dynamic-locale-bundles)
- [React Integration](#react-integration)
- [Adding a New Locale](#adding-a-new-locale)

---

## Overview

Apex Terminal supports 10 locales — English, Spanish, French, German, Japanese, Chinese, Korean, Arabic, Portuguese, and Russian — with full pluralization rules, locale-aware number/date/currency formatting, and RTL layout for Arabic. The `I18nEngine` singleton manages locale state, translation resolution with namespace fallback, and dynamic bundle loading.

The engine is initialized once and exposed via `getI18n()` and a shorthand `t()` function. Translations are organized by namespace and support `{{variable}}` interpolation and plural forms.

---

## Locale Configuration

Each locale is defined as a `LocaleConfig` in `localeConfigs`:

```typescript
interface LocaleConfig {
  code: Locale;           // 'en' | 'es' | 'fr' | 'de' | 'ja' | 'zh' | 'ko' | 'ar' | 'pt' | 'ru'
  name: string;           // English name
  nativeName: string;     // Name in native script ('日本語', 'العربية')
  direction: Direction;   // 'ltr' | 'rtl'
  dateFormat: string;     // 'MM/DD/YYYY', 'DD.MM.YYYY', 'YYYY/MM/DD'
  timeFormat: string;     // 'hh:mm A' (12h) or 'HH:mm' (24h)
  numberDecimal: string;  // '.' or ',' or '٫'
  numberThousands: string;// ',' or '.' or '\u00A0' or '٬'
  currencySymbol: string; // '$', '€', '¥', '₩', 'ر.س', 'R$', '₽'
  currencyPosition: 'prefix' | 'suffix';
  pluralRule: (n: number) => PluralForm;
}
```

The engine auto-detects locale from `localStorage`, then `navigator.languages`, falling back to `'en'`.

---

## Translation Key Structure

Keys follow a `domain.entity.action` convention, prefixed by namespace:

| Namespace | Key Pattern | Example |
|-----------|-------------|---------|
| `common` | `app.*`, `items.*`, `time.*` | `app.loading`, `time.ago.minutes` |
| `chart` | `chart.*` | `chart.candlestick`, `chart.volume` |
| `trading` | `trading.*` | `trading.buy`, `trading.placeOrder` |
| `portfolio` | `portfolio.*` | `portfolio.totalValue`, `portfolio.unrealizedPnl` |
| `orders` | `orders.*` | `orders.open`, `orders.cancelOrder` |
| `errors` | `error.*` | `error.network`, `error.rateLimit` |
| `screener` | `screener.*` | `screener.create`, `screener.results` |
| `news` | `news.*` | `news.headline`, `news.sentiment` |
| `settings` | `settings.*` | `settings.theme`, `settings.language` |

---

## Namespace Organization

Translations are typed as `Partial<Record<Namespace, TranslationMap>>` per locale. The engine infers namespace from the first key segment, then searches all namespaces as fallback:

```typescript
// Direct namespace resolution
i18n.t('trading.buy');                           // → infers ns='trading'
i18n.t('app.loading');                           // → infers ns='common' (not 'app')
i18n.t('chart.indicators', undefined, { ns: 'chart' }); // → explicit namespace
```

Only built-in English ships all namespaces. Other locales ship partial translations — missing keys fall back to the `en` equivalent, then return the raw key as last resort.

---

## Pluralization

Five plural rules cover all 10 locales, mapped to CLDR plural forms:

| Rule | Locales | Forms Used |
|------|---------|------------|
| `pluralEn` | en, es, de, pt | `one`, `other` |
| `pluralFr` | fr | `one` (≤1), `other` |
| `pluralJa` | ja, zh, ko | `other` only |
| `pluralAr` | ar | `zero`, `one`, `two`, `few`, `many`, `other` |
| `pluralRu` | ru | `one`, `few`, `many`, `other` |

Plural translations use a `Record<PluralForm, string>` value:

```typescript
// English
'trading.positions': { one: '{{count}} position', other: '{{count}} positions' }

// Arabic (all 6 forms)
'items.count': {
  zero: '{{count}} عنصر', one: '{{count}} عنصر', two: '{{count}} عنصران',
  few: '{{count}} عناصر', many: '{{count}} عنصراً', other: '{{count}} عنصر'
}

// Japanese (single form)
'items.count': { other: '{{count}}件' }
```

Usage passes `count` in both the values and options:

```typescript
i18n.t('trading.positions', { count: 5 }, { count: 5 }); // → "5 positions"
```

---

## Interpolation

The `{{variable}}` syntax replaces named placeholders:

```typescript
i18n.t('trading.orderFailed', { reason: 'Insufficient margin' });
// → "Order failed: Insufficient margin"

i18n.t('time.ago.hours', { count: 3 }, { count: 3 });
// → "3 hours ago"
```

Unresolved placeholders are preserved as-is (`{{unknown}}`) to aid debugging.

---

## Financial Data Formatting

The engine provides locale-aware formatters critical for financial UIs:

```typescript
const i18n = getI18n();

i18n.formatNumber(1234567.89);                  // en: "1,234,567.89"  de: "1.234.567,89"
i18n.formatNumber(1234567.89, { compact: true }); // "1.23M"
i18n.formatCurrency(42150.75);                  // en: "$42,150.75"  fr: "42 150,75 €"
i18n.formatPercent(-2.34);                      // "-2.34%"
i18n.formatPrice(0.00004523);                   // "0.000045" (auto 6 decimals for <$1)
i18n.formatPrice(185.42);                       // "185.4200" (4 decimals for <$100)
i18n.formatVolume(23400000);                    // "23.40M"
i18n.formatMarketCap(2.1e12);                   // "$2.10T"
i18n.formatPnL(1250.00);                        // "+$1,250.00"
i18n.formatPnL(-340.50);                        // "-$340.50"
```

Compact formatting thresholds: `K` (≥1,000), `M` (≥1,000,000), `B` (≥1,000,000,000), `T` (≥1,000,000,000,000).

---

## RTL Support

Arabic (`ar`) is the only RTL locale. When set, the engine applies `dir="rtl"` and `lang="ar"` to the document root. Components use the `isRTL()` check for layout adjustments:

```typescript
const i18n = getI18n();
const direction = i18n.getDirection();   // 'rtl' for Arabic
const isRTL = i18n.isRTL();             // true for Arabic

// Tailwind uses dir: attribute selectors
// <div className="ltr:ml-4 rtl:mr-4"> or <div dir={direction}>
```

Currency position also adapts — Arabic places the symbol as suffix (`"42,150.75 ر.س"`), while English uses prefix (`"$42,150.75"`).

---

## Dynamic Locale Bundles

Non-English translations can be lazy-loaded to reduce initial bundle size:

```typescript
const i18n = getI18n();

i18n.registerLoader('ja', () => import('./locales/ja.json').then(m => m.default));

// Load on demand when user switches locale
await i18n.setLocale('ja');
await i18n.loadNamespace('ja', 'trading');
```

Built-in English and partial translations for other locales are bundled. Full locale packs are loaded on demand via registered loaders. The `loadedNamespaces` map prevents duplicate fetches.

---

## React Integration

Components access translations through the singleton or via a custom hook pattern:

```typescript
import { t, getI18n } from '@/lib/platform/i18n';

function OrderPanel() {
  const i18n = getI18n();

  return (
    <div dir={i18n.getDirection()}>
      <h2>{t('trading.placeOrder')}</h2>
      <label>{t('trading.quantity')}</label>
      <span>{i18n.formatCurrency(totalValue)}</span>
      <p>{i18n.formatRelativeTime(lastUpdate)}</p>
    </div>
  );
}
```

Locale changes propagate via the `onChange` listener, triggering re-renders:

```typescript
useEffect(() => {
  const unsub = getI18n().onChange((locale) => {
    setCurrentLocale(locale);
  });
  return unsub;
}, []);
```

---

## Adding a New Locale

1. Add the locale code to the `Locale` type union
2. Define the `LocaleConfig` entry in `localeConfigs` with formatting rules and plural function
3. Add built-in translations (at minimum `common` namespace) to `builtInTranslations`
4. Register a loader for the full translation bundle
5. Test pluralization edge cases and number/currency formatting for that locale

// Platform Internationalization - Translations, Formatting & Locale Management

export type Locale = 'en' | 'es' | 'fr' | 'de' | 'ja' | 'zh' | 'ko' | 'ar' | 'pt' | 'ru';
export type Namespace = 'common' | 'chart' | 'trading' | 'portfolio' | 'screener' | 'orders' | 'news' | 'settings' | 'errors';
export type Direction = 'ltr' | 'rtl';

export interface LocaleConfig {
  code: Locale;
  name: string;
  nativeName: string;
  direction: Direction;
  dateFormat: string;
  timeFormat: string;
  numberDecimal: string;
  numberThousands: string;
  currencySymbol: string;
  currencyPosition: 'prefix' | 'suffix';
  pluralRule: (n: number) => PluralForm;
}

export type PluralForm = 'zero' | 'one' | 'two' | 'few' | 'many' | 'other';

export type TranslationValue = string | Record<PluralForm, string>;
export type TranslationMap = Record<string, TranslationValue>;
export type NamespacedTranslations = Partial<Record<Namespace, TranslationMap>>;
export type AllTranslations = Partial<Record<Locale, NamespacedTranslations>>;

interface InterpolationValues {
  [key: string]: string | number;
}

// --- Plural Rules ---

function pluralEn(n: number): PluralForm { return n === 1 ? 'one' : 'other'; }
function pluralFr(n: number): PluralForm { return n <= 1 ? 'one' : 'other'; }
function pluralJa(): PluralForm { return 'other'; }
function pluralAr(n: number): PluralForm {
  if (n === 0) return 'zero';
  if (n === 1) return 'one';
  if (n === 2) return 'two';
  if (n % 100 >= 3 && n % 100 <= 10) return 'few';
  if (n % 100 >= 11 && n % 100 <= 99) return 'many';
  return 'other';
}
function pluralRu(n: number): PluralForm {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'one';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'few';
  if (mod10 === 0 || (mod10 >= 5 && mod10 <= 9) || (mod100 >= 11 && mod100 <= 14)) return 'many';
  return 'other';
}

// --- Locale Configs ---

export const localeConfigs: Record<Locale, LocaleConfig> = {
  en: { code: 'en', name: 'English', nativeName: 'English', direction: 'ltr', dateFormat: 'MM/DD/YYYY', timeFormat: 'hh:mm A', numberDecimal: '.', numberThousands: ',', currencySymbol: '$', currencyPosition: 'prefix', pluralRule: pluralEn },
  es: { code: 'es', name: 'Spanish', nativeName: 'Español', direction: 'ltr', dateFormat: 'DD/MM/YYYY', timeFormat: 'HH:mm', numberDecimal: ',', numberThousands: '.', currencySymbol: '€', currencyPosition: 'suffix', pluralRule: pluralEn },
  fr: { code: 'fr', name: 'French', nativeName: 'Français', direction: 'ltr', dateFormat: 'DD/MM/YYYY', timeFormat: 'HH:mm', numberDecimal: ',', numberThousands: '\u00A0', currencySymbol: '€', currencyPosition: 'suffix', pluralRule: pluralFr },
  de: { code: 'de', name: 'German', nativeName: 'Deutsch', direction: 'ltr', dateFormat: 'DD.MM.YYYY', timeFormat: 'HH:mm', numberDecimal: ',', numberThousands: '.', currencySymbol: '€', currencyPosition: 'suffix', pluralRule: pluralEn },
  ja: { code: 'ja', name: 'Japanese', nativeName: '日本語', direction: 'ltr', dateFormat: 'YYYY/MM/DD', timeFormat: 'HH:mm', numberDecimal: '.', numberThousands: ',', currencySymbol: '¥', currencyPosition: 'prefix', pluralRule: pluralJa },
  zh: { code: 'zh', name: 'Chinese', nativeName: '中文', direction: 'ltr', dateFormat: 'YYYY/MM/DD', timeFormat: 'HH:mm', numberDecimal: '.', numberThousands: ',', currencySymbol: '¥', currencyPosition: 'prefix', pluralRule: pluralJa },
  ko: { code: 'ko', name: 'Korean', nativeName: '한국어', direction: 'ltr', dateFormat: 'YYYY.MM.DD', timeFormat: 'HH:mm', numberDecimal: '.', numberThousands: ',', currencySymbol: '₩', currencyPosition: 'prefix', pluralRule: pluralJa },
  ar: { code: 'ar', name: 'Arabic', nativeName: 'العربية', direction: 'rtl', dateFormat: 'DD/MM/YYYY', timeFormat: 'hh:mm A', numberDecimal: '٫', numberThousands: '٬', currencySymbol: 'ر.س', currencyPosition: 'suffix', pluralRule: pluralAr },
  pt: { code: 'pt', name: 'Portuguese', nativeName: 'Português', direction: 'ltr', dateFormat: 'DD/MM/YYYY', timeFormat: 'HH:mm', numberDecimal: ',', numberThousands: '.', currencySymbol: 'R$', currencyPosition: 'prefix', pluralRule: pluralEn },
  ru: { code: 'ru', name: 'Russian', nativeName: 'Русский', direction: 'ltr', dateFormat: 'DD.MM.YYYY', timeFormat: 'HH:mm', numberDecimal: ',', numberThousands: '\u00A0', currencySymbol: '₽', currencyPosition: 'suffix', pluralRule: pluralRu },
};

// --- Built-in English Translations ---

const enCommon: TranslationMap = {
  'app.name': 'TradingView Pro',
  'app.loading': 'Loading...',
  'app.error': 'Something went wrong',
  'app.retry': 'Retry',
  'app.cancel': 'Cancel',
  'app.confirm': 'Confirm',
  'app.save': 'Save',
  'app.delete': 'Delete',
  'app.edit': 'Edit',
  'app.close': 'Close',
  'app.search': 'Search',
  'app.noResults': 'No results found',
  'app.more': 'More',
  'app.less': 'Less',
  'app.yes': 'Yes',
  'app.no': 'No',
  'app.ok': 'OK',
  'items.count': { one: '{{count}} item', other: '{{count}} items' },
  'time.ago.seconds': { one: '{{count}} second ago', other: '{{count}} seconds ago' },
  'time.ago.minutes': { one: '{{count}} minute ago', other: '{{count}} minutes ago' },
  'time.ago.hours': { one: '{{count}} hour ago', other: '{{count}} hours ago' },
  'time.ago.days': { one: '{{count}} day ago', other: '{{count}} days ago' },
};

const enChart: TranslationMap = {
  'chart.title': 'Chart',
  'chart.timeframe': 'Timeframe',
  'chart.indicators': 'Indicators',
  'chart.drawings': 'Drawings',
  'chart.fullscreen': 'Fullscreen',
  'chart.screenshot': 'Screenshot',
  'chart.resetZoom': 'Reset Zoom',
  'chart.candlestick': 'Candlestick',
  'chart.line': 'Line',
  'chart.area': 'Area',
  'chart.bar': 'Bar',
  'chart.heikinAshi': 'Heikin Ashi',
  'chart.volume': 'Volume',
  'chart.open': 'Open',
  'chart.high': 'High',
  'chart.low': 'Low',
  'chart.close': 'Close',
  'chart.change': 'Change',
  'chart.crosshair': 'Crosshair',
};

const enTrading: TranslationMap = {
  'trading.buy': 'Buy',
  'trading.sell': 'Sell',
  'trading.marketOrder': 'Market Order',
  'trading.limitOrder': 'Limit Order',
  'trading.stopOrder': 'Stop Order',
  'trading.stopLimit': 'Stop Limit',
  'trading.quantity': 'Quantity',
  'trading.price': 'Price',
  'trading.total': 'Total',
  'trading.stopLoss': 'Stop Loss',
  'trading.takeProfit': 'Take Profit',
  'trading.leverage': 'Leverage',
  'trading.margin': 'Margin',
  'trading.placeOrder': 'Place Order',
  'trading.confirmOrder': 'Confirm Order',
  'trading.orderPlaced': 'Order placed successfully',
  'trading.orderFailed': 'Order failed: {{reason}}',
  'trading.positions': { one: '{{count}} position', other: '{{count}} positions' },
};

const enPortfolio: TranslationMap = {
  'portfolio.title': 'Portfolio',
  'portfolio.totalValue': 'Total Value',
  'portfolio.dayChange': 'Day Change',
  'portfolio.totalReturn': 'Total Return',
  'portfolio.holdings': 'Holdings',
  'portfolio.cashBalance': 'Cash Balance',
  'portfolio.buyingPower': 'Buying Power',
  'portfolio.unrealizedPnl': 'Unrealized P&L',
  'portfolio.realizedPnl': 'Realized P&L',
  'portfolio.allocation': 'Allocation',
  'portfolio.performance': 'Performance',
};

const enErrors: TranslationMap = {
  'error.network': 'Network error. Please check your connection.',
  'error.auth': 'Authentication failed. Please log in again.',
  'error.permission': 'You don\'t have permission to perform this action.',
  'error.notFound': 'Resource not found.',
  'error.rateLimit': 'Too many requests. Please wait a moment.',
  'error.server': 'Server error. Please try again later.',
  'error.validation': 'Please check your input and try again.',
  'error.timeout': 'Request timed out. Please try again.',
  'error.maintenance': 'System is under maintenance. Please try again later.',
  'error.unknown': 'An unexpected error occurred.',
};

const enOrders: TranslationMap = {
  'orders.title': 'Orders',
  'orders.open': 'Open Orders',
  'orders.filled': 'Filled',
  'orders.cancelled': 'Cancelled',
  'orders.pending': 'Pending',
  'orders.partial': 'Partially Filled',
  'orders.rejected': 'Rejected',
  'orders.cancelOrder': 'Cancel Order',
  'orders.modifyOrder': 'Modify Order',
  'orders.noOrders': 'No orders',
};

// --- Built-in Translations Map ---

const builtInTranslations: AllTranslations = {
  en: {
    common: enCommon,
    chart: enChart,
    trading: enTrading,
    portfolio: enPortfolio,
    errors: enErrors,
    orders: enOrders,
  },
  es: {
    common: {
      'app.name': 'TradingView Pro',
      'app.loading': 'Cargando...',
      'app.error': 'Algo salió mal',
      'app.retry': 'Reintentar',
      'app.cancel': 'Cancelar',
      'app.confirm': 'Confirmar',
      'app.save': 'Guardar',
      'app.delete': 'Eliminar',
      'app.search': 'Buscar',
      'items.count': { one: '{{count}} elemento', other: '{{count}} elementos' },
    },
    trading: {
      'trading.buy': 'Comprar',
      'trading.sell': 'Vender',
      'trading.placeOrder': 'Colocar Orden',
      'trading.quantity': 'Cantidad',
      'trading.price': 'Precio',
    },
  },
  fr: {
    common: {
      'app.loading': 'Chargement...',
      'app.error': 'Quelque chose s\'est mal passé',
      'app.retry': 'Réessayer',
      'app.cancel': 'Annuler',
      'app.confirm': 'Confirmer',
      'app.save': 'Enregistrer',
      'app.delete': 'Supprimer',
      'app.search': 'Rechercher',
      'items.count': { one: '{{count}} élément', other: '{{count}} éléments' },
    },
    trading: {
      'trading.buy': 'Acheter',
      'trading.sell': 'Vendre',
      'trading.placeOrder': 'Passer l\'ordre',
      'trading.quantity': 'Quantité',
      'trading.price': 'Prix',
    },
  },
  de: {
    common: {
      'app.loading': 'Wird geladen...',
      'app.error': 'Etwas ist schiefgelaufen',
      'app.retry': 'Erneut versuchen',
      'app.cancel': 'Abbrechen',
      'app.confirm': 'Bestätigen',
      'app.save': 'Speichern',
      'app.delete': 'Löschen',
      'app.search': 'Suchen',
      'items.count': { one: '{{count}} Element', other: '{{count}} Elemente' },
    },
    trading: {
      'trading.buy': 'Kaufen',
      'trading.sell': 'Verkaufen',
      'trading.placeOrder': 'Order aufgeben',
    },
  },
  ja: {
    common: {
      'app.loading': '読み込み中...',
      'app.error': 'エラーが発生しました',
      'app.retry': '再試行',
      'app.cancel': 'キャンセル',
      'app.confirm': '確認',
      'app.save': '保存',
      'app.delete': '削除',
      'app.search': '検索',
      'items.count': { other: '{{count}}件' },
    },
    trading: {
      'trading.buy': '買い',
      'trading.sell': '売り',
      'trading.placeOrder': '注文する',
    },
  },
  zh: {
    common: {
      'app.loading': '加载中...',
      'app.error': '出了点问题',
      'app.retry': '重试',
      'app.cancel': '取消',
      'app.confirm': '确认',
      'app.save': '保存',
      'app.delete': '删除',
      'app.search': '搜索',
      'items.count': { other: '{{count}} 项' },
    },
    trading: {
      'trading.buy': '买入',
      'trading.sell': '卖出',
      'trading.placeOrder': '下单',
    },
  },
  ko: {
    common: {
      'app.loading': '로딩 중...',
      'app.error': '오류가 발생했습니다',
      'app.retry': '재시도',
      'app.cancel': '취소',
      'app.confirm': '확인',
      'app.save': '저장',
      'app.delete': '삭제',
      'app.search': '검색',
      'items.count': { other: '{{count}}개' },
    },
    trading: {
      'trading.buy': '매수',
      'trading.sell': '매도',
      'trading.placeOrder': '주문하기',
    },
  },
  ar: {
    common: {
      'app.loading': '...جاري التحميل',
      'app.error': 'حدث خطأ ما',
      'app.retry': 'إعادة المحاولة',
      'app.cancel': 'إلغاء',
      'app.confirm': 'تأكيد',
      'app.save': 'حفظ',
      'app.delete': 'حذف',
      'app.search': 'بحث',
      'items.count': { zero: '{{count}} عنصر', one: '{{count}} عنصر', two: '{{count}} عنصران', few: '{{count}} عناصر', many: '{{count}} عنصراً', other: '{{count}} عنصر' },
    },
    trading: {
      'trading.buy': 'شراء',
      'trading.sell': 'بيع',
      'trading.placeOrder': 'تنفيذ الأمر',
    },
  },
  pt: {
    common: {
      'app.loading': 'Carregando...',
      'app.error': 'Algo deu errado',
      'app.retry': 'Tentar novamente',
      'app.cancel': 'Cancelar',
      'app.confirm': 'Confirmar',
      'app.save': 'Salvar',
      'app.delete': 'Excluir',
      'app.search': 'Pesquisar',
      'items.count': { one: '{{count}} item', other: '{{count}} itens' },
    },
    trading: {
      'trading.buy': 'Comprar',
      'trading.sell': 'Vender',
      'trading.placeOrder': 'Executar Ordem',
    },
  },
  ru: {
    common: {
      'app.loading': 'Загрузка...',
      'app.error': 'Что-то пошло не так',
      'app.retry': 'Повторить',
      'app.cancel': 'Отмена',
      'app.confirm': 'Подтвердить',
      'app.save': 'Сохранить',
      'app.delete': 'Удалить',
      'app.search': 'Поиск',
      'items.count': { one: '{{count}} элемент', few: '{{count}} элемента', many: '{{count}} элементов', other: '{{count}} элементов' },
    },
    trading: {
      'trading.buy': 'Купить',
      'trading.sell': 'Продать',
      'trading.placeOrder': 'Разместить ордер',
    },
  },
};

// --- I18n Engine ---

export class I18nEngine {
  private static STORAGE_KEY = 'platform_locale';
  private locale: Locale;
  private fallbackLocale: Locale = 'en';
  private translations: AllTranslations;
  private loadedNamespaces = new Map<string, Set<Namespace>>();
  private listeners = new Set<(locale: Locale) => void>();
  private loaders = new Map<string, () => Promise<NamespacedTranslations>>();

  constructor(options?: { locale?: Locale; fallback?: Locale }) {
    this.translations = structuredClone(builtInTranslations);
    this.fallbackLocale = options?.fallback || 'en';
    this.locale = options?.locale || this.detectLocale();
    this.applyDirection();
    this.markBuiltInLoaded();
  }

  private detectLocale(): Locale {
    try {
      const stored = localStorage.getItem(I18nEngine.STORAGE_KEY);
      if (stored && stored in localeConfigs) return stored as Locale;
    } catch { /* noop */ }

    if (typeof navigator !== 'undefined') {
      const langs = navigator.languages || [navigator.language];
      for (const lang of langs) {
        const code = lang.split('-')[0].toLowerCase();
        if (code in localeConfigs) return code as Locale;
      }
    }

    return this.fallbackLocale;
  }

  private applyDirection(): void {
    if (typeof document === 'undefined') return;
    const config = localeConfigs[this.locale];
    document.documentElement.setAttribute('dir', config.direction);
    document.documentElement.setAttribute('lang', this.locale);
  }

  private markBuiltInLoaded(): void {
    for (const [locale, namespaces] of Object.entries(this.translations)) {
      if (!namespaces) continue;
      const nsSet = new Set<Namespace>(Object.keys(namespaces) as Namespace[]);
      this.loadedNamespaces.set(locale, nsSet);
    }
  }

  getLocale(): Locale { return this.locale; }

  getConfig(): LocaleConfig { return localeConfigs[this.locale]; }

  getDirection(): Direction { return localeConfigs[this.locale].direction; }

  isRTL(): boolean { return this.getDirection() === 'rtl'; }

  getAllLocales(): LocaleConfig[] { return Object.values(localeConfigs); }

  async setLocale(locale: Locale): Promise<void> {
    if (!(locale in localeConfigs)) throw new Error(`Unknown locale: ${locale}`);
    this.locale = locale;
    this.applyDirection();
    try { localStorage.setItem(I18nEngine.STORAGE_KEY, locale); } catch { /* noop */ }
    this.listeners.forEach(fn => fn(locale));
  }

  registerLoader(locale: Locale, loader: () => Promise<NamespacedTranslations>): void {
    this.loaders.set(locale, loader);
  }

  async loadNamespace(locale: Locale, namespace: Namespace): Promise<void> {
    const loaded = this.loadedNamespaces.get(locale);
    if (loaded?.has(namespace)) return;

    const loader = this.loaders.get(locale);
    if (loader) {
      const translations = await loader();
      if (!this.translations[locale]) this.translations[locale] = {};
      Object.assign(this.translations[locale]!, translations);
      if (!this.loadedNamespaces.has(locale)) this.loadedNamespaces.set(locale, new Set());
      this.loadedNamespaces.get(locale)!.add(namespace);
    }
  }

  addTranslations(locale: Locale, namespace: Namespace, translations: TranslationMap): void {
    if (!this.translations[locale]) this.translations[locale] = {};
    if (!this.translations[locale]![namespace]) this.translations[locale]![namespace] = {};
    Object.assign(this.translations[locale]![namespace]!, translations);
    if (!this.loadedNamespaces.has(locale)) this.loadedNamespaces.set(locale, new Set());
    this.loadedNamespaces.get(locale)!.add(namespace);
  }

  t(key: string, values?: InterpolationValues, options?: { count?: number; ns?: Namespace }): string {
    const ns = options?.ns || this.inferNamespace(key);
    const count = options?.count;

    let result = this.resolveKey(this.locale, ns, key, count)
      ?? this.resolveKey(this.fallbackLocale, ns, key, count)
      ?? key;

    if (values) {
      result = this.interpolate(result, values);
    }

    return result;
  }

  private inferNamespace(key: string): Namespace | undefined {
    const parts = key.split('.');
    const nsCandidate = parts[0] as Namespace;
    const allNs: Namespace[] = ['common', 'chart', 'trading', 'portfolio', 'screener', 'orders', 'news', 'settings', 'errors'];
    return allNs.includes(nsCandidate) ? nsCandidate : undefined;
  }

  private resolveKey(locale: Locale, ns: Namespace | undefined, key: string, count?: number): string | null {
    const localeTranslations = this.translations[locale];
    if (!localeTranslations) return null;

    if (ns) {
      const nsTranslations = localeTranslations[ns];
      if (nsTranslations && key in nsTranslations) {
        return this.resolvePlural(nsTranslations[key], locale, count);
      }
    }

    for (const nsKey of Object.keys(localeTranslations) as Namespace[]) {
      const nsTranslations = localeTranslations[nsKey];
      if (nsTranslations && key in nsTranslations) {
        return this.resolvePlural(nsTranslations[key], locale, count);
      }
    }

    return null;
  }

  private resolvePlural(value: TranslationValue, locale: Locale, count?: number): string {
    if (typeof value === 'string') return value;

    if (count !== undefined) {
      const form = localeConfigs[locale].pluralRule(count);
      return value[form] ?? value.other ?? Object.values(value)[0] ?? '';
    }

    return value.other ?? Object.values(value)[0] ?? '';
  }

  private interpolate(template: string, values: InterpolationValues): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
      return key in values ? String(values[key]) : `{{${key}}}`;
    });
  }

  onChange(callback: (locale: Locale) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  // --- Number Formatting ---

  formatNumber(value: number, options?: {
    decimals?: number;
    compact?: boolean;
    sign?: boolean;
  }): string {
    const config = localeConfigs[this.locale];

    if (options?.compact) {
      return this.formatCompact(value);
    }

    const decimals = options?.decimals ?? 2;
    const abs = Math.abs(value);
    const [intPart, decPart] = abs.toFixed(decimals).split('.');
    const withThousands = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, config.numberThousands);
    const sign = options?.sign && value > 0 ? '+' : (value < 0 ? '-' : '');
    return decPart ? `${sign}${withThousands}${config.numberDecimal}${decPart}` : `${sign}${withThousands}`;
  }

  private formatCompact(value: number): string {
    const abs = Math.abs(value);
    const sign = value < 0 ? '-' : '';
    if (abs >= 1e12) return `${sign}${(abs / 1e12).toFixed(2)}T`;
    if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(2)}B`;
    if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(2)}M`;
    if (abs >= 1e3) return `${sign}${(abs / 1e3).toFixed(2)}K`;
    return `${sign}${abs.toFixed(2)}`;
  }

  formatPercent(value: number, decimals = 2): string {
    const formatted = this.formatNumber(value, { decimals, sign: true });
    return `${formatted}%`;
  }

  formatCurrency(value: number, currency?: string, options?: { decimals?: number; compact?: boolean }): string {
    const config = localeConfigs[this.locale];
    const symbol = currency || config.currencySymbol;
    const formatted = this.formatNumber(Math.abs(value), { decimals: options?.decimals ?? 2, compact: options?.compact });
    const sign = value < 0 ? '-' : '';

    if (config.currencyPosition === 'prefix') {
      return `${sign}${symbol}${formatted}`;
    }
    return `${sign}${formatted} ${symbol}`;
  }

  // --- Date Formatting ---

  formatDate(date: Date | number, format?: string): string {
    const d = typeof date === 'number' ? new Date(date) : date;
    const fmt = format || localeConfigs[this.locale].dateFormat;

    const tokens: Record<string, string> = {
      'YYYY': String(d.getFullYear()),
      'YY': String(d.getFullYear()).slice(-2),
      'MM': String(d.getMonth() + 1).padStart(2, '0'),
      'DD': String(d.getDate()).padStart(2, '0'),
      'HH': String(d.getHours()).padStart(2, '0'),
      'hh': String(d.getHours() % 12 || 12).padStart(2, '0'),
      'mm': String(d.getMinutes()).padStart(2, '0'),
      'ss': String(d.getSeconds()).padStart(2, '0'),
      'A': d.getHours() >= 12 ? 'PM' : 'AM',
    };

    return fmt.replace(/YYYY|YY|MM|DD|HH|hh|mm|ss|A/g, match => tokens[match] || match);
  }

  formatTime(date: Date | number, format?: string): string {
    const fmt = format || localeConfigs[this.locale].timeFormat;
    return this.formatDate(date, fmt);
  }

  formatDateTime(date: Date | number): string {
    return `${this.formatDate(date)} ${this.formatTime(date)}`;
  }

  formatRelativeTime(date: Date | number): string {
    const d = typeof date === 'number' ? date : date.getTime();
    const diff = Math.floor((Date.now() - d) / 1000);

    if (diff < 60) return this.t('time.ago.seconds', { count: diff }, { count: diff, ns: 'common' });
    if (diff < 3600) { const m = Math.floor(diff / 60); return this.t('time.ago.minutes', { count: m }, { count: m, ns: 'common' }); }
    if (diff < 86400) { const h = Math.floor(diff / 3600); return this.t('time.ago.hours', { count: h }, { count: h, ns: 'common' }); }
    const days = Math.floor(diff / 86400);
    if (days < 30) return this.t('time.ago.days', { count: days }, { count: days, ns: 'common' });
    return this.formatDate(date);
  }

  // --- Financial Formatting ---

  formatPrice(value: number, decimals?: number): string {
    const d = decimals ?? (Math.abs(value) < 1 ? 6 : Math.abs(value) < 100 ? 4 : 2);
    return this.formatNumber(value, { decimals: d });
  }

  formatVolume(value: number): string {
    return this.formatNumber(value, { compact: true, decimals: 2 });
  }

  formatMarketCap(value: number): string {
    return this.formatCurrency(value, undefined, { compact: true });
  }

  formatPnL(value: number, decimals = 2): string {
    const sign = value > 0 ? '+' : '';
    return `${sign}${this.formatCurrency(value, undefined, { decimals })}`;
  }
}

// --- Singleton ---

let defaultEngine: I18nEngine | null = null;

export function getI18n(): I18nEngine {
  if (!defaultEngine) defaultEngine = new I18nEngine();
  return defaultEngine;
}

export function t(key: string, values?: InterpolationValues, options?: { count?: number; ns?: Namespace }): string {
  return getI18n().t(key, values, options);
}

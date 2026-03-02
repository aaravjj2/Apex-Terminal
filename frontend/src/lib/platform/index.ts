// Platform Infrastructure - Barrel Exports

// Accessibility
export {
  type ContrastResult,
  type FocusTrapOptions,
  type LiveRegionOptions,
  type SkipLink,
  type HeadingNode,
  type LandmarkInfo,
  type ColorBlindType,
  type AccessibilityAuditResult,
  type AccessibilityViolation,
  parseColor,
  contrastRatio,
  suggestAccessibleColor,
  simulateColorBlindness,
  colorBlindSafeCheck,
  getFocusableElements,
  FocusTrap,
  RovingTabindex,
  LiveRegionManager,
  createSkipLinks,
  ariaHelpers,
  associateErrorMessage,
  clearErrorMessage,
  makeFieldAccessible,
  validateLandmarks,
  getLandmarks,
  validateHeadingHierarchy,
  prefersReducedMotion,
  prefersHighContrast,
  prefersDarkMode,
  onMotionPreferenceChange,
  onContrastPreferenceChange,
  FontSizeManager,
  generateChartDescription,
  runAccessibilityAudit,
} from './accessibility';

// Theme
export {
  type ThemeColors,
  type ThemeFinancial,
  type ThemeChart,
  type ThemeTypography,
  type ThemeSpacing,
  type ThemeShadows,
  type ThemeBorders,
  type ThemeRadii,
  type ThemeTransitions,
  type ThemeZIndex,
  type ComponentTokens,
  type Theme,
  bloombergDarkTheme,
  tradingViewDarkTheme,
  tradingViewLightTheme,
  highContrastTheme,
  nordTheme,
  draculaTheme,
  ThemeEngine,
  generateCSSVariables,
  getThemeVar,
  interpolateThemeColors,
  animateThemeTransition,
} from './theme';

// Keyboard
export {
  type ModifierKey,
  type KeyBinding,
  type ShortcutDefinition,
  type ShortcutCategory,
  type ShortcutContext,
  type ChordSequence,
  type ShortcutConflict,
  type ShortcutCheatSheetEntry,
  ShortcutRegistry,
  createDefaultShortcuts,
  registerDefaultViSequences,
  registerDefaultChords,
  serializeBinding,
  displayBinding,
  matchesBinding,
  isInputFocused,
} from './keyboard';

// I18n
export {
  type Locale,
  type Namespace,
  type Direction,
  type LocaleConfig,
  type PluralForm,
  type TranslationValue,
  type TranslationMap,
  localeConfigs,
  I18nEngine,
  getI18n,
  t,
} from './i18n';

// Service Worker
export {
  type CacheStrategy,
  type CacheRoute,
  type SWConfig,
  type SyncTask,
  type PushSubscriptionInfo,
  ServiceWorkerManager,
  RuntimeCache,
  OfflineDetector,
  createDefaultSWConfig,
} from './serviceWorker';

// Analytics
export {
  type AnalyticsEvent,
  type PageView,
  type PerformanceMetrics,
  type UserJourneyStep,
  type FunnelStep,
  type ABTestVariant,
  type ErrorEvent,
  type FeatureUsage,
  type SessionInfo,
  type AnalyticsProvider,
  AnalyticsEngine,
  createBeaconProvider,
  createConsoleProvider,
} from './analytics';

// Error Handling
export {
  type ErrorCategory,
  type ErrorSeverity,
  type AppError,
  type Breadcrumb,
  type RetryConfig,
  type ErrorReportPayload,
  type ErrorStats,
  type ErrorBoundaryState,
  classifyError,
  createAppError,
  withRetry,
  BreadcrumbCollector,
  ErrorReporter,
  GlobalErrorHandler,
  createErrorBoundaryState,
  handleErrorBoundaryCatch,
  retryErrorBoundary,
  createHttpError,
  handleResponse,
} from './errorHandling';

// Feature Flags
export {
  type FeatureFlag,
  type FlagVariant,
  type FlagEvaluation,
  type FlagOverride,
  type FlagAuditEntry,
  type RemoteFlagConfig,
  FeatureFlagEngine,
  createDefaultFlags,
} from './featureFlags';

// Permissions
export {
  type Permission,
  type Role,
  type ResourceType,
  type RoleDefinition,
  type ResourcePermission,
  type PermissionCheck,
  type AuditEntry,
  PermissionEngine,
  PermissionError,
  createPermissionGuard,
} from './permissions';

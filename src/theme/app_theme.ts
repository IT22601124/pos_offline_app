export type AppThemeMode = 'light' | 'dark';

export const APP_THEME_KEY = 'nova_app_theme';
export const APP_THEME_CHANGE_EVENT = 'nova-app-theme-change';

export const isAppThemeMode = (value: unknown): value is AppThemeMode =>
  value === 'light' || value === 'dark';

export const getStoredTheme = (): AppThemeMode => {
  if (typeof window === 'undefined') return 'dark';

  const storedTheme = window.localStorage.getItem(APP_THEME_KEY);
  return isAppThemeMode(storedTheme) ? storedTheme : 'dark';
};

export const applyAppTheme = (theme: AppThemeMode) => {
  if (typeof document === 'undefined') return;

  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
};

export const persistAppTheme = (theme: AppThemeMode) => {
  if (typeof window === 'undefined') return;

  window.localStorage.setItem(APP_THEME_KEY, theme);
  window.dispatchEvent(new CustomEvent<AppThemeMode>(APP_THEME_CHANGE_EVENT, { detail: theme }));
};

export type AppearancePreference = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'city-elevation:appearance';

export function getStoredAppearance() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);

    return raw === 'light' || raw === 'dark' || raw === 'system'
      ? raw
      : 'system';
  } catch {
    return 'system';
  }
}

export function storeAppearance(preference: AppearancePreference) {
  try {
    window.localStorage.setItem(STORAGE_KEY, preference);
  } catch {
    // Ignore storage/privacy failures.
  }
}

export function resolveTheme(preference: AppearancePreference): ResolvedTheme {
  if (preference === 'light' || preference === 'dark') {
    return preference;
  }

  return systemTheme();
}

export function watchSystemTheme(
  onChange: (theme: ResolvedTheme) => void,
) {
  const query = window.matchMedia('(prefers-color-scheme: dark)');
  const handler = () => onChange(query.matches ? 'dark' : 'light');

  query.addEventListener('change', handler);

  return () => query.removeEventListener('change', handler);
}

function systemTheme(): ResolvedTheme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

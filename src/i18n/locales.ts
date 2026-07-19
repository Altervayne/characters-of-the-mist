/*
 * The single source of truth for the app's available localizations. Every language picker (the desktop +
 * mobile General settings, both onboarding screens) and the About credits read from here, so adding a
 * locale is a one-line edit in one place instead of a hunt across half a dozen components.
 *
 * When a new locale lands: add its row below, drop its `<code>.json` into `messages/`, and register it in
 * `src/i18n/config.ts` (the static JSON import + the `resources` entry).
 */

export interface LocaleInfo {
   /** ISO 639-1 code, the value i18next uses (e.g. 'en', 'fr'). */
   code: string;
   /** The language's name in English (e.g. 'French'). */
   englishName: string;
   /** The language's name in its own language (e.g. 'Français'). */
   nativeName: string;
   /** The community contributor who provided the translation, or `null` for the ones authored in-house. */
   contributor: string | null;
}

export const DEFAULT_LOCALE = 'en';

export const LOCALES: readonly LocaleInfo[] = [
   { code: 'en', englishName: 'English', nativeName: 'English', contributor: null },
   { code: 'fr', englishName: 'French', nativeName: 'Français', contributor: null },
   { code: 'de', englishName: 'German', nativeName: 'Deutsch', contributor: 'Markus Raab' },
   { code: 'es', englishName: 'Spanish', nativeName: 'Español', contributor: 'Salvador Pérez Martín' },
] as const;

/**
 * Normalizes an i18next language string to a base locale code we actually ship: strips any region suffix
 * ('en-US' -> 'en') and falls back to {@link DEFAULT_LOCALE} for anything unknown, so a language picker's
 * value always matches one of its options.
 */
export function resolveLocaleCode(language: string | undefined): string {
   const base = language?.split('-')[0];
   return LOCALES.some((locale) => locale.code === base) ? (base as string) : DEFAULT_LOCALE;
}

/** The community-contributed locales (those with a named translator), for the About > Credits list. */
export const CONTRIBUTED_LOCALES: readonly LocaleInfo[] = LOCALES.filter((locale) => locale.contributor !== null);

/**
 * Builds the markdown credit list rendered under About > Credits: one `- **Native** (English): Contributor`
 * line per community-contributed locale, wrapped in the leading/trailing newline the markdown renderer expects.
 */
export function buildLocalizationCreditsMarkdown(): string {
   const lines = CONTRIBUTED_LOCALES.map((locale) => `- **${locale.nativeName}** (${locale.englishName}): ${locale.contributor}`);
   return `\n${lines.join('\n')}\n`;
}

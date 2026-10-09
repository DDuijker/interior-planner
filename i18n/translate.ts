import { en } from "./messages/en";
import { nl, type MessageKey } from "./messages/nl";

export const LOCALES = ["nl", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export type { MessageKey };

export const messages: Record<Locale, Record<MessageKey, string>> = { nl, en };

export type Params = Record<string, string | number>;

/** Look up a message and fill `{name}` placeholders. Unknown params stay visible. */
export function translate(locale: Locale, key: MessageKey, params?: Params): string {
  const template = messages[locale][key] ?? messages.nl[key] ?? key;
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (m, name: string) =>
    name in params ? String(params[name]) : m,
  );
}

/** Pick a supported locale from browser preferences (e.g. navigator.languages). */
export function detectLocale(preferred: readonly string[]): Locale {
  for (const tag of preferred) {
    const base = tag.toLowerCase().split("-")[0];
    if ((LOCALES as readonly string[]).includes(base ?? "")) return base as Locale;
  }
  return "nl";
}

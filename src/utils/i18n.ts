import msDict from '../i18n/ms.json';
import enDict from '../i18n/en.json';

type NestedDictionary = { [key: string]: string | NestedDictionary };

function getNestedValue(obj: NestedDictionary, path: string): string | undefined {
  const keys = path.split('.');
  let current: any = obj;
  for (const key of keys) {
    if (current && typeof current === 'object' && key in current) {
      current = current[key];
    } else {
      return undefined;
    }
  }
  return typeof current === 'string' ? current : undefined;
}

function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return Object.entries(params).reduce(
    (str, [key, val]) => str.replace(new RegExp(`\\{${key}\\}`, 'g'), String(val)),
    template
  );
}

export interface BilingualMessage {
  message_ms: string;
  message_en: string;
}

export function getBilingualText(keyPath: string, params?: Record<string, string | number>): BilingualMessage {
  const rawMs = getNestedValue(msDict as NestedDictionary, keyPath) || keyPath;
  const rawEn = getNestedValue(enDict as NestedDictionary, keyPath) || keyPath;

  return {
    message_ms: interpolate(rawMs, params),
    message_en: interpolate(rawEn, params),
  };
}

export function getBilingualError(code: string, params?: Record<string, string | number>): BilingualMessage {
  return getBilingualText(`errors.${code}`, params);
}

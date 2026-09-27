import { useAuth } from "../state/AuthContext.jsx";
import { translations } from "./translations.js";

/**
 * useT() — returns the translations object for the current user language.
 * Usage:  const t = useT();  then  <h1>{t.feedTitle}</h1>
 * For function keys:  {t.feedShown(shown, total)}
 */
export function useT() {
  const { user } = useAuth();
  const lang = user?.uiLang ?? "en";
  return translations[lang] ?? translations.en;
}

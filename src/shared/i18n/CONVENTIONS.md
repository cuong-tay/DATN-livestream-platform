# I18n Conventions

Pages, widgets, and features must not hard-code user-facing UI text.

Workflow:

1. Add the key to `src/shared/i18n/translations.ts` for every supported language.
2. Import `useI18n` from `@/shared/i18n`.
3. Replace visible text, placeholders, aria labels, toast messages, and empty/error states with `t("...")`.
4. Use `useI18nFormatters()` for dates, numbers, and currency instead of hard-coded `toLocaleString("vi-VN")`.
5. Run `npm run typecheck`.
6. Run `npm run check:i18n-pages` and review warnings for the changed files before finishing.

Allowed hard-coded values:

- Route paths, API paths, CSS classes, storage keys, query params, and test ids.
- Internal enum values such as `LIVE`, `VOD`, `ENDED`, or backend status codes.
- Backend content such as usernames, video titles, category names, and chat messages.
- Product units or brand terms only when they are intentionally language-neutral; otherwise add a translation key.

Recommended namespaces:

- `common.*` for reusable nouns and simple labels.
- `actions.*` for verbs and button labels.
- `status.*` for state badges and lifecycle labels.
- `errors.*` for reusable error messages.
- `{page}.*` for page-specific copy.

Useful guard command:

```powershell
npm run check:i18n-pages
```

Use `node scripts/check-page-i18n.mjs --fail` if the check should fail CI instead of warning locally.

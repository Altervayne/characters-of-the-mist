# Board text display fonts

Self-hosted woff2 faces for the board TEXT element's display font tokens
(`handwriting` / `marker` / `rounded`). Declared via `@font-face` in
`src/app/global.css` and precached by the service worker (the `woff2`
glob in `vite.config.ts`).

Drop the **Latin-subset woff2** files here with these exact names:

| File                    | Font             | Weights     | License        | Source                                            |
| ----------------------- | ---------------- | ----------- | -------------- | ------------------------------------------------- |
| `caveat.woff2`          | Caveat           | 400–700     | OFL 1.1        | https://fonts.google.com/specimen/Caveat          |
| `permanent-marker.woff2`| Permanent Marker | 400         | OFL 1.1        | https://fonts.google.com/specimen/Permanent+Marker|
| `fredoka.woff2`         | Fredoka          | 400–600     | OFL 1.1        | https://fonts.google.com/specimen/Fredoka         |

Keep each file a Latin subset (~20–60 KB) so it stays well under the 2 MiB
per-file precache cap. Add all three to `THIRD_PARTY_LICENSES` before the
OSS release.

Until the files are present the tokens fall back to their generic stacks
(cursive / rounded / sans-serif), so the picker still works — it just shows
the fallback letterforms.

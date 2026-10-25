# Asset & license inventory

Bundled and directly-depended assets. The live, admin-editable register lives in
the app (`assets` table, seeded) — this file is the developer record.

| Asset | Kind | Source | License | Attribution | Commercial | Verified |
|---|---|---|---|---|---|---|
| Vazirmatn | Font | `@fontsource-variable/vazirmatn` | SIL OFL 1.1 | Vazirmatn by Saber Rastikerdar | yes | yes |
| Lucide | Icons | `lucide-react` | ISC | Lucide contributors | yes | yes |
| Next.js | Framework | `next` | MIT | Vercel | yes | yes |
| React | Library | `react` / `react-dom` | MIT | Meta | yes | yes |
| Express | Framework | `express` | MIT | OpenJS Foundation | yes | yes |
| Prisma | ORM | `prisma` / `@prisma/client` | Apache-2.0 | Prisma | yes | yes |
| Tailwind CSS | Library | `tailwindcss` | MIT | Tailwind Labs | yes | yes |
| Radix UI primitives | Library | `@radix-ui/*` | MIT | WorkOS | yes | yes |
| Recharts | Library | `recharts` | MIT | Recharts | yes | yes |
| ExcelJS | Library | `exceljs` | MIT | ExcelJS contributors | yes | yes |
| decimal.js | Library | `decimal.js` | MIT | Michael Mclaughlin | yes | yes |
| jalaali-js | Library | `jalaali-js` | MIT | Behrang Noruzi Niya | yes | yes |
| Zod | Library | `zod` | MIT | Colin McDonnell | yes | yes |

## Notes

- **No images, illustrations, logos, testimonials or marketing claims** are
  bundled. There is nothing to verify for fabricated content.
- Fonts are self-hosted via the `@fontsource-variable/vazirmatn` package (no
  runtime third-party font request), which also avoids an IP disclosure.
- New icons should stay within an outline set with a consistent stroke, as
  reflected in the taste profile; no mixed-weight icon sets were introduced.

## Uncertain / flagged

- Any asset added later (illustrations, logos) must be recorded here and in the
  in-app register with its license before it ships.

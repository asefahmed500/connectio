import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      // DAL boundary: server actions must NOT import prisma directly. Every DB
      // call must go through lib/dal/*. This rule has 7 pre-existing offenders
      // (login, 2fa, profile, invite flows that legitimately set up auth state)
      // — they are tracked for follow-up. New offenders should not land.
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/lib/db",
              message:
                "Server actions must not import prisma directly — add a function in lib/dal/ instead. (Pre-existing offenders are tracked; new ones must be moved to the DAL.)",
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;

import nextConfig from "eslint-config-next/core-web-vitals";

export default [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      ".venv/**",
      "__pycache__/**",
      "api/**",
      "modules/**",
      "scripts/**",
      "public/**",
      "*.config.js",
      "*.config.mjs",
      "*.config.ts",
    ],
  },
  ...nextConfig,
];

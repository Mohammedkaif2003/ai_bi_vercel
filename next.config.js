/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Transpile react-plotly.js which ships CommonJS
  transpilePackages: ["react-plotly.js", "plotly.js"],
};

module.exports = nextConfig;

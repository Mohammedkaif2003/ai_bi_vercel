/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["react-plotly.js", "plotly.js"],
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        buffer: false,
        fs: false,
        path: false,
        child_process: false,
      };
    }
    return config;
  },
};

module.exports = nextConfig;

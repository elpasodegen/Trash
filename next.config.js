/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    // evita problemi con ffmpeg.wasm in bundle
    config.resolve.fallback = { ...config.resolve.fallback, fs: false, path: false, os: false };
    return config;
  }
};

module.exports = nextConfig;

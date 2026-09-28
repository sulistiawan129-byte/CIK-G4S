/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config, { isServer, webpack }) => {
    if (!isServer) {
      // pptxgenjs menyertakan kode Node (fs/https) yang tidak dipakai di browser.
      config.plugins.push(new webpack.NormalModuleReplacementPlugin(/^node:/, (r) => { r.request = r.request.replace(/^node:/, ""); }));
      config.resolve.fallback = { ...(config.resolve.fallback || {}), fs: false, https: false, http: false, path: false, os: false, stream: false, zlib: false, crypto: false, url: false };
    }
    return config;
  },
};
module.exports = nextConfig;

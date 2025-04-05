/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ["images.clerk.dev"],
  },
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  },
  webpack: (config, { isServer }) => {
    // Handle node: protocol imports
    if (!isServer) {
      // This is for client-side
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        dns: false,
        child_process: false,
        aws4: false,
        encoding: false,
      };
    } else {
      // This is for server-side
      config.resolve.alias = {
        ...config.resolve.alias,
        "node:fs": "fs",
        "node:path": "path",
        "node:url": "url",
        "node:util": "util",
        "node:stream": "stream",
        "node:http": "http",
        "node:https": "https",
        "node:zlib": "zlib",
        "node:crypto": "crypto",
        "node:buffer": "buffer",
        "node:querystring": "querystring",
        "node:os": "os",
        "node:events": "events",
        "node:assert": "assert",
        "node:constants": "constants",
        "node:process": "process",
        "node:punycode": "punycode",
        "node:vm": "vm",
        "node:domain": "domain",
        "node:dgram": "dgram",
        "node:dns": "dns",
        "node:readline": "readline",
        "node:repl": "repl",
        "node:string_decoder": "string_decoder",
        "node:timers": "timers",
        "node:tls": "tls",
        "node:tty": "tty",
        "node:v8": "v8",
        "node:worker_threads": "worker_threads",
      };
    }
    return config;
  },
  experimental: {
    runtime: "nodejs", // Use Node.js runtime globally
  },
};

module.exports = nextConfig;

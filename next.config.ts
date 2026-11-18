import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  allowedDevOrigins: ["192.168.100.21"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
        pathname: "/storage/v1/object/public/product-images/**",
      },
      {
        protocol: "http",
        hostname: "127.0.0.1",
        port: "54321",
        pathname: "/storage/v1/object/public/product-images/**",
      },
    ],
  },
  async redirects() {
    return [
      { source: "/vendedor/perfil", destination: "/panel/tienda", permanent: true },
      { source: "/vendedor/prendas/nueva", destination: "/panel/prendas/nueva", permanent: true },
      { source: "/vendedor/prendas/:id", destination: "/panel/prendas/:id", permanent: true },
      { source: "/vendedor/prendas", destination: "/panel/prendas", permanent: true },
      { source: "/vendedor", destination: "/panel", permanent: true },
      { source: "/admin/prendas", destination: "/panel/admin/prendas", permanent: true },
      { source: "/admin/vendedoras/:id", destination: "/panel", permanent: true },
    ];
  },
};

export default nextConfig;

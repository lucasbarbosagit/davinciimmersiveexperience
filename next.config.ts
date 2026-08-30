import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Evita que o Next suba até C:\Users\lucas procurando outro lockfile
  // (o aviso do build apontava um package-lock.json ali fora do projeto).
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;

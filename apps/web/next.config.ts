import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  transpilePackages: ["@workspace/ui"],
  // The Instagram exports are read at request time with fs, which the tracer
  // can't follow from a computed path — list them so a deploy ships the CSVs.
  outputFileTracingIncludes: {
    "/social": ["./lib/data/**/*.csv"],
  },
}

export default nextConfig

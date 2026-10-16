/** A separate output directory lets verification builds run alongside `next dev`. */
const nextConfig = {
  distDir: process.env.TRIPRI_VERIFY_BUILD === '1' ? '.next-verify' : '.next',
};

export default nextConfig;

import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
   images: {
      remotePatterns: [
         {
            protocol: 'https',
            hostname: 'i.creativecommons.org',
            port: '',
            pathname: '/l/by-nc-sa/**',
         },
         {
            protocol: 'https',
            hostname: 'storage.ko-fi.com',
            port: '',
            pathname: '/cdn/brandasset/**',
         },
      ],
   },
};

export default withNextIntl(nextConfig);

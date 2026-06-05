import { PHASE_DEVELOPMENT_SERVER } from 'next/constants.js'

/** @type {import('next').NextConfig} */
const baseConfig = {
  transpilePackages: ['@error-tracker/sdk'],
}

/** @type {(phase: string) => import('next').NextConfig} */
export default function config(phase) {
  return {
    ...baseConfig,
    distDir: phase === PHASE_DEVELOPMENT_SERVER ? '.next-dev' : '.next',
  }
}

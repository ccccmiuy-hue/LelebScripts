import { MikaelClient } from '../../src/mikael-client.js';

export function getMikaelClient() {
  return new MikaelClient({
    licenseKey: process.env.MIKAEL_LICENSE_KEY,
    deviceId: process.env.MIKAEL_DEVICE_ID || 'vercel-serverless',
    build: process.env.MIKAEL_BUILD || 'bmspgs5gz',
    component: process.env.MIKAEL_COMPONENT || 'mkc-cf13efce2cff79dd',
    baseUrl: process.env.MIKAEL_BASE_URL || 'https://mikael.store',
    timeoutMs: Number(process.env.MIKAEL_TIMEOUT_MS || 10000),
  });
}

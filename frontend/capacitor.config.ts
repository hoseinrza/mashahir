import type { CapacitorConfig } from '@capacitor/cli';

/**
 * مشاهیر آینده — native shell for iOS/Android.
 * The web assets come from `npm run build:mobile` (mode "mobile"), which
 * bakes VITE_API_URL from .env.mobile into the bundle. Replace that
 * placeholder domain once the public backend exists, then `npm run cap:sync`.
 */
const config: CapacitorConfig = {
  appId: 'ir.mashahir.school',
  appName: 'مشاهیر آینده',
  webDir: 'dist',
  backgroundColor: '#F7F9FC',
  ios: {
    // RTL content always respects the safe areas under the notch/home bar.
    contentInset: 'always',
  },
};

export default config;

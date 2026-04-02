/**
 * capacitor.config.ts
 * ────────────────────
 * Capacitor configuration for wrapping the React app into native iOS/Android.
 *
 * Setup steps:
 *   1. npm install @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android
 *   2. npx cap add ios
 *   3. npx cap add android
 *   4. npm run build && npx cap sync
 *   5. npx cap open ios    (opens in Xcode)
 *      npx cap open android (opens in Android Studio)
 */

import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  // Must match your App Store / Play Store bundle ID
  appId:   'in.twam.app',
  appName: 'TWAM',

  // Where Capacitor reads the web build output
  webDir: 'dist',

  // ── Server config ─────────────────────────────────────────────────────────
  server: {
    // For local dev: point to your Vite dev server
    // Comment out (or use androidScheme) for production builds
    // url: 'http://192.168.1.100:5173',
    androidScheme: 'https',

    // Allow navigation back to API domain (for deep links / OAuth)
    allowNavigation: [
      '127.0.0.1',
      'localhost',
      '*.twam.in',
    ],
  },

  // ── Plugin config ──────────────────────────────────────────────────────────
  plugins: {
    // Push Notifications (Firebase Cloud Messaging)
    // Install: npm install @capacitor/push-notifications
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },

    // Splash Screen
    // Install: npm install @capacitor/splash-screen
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide:     true,
      backgroundColor:    '#6B0F2A',   // TWAM brand colour
      androidSplashResourceName: 'splash',
      androidScaleType:  'CENTER_CROP',
      showSpinner:        false,
    },

    // Status Bar
    // Install: npm install @capacitor/status-bar
    StatusBar: {
      style:           'DARK',
      backgroundColor: '#6B0F2A',
    },
  },

  // ── iOS config ────────────────────────────────────────────────────────────
  ios: {
    contentInset: 'automatic',
    // Universal Links config goes in ios/App/App/Info.plist
  },

  // ── Android config ────────────────────────────────────────────────────────
  android: {
    // App Links config goes in android/app/src/main/AndroidManifest.xml
    buildOptions: {
      keystorePath:     'twam-release.keystore',
      keystoreAlias:    'twam',
    },
  },
};

export default config;

import { Capacitor } from '@capacitor/core';

export function isNativeApp() {
  return Capacitor.isNativePlatform();
}

export async function setupNativeRuntime() {
  if (!isNativeApp()) return;

  document.documentElement.classList.add('native-app');

  const { App } = await import('@capacitor/app');
  await App.addListener('backButton', ({ canGoBack }) => {
    if (canGoBack || window.history.length > 1) {
      window.history.back();
      return;
    }
    App.exitApp();
  });
}

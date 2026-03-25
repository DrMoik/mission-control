import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { deleteDoc, doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../firebase.js';
import { isNativeApp } from '../mobile/nativeRuntime.js';

const DEFAULT_NOTIFICATION_PREFERENCES = {
  assignmentsEnabled: true,
  sessionsEnabled: true,
};

const DEVICE_ID_STORAGE_KEY = 'mission-control-device-id';
const PUSH_CHANNEL_ID = 'mission-control-updates';

function getOrCreateDeviceId() {
  if (typeof window === 'undefined') return null;

  const existing = window.localStorage.getItem(DEVICE_ID_STORAGE_KEY);
  if (existing) return existing;

  const generated = `device_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
  window.localStorage.setItem(DEVICE_ID_STORAGE_KEY, generated);
  return generated;
}

function normalizePermissionState(permission) {
  if (!permission) return 'unknown';
  if (typeof permission === 'string') return permission;
  return permission.receive || 'unknown';
}

function normalizePreferences(raw) {
  return {
    assignmentsEnabled: raw?.assignmentsEnabled ?? DEFAULT_NOTIFICATION_PREFERENCES.assignmentsEnabled,
    sessionsEnabled: raw?.sessionsEnabled ?? DEFAULT_NOTIFICATION_PREFERENCES.sessionsEnabled,
  };
}

export function usePushNotifications({ authUser, currentTeam, navigate }) {
  const [preferences, setPreferences] = useState(DEFAULT_NOTIFICATION_PREFERENCES);
  const [permissionState, setPermissionState] = useState(isNativeApp() ? 'unknown' : 'unsupported');
  const [registrationState, setRegistrationState] = useState(isNativeApp() ? 'idle' : 'unsupported');
  const [lastError, setLastError] = useState('');
  const [banner, setBanner] = useState(null);

  const deviceIdRef = useRef(getOrCreateDeviceId());
  const pushRef = useRef(null);
  const previousUidRef = useRef(null);

  const persistDeviceRecord = useCallback(async (payload = {}) => {
    if (!authUser?.uid || !deviceIdRef.current || !isNativeApp()) return;

    await setDoc(
      doc(db, 'users', authUser.uid, 'devices', deviceIdRef.current),
      {
        deviceId: deviceIdRef.current,
        platform: 'android',
        permissionState,
        app: 'mission-control',
        teamId: currentTeam?.id || null,
        teamName: currentTeam?.name || null,
        updatedAt: serverTimestamp(),
        ...payload,
      },
      { merge: true },
    );
  }, [authUser?.uid, currentTeam?.id, currentTeam?.name, permissionState]);

  useEffect(() => {
    const previousUid = previousUidRef.current;
    const currentUid = authUser?.uid || null;

    if (previousUid && previousUid !== currentUid && deviceIdRef.current) {
      deleteDoc(doc(db, 'users', previousUid, 'devices', deviceIdRef.current)).catch(() => {});
    }

    previousUidRef.current = currentUid;
  }, [authUser?.uid]);

  useEffect(() => {
    if (!authUser?.uid || !currentTeam?.id) {
      setPreferences(DEFAULT_NOTIFICATION_PREFERENCES);
      return undefined;
    }

    return onSnapshot(
      doc(db, 'users', authUser.uid, 'notificationPreferences', currentTeam.id),
      (snapshot) => {
        setPreferences(normalizePreferences(snapshot.exists() ? snapshot.data() : null));
      },
    );
  }, [authUser?.uid, currentTeam?.id]);

  useEffect(() => {
    if (!banner) return undefined;

    const timeoutId = window.setTimeout(() => {
      setBanner(null);
    }, 6000);

    return () => window.clearTimeout(timeoutId);
  }, [banner]);

  useEffect(() => {
    if (!isNativeApp()) return undefined;

    let cancelled = false;
    let removeRegistration = null;
    let removeRegistrationError = null;
    let removeReceived = null;
    let removeAction = null;

    (async () => {
      try {
        const { PushNotifications } = await import('@capacitor/push-notifications');
        pushRef.current = PushNotifications;

        const permission = await PushNotifications.checkPermissions();
        const normalizedPermission = normalizePermissionState(permission);
        if (cancelled) return;

        setPermissionState(normalizedPermission);
        setRegistrationState(normalizedPermission === 'granted' ? 'registering' : 'idle');

        await PushNotifications.createChannel({
          id: PUSH_CHANNEL_ID,
          name: 'Mission Control Updates',
          description: 'Assignments and session updates',
          importance: 5,
          visibility: 1,
        }).catch(() => {});

        removeRegistration = await PushNotifications.addListener('registration', async (token) => {
          if (cancelled) return;
          setRegistrationState('registered');
          setLastError('');
          await persistDeviceRecord({
            token: token.value,
            permissionState: 'granted',
            tokenUpdatedAt: serverTimestamp(),
          });
        });

        removeRegistrationError = await PushNotifications.addListener('registrationError', async (error) => {
          if (cancelled) return;
          const message = error?.error || 'Push registration failed.';
          setRegistrationState('error');
          setLastError(message);
          await persistDeviceRecord({
            registrationError: message,
            permissionState: normalizePermissionState(await PushNotifications.checkPermissions()),
          });
        });

        removeReceived = await PushNotifications.addListener('pushNotificationReceived', (notification) => {
          if (cancelled) return;
          setBanner({
            id: `${Date.now()}`,
            title: notification.title || 'Nueva notificacion',
            body: notification.body || '',
            route: notification.data?.route || null,
          });
        });

        removeAction = await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
          if (cancelled) return;
          const route = action.notification.data?.route;
          if (route) navigate(route.startsWith('/') ? route : `/${route}`);
        });

        if (normalizedPermission === 'granted') {
          await PushNotifications.register();
        }
      } catch (error) {
        if (cancelled) return;
        setRegistrationState('error');
        setLastError(error?.message || 'Push notifications are unavailable.');
      }
    })();

    return () => {
      cancelled = true;
      removeRegistration?.remove?.();
      removeRegistrationError?.remove?.();
      removeReceived?.remove?.();
      removeAction?.remove?.();
    };
  }, [navigate, persistDeviceRecord]);

  useEffect(() => {
    if (!authUser?.uid || !isNativeApp()) return;
    persistDeviceRecord().catch(() => {});
  }, [authUser?.uid, currentTeam?.id, currentTeam?.name, persistDeviceRecord]);

  const requestPermission = useCallback(async () => {
    if (!isNativeApp()) return;

    try {
      const push = pushRef.current || (await import('@capacitor/push-notifications')).PushNotifications;
      pushRef.current = push;

      const result = await push.requestPermissions();
      const normalizedPermission = normalizePermissionState(result);
      setPermissionState(normalizedPermission);

      if (normalizedPermission === 'granted') {
        setRegistrationState('registering');
        setLastError('');
        await persistDeviceRecord({ permissionState: normalizedPermission, registrationError: null });
        await push.register();
        return;
      }

      setRegistrationState('idle');
      await persistDeviceRecord({ permissionState: normalizedPermission });
    } catch (error) {
      setRegistrationState('error');
      setLastError(error?.message || 'Unable to enable notifications.');
    }
  }, [persistDeviceRecord]);

  const updatePreference = useCallback(async (key, enabled) => {
    if (!authUser?.uid || !currentTeam?.id) return;
    if (!Object.prototype.hasOwnProperty.call(DEFAULT_NOTIFICATION_PREFERENCES, key)) return;

    const nextPreferences = { ...preferences, [key]: enabled };
    setPreferences(nextPreferences);

    await setDoc(
      doc(db, 'users', authUser.uid, 'notificationPreferences', currentTeam.id),
      {
        ...nextPreferences,
        teamId: currentTeam.id,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  }, [authUser?.uid, currentTeam?.id, preferences]);

  const clearBanner = useCallback(() => setBanner(null), []);

  const statusLabel = useMemo(() => {
    if (!isNativeApp()) return 'Solo disponible en la app Android';
    if (permissionState === 'granted' && registrationState === 'registered') return 'Activas en este dispositivo';
    if (permissionState === 'granted') return 'Permiso concedido, finalizando registro';
    if (permissionState === 'denied') return 'Permiso bloqueado en Android';
    if (permissionState === 'prompt' || permissionState === 'prompt-with-rationale') return 'Pendiente de activacion';
    if (registrationState === 'error') return 'No se pudieron registrar';
    return 'No activadas';
  }, [permissionState, registrationState]);

  return {
    banner,
    clearBanner,
    isSupported: isNativeApp(),
    permissionState,
    registrationState,
    lastError,
    preferences,
    requestPermission,
    statusLabel,
    updatePreference,
  };
}

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import api from './api';
import type { AuthResult, User } from '../types';

const AUTH_TOKEN_KEY = 'authToken';
const DEVICE_ID_KEY = 'deviceId';

export async function getDeviceId(): Promise<string> {
  let id = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = Crypto.randomUUID();
    await AsyncStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

interface DeviceAuthResponse {
  user: User;
  token: string;
  isNewUser: boolean;
}

export async function authenticate(): Promise<AuthResult> {
  const deviceId = await getDeviceId();
  const { data } = await api.post<DeviceAuthResponse>('/auth/device', { deviceId });
  await AsyncStorage.setItem(AUTH_TOKEN_KEY, data.token);
  return {
    user: data.user,
    token: data.token,
    isNewUser: data.isNewUser,
  };
}

export async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem(AUTH_TOKEN_KEY);
}

export async function clearAuth(): Promise<void> {
  await Promise.all([
    AsyncStorage.removeItem(AUTH_TOKEN_KEY),
    AsyncStorage.removeItem(DEVICE_ID_KEY),
  ]);
}

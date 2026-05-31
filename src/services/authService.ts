import AsyncStorage from '@react-native-async-storage/async-storage';
import api from './api';

const AUTH_TOKEN_KEY = 'authToken';

export async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem(AUTH_TOKEN_KEY);
}

export async function clearAuth(): Promise<void> {
  await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
}

export async function checkNickname(nickname: string): Promise<{ available: boolean; reason?: string }> {
  const res = await api.get(`/auth/check-nickname?nickname=${encodeURIComponent(nickname)}`);
  return res.data;
}

export async function registerWithNickname(nickname: string, pin: string): Promise<{ user: { id: string; nickname: string; name: string }; token: string; isNewUser: boolean }> {
  const res = await api.post('/auth/register-nickname', { nickname, pin });
  return res.data;
}

export async function loginWithNickname(nickname: string, pin: string): Promise<{ user: { id: string; nickname: string; name: string }; token: string; isNewUser: boolean }> {
  const res = await api.post('/auth/login-nickname', { nickname, pin });
  return res.data;
}

import AsyncStorage from '@react-native-async-storage/async-storage';

const PETS_KEY = 'savedPets';
const SELECTED_PET_ID_KEY = 'selectedPetId';
const DISCLAIMER_KEY = 'hasAcceptedDisclaimer';

export async function savePetsLocally(pets: unknown[]): Promise<void> {
  await AsyncStorage.setItem(PETS_KEY, JSON.stringify(pets));
}

export async function loadPetsLocally<T>(): Promise<T[]> {
  const raw = await AsyncStorage.getItem(PETS_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export async function saveSelectedPetId(id: string | null): Promise<void> {
  if (id) {
    await AsyncStorage.setItem(SELECTED_PET_ID_KEY, id);
  } else {
    await AsyncStorage.removeItem(SELECTED_PET_ID_KEY);
  }
}

export async function getSelectedPetId(): Promise<string | null> {
  return AsyncStorage.getItem(SELECTED_PET_ID_KEY);
}

export async function hasAcceptedDisclaimer(): Promise<boolean> {
  return (await AsyncStorage.getItem(DISCLAIMER_KEY)) === 'true';
}

export async function setDisclaimerAccepted(): Promise<void> {
  await AsyncStorage.setItem(DISCLAIMER_KEY, 'true');
}

export async function clearAllData(): Promise<void> {
  await Promise.all(
    [PETS_KEY, SELECTED_PET_ID_KEY, DISCLAIMER_KEY, 'authToken', 'deviceId'].map(key =>
      AsyncStorage.removeItem(key)
    )
  );
}

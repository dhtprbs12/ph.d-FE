import React, { createContext, useContext, useEffect, useReducer, useCallback } from 'react';
import type { Pet } from '../types';
import * as authService from '../services/authService';
import * as petService from '../services/petService';
import { savePetsLocally, loadPetsLocally, saveSelectedPetId, getSelectedPetId, clearAllData } from '../utils/storage';

interface AppState {
  pets: Pet[];
  selectedPet: Pet | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

type Action =
  | { type: 'SET_PETS'; pets: Pet[] }
  | { type: 'SET_SELECTED_PET'; pet: Pet | null }
  | { type: 'SET_AUTHENTICATED'; value: boolean }
  | { type: 'SET_LOADING'; value: boolean }
  | { type: 'ADD_PET'; pet: Pet }
  | { type: 'UPDATE_PET'; pet: Pet }
  | { type: 'REMOVE_PET'; petId: string }
  | { type: 'RESET' };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_PETS':
      return { ...state, pets: action.pets };
    case 'SET_SELECTED_PET':
      return { ...state, selectedPet: action.pet };
    case 'SET_AUTHENTICATED':
      return { ...state, isAuthenticated: action.value };
    case 'SET_LOADING':
      return { ...state, isLoading: action.value };
    case 'ADD_PET':
      return { ...state, pets: [...state.pets, action.pet] };
    case 'UPDATE_PET':
      return {
        ...state,
        pets: state.pets.map(p => (p.id === action.pet.id ? action.pet : p)),
        selectedPet: state.selectedPet?.id === action.pet.id ? action.pet : state.selectedPet,
      };
    case 'REMOVE_PET': {
      const newPets = state.pets.filter(p => p.id !== action.petId);
      const newSelected = state.selectedPet?.id === action.petId ? (newPets[0] ?? null) : state.selectedPet;
      return { ...state, pets: newPets, selectedPet: newSelected };
    }
    case 'RESET':
      return { pets: [], selectedPet: null, isAuthenticated: false, isLoading: false };
    default:
      return state;
  }
}

interface AppContextValue extends AppState {
  authenticateAndSync: () => Promise<void>;
  selectPet: (pet: Pet) => void;
  addPet: (pet: Pet) => Promise<void>;
  updatePet: (pet: Pet) => Promise<void>;
  deletePet: (pet: Pet) => Promise<void>;
  setPrimaryPet: (pet: Pet) => void;
  resetApp: () => Promise<void>;
  refreshPets: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, {
    pets: [],
    selectedPet: null,
    isAuthenticated: false,
    isLoading: true,
  });

  useEffect(() => {
    (async () => {
      const localPets = await loadPetsLocally<Pet>();
      if (localPets.length > 0) {
        dispatch({ type: 'SET_PETS', pets: localPets });
        const selectedId = await getSelectedPetId();
        const selected = localPets.find(p => p.id === selectedId) ??
          localPets.find(p => p.is_primary) ??
          localPets[0];
        dispatch({ type: 'SET_SELECTED_PET', pet: selected ?? null });
      }
      // History (and other flows) use isAuthenticated; token is set on first disclaimer.
      // Returning users skip Disclaimer, so restore session from stored token.
      const token = await authService.getToken();
      if (token) {
        dispatch({ type: 'SET_AUTHENTICATED', value: true });
      }
      dispatch({ type: 'SET_LOADING', value: false });
    })();
  }, []);

  const authenticateAndSync = useCallback(async () => {
    try {
      await authService.authenticate();
      dispatch({ type: 'SET_AUTHENTICATED', value: true });

      const serverPets = await petService.getPets();
      if (serverPets.length > 0) {
        const localPets = await loadPetsLocally<Pet>();
        const localPhotoMap = new Map(localPets.map(p => [p.id, p.photoData]));
        const merged = serverPets.map(sp => ({
          ...sp,
          photoData: sp.photoData ?? localPhotoMap.get(sp.id) ?? undefined,
        }));

        dispatch({ type: 'SET_PETS', pets: merged });
        await savePetsLocally(merged);

        const selectedId = await getSelectedPetId();
        const selected = merged.find(p => p.id === selectedId) ??
          merged.find(p => p.is_primary) ??
          merged[0];
        dispatch({ type: 'SET_SELECTED_PET', pet: selected ?? null });
      } else if (state.pets.length > 0) {
        for (const pet of state.pets) {
          try {
            await petService.createPet({
              name: pet.name,
              petType: pet.pet_type,
              breed: pet.breed,
              ageMonths: pet.age_months,
              weightKg: pet.weight_kg,
              sex: pet.sex,
              activityLevel: pet.activity_level,
              healthConditions: (pet.healthConditions ?? []).map(c => ({
                conditionType: c.condition_type,
                severity: c.severity,
                notes: c.notes,
              })),
            });
          } catch (e) {
            console.warn('Failed to push pet to server:', e);
          }
        }
      }
    } catch (e) {
      console.warn('Auth/sync failed (offline mode):', e);
    }
  }, [state.pets]);

  const selectPet = useCallback((pet: Pet) => {
    dispatch({ type: 'SET_SELECTED_PET', pet });
    saveSelectedPetId(pet.id);
  }, []);

  const addPet = useCallback(async (pet: Pet) => {
    const isFirst = state.pets.length === 0;
    const newPet = isFirst ? { ...pet, is_primary: true } : pet;

    dispatch({ type: 'ADD_PET', pet: newPet });
    if (isFirst || !state.selectedPet) {
      dispatch({ type: 'SET_SELECTED_PET', pet: newPet });
      await saveSelectedPetId(newPet.id);
    }

    const allPets = [...state.pets, newPet];
    await savePetsLocally(allPets);

    if (state.isAuthenticated) {
      try {
        const serverPet = await petService.createPet({
          name: newPet.name,
          petType: newPet.pet_type,
          breed: newPet.breed,
          ageMonths: newPet.age_months,
          weightKg: newPet.weight_kg,
          sex: newPet.sex,
          activityLevel: newPet.activity_level,
          healthConditions: (newPet.healthConditions ?? []).map(c => ({
            conditionType: c.condition_type,
            severity: c.severity,
            notes: c.notes,
          })),
        });
        const updatedPet = { ...newPet, id: serverPet.id };
        dispatch({ type: 'UPDATE_PET', pet: updatedPet });
        const updatedPets = allPets.map(p => (p.id === newPet.id ? updatedPet : p));
        await savePetsLocally(updatedPets);
      } catch (e) {
        console.warn('Server create failed:', e);
      }
    }
  }, [state.pets, state.selectedPet, state.isAuthenticated]);

  const updatePetAction = useCallback(async (pet: Pet) => {
    dispatch({ type: 'UPDATE_PET', pet });
    const newPets = state.pets.map(p => (p.id === pet.id ? pet : p));
    await savePetsLocally(newPets);

    if (state.isAuthenticated) {
      try {
        await petService.updatePet(pet.id, {
          name: pet.name,
          petType: pet.pet_type,
          breed: pet.breed,
          ageMonths: pet.age_months,
          weightKg: pet.weight_kg,
          sex: pet.sex,
          activityLevel: pet.activity_level,
          healthConditions: (pet.healthConditions ?? []).map(c => ({
            conditionType: c.condition_type,
            severity: c.severity,
            notes: c.notes,
          })),
        });
      } catch (e) {
        console.warn('Server update failed:', e);
      }
    }
  }, [state.pets, state.isAuthenticated]);

  const deletePetAction = useCallback(async (pet: Pet) => {
    dispatch({ type: 'REMOVE_PET', petId: pet.id });
    const newPets = state.pets.filter(p => p.id !== pet.id);
    await savePetsLocally(newPets);
    if (state.selectedPet?.id === pet.id) {
      const next = newPets[0] ?? null;
      dispatch({ type: 'SET_SELECTED_PET', pet: next });
      await saveSelectedPetId(next?.id ?? null);
    }

    if (state.isAuthenticated) {
      try {
        await petService.deletePet(pet.id);
      } catch (e) {
        console.warn('Server delete failed:', e);
      }
    }
  }, [state.pets, state.selectedPet, state.isAuthenticated]);

  const setPrimaryPetAction = useCallback((pet: Pet) => {
    const updatedPets = state.pets.map(p => ({
      ...p,
      is_primary: p.id === pet.id,
    }));
    dispatch({ type: 'SET_PETS', pets: updatedPets });
    dispatch({ type: 'SET_SELECTED_PET', pet: { ...pet, is_primary: true } });
    savePetsLocally(updatedPets);
    saveSelectedPetId(pet.id);

    if (state.isAuthenticated) {
      petService.setPrimaryPet(pet.id).catch(e => console.warn('Server setPrimary failed:', e));
    }
  }, [state.pets, state.isAuthenticated]);

  const refreshPets = useCallback(async () => {
    try {
      const serverPets = await petService.getPets();
      if (serverPets.length > 0) {
        dispatch({ type: 'SET_PETS', pets: serverPets });
        await savePetsLocally(serverPets);
      }
    } catch (e) {
      console.warn('Refresh pets failed:', e);
    }
  }, []);

  const resetApp = useCallback(async () => {
    dispatch({ type: 'RESET' });
    await clearAllData();
  }, []);

  return (
    <AppContext.Provider
      value={{
        pets: state.pets,
        selectedPet: state.selectedPet,
        isAuthenticated: state.isAuthenticated,
        isLoading: state.isLoading,
        authenticateAndSync,
        selectPet,
        addPet,
        updatePet: updatePetAction,
        deletePet: deletePetAction,
        setPrimaryPet: setPrimaryPetAction,
        resetApp,
        refreshPets,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}

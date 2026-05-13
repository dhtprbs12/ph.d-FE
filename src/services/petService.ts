import api from './api';
import type { CreatePetData, Pet, PetHealthConditionInput, UpdatePetData } from '../types';

function mapHealthConditions(conditions: PetHealthConditionInput[]) {
  return conditions.map((c) => ({
    type: c.conditionType,
    conditionType: c.conditionType,
    severity: c.severity,
    notes: c.notes,
  }));
}

function buildCreateBody(data: CreatePetData) {
  return {
    name: data.name,
    petType: data.petType,
    breed: data.breed,
    ageMonths: data.ageMonths,
    weightKg: data.weightKg,
    sex: data.sex,
    activityLevel: data.activityLevel,
    healthConditions: mapHealthConditions(data.healthConditions),
  };
}

function buildUpdateBody(data: UpdatePetData): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  if (data.name !== undefined) body.name = data.name;
  if (data.petType !== undefined) body.petType = data.petType;
  if (data.breed !== undefined) body.breed = data.breed;
  if (data.ageMonths !== undefined) body.ageMonths = data.ageMonths;
  if (data.weightKg !== undefined) body.weightKg = data.weightKg;
  if (data.sex !== undefined) body.sex = data.sex;
  if (data.activityLevel !== undefined) body.activityLevel = data.activityLevel;
  if (data.healthConditions !== undefined) {
    body.healthConditions = mapHealthConditions(data.healthConditions);
  }
  return body;
}

export async function getPets(): Promise<Pet[]> {
  const { data } = await api.get<{ pets: Pet[] } | Pet[]>('/pets');
  if (Array.isArray(data)) return data;
  return data.pets ?? [];
}

export async function createPet(data: CreatePetData): Promise<Pet> {
  const { data: res } = await api.post<{ pet: Pet }>('/pets', buildCreateBody(data));
  return res.pet;
}

export async function updatePet(id: string, data: UpdatePetData): Promise<Pet> {
  const { data: res } = await api.put<{ pet: Pet }>(`/pets/${id}`, buildUpdateBody(data));
  return res.pet;
}

export async function deletePet(id: string): Promise<void> {
  await api.delete(`/pets/${id}`);
}

export async function setPrimaryPet(id: string): Promise<void> {
  await api.post(`/pets/${id}/primary`);
}

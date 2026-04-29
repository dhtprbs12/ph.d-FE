export type PetType = 'dog' | 'cat';
export type PetSex = 'male' | 'female' | 'neutered_male' | 'spayed_female';
export type ActivityLevel = 'low' | 'moderate' | 'high';
export type Severity = 'mild' | 'moderate' | 'severe';
export type SafetyLevel = 'safe' | 'caution' | 'danger' | 'unknown';
export type RiskLevel = 'safe' | 'low' | 'moderate' | 'high' | 'danger';
export type Grade = 'A' | 'B' | 'C' | 'D' | 'F';

export interface Pet {
  id: string;
  name: string;
  pet_type: PetType;
  breed?: string;
  age_months?: number;
  weight_kg?: number;
  sex?: PetSex;
  activity_level: ActivityLevel;
  is_primary: boolean;
  healthConditions: HealthCondition[];
  photoData?: string;
}

export interface HealthCondition {
  id: string;
  condition_type: string;
  severity: Severity;
  notes?: string;
}

/** Input shape for create/update pet APIs (camelCase in app code). */
export interface PetHealthConditionInput {
  conditionType: string;
  severity: Severity;
  notes?: string;
}

export interface CreatePetData {
  name: string;
  petType: PetType;
  breed?: string;
  ageMonths?: number;
  weightKg?: number;
  sex?: PetSex;
  activityLevel: ActivityLevel;
  healthConditions: PetHealthConditionInput[];
}

export type UpdatePetData = Partial<CreatePetData>;

/** Authenticated user returned from `/auth/device`. */
export interface User {
  id: string;
  [key: string]: unknown;
}

export interface AuthResult {
  user: User;
  token: string;
  isNewUser: boolean;
}

/** Front label scan API response. */
export interface ScanFrontResponse {
  success: boolean;
  pendingScanId: string;
  captured: {
    productName?: string;
    brand?: string;
    targetPet?: string;
    productType?: string;
  };
  candidates: ProductCandidate[];
  nextStep: string;
}

/** Poll scan result API response. */
export interface PollScanResultResponse {
  status: string;
  result?: ScanResult;
  progress?: { current?: number; total?: number; message?: string };
  [key: string]: unknown;
}

/** Quick analyze request body. */
export interface QuickAnalyzeData {
  productId: string;
  petName: string;
  petType: string;
  petBreed?: string;
  petAgeMonths?: number;
  petWeightKg?: number;
  petAllergies?: string[];
  petHealthConditions?: PetHealthConditionInput[] | HealthCondition[];
  deviceId: string;
}

/** Product filter query params (aligned with backend). */
export interface ProductFilterParams {
  petType?: string;
  productType?: string;
  lifeStage?: string;
  noGrains?: boolean;
  withGrains?: boolean;
  withChicken?: boolean;
  withBeef?: boolean;
  withFish?: boolean;
  withLamb?: boolean;
  withTurkey?: boolean;
  withDuck?: boolean;
  healthConditions?: unknown;
  minScore?: number;
  q?: string;
  limit?: number;
  offset?: number;
}

export interface ProductFilterResponse {
  products: Product[];
  scores: Record<string, CachedScore | number>;
  pagination: { total: number; limit: number; offset: number };
}

export interface BatchScoresResponse {
  scores: Record<string, CachedScore | number>;
}

export interface ProductImageResponse {
  imageUrl: string | null;
}

export interface AlternativesRequest {
  petType: string;
  healthConditions?: PetHealthConditionInput[] | HealthCondition[];
  petName?: string;
  limit?: number;
}

export interface Product {
  id: string;
  barcode?: string;
  name: string;
  brand?: string;
  product_type?: string;
  texture?: string;
  target_pet_type?: string;
  target_life_stage?: string;
  image_url?: string;
  raw_ingredients_text?: string;
  base_dog_score?: number;
  base_cat_score?: number;
  scan_count?: number;
}

export interface ScanResult {
  scanId: string;
  scanType: string;
  extracted?: {
    productName?: string;
    brand?: string;
    targetPet?: string;
    ingredientCount?: number;
    confidence?: number;
  };
  product?: {
    id?: string;
    name?: string;
    brand?: string;
    imageUrl?: string;
    image_url?: string;
    productType?: string;
    product_type?: string;
  };
  parsedIngredients?: string[];
  analysis: Analysis;
  aiInsights?: AIInsights;
  pet: { id?: string; name: string; petType: string };
}

export interface Analysis {
  finalScore: number;
  grade: string;
  recommendation: string;
  ingredients: IngredientAnalysis[];
  warnings?: Warning[];
  positives?: string[];
  summary?: string;
  hasTaurine?: boolean;
  toxicCount?: number;
  allergenCount?: number;
  healthConcernCount?: number;
  keyIssues?: string[];
  proteinQuality?: string;
  hasArtificialAdditives?: boolean;
}

export interface IngredientAnalysis {
  name: string;
  normalizedName?: string;
  position: number;
  riskLevel: string;
  adjustedRiskScore: number;
  isToxic: boolean;
  isAllergenMatch: boolean;
  isHealthConcern: boolean;
  hasTaurine?: boolean;
  explanation?: string;
  positiveBenefit?: string;
}

export interface Warning {
  ingredient: string;
  level: string;
  reason: string;
}

export interface AIInsights {
  personalizedSummary?: string;
  topConcerns?: string[];
  topBenefits?: string[];
  feedingTip?: string;
  alternativeAdvice?: string;
  confidenceNote?: string;
  aiGenerated?: boolean;
  conditionWarnings?: ConditionWarning[];
}

export interface ConditionWarning {
  type: string;
  severity: string;
  condition: string;
  conditionLabel: string;
  ingredient: string;
  position?: number;
  message: string;
}

export interface ProductCandidate {
  id: string;
  name?: string;
  brand?: string;
  imageUrl?: string;
  image_url?: string;
  productType?: string;
  product_type?: string;
  targetPetType?: string;
  target_pet_type?: string;
}

export interface CachedScore {
  score: number;
  grade: string;
  recommendation?: string;
  conditionWarnings?: ConditionWarning[];
}

export interface FoodCheckResult {
  foodName: string;
  category?: string;
  safetyLevel: string;
  explanation: string;
  tip?: string;
}

export interface ScanHistoryItem {
  id: string;
  scan_type: string;
  final_score: number;
  grade: string;
  product_id?: string;
  product_name?: string;
  product_brand?: string;
  product_image?: string;
  pet_name?: string;
  pet_type?: string;
  created_at: string;
  recommendation?: string;
}

export interface AlternativeProduct {
  product: Product;
  score: number;
  grade: string;
}

export interface UserBadge {
  title: string;
  level: number;
  icon: string;
  color: string;
  nextAt?: number;
  progress?: number;
}

export interface UserStats {
  scanCount: number;
  badge: UserBadge;
}

export interface CommunityStats {
  totalScans: number;
  totalProducts: number;
  ingredientsAnalyzed: number;
  lastUpdated?: string;
}

export const CONDITION_TYPES = [
  { value: 'allergy_chicken', label: 'Chicken Allergy', category: 'Allergies' },
  { value: 'allergy_beef', label: 'Beef Allergy', category: 'Allergies' },
  { value: 'allergy_fish', label: 'Fish Allergy', category: 'Allergies' },
  { value: 'allergy_dairy', label: 'Dairy Allergy', category: 'Allergies' },
  { value: 'allergy_grains', label: 'Grain Allergy', category: 'Allergies' },
  { value: 'allergy_eggs', label: 'Egg Allergy', category: 'Allergies' },
  { value: 'allergy_soy', label: 'Soy Allergy', category: 'Allergies' },
  { value: 'allergy_lamb', label: 'Lamb Allergy', category: 'Allergies' },
  { value: 'digestive_sensitivity', label: 'Digestive Sensitivity', category: 'Digestive' },
  { value: 'skin_issues', label: 'Skin Issues', category: 'Physical' },
  { value: 'joint_issues', label: 'Joint Issues', category: 'Physical' },
  { value: 'kidney_disease', label: 'Kidney Disease', category: 'Organ Health' },
  { value: 'liver_disease', label: 'Liver Disease', category: 'Organ Health' },
  { value: 'heart_disease', label: 'Heart Disease', category: 'Metabolic' },
  { value: 'diabetes', label: 'Diabetes', category: 'Metabolic' },
  { value: 'obesity', label: 'Obesity', category: 'Metabolic' },
  { value: 'urinary_issues', label: 'Urinary Issues', category: 'Organ Health' },
  { value: 'thyroid_issues', label: 'Thyroid Issues', category: 'Metabolic' },
  { value: 'pancreatitis', label: 'Pancreatitis', category: 'Digestive' },
  { value: 'ibd', label: 'IBD', category: 'Digestive' },
] as const;

export const PET_SEX_OPTIONS: { value: PetSex; label: string }[] = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'neutered_male', label: 'Neutered Male' },
  { value: 'spayed_female', label: 'Spayed Female' },
];

export const ACTIVITY_LEVELS: { value: ActivityLevel; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'high', label: 'High' },
];

export function getConditionLabel(type: string): string {
  return CONDITION_TYPES.find(c => c.value === type)?.label ?? type;
}

export function formatAge(months?: number): string {
  if (!months) return 'Unknown';
  if (months < 12) return `${months} months`;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  if (rem === 0) return `${years} ${years === 1 ? 'year' : 'years'}`;
  return `${years}y ${rem}m`;
}

export function formatWeight(kg?: number): string {
  if (!kg) return 'Unknown';
  const lbs = kg / 0.453592;
  return `${lbs.toFixed(1)} lbs`;
}

export function formatCommunityScans(total: number): string {
  if (total >= 1_000_000) return `${(total / 1_000_000).toFixed(1)}M+`;
  if (total >= 1_000) return `${(total / 1_000).toFixed(1)}K+`;
  return `${total}`;
}

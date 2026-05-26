import type { NavigatorScreenParams } from '@react-navigation/native';
import type { Product, ScanResult } from '../types';

export type PreloadedScore = {
  score: number;
  grade?: string;
  recommendation?: string;
};

/** Raw `product_image` from history (same as DB `image_url`); use when analysis payload omits the image. */
/** Params for manual ingredient entry from Home (optional product hint when re-used). */
export type ManualIngredientsParams = {
  productHint?: { brand?: string; productName?: string; productType?: string };
};

export type ResultParams =
  | {
      scanResult: ScanResult;
      productId?: undefined;
      product?: undefined;
      preloadedScore?: undefined;
      historyImageUrl?: string;
      /** When true (e.g. ingredients-only flow), hide hero product image on Result. */
      suppressProductImage?: boolean;
    }
  | {
      scanResult?: undefined;
      productId: string;
      product: Product;
      preloadedScore: PreloadedScore;
      historyImageUrl?: string;
      suppressProductImage?: boolean;
    };

export type HomeStackParamList = {
  Home: undefined;
  ProductSearch: undefined;
  Result: ResultParams;
  TwoStepScan: undefined;
  ManualIngredients: ManualIngredientsParams | undefined;
  FoodCheck: undefined;
  AddPet: undefined;
};

export type HistoryStackParamList = {
  History: undefined;
  Result: ResultParams;
};

export type PetsStackParamList = {
  Pets: undefined;
  AddPet: undefined;
  EditPet: { petId: string };
};

export type SettingsStackParamList = {
  Settings: undefined;
};

export type MainTabParamList = {
  HomeTab: NavigatorScreenParams<HomeStackParamList>;
  HistoryTab: NavigatorScreenParams<HistoryStackParamList>;
  PetsTab: NavigatorScreenParams<PetsStackParamList>;
  SettingsTab: NavigatorScreenParams<SettingsStackParamList>;
};

export type RootStackParamList = {
  Launch: undefined;
  Disclaimer: undefined;
  MainTabs: NavigatorScreenParams<MainTabParamList> | undefined;
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}

import { ImageSourcePropType } from 'react-native';

const BASE_CHARACTERS: Record<string, ImageSourcePropType> = {
  dog: require('../../assets/character/base_dog.png'),
};

const ITEM_LAYERS: Record<string, ImageSourcePropType> = {
  hat_graduation_cap: require('../../assets/character/items/hat_graduation_cap.png'),
};

const ITEM_THUMBS: Record<string, ImageSourcePropType> = {
  hat_graduation_cap: require('../../assets/character/thumbs/hat_graduation_cap_thumb.png'),
};

export function getBaseCharacter(type: string): ImageSourcePropType {
  return BASE_CHARACTERS[type] || BASE_CHARACTERS.dog;
}

export function getItemLayer(assetKey: string): ImageSourcePropType | null {
  return ITEM_LAYERS[assetKey] || null;
}

export function getItemThumb(assetKey: string): ImageSourcePropType | null {
  return ITEM_THUMBS[assetKey] || null;
}

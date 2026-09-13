import { ImageSourcePropType } from 'react-native';

const BASE_CHARACTERS: Record<string, ImageSourcePropType> = {
  dog: require('../../assets/character/base_dog.png'),
};

const ITEM_LAYERS: Record<string, ImageSourcePropType> = {
  hat_graduation_cap: require('../../assets/character/items/hat_graduation_cap.png'),
  hat_la_cap: require('../../assets/character/items/la_cap.png'),
  hat_nyc_cap: require('../../assets/character/items/nyc_cap.png'),
  glasses_round: require('../../assets/character/items/glass.png'),
};

const ITEM_THUMBS: Record<string, ImageSourcePropType> = {
  hat_graduation_cap: require('../../assets/character/thumbs/hat_graduation_cap_thumb.png'),
  hat_la_cap: require('../../assets/character/thumbs/la_cap_thumb.png'),
  hat_nyc_cap: require('../../assets/character/thumbs/nyc_cap_thumb.png'),
  glasses_round: require('../../assets/character/thumbs/glass_thumb.png'),
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

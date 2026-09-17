import { ImageSourcePropType } from 'react-native';

const BASE_CHARACTERS: Record<string, ImageSourcePropType> = {
  dog: require('../../assets/character/base_dog.png'),
};

const ITEM_LAYERS: Record<string, ImageSourcePropType> = {
  hat_graduation_cap: require('../../assets/character/items/hat_graduation_cap.png'),
  hat_la_cap: require('../../assets/character/items/la_cap.png'),
  hat_nyc_cap: require('../../assets/character/items/nyc_cap.png'),
  hat_bandana: require('../../assets/character/items/bandana.png'),
  glasses_round: require('../../assets/character/items/glass.png'),
  glasses_et: require('../../assets/character/items/et_sunglasses.png'),
  glasses_moscot: require('../../assets/character/items/moscot.png'),
  glasses_oakley: require('../../assets/character/items/oakley_sunglasses.png'),
  glasses_pixel: require('../../assets/character/items/pixel_sunglasses.png'),
  glasses_rayben: require('../../assets/character/items/rayben_sunglasses.png'),
  glasses_sunglasses: require('../../assets/character/items/sunglasses.png'),
  glasses_tinted: require('../../assets/character/items/tinted_sunglasses.png'),
  accessory_choker: require('../../assets/character/items/choker.png'),
  accessory_dollar_chain: require('../../assets/character/items/dollar_necklace.png'),
  accessory_gold_earring: require('../../assets/character/items/gold_earing.png'),
  accessory_pearl_necklace: require('../../assets/character/items/necklace_2.png'),
  accessory_chain_necklace: require('../../assets/character/items/necklace_3.png'),
  accessory_piercing: require('../../assets/character/items/piercing.png'),
  accessory_clover: require('../../assets/character/items/vancleaf.png'),
  hat_strawberry: require('../../assets/character/items/strawberry_hat.png'),
  hat_tangerine: require('../../assets/character/items/tangerine_hat.png'),
  clothes_ballpark: require('../../assets/character/items/dodgers.png'),
  clothes_pinstripe: require('../../assets/character/items/yankees.png'),
  clothes_ivy_sweater: require('../../assets/character/items/Harvard.png'),
  clothes_cat_lover_tee: require('../../assets/character/items/Ilovecat.png'),
  clothes_phd_tee: require('../../assets/character/items/Ilovephd.png'),
  clothes_sporty_vest: require('../../assets/character/items/pawdidas_running_vest.png'),
  accessory_ghost: require('../../assets/character/items/ghost.png'),
  clothes_granny: require('../../assets/character/items/grandmother.png'),
  accessory_dino: require('../../assets/character/items/dinosaur_acc.png'),
  clothes_orange_dress: require('../../assets/character/items/orange_dress.png'),
  hat_orange_hair: require('../../assets/character/items/orange_hair.png'),
  accessory_snow_white_band: require('../../assets/character/items/snow_white_band.png'),
  clothes_snow_white_dress: require('../../assets/character/items/snow_white_dress.png'),
  clothes_suit: require('../../assets/character/items/suit.png'),
};

const ITEM_THUMBS: Record<string, ImageSourcePropType> = {
  hat_graduation_cap: require('../../assets/character/thumbs/hat_graduation_cap_thumb.png'),
  hat_la_cap: require('../../assets/character/thumbs/la_cap_thumb.png'),
  hat_nyc_cap: require('../../assets/character/thumbs/nyc_cap_thumb.png'),
  hat_bandana: require('../../assets/character/thumbs/bandana_thumb.png'),
  glasses_round: require('../../assets/character/thumbs/glass_thumb.png'),
  glasses_et: require('../../assets/character/thumbs/et_sunglasses_thumb.png'),
  glasses_moscot: require('../../assets/character/thumbs/moscot_thumb.png'),
  glasses_oakley: require('../../assets/character/thumbs/oakley_sunglasses_thumb.png'),
  glasses_pixel: require('../../assets/character/thumbs/pixel_sunglasses_thumb.png'),
  glasses_rayben: require('../../assets/character/thumbs/rayben_sunglasses_thumb.png'),
  glasses_sunglasses: require('../../assets/character/thumbs/sunglasses_thumb.png'),
  glasses_tinted: require('../../assets/character/thumbs/tinted_sunglasses_thumb.png'),
  accessory_choker: require('../../assets/character/thumbs/choker_thumb.png'),
  accessory_dollar_chain: require('../../assets/character/thumbs/dollar_necklace_thumb.png'),
  accessory_gold_earring: require('../../assets/character/thumbs/gold_earing_thumb.png'),
  accessory_pearl_necklace: require('../../assets/character/thumbs/necklace2_thumb.png'),
  accessory_chain_necklace: require('../../assets/character/thumbs/necklace3_thumb.png'),
  accessory_piercing: require('../../assets/character/thumbs/piercing_thumb.png'),
  accessory_clover: require('../../assets/character/thumbs/vancleaf_thumb.png'),
  hat_strawberry: require('../../assets/character/thumbs/strawberry_hat_thumb.png'),
  hat_tangerine: require('../../assets/character/thumbs/tangerine_hat_thumb.png'),
  clothes_ballpark: require('../../assets/character/thumbs/dodgers_thumb.png'),
  clothes_pinstripe: require('../../assets/character/thumbs/yankees_thumb.png'),
  clothes_ivy_sweater: require('../../assets/character/thumbs/Harvard_thumb.png'),
  clothes_cat_lover_tee: require('../../assets/character/thumbs/Ilovecat_thumb.png'),
  clothes_phd_tee: require('../../assets/character/thumbs/Ilovephd_thumb.png'),
  clothes_sporty_vest: require('../../assets/character/thumbs/pawdidas_running_vest_thumb.png'),
  accessory_ghost: require('../../assets/character/thumbs/ghost_thumb.png'),
  clothes_granny: require('../../assets/character/thumbs/grandmother_thumb.png'),
  accessory_dino: require('../../assets/character/thumbs/dinosaur_acc_thumb.png'),
  clothes_orange_dress: require('../../assets/character/thumbs/orange_dress_thumb.png'),
  hat_orange_hair: require('../../assets/character/thumbs/orange_hair_thumb.png'),
  accessory_snow_white_band: require('../../assets/character/thumbs/snow_white_band_thumb.png'),
  clothes_snow_white_dress: require('../../assets/character/thumbs/snow_white_dress_thumb.png'),
  clothes_suit: require('../../assets/character/thumbs/suit_thumb.png'),
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

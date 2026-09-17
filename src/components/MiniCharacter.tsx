import React, { useState, useEffect } from 'react';
import { View, Image, Text, StyleSheet } from 'react-native';
import { colors } from '../theme';
import shopService, { CharacterState } from '../services/shopService';
import { getBaseCharacter, getItemLayer } from '../utils/characterAssets';

interface MiniCharacterProps {
  size?: number;
  petId?: string;
  characterData?: CharacterState | null;
}

export default function MiniCharacter({ size = 60, petId, characterData }: MiniCharacterProps) {
  const [character, setCharacter] = useState<CharacterState | null>(characterData || null);

  useEffect(() => {
    if (!characterData && petId) {
      shopService.getCharacter(petId).then(setCharacter).catch(() => {});
    } else {
      setCharacter(characterData || null);
    }
  }, [characterData, petId]);

  const charType = character?.characterType || 'dog';
  const baseImg = getBaseCharacter(charType);
  const equipped = character?.equipped;

  if (!baseImg) {
    const baseEmoji = charType === 'cat' ? '🐱' : '🐕';
    return (
      <View style={[styles.container, { width: size, height: size, borderRadius: size / 2 }]}>
        <Text style={{ fontSize: size * 0.5 }}>{baseEmoji}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { width: size, height: size, borderRadius: size / 2 }]}>
      <Image source={baseImg} style={{ width: size, height: size }} resizeMode="contain" />
      {equipped && (['clothes', 'accessory', 'hat', 'glasses', 'effect'] as const).map(slot => {
        const item = equipped[slot];
        if (!item) return null;
        const layer = getItemLayer(item.assetKey);
        if (!layer) return null;
        return (
          <Image
            key={slot}
            source={layer}
            style={{ position: 'absolute', top: 0, left: 0, width: size, height: size }}
            resizeMode="contain"
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
});

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme';
import shopService, { CharacterState } from '../services/shopService';

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

  const baseEmoji = character?.characterType === 'cat' ? '🐱' : '🐕';
  const equipped = character?.equipped;

  return (
    <View style={[styles.container, { width: size, height: size, borderRadius: size / 2 }]}>
      {equipped?.background && (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.accent + '15', borderRadius: size / 2 }]} />
      )}
      <Text style={{ fontSize: size * 0.5 }}>{baseEmoji}</Text>
      {equipped && (
        <View style={styles.badges}>
          {equipped.hat && <Text style={{ fontSize: size * 0.15 }}>🎩</Text>}
          {equipped.glasses && <Text style={{ fontSize: size * 0.15 }}>👓</Text>}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.lightGray,
    overflow: 'hidden',
  },
  badges: {
    position: 'absolute',
    top: 0,
    right: 0,
    flexDirection: 'row',
    gap: 1,
  },
});

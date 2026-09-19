import React, { ReactNode } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  ViewStyle,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type StyleProp,
} from 'react-native';

type Props = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  keyboardVerticalOffset?: number;
  footer?: ReactNode;
};

/** Keeps focused inputs above the keyboard and lets the user dismiss it. */
export default function KeyboardSafe({
  children,
  style,
  contentContainerStyle,
  keyboardVerticalOffset = 0,
  footer,
}: Props) {
  return (
    <KeyboardAvoidingView
      style={[styles.flex, style]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={keyboardVerticalOffset}
    >
      <ScrollView
        style={styles.flex}
        contentContainerStyle={contentContainerStyle}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        automaticallyAdjustKeyboardInsets
        showsVerticalScrollIndicator={false}
        onScrollBeginDrag={Keyboard.dismiss}
      >
        <Pressable onPress={Keyboard.dismiss}>
          {children}
        </Pressable>
      </ScrollView>
      {footer}
    </KeyboardAvoidingView>
  );
}

export const keyboardScrollProps = {
  keyboardShouldPersistTaps: 'handled' as const,
  keyboardDismissMode: (Platform.OS === 'ios' ? 'interactive' : 'on-drag') as 'interactive' | 'on-drag',
  automaticallyAdjustKeyboardInsets: true,
  onScrollBeginDrag: (_e?: NativeSyntheticEvent<NativeScrollEvent>) => {
    Keyboard.dismiss();
  },
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
});

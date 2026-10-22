import React from 'react';
import { Modal, View } from 'react-native';

export function SheetHost({
  visible,
  onClose,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <View style={{ flex: 1 }}>{children}</View>
    </Modal>
  );
}

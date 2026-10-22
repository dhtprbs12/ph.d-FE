import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { createPortal } from 'react-dom';

export function SheetHost({
  visible,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const [node, setNode] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (!visible) return;
    const el = document.createElement('div');
    el.setAttribute('data-phd-log-sheet', 'true');
    el.style.position = 'fixed';
    el.style.left = '0';
    el.style.right = '0';
    el.style.top = '0';
    el.style.bottom = '0';
    el.style.zIndex = '100000';
    el.style.display = 'flex';
    el.style.flexDirection = 'column';
    document.body.appendChild(el);
    setNode(el);
    return () => {
      document.body.removeChild(el);
      setNode(null);
    };
  }, [visible]);

  if (!visible || !node) return null;
  return createPortal(<View style={{ flex: 1, width: '100%' }}>{children}</View>, node);
}

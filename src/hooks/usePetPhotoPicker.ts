import { useCallback, useRef } from 'react';
import { usePetPhotoPickerContext } from '../context/PetPhotoPickerProvider';

type Options = {
  currentPhotoUri?: string | null;
  onPhotoSelected: (uri: string | null) => void;
  title?: string;
};

export function usePetPhotoPicker({ currentPhotoUri, onPhotoSelected, title }: Options) {
  const { openPicker, isBusy } = usePetPhotoPickerContext();
  const optionsRef = useRef({ currentPhotoUri, onPhotoSelected, title });
  optionsRef.current = { currentPhotoUri, onPhotoSelected, title };

  const pickPhoto = useCallback(() => {
    openPicker(optionsRef.current);
  }, [openPicker]);

  return { pickPhoto, cropModal: null, isBusy };
}

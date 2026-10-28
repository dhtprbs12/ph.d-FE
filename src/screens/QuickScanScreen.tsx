import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Modal } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { HomeStackParamList } from '../navigation/types';
import { useApp } from '../context/AppContext';
import { colors } from '../theme';
import api from '../services/api';
import petFoodService from '../services/petFoodService';
import { toTitleCase } from '../utils/helpers';
import { calendarDaysOnFood } from '../utils/foodTime';
import { SwitchFoodDialog } from '../components/SwitchFoodDialog';
import { useToast } from '../components/common/Toast';
import { lookupByBarcode, ackLookup } from '../services/lookupService';

type Nav = NativeStackNavigationProp<HomeStackParamList>;

export function QuickScanScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<any>();
  const { selectedPet } = useApp();
  const mode = route.params?.mode || 'analyze';
  const toast = useToast();
  const foodPetId = route.params?.petId;
  const [permission, requestPermission] = useCameraPermissions();
  const scannedRef = useRef(false);
  const cameraRef = useRef<CameraView>(null);
  const [looking, setLooking] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [missedScan, setMissedScan] = useState<{ barcode: string; photoUri?: string } | null>(null);
  const [foodSetInfo, setFoodSetInfo] = useState<{ name: string } | null>(null);
  const [pendingSwitch, setPendingSwitch] = useState<{ name: string; productId: string; brand?: string; currentName?: string; days?: number } | null>(null);

  useEffect(() => {
    if (!permission?.granted) requestPermission();
  }, [permission]);

  const handleBarCodeScanned = useCallback(async ({ data }: { data: string }) => {
    if (scannedRef.current || !selectedPet) return;
    scannedRef.current = true;
    let photoUri: string | null = null;
    try {
      const shot = await cameraRef.current?.takePictureAsync({ quality: 0.6 });
      photoUri = shot?.uri || null;
    } catch {
      photoUri = null;
    }
    setLooking(true);
    setNotFound(false);

    try {
      const res = await api.get<any>(`/scan/barcode-lookup`, {
        params: {
          barcode: data,
          petType: selectedPet.pet_type,
          petName: selectedPet.name,
          petId: selectedPet.id,
          ...(mode === 'analyze' ? { recordHistory: '1' } : {}),
        },
      });
      const result = res.data;

      if (result?.product && result?.analysis) {
        if (mode === 'selectFood' && foodPetId) {
          try {
            const currentFood = await petFoodService.getCurrentFood(foodPetId);
            if (currentFood?.productId && currentFood.productId === result.product.id) {
              toast.show({ message: 'Already eating this food', type: 'info' });
              scannedRef.current = false;
              setLooking(false);
              return;
            }
            if (currentFood) {
              setPendingSwitch({
                name: result.product.name,
                productId: result.product.id,
                brand: result.product.brand || undefined,
                currentName: currentFood.productName,
                days: calendarDaysOnFood(currentFood.startedAt, null, true),
              });
              setLooking(false);
              return;
            }
            await petFoodService.setCurrentFood(foodPetId, {
              productId: result.product.id,
              productName: result.product.name,
              brand: result.product.brand || undefined,
            });
            setFoodSetInfo({ name: result.product.name });
          } catch {
            toast.show({ message: 'Failed to set current food', type: 'error' });
          }
          setLooking(false);
          return;
        }
        const scanResult = {
          scanId: `barcode-${Date.now()}`,
          scanType: 'barcode_lookup',
          product: {
            id: result.product.id,
            name: result.product.name,
            manufacturer: result.product.manufacturer,
            brand: result.product.brand,
            image_url: result.product.image_url,
          },
          analysis: result.analysis,
          pet: { name: selectedPet.name, petType: selectedPet.pet_type },
        };
        navigation.replace('Result', { scanResult });
      } else if (result?.product) {
        setMissedScan(null);
        setNotFound(true);
        setLooking(false);
      } else {
        setMissedScan({ barcode: data, photoUri: photoUri ?? undefined });
        setNotFound(true);
        setLooking(false);
      }
    } catch (e: any) {
      if (e?.response?.status === 404) {
        if (mode === 'analyze') {
          try {
            const existing = await lookupByBarcode(data);
            if (existing?.scanResult) {
              await ackLookup(existing.id);
              navigation.replace('Result', { scanResult: existing.scanResult });
              return;
            }
          } catch {
            // A miss still opens the photo flow.
          }
        }
        setMissedScan({ barcode: data, photoUri: photoUri ?? undefined });
        setNotFound(true);
      } else {
        toast.show({ message: 'Something went wrong. Try again.', type: 'error' });
      }
      setLooking(false);
    }
  }, [selectedPet, navigation, mode, foodPetId, toast]);

  const retry = () => {
    scannedRef.current = false;
    setNotFound(false);
    setMissedScan(null);
    setLooking(false);
  };

  if (!permission?.granted) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.center}>
          <Text style={s.permText}>Camera permission is required.</Text>
          <Pressable onPress={() => navigation.goBack()} style={s.backBtn}>
            <Text style={s.backBtnText}>Go Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="close" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={s.title}>{mode === 'selectFood' ? 'Scan Food' : 'Quick Scan'}</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Camera */}
      <View style={s.cameraContainer}>
        {!notFound && !looking && (
          <CameraView
            ref={cameraRef}
            style={s.camera}
            facing="back"
            mode="picture"
            autofocus="off"
            barcodeScannerSettings={{
              barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39', 'code93', 'itf14', 'qr'],
            }}
            onBarcodeScanned={handleBarCodeScanned}
          />
        )}
        {!notFound && !looking && (
          <View style={s.overlay}>
            <Text style={s.hint}>Point at the barcode</Text>
          </View>
        )}
        {looking && (
          <Modal transparent animationType="fade">
            <View style={s.loadingModal}>
              <View style={s.loadingCard}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={s.loadingText}>Looking up product...</Text>
              </View>
            </View>
          </Modal>
        )}
        {notFound && (
          <View style={s.notFoundOverlay}>
            <Ionicons name="search-outline" size={48} color={colors.textSecondary} />
            <Text style={s.notFoundTitle}>Product Not Found</Text>
            <Text style={s.notFoundSub}>
              {missedScan
                ? "This product isn't in our database yet."
                : "This product doesn't have a report yet."}
            </Text>
            <View style={s.notFoundBtns}>
              <Pressable onPress={retry} style={s.retryBtn}>
                <Text style={s.retryBtnText}>Scan Again</Text>
              </Pressable>
            </View>
            {(mode === 'analyze' || route.params?.firstFood) && missedScan ? (
              <Pressable
                onPress={() => navigation.replace('LookupPhotos', {
                  mode: 'barcode',
                  barcode: missedScan.barcode,
                  barcodePhotoUri: missedScan.photoUri,
                  setAsCurrentFood: route.params?.firstFood === true,
                  replaceCurrentFood: route.params?.replaceCurrentFood === true,
                })}
                style={s.registerBtn}
              >
                <Text style={s.registerBtnText}>Register</Text>
                <View style={s.tokenBadge}>
                  <Text style={s.tokenBadgeText}>+🦴20</Text>
                </View>
              </Pressable>
            ) : null}
          </View>
        )}
      </View>

      {/* Food Set Success Modal */}
      {foodSetInfo && (
        <Modal transparent animationType="fade">
          <View style={s.loadingModal}>
            <View style={s.successCard}>
              <Text style={{ fontSize: 48 }}>🎉</Text>
              <Text style={s.successTitle}>Food Updated!</Text>
              <Text style={s.successName}>{toTitleCase(foodSetInfo.name)}</Text>
              <Text style={s.successSub}>is now {selectedPet?.name || 'your pet'}'s current food</Text>
              <Pressable
                onPress={() => { setFoodSetInfo(null); navigation.goBack(); }}
                style={s.successBtn}
              >
                <Text style={s.successBtnText}>Done</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      )}

      {/* Switch Food Confirmation Modal */}
      <SwitchFoodDialog
        visible={!!pendingSwitch}
        currentName={pendingSwitch?.currentName || ''}
        dayCount={pendingSwitch?.days}
        newName={pendingSwitch?.name || ''}
        onCancel={() => { setPendingSwitch(null); scannedRef.current = false; setLooking(false); }}
        onConfirm={async () => {
          if (!pendingSwitch) return;
          try {
            await petFoodService.setCurrentFood(foodPetId!, {
              productId: pendingSwitch.productId,
              productName: pendingSwitch.name,
              brand: pendingSwitch.brand,
            });
            setFoodSetInfo({ name: pendingSwitch.name });
            setPendingSwitch(null);
          } catch {
            toast.show({ message: 'Failed to switch food', type: 'error' });
            setPendingSwitch(null);
          }
        }}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  title: { fontSize: 17, fontWeight: '600', color: colors.textPrimary },
  cameraContainer: { flex: 1, position: 'relative', margin: 16, borderRadius: 20, overflow: 'hidden', backgroundColor: '#000' },
  camera: { flex: 1 },
  overlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' },
  hint: { color: '#fff', fontSize: 14, marginTop: 20, fontWeight: '500' },
  loadingModal: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    paddingVertical: 32,
    paddingHorizontal: 40,
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
  },
  loadingText: { fontSize: 15, color: colors.textSecondary, fontWeight: '500' },
  notFoundOverlay: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    gap: 12,
  },
  notFoundTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
  notFoundSub: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  notFoundBtns: { flexDirection: 'row', gap: 12, marginTop: 16 },
  retryBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  retryBtnText: { color: colors.primary, fontWeight: '600', fontSize: 14 },
  labelScanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    backgroundColor: colors.primary,
  },
  labelScanBtnText: { color: colors.white, fontWeight: '600', fontSize: 14 },
  registerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    backgroundColor: colors.primary,
  },
  registerBtnText: { color: colors.white, fontWeight: '600', fontSize: 14 },
  tokenBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  tokenBadgeText: { fontSize: 11, color: '#fff', fontWeight: '700' },
  successCard: {
    backgroundColor: colors.white,
    borderRadius: 20,
    paddingVertical: 32,
    paddingHorizontal: 32,
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
  },
  successTitle: { fontSize: 20, fontWeight: '700', color: colors.textPrimary },
  successName: { fontSize: 16, fontWeight: '600', color: colors.primary },
  successSub: { fontSize: 14, color: colors.textSecondary, textAlign: 'center' },
  successBtn: {
    marginTop: 12,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 40,
    borderRadius: 12,
  },
  successBtnText: { fontSize: 15, fontWeight: '600', color: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  permText: { fontSize: 15, color: colors.textSecondary, textAlign: 'center', marginBottom: 16 },
  backBtn: { padding: 12, borderRadius: 8, borderWidth: 1, borderColor: colors.primary },
  backBtnText: { color: colors.primary, fontWeight: '600' },
});

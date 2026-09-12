import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Alert } from 'react-native';
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

type Nav = NativeStackNavigationProp<HomeStackParamList>;

export function QuickScanScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<any>();
  const { selectedPet } = useApp();
  const mode = route.params?.mode || 'analyze';
  const foodPetId = route.params?.petId;
  const [permission, requestPermission] = useCameraPermissions();
  const scannedRef = useRef(false);
  const [looking, setLooking] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [scannedBarcode, setScannedBarcode] = useState<string | null>(null);

  useEffect(() => {
    if (!permission?.granted) requestPermission();
  }, [permission]);

  const handleBarCodeScanned = useCallback(async ({ data }: { data: string }) => {
    if (scannedRef.current || !selectedPet) return;
    scannedRef.current = true;
    setLooking(true);
    setNotFound(false);
    setScannedBarcode(data);

    try {
      const res = await api.get<any>(`/scan/barcode-lookup`, {
        params: { barcode: data, petType: selectedPet.pet_type },
      });
      const result = res.data;

      if (result?.product && result?.analysis) {
        if (mode === 'selectFood' && foodPetId) {
          try {
            await petFoodService.setCurrentFood(foodPetId, {
              productId: result.product.id,
              productName: result.product.name,
              brand: result.product.brand || undefined,
            });
            Alert.alert('✅ Food Set!', `${result.product.name} is now ${selectedPet?.name || 'your pet'}'s current food.`, [
              { text: 'OK', onPress: () => navigation.goBack() },
            ]);
          } catch {
            Alert.alert('Error', 'Failed to set current food.');
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
        // Product found but no cached analysis
        setNotFound(true);
        setLooking(false);
      } else {
        setNotFound(true);
        setLooking(false);
      }
    } catch (e: any) {
      if (e?.response?.status === 404) {
        setNotFound(true);
      } else {
        Alert.alert('Error', 'Something went wrong. Try again.');
      }
      setLooking(false);
    }
  }, [selectedPet, navigation]);

  const retry = () => {
    scannedRef.current = false;
    setNotFound(false);
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
        {!notFound && (
          <CameraView
            style={s.camera}
            barcodeScannerSettings={{
              barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39', 'code93', 'itf14', 'qr'],
            }}
            onBarcodeScanned={looking || notFound ? undefined : handleBarCodeScanned}
          />
        )}
        {!notFound && !looking && (
          <View style={s.overlay}>
            <View style={s.scanFrame} />
            <Text style={s.hint}>Point at the barcode</Text>
          </View>
        )}
        {looking && (
          <View style={s.loadingOverlay}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={s.loadingText}>Looking up product...</Text>
          </View>
        )}
        {notFound && (
          <View style={s.notFoundOverlay}>
            <Ionicons name="search-outline" size={48} color={colors.textSecondary} />
            <Text style={s.notFoundTitle}>Product Not Found</Text>
            <Text style={s.notFoundSub}>
              This barcode isn't in our database yet.{'\n'}Help us add it and earn tokens!
            </Text>
            <View style={s.notFoundBtns}>
              <Pressable onPress={retry} style={s.retryBtn}>
                <Text style={s.retryBtnText}>Scan Again</Text>
              </Pressable>
              <Pressable
                onPress={() => navigation.replace('ProductRegister', { barcode: scannedBarcode ?? undefined })}
                style={s.registerBtn}
              >
                <Ionicons name="camera" size={16} color={colors.white} />
                <Text style={s.registerBtnText}>Register Product</Text>
                <View style={s.tokenBadge}>
                  <Text style={s.tokenBadgeText}>+🦴20</Text>
                </View>
              </Pressable>
            </View>
          </View>
        )}
      </View>
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
  scanFrame: {
    width: '70%',
    height: 3,
    backgroundColor: colors.primary,
    opacity: 0.7,
    borderRadius: 2,
  },
  hint: { color: '#fff', fontSize: 14, marginTop: 20, fontWeight: '500' },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
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
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  permText: { fontSize: 15, color: colors.textSecondary, textAlign: 'center', marginBottom: 16 },
  backBtn: { padding: 12, borderRadius: 8, borderWidth: 1, borderColor: colors.primary },
  backBtnText: { color: colors.primary, fontWeight: '600' },
});

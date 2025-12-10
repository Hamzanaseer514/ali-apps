import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type Prediction = {
  label: string;
  confidence: number;
};

type ImageMeta = {
  width?: number;
  height?: number;
  sizeMB?: number;
};

const MOCK_LABELS = ['Cat', 'Dog', 'Car', 'Tree', 'Laptop', 'Coffee Mug', 'Book'];

export default function HomeScreen() {
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [mediaPermission, requestMediaPermission] = ImagePicker.useMediaLibraryPermissions();
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [isClassifying, setIsClassifying] = useState(false);
  const [isCameraVisible, setIsCameraVisible] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<'back' | 'front'>('back');
  const [imageMeta, setImageMeta] = useState<ImageMeta | null>(null);

  const cameraRef = useRef<CameraView>(null);

  useEffect(() => {
    if (!mediaPermission) {
      requestMediaPermission();
    }
  }, [mediaPermission, requestMediaPermission]);

  const ensureCameraAccess = async () => {
    if (cameraPermission?.granted) {
      return true;
    }
    const permission = await requestCameraPermission();
    return permission?.granted ?? false;
  };

  const ensureMediaAccess = async () => {
    if (mediaPermission?.granted || mediaPermission?.accessPrivileges === 'limited') {
      return true;
    }
    const permission = await requestMediaPermission();
    if (!permission) {
      return false;
    }
    const hasLimitedAccess = permission.accessPrivileges === 'limited';
    if (!permission.granted && !hasLimitedAccess) {
      Alert.alert(
        'Permission needed',
        'Gallery access is required to pick an image. You can enable access from the device settings.'
      );
    }
    return permission.granted || hasLimitedAccess;
  };

  const updateImageState = (uri: string | null, meta: ImageMeta | null) => {
    setSelectedImageUri(uri);
    setImageMeta(meta);
    setPrediction(null);
  };

  const handleOpenCamera = async () => {
    const granted = await ensureCameraAccess();
    if (!granted) {
      Alert.alert('Permission needed', 'Camera access is required to take a photo.');
      return;
    }
    setIsCameraVisible(true);
  };

  const handlePickImage = async () => {
    setIsCameraVisible(false);
    const granted = await ensureMediaAccess();
    if (!granted) {
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        selectionLimit: 1,
        quality: 0.9,
      });

      if (result.canceled) {
        return;
      }

      const asset = result.assets?.[0];
      if (asset?.type && asset.type !== 'image') {
        Alert.alert('Only images supported', 'Please pick a photo to continue classification.');
        return;
      }
      if (asset?.uri) {
        updateImageState(asset.uri, {
          width: asset.width,
          height: asset.height,
          sizeMB: asset.fileSize ? asset.fileSize / (1024 * 1024) : undefined,
        });
      }
    } catch (error) {
      console.warn('Failed to pick image', error);
      Alert.alert('Something went wrong', 'Unable to open the photo library right now. Please try again.');
    }
  };

  const handleTakePhoto = async () => {
    if (!cameraRef.current) {
      return;
    }
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.7,
        skipProcessing: true,
      });
      updateImageState(photo?.uri ?? null, {
        width: photo?.width,
        height: photo?.height,
      });
    } catch (error) {
      console.warn('Failed to take photo', error);
    } finally {
      setIsCameraVisible(false);
    }
  };

  const handleClassify = async () => {
    if (!selectedImageUri) {
      return;
    }
    setIsClassifying(true);
    setPrediction(null);

    try {
      const result = await mockModelInference(selectedImageUri);
      setPrediction(result);
    } finally {
      setIsClassifying(false);
    }
  };

  const hasImage = Boolean(selectedImageUri);
  const helperMessage = useMemo(() => {
    if (!hasImage) {
      return 'Upload or capture a crisp photo to unlock model predictions.';
    }
    if (!prediction) {
      return 'Ready when you are. Tap classify to send this frame through your model.';
    }
    return 'Use this insight to decide if the asset meets your quality bar.';
  }, [hasImage, prediction]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>Vision Studio</Text>
          <Text style={styles.title}>Road Detection & Classification App</Text>
          <Text style={styles.subtitle}>
            Capture, curate, and validate imagery with a refined workflow built for fast iteration.
          </Text>
        </View>

        {/* <View style={styles.badgeRow}>
          <View style={styles.badge}>
            <Ionicons name={hasImage ? 'checkmark-circle' : 'ellipse-outline'} size={16} color="#2563EB" />
            <Text style={styles.badgeText}>{hasImage ? 'Image Ready' : 'Awaiting Image'}</Text>
          </View>
          <View style={styles.badge}>
            <Ionicons name="shield-checkmark" size={16} color="#2563EB" />
            <Text style={styles.badgeText}>Secure Offline / Cloud Ready</Text>
          </View>
        </View> */}

        {isCameraVisible && (
          <View style={styles.cameraContainer}>
            <CameraView ref={cameraRef} style={styles.camera} facing={cameraFacing} />
            <View style={styles.cameraActions}>
              <Pressable style={styles.secondaryButton} onPress={() => setIsCameraVisible(false)}>
                <Text style={styles.secondaryButtonText}>Close</Text>
              </Pressable>
              <Pressable
                style={styles.secondaryButton}
                onPress={() => setCameraFacing((prev) => (prev === 'back' ? 'front' : 'back'))}>
                <Text style={styles.secondaryButtonText}>Flip</Text>
              </Pressable>
            </View>
            <Pressable style={styles.shutterButton} onPress={handleTakePhoto}>
              <View style={styles.shutterInner} />
            </Pressable>
          </View>
        )}

        <View style={styles.imageCard}>
          {selectedImageUri ? (
            <Image source={{ uri: selectedImageUri }} style={styles.previewImage} />
          ) : (
            <Text style={styles.placeholderText}>Drop in a high-quality reference image to begin.</Text>
          )}
        </View>

       

        <View style={styles.actionGrid}>
          <Pressable style={[styles.actionCard, styles.primaryAction]} onPress={handleOpenCamera}>
            <View style={styles.actionIcon}>
              <Ionicons name="camera" size={22} color="#0B1D40" />
            </View>
            <View style={styles.actionCopy}>
              <Text style={styles.actionTitle}>Use Camera</Text>
              <Text style={styles.actionSubtitle}>Capture with live preview</Text>
            </View>
          </Pressable>
          <Pressable style={styles.actionCard} onPress={handlePickImage}>
            <View style={[styles.actionIcon, styles.actionIconAlt]}>
              <Ionicons name="images" size={22} color="#0D2A5C" />
            </View>
            <View style={styles.actionCopy}>
              <Text style={styles.actionTitle}>Pick from Gallery</Text>
              <Text style={styles.actionSubtitle}>Import an existing asset</Text>
            </View>
          </Pressable>
        </View>

        <Pressable
          style={[styles.classifyButton, !hasImage && styles.disabledButton]}
          onPress={handleClassify}
          disabled={!hasImage || isClassifying}>
          {isClassifying ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.classifyButtonText}>Classify</Text>
          )}
        </Pressable>

        {prediction && (
          <View style={styles.resultCard}>
            <View style={styles.resultHeader}>
              <Text style={styles.resultLabel}>Prediction</Text>
              <View style={styles.confidencePill}>
                <Ionicons name="sparkles" size={14} color="#0F172A" />
                <Text style={styles.confidenceText}>{prediction.confidence.toFixed(1)}%</Text>
              </View>
            </View>
            <Text style={styles.resultValue}>{prediction.label}</Text>
            <Text style={styles.resultConfidence}>Confidence Score</Text>
          </View>
        )}

        <View style={styles.helperPanel}>
          <Ionicons name="information-circle" size={18} color="#2563EB" />
          <Text style={styles.helperText}>{helperMessage}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

async function mockModelInference(imageUri: string): Promise<Prediction> {
  try {
    const formData = new FormData();

    const fileName = imageUri.split('/').pop() ?? 'image.jpg';
    const ext = fileName.split('.').pop()?.toLowerCase();

    const mimeType =
      ext === 'png'
        ? 'image/png'
        : ext === 'heic'
        ? 'image/heic'
        : ext === 'webp'
        ? 'image/webp'
        : 'image/jpeg';

    formData.append('file', {
      uri: imageUri,
      name: fileName,
      type: mimeType,
    } as any);

    const response = await fetch('http://10.5.32.231:5000/predict', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const msg = await response.text();
      throw new Error(msg || 'Failed to classify image.');
    }

    const data = await response.json();

    const percent =
      typeof data.confidence_percent === 'number'
        ? data.confidence_percent
        : typeof data.confidence === 'number'
        ? data.confidence * 100
        : 0;

    return {
      label: data.predicted_class ?? data.label ?? 'Unknown',
      confidence: percent,
    };
  } catch (err) {
    console.error('Classification error:', err);
    throw err;
  }
}


const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F4F6FB',
  },
  content: {
    padding: 24,
    rowGap: 20,
    paddingBottom: 48,
  },
  hero: {
    rowGap: 8,
  },
  eyebrow: {
    fontSize: 14,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: '#2563EB',
    fontWeight: '600',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0F172A',
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 22,
    color: '#475569',
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 6,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: '#E3EDFF',
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
  },
  cameraContainer: {
    height: 360,
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: '#000',
    position: 'relative',
  },
  camera: {
    ...StyleSheet.absoluteFillObject,
  },
  cameraActions: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    columnGap: 12,
  },
  shutterButton: {
    position: 'absolute',
    bottom: 24,
    alignSelf: 'center',
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: '#FFFFFFAA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shutterInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
  },
  imageCard: {
    height: 260,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 18,
    shadowColor: '#0F172A',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 16,
    elevation: 3,
  },
  previewImage: {
    width: '100%',
    height: '100%',
    borderRadius: 20,
  },
  placeholderText: {
    textAlign: 'center',
    color: '#94A3B8',
    fontSize: 16,
    lineHeight: 22,
  },
  metricsRow: {
    flexDirection: 'row',
    columnGap: 12,
    flexWrap: 'wrap',
  },
  metricCard: {
    flex: 1,
    minWidth: 150,
    padding: 16,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    rowGap: 6,
  },
  metricLabel: {
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: '#94A3B8',
    fontWeight: '600',
  },
  metricValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  metricHint: {
    fontSize: 14,
    color: '#64748B',
  },
  actionGrid: {
    rowGap: 12,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 14,
    padding: 18,
    borderRadius: 20,
    backgroundColor: '#EEF2FF',
  },
  primaryAction: {
    backgroundColor: '#DAE8FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionIconAlt: {
    backgroundColor: '#E3EDFF',
  },
  actionCopy: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  actionSubtitle: {
    fontSize: 14,
    color: '#475569',
  },
  secondaryButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#1F2937B3',
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  classifyButton: {
    backgroundColor: '#0F172A',
    paddingVertical: 18,
    borderRadius: 18,
    alignItems: 'center',
    shadowColor: '#0F172A',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 15,
    elevation: 4,
  },
  classifyButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 18,
  },
  disabledButton: {
    backgroundColor: '#94A3B8',
    shadowOpacity: 0,
    elevation: 0,
  },
  resultCard: {
    padding: 22,
    borderRadius: 24,
    backgroundColor: '#0F172A',
    rowGap: 10,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  resultLabel: {
    fontSize: 14,
    color: '#A5B4FC',
    letterSpacing: 1,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  confidencePill: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
  },
  confidenceText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  resultValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  resultConfidence: {
    fontSize: 16,
    color: '#CBD5F5',
  },
  helperPanel: {
    flexDirection: 'row',
    columnGap: 10,
    padding: 16,
    borderRadius: 18,
    backgroundColor: '#E7EEF9',
    alignItems: 'flex-start',
  },
  helperText: {
    flex: 1,
    color: '#0F172A',
    fontSize: 15,
    lineHeight: 22,
  },
});

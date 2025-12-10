import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

type Prediction = {
  label: string;
  confidence: number;
};

const API_ENDPOINT = 'http://10.5.32.231:5000/predict';

export default function HomeScreen() {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [isClassifying, setIsClassifying] = useState(false);
  const [cameraVisible, setCameraVisible] = useState(false);
  const [resultModalVisible, setResultModalVisible] = useState(false);
  const cameraRef = useRef<CameraView>(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  const ensureCameraPermission = useCallback(async () => {
    if (cameraPermission?.granted) {
      return true;
    }
    const response = await requestCameraPermission();
    if (!response.granted) {
      Alert.alert(
        'Camera permission needed',
        'Please grant camera access to capture images.'
      );
      return false;
    }
    return true;
  }, [cameraPermission?.granted, requestCameraPermission]);

  const handleOpenCamera = useCallback(async () => {
    const granted = await ensureCameraPermission();
    if (!granted) {
      return;
    }
    setCameraVisible(true);
  }, [ensureCameraPermission]);

  const handleCapturePhoto = useCallback(async () => {
    if (!cameraRef.current) {
      return;
    }
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        skipProcessing: true,
      });
      setImageUri(photo.uri);
      setPrediction(null);
      setResultModalVisible(false);
      setCameraVisible(false);
    } catch (error) {
      Alert.alert('Capture failed', 'Unable to take a picture right now.');
    }
  }, []);

  const handlePickImage = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== ImagePicker.PermissionStatus.GRANTED) {
      Alert.alert(
        'Gallery permission needed',
        'Please allow access to your library to select images.'
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.9,
    });

    if (!result.canceled && result.assets?.length) {
      setImageUri(result.assets[0].uri);
      setPrediction(null);
      setResultModalVisible(false);
    }
  }, []);

  const classifyImageViaApi = useCallback(async (uri: string) => {
    const formData = new FormData();
    const fileName = uri.split('/').pop() ?? 'upload.jpg';
    const extension = fileName.split('.').pop()?.toLowerCase();

    const mimeType =
      extension === 'png'
        ? 'image/png'
        : extension === 'heic'
        ? 'image/heic'
        : extension === 'webp'
        ? 'image/webp'
        : 'image/jpeg';

    formData.append('image', {
      uri,
      name: fileName,
      type: mimeType,
    } as any);

    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(message || 'Unable to classify image.');
    }

    const data = await response.json();
    const percent =
      typeof data.confidence_percent === 'number'
        ? data.confidence_percent
        : typeof data.confidence === 'number'
        ? data.confidence * 100
        : 0;

    return {
      label: typeof data.label === 'string' ? data.label : 'Unknown',
      confidence: percent / 100,
    };
  }, []);

  const handleClassify = useCallback(async () => {
    if (!imageUri) {
      Alert.alert('No image', 'Pick or capture an image before classifying.');
      return;
    }
    try {
      setIsClassifying(true);
      const result = await classifyImageViaApi(imageUri);
      setPrediction(result);
      setResultModalVisible(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Something went wrong.';
      Alert.alert('Classification failed', message);
    } finally {
      setIsClassifying(false);
    }
  }, [classifyImageViaApi, imageUri]);

  const hasImage = Boolean(imageUri);

  return (
    <LinearGradient colors={['#05080f', '#060f1f']} style={styles.gradient}>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="light" />
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          bounces={false}
          keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Text style={styles.heading}>Garbage Detection & Classification App</Text>
            <Text style={styles.copy}>
              Capture a new photo or browse your gallery, then let the model guess the subject with a
              tap.
            </Text>
          </View>

          <LinearGradient colors={['#111b2f', '#0b1220']} style={styles.previewShell}>
            {hasImage ? (
              <Image source={{ uri: imageUri! }} style={styles.previewImage} resizeMode="cover" />
            ) : (
              <View style={styles.previewPlaceholder}>
                <Text style={styles.previewTitle}>Image preview</Text>
                <Text style={styles.previewSubtitle}>Your selected image will appear here.</Text>
              </View>
            )}
          </LinearGradient>

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.button, styles.primaryButton]}
              onPress={handleOpenCamera}>
              <Text style={styles.buttonText}>Take Picture</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.secondaryButton]}
              onPress={handlePickImage}>
              <Text style={styles.buttonText}>Select from Gallery</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.fullButton, (!hasImage || isClassifying) && styles.buttonDisabled]}
            onPress={handleClassify}
            disabled={!hasImage || isClassifying}>
            {isClassifying ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.fullButtonText}>Classify</Text>
            )}
          </TouchableOpacity>

          <Text style={styles.note}>Tip: keep the subject centered and well-lit for best results.</Text>
        </ScrollView>

        <Modal visible={cameraVisible} animationType="slide">
          <SafeAreaView style={styles.cameraSafeArea}>
            <CameraView ref={cameraRef} style={styles.cameraPreview} facing="back" />
            <View style={styles.cameraControls}>
              <TouchableOpacity
                style={[styles.button, styles.cameraAction]}
                onPress={() => setCameraVisible(false)}>
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.captureButton]}
                onPress={handleCapturePhoto}>
                <Text style={styles.buttonText}>Capture</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </Modal>

        <Modal
          visible={resultModalVisible && !!prediction}
          transparent
          animationType="fade"
          onRequestClose={() => setResultModalVisible(false)}>
          <View style={styles.resultModalBackdrop}>
            <View style={styles.resultModal}>
              <Text style={styles.resultTitle}>Classification Result</Text>
              <Text style={styles.resultClass}>{prediction?.label ?? '--'}</Text>
              <Text style={styles.resultConfidence}>
                Confidence{' '}
                {prediction ? `${(prediction.confidence * 100).toFixed(1)}%` : '--'}
              </Text>
              <TouchableOpacity
                style={[styles.button, styles.modalButton, styles.closeButton]}
                onPress={() => setResultModalVisible(false)}>
                <Text style={styles.buttonText}>OK</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingVertical: 32,
    paddingBottom: 48,
    gap: 24,
  },
  header: {
    gap: 8,
    paddingTop: 24,
  },
  heading: {
    color: '#f5f7ff',
    fontSize: 26,
    fontWeight: '700',
  },
  copy: {
    color: '#9ca9c9',
    fontSize: 14,
    lineHeight: 20,
  },
  previewShell: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    height: 260,
    overflow: 'hidden',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  previewPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    gap: 6,
  },
  previewTitle: {
    color: '#cfd6ef',
    fontSize: 16,
    fontWeight: '600',
  },
  previewSubtitle: {
    color: '#7d88a8',
    textAlign: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    elevation: 4,
  },
  buttonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  primaryButton: {
    backgroundColor: '#4c6dff',
  },
  secondaryButton: {
    backgroundColor: '#2fb59b',
  },
  fullButton: {
    marginTop: 8,
    paddingVertical: 16,
    borderRadius: 20,
    alignItems: 'center',
    backgroundColor: '#f45c71',
    shadowColor: '#f45c71',
    shadowOpacity: 0.35,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 20,
    elevation: 6,
  },
  fullButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  note: {
    color: '#7e89a8',
    fontSize: 13,
    lineHeight: 18,
  },
  cameraSafeArea: {
    flex: 1,
    backgroundColor: '#000',
  },
  cameraPreview: {
    flex: 1,
  },
  cameraControls: {
    flexDirection: 'row',
    gap: 16,
    padding: 20,
    backgroundColor: '#03060c',
  },
  cameraAction: {
    backgroundColor: '#404b63',
    flex: 1,
  },
  captureButton: {
    backgroundColor: '#f45c71',
    flex: 1,
  },
  modalButton: {
    flex: 0,
    width: '100%',
  },
  resultModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  resultModal: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#0b1528',
    borderRadius: 28,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    gap: 12,
  },
  resultTitle: {
    color: '#8aa7ff',
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  resultClass: {
    color: '#f5f7ff',
    fontSize: 24,
    fontWeight: '700',
  },
  resultConfidence: {
    color: '#cfd6ff',
    fontSize: 15,
  },
  closeButton: {
    backgroundColor: '#1e2740',
    marginTop: 4,
  },
});

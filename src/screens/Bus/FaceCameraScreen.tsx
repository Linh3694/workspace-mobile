/**
 * Face Camera Screen
 * Wrapper screen for FaceCamera component with bus service integration
 */

import React, { useState, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import FaceCamera from '../../components/FaceRecognition/FaceCamera';
import { busService, type FaceRecognitionResult } from '../../services/busService';

type RootStackParamList = {
  FaceCamera: { tripId: string; onSuccess?: () => void };
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type RoutePropType = RouteProp<RootStackParamList, 'FaceCamera'>;

const FaceCameraScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RoutePropType>();
  const { tripId } = route.params;

  const [isProcessing, setIsProcessing] = useState(false);
  const [lastResult, setLastResult] = useState<{
    success: boolean;
    studentName?: string;
    message?: string;
  } | null>(null);

  const handleCapture = useCallback(
    async (imageBase64: string) => {
      setIsProcessing(true);
      setLastResult(null);

      try {
        console.log('========================================');
        console.log('[FaceCameraScreen] 🎬 START FACE RECOGNITION');
        console.log('========================================');
        console.log(`[FaceCameraScreen] Trip ID: ${tripId}`);
        console.log(`[FaceCameraScreen] Image base64 length: ${imageBase64?.length || 0} chars`);
        console.log(`[FaceCameraScreen] Image preview: ${imageBase64?.substring(0, 100)}...`);

        const response = await busService.verifyAndCheckin(
          `data:image/jpeg;base64,${imageBase64}`,
          tripId,
          true // auto checkin
        );

        console.log('----------------------------------------');
        console.log('[FaceCameraScreen] 📥 FULL RESPONSE FROM API:');
        console.log('----------------------------------------');
        console.log(JSON.stringify(response, null, 2));
        console.log('----------------------------------------');

        if (response.success && response.data) {
          const result = response.data as FaceRecognitionResult;

          console.log('[FaceCameraScreen] ✅ Recognition SUCCESS');
          console.log('[FaceCameraScreen] Recognized:', result.recognized);
          console.log('[FaceCameraScreen] Checked in:', result.checked_in);
          console.log('[FaceCameraScreen] Student:', JSON.stringify(result.student));
          console.log('[FaceCameraScreen] Recognition info:', JSON.stringify(result.recognition));
          console.log('[FaceCameraScreen] Message:', result.message);

          setLastResult({
            success: result.recognized && result.checked_in,
            studentName: result.student?.student_name,
            message: result.message,
          });

          // Auto hide result after 3 seconds
          setTimeout(() => {
            setLastResult(null);
          }, 3000);
        } else {
          // Show detailed error message
          const errorMessage = response.message || 'Không nhận diện được';

          console.log('[FaceCameraScreen] ❌ Recognition FAILED');
          console.log('[FaceCameraScreen] Error message:', errorMessage);
          console.log('[FaceCameraScreen] Full error response:', JSON.stringify(response));

          setLastResult({
            success: false,
            message: errorMessage,
          });

          // Keep error visible longer (5 seconds)
          setTimeout(() => {
            setLastResult(null);
          }, 5000);
        }

        console.log('========================================');
        console.log('[FaceCameraScreen] 🎬 END FACE RECOGNITION');
        console.log('========================================');
      } catch (error: any) {
        console.log('[FaceCameraScreen] 💥 EXCEPTION occurred');
        console.error('[FaceCameraScreen] Error:', error);
        console.error('[FaceCameraScreen] Error message:', error?.message);
        console.error('[FaceCameraScreen] Error stack:', error?.stack);

        const errorMessage = error?.message || 'Có lỗi xảy ra khi nhận diện';
        setLastResult({
          success: false,
          message: errorMessage,
        });
      } finally {
        setIsProcessing(false);
      }
    },
    [tripId]
  );

  const handleClose = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  return (
    <View style={styles.container}>
      <FaceCamera
        onCapture={handleCapture}
        onClose={handleClose}
        autoCapture={true}
        isProcessing={isProcessing}
        lastResult={lastResult}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
});

export default FaceCameraScreen;

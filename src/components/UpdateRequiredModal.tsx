import React from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AppIcon from '../assets/icon.png';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface UpdateRequiredModalProps {
  visible: boolean;
  currentVersion: string;
  latestVersion: string;
  onUpdate: () => void;
  onLater?: () => void;
  forceUpdate?: boolean; // Nếu true, không cho phép bỏ qua
}

export const UpdateRequiredModal: React.FC<UpdateRequiredModalProps> = ({
  visible,
  currentVersion,
  latestVersion,
  onUpdate,
  onLater,
  forceUpdate = false,
}) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={forceUpdate ? undefined : onLater}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header với gradient */}
          <LinearGradient
            colors={['#F05023', '#F5AA1E']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.header}
          >
            <View style={styles.iconContainer}>
              <Image source={AppIcon} style={styles.icon} resizeMode="contain" />
            </View>
          </LinearGradient>

          {/* Content */}
          <View style={styles.content}>
            <Text style={styles.title}>Phiên bản mới đã có!</Text>
            <Text style={styles.subtitle}>
              Cập nhật ngay để trải nghiệm những tính năng mới nhất
            </Text>

            {/* Buttons */}
            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={styles.updateButton}
                onPress={onUpdate}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={['#F05023', '#F5AA1E']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.updateButtonGradient}
                >
                  <Ionicons name="download-outline" size={20} color="#FFFFFF" />
                  <Text style={styles.updateButtonText}>
                    Cập nhật ngay
                  </Text>
                </LinearGradient>
              </TouchableOpacity>

              {!forceUpdate && onLater && (
                <TouchableOpacity
                  style={styles.laterButton}
                  onPress={onLater}
                  activeOpacity={0.7}
                >
                  <Text style={styles.laterButtonText}>Để sau</Text>
                </TouchableOpacity>
              )}
            </View>

            {forceUpdate && (
              <Text style={styles.forceUpdateNote}>
                * Bạn cần cập nhật để tiếp tục sử dụng ứng dụng
              </Text>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  container: {
    width: SCREEN_WIDTH - 48,
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.25,
        shadowRadius: 20,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  header: {
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  icon: {
    width: 80,
    height: 80,
    borderRadius: 20,
  },
  content: {
    padding: 24,
    paddingTop: 20,
  },
  title: {
    fontSize: 22,
    fontFamily: 'Mulish-Bold',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: 'Mulish-Regular',
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  versionContainer: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  versionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  versionLabel: {
    fontSize: 13,
    fontFamily: 'Mulish-Medium',
    color: '#6B7280',
  },
  versionBadge: {
    backgroundColor: '#E5E7EB',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
  },
  versionBadgeNew: {
    backgroundColor: '#DCFCE7',
  },
  versionTextOld: {
    fontSize: 13,
    fontFamily: 'Mulish-SemiBold',
    color: '#6B7280',
  },
  versionTextNew: {
    fontSize: 13,
    fontFamily: 'Mulish-SemiBold',
    color: '#10B981',
  },
  arrowContainer: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  featuresContainer: {
    marginBottom: 24,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  featureText: {
    fontSize: 13,
    fontFamily: 'Mulish-Regular',
    color: '#4B5563',
    marginLeft: 10,
  },
  buttonContainer: {
    gap: 12,
  },
  updateButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  updateButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  updateButtonText: {
    fontSize: 16,
    fontFamily: 'Mulish-Bold',
    color: '#FFFFFF',
  },
  laterButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  laterButtonText: {
    fontSize: 14,
    fontFamily: 'Mulish-SemiBold',
    color: '#9CA3AF',
  },
  forceUpdateNote: {
    fontSize: 11,
    fontFamily: 'Mulish-Regular',
    color: '#EF4444',
    textAlign: 'center',
    marginTop: 12,
  },
});

export default UpdateRequiredModal;


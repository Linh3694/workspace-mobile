// @ts-nocheck
import React, { useEffect } from 'react';
import { View, Text, Image, Dimensions, StyleSheet, StatusBar } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  runOnJS,
} from 'react-native-reanimated';
import Constants from 'expo-constants';
import { getActiveTheme } from '../../theme/themeConfig';
import { Snowfall } from '../../components/Snowfall';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const theme = getActiveTheme();

interface SplashScreenProps {
  onFinish: () => void;
}

const SplashScreen: React.FC<SplashScreenProps> = ({ onFinish }) => {
  // Animation values
  const logoOpacity = useSharedValue(0);
  const textOpacity = useSharedValue(0);
  const subtitleOpacity = useSharedValue(0);
  const versionOpacity = useSharedValue(0);
  const containerOpacity = useSharedValue(1);
  const circleScale1 = useSharedValue(0);
  const circleScale2 = useSharedValue(0);

  useEffect(() => {
    console.log('🎬 SplashScreen useEffect starting animations...');

    // Phase 1: Circles expand
    circleScale1.value = withTiming(1, { duration: 600 });
    circleScale2.value = withDelay(200, withTiming(1, { duration: 600 }));

    // Phase 2: Logo fade in (no scale animation)
    logoOpacity.value = withDelay(200, withTiming(1, { duration: 500 }));

    // Phase 3: Text appears (after 600ms)
    textOpacity.value = withDelay(600, withTiming(1, { duration: 350 }));

    // Phase 4: Subtitle appears (after 900ms)
    subtitleOpacity.value = withDelay(900, withTiming(1, { duration: 300 }));

    // Phase 5: Version appears (after 1100ms)
    versionOpacity.value = withDelay(1100, withTiming(1, { duration: 300 }));

    // Phase 6: Fade out and finish (after 2500ms)
    containerOpacity.value = withDelay(
      2500,
      withTiming(0, { duration: 400 }, (finished) => {
        if (finished) {
          console.log('🎬 Animation finished, calling onFinish');
          runOnJS(onFinish)();
        }
      })
    );
  }, []);

  // Animated styles
  const circle1Style = useAnimatedStyle(() => ({
    transform: [{ scale: circleScale1.value }],
  }));

  const circle2Style = useAnimatedStyle(() => ({
    transform: [{ scale: circleScale2.value }],
  }));

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
  }));

  const textStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
  }));

  const subtitleStyle = useAnimatedStyle(() => ({
    opacity: subtitleOpacity.value,
  }));

  const versionStyle = useAnimatedStyle(() => ({
    opacity: versionOpacity.value,
  }));

  const containerStyle = useAnimatedStyle(() => ({
    opacity: containerOpacity.value,
  }));

  // Kiểm tra xem có phải theme winter không để đổi màu
  const isWinterTheme = theme.id === 'winter';
  const backgroundColor = theme.colors.splashBackground || '#FEFEFE';
  const textColor = theme.colors.splashText || '#666';
  const subtitleColor = theme.colors.splashSubtitle || '#666';
  const accentColor = theme.colors.splashAccent || '#F5AA1E';

  return (
    <Reanimated.View
      style={[styles.container, containerStyle, { backgroundColor: backgroundColor }]}>
      <StatusBar
        barStyle={isWinterTheme ? 'light-content' : 'dark-content'}
        backgroundColor="transparent"
        translucent
      />

      {/* Gradient hoặc màu nền solid cho winter */}
      {isWinterTheme ? (
        <View style={[styles.gradient, { backgroundColor: backgroundColor }]} />
      ) : (
        <LinearGradient
          colors={['#FEFEFE', '#FFF9F0', '#FFF5E6']}
          style={styles.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
      )}

      {/* Animation tuyết rơi cho theme mùa đông */}
      {theme.hasSnowfall && <Snowfall count={40} />}

      {/* Decorative circles - ẩn khi theme winter vì đã có icon đẹp */}
      {!isWinterTheme && (
        <>
          <Reanimated.View style={[styles.decorCircle, styles.circle1, circle1Style]} />
          <Reanimated.View style={[styles.decorCircle, styles.circle2, circle2Style]} />
        </>
      )}

      {/* Main content */}
      <View style={styles.content}>
        {/* Logo - Dùng icon Giáng sinh cho theme winter */}
        <Reanimated.View style={logoStyle}>
          {isWinterTheme ? (
            // Icon Giáng sinh đẹp - không cần các layer 3D
            <View style={styles.christmasLogoContainer}>
              <Image
                source={require('../../assets/theme/christmas/icon.png')}
                style={styles.christmasLogo}
                resizeMode="contain"
              />
            </View>
          ) : (
            // Logo mặc định với hiệu ứng 3D
            <View style={styles.logoStack}>
              {/* Background layer 1 - Bottom most */}
              <View style={[styles.logoLayer, styles.logoLayer1]} />
              {/* Background layer 2 - Middle */}
              <View style={[styles.logoLayer, styles.logoLayer2]} />
              {/* Main image - Top layer */}
              <View style={[styles.logoLayer, styles.logoLayerMain]}>
                <Image
                  source={require('../../assets/icon.png')}
                  style={styles.logo}
                  resizeMode="contain"
                />
              </View>
            </View>
          )}
        </Reanimated.View>

        {/* Merry Christmas text - chỉ hiển thị khi theme winter */}
        {isWinterTheme && (
          <Reanimated.View style={[styles.merryChristmasContainer, textStyle]}>
            <Text style={styles.merryChristmasText}>🎄 Merry Christmas 🎄</Text>
          </Reanimated.View>
        )}

        {/* Subtitle - Wellspring Innovation Spaces */}
        <Reanimated.View style={[styles.subtitleContainer, subtitleStyle]}>
          <Text style={[styles.subtitle, { color: subtitleColor }]}>
            Wellspring Innovation Spaces
          </Text>
        </Reanimated.View>
      </View>

      {/* Bottom accent line */}
      <Reanimated.View
        style={[styles.accentLine, subtitleStyle, { backgroundColor: accentColor }]}
      />

      {/* Version text */}
      <Reanimated.View style={[styles.versionContainer, versionStyle]}>
        <Text style={[styles.versionText, { color: accentColor }]}>
          v{Constants.expoConfig?.version || '1.0.0'}
        </Text>
      </Reanimated.View>
    </Reanimated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FEFEFE',
  },
  gradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  decorCircle: {
    position: 'absolute',
    borderRadius: 9999,
    backgroundColor: '#F5AA1E',
    opacity: 0.12,
  },
  circle1: {
    width: SCREEN_WIDTH * 1.2,
    height: SCREEN_WIDTH * 1.2,
    top: -SCREEN_WIDTH * 0.4,
    right: -SCREEN_WIDTH * 0.4,
  },
  circle2: {
    width: SCREEN_WIDTH * 0.8,
    height: SCREEN_WIDTH * 0.8,
    bottom: -SCREEN_WIDTH * 0.3,
    left: -SCREEN_WIDTH * 0.3,
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoStack: {
    width: 150,
    height: 180,
    marginBottom: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Style cho icon Giáng sinh
  christmasLogoContainer: {
    width: 240,
    height: 240,
    marginBottom: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 40, // Bo góc như icon cũ
    overflow: 'hidden', // Đảm bảo ảnh được cắt theo borderRadius
    // Thêm shadow cho đẹp
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
  },
  christmasLogo: {
    width: 240,
    height: 240,
  },
  // Style cho Merry Christmas text
  merryChristmasContainer: {
    marginBottom: 8,
    alignItems: 'center',
  },
  merryChristmasText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F5D17A', // Màu vàng như chữ W trong icon
    letterSpacing: 1,
    textAlign: 'center',
  },
  logoLayer: {
    position: 'absolute',
    borderRadius: 32,
  },
  logoLayer1: {
    width: 120,
    height: 130,
    top: 15,
    backgroundColor: '#E4E4E7', // zinc-200
    opacity: 0.6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  logoLayer2: {
    width: 130,
    height: 130,
    top: 28,
    backgroundColor: '#D6D3D1', // stone-300
    opacity: 0.8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  logoLayerMain: {
    width: 140,
    height: 140,
    top: 40,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 10,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logo: {
    width: 140,
    height: 140,
  },
  textContainer: {
    alignItems: 'center',
  },
  appName: {
    fontSize: 56,
    fontWeight: '800',
    color: '#002855',
    letterSpacing: 8,
  },
  subtitleContainer: {
    marginTop: 12,
    alignItems: 'center',
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
    letterSpacing: 3,
    textTransform: 'uppercase',
  },
  accentLine: {
    position: 'absolute',
    bottom: 60,
    width: 40,
    height: 3,
    backgroundColor: '#F5AA1E',
    borderRadius: 2,
  },
  versionContainer: {
    position: 'absolute',
    bottom: 80,
    alignItems: 'center',
  },
  versionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#F5AA1E',
    letterSpacing: 1,
  },
});

export default SplashScreen;

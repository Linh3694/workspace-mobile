// @ts-nocheck
import React, { useEffect } from 'react';
import { View, Text, Image, Dimensions, StyleSheet, StatusBar } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  runOnJS,
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface SplashScreenProps {
  onFinish: () => void;
}

const SplashScreen: React.FC<SplashScreenProps> = ({ onFinish }) => {
  // Animation values
  const logoOpacity = useSharedValue(0);
  const subtitleOpacity = useSharedValue(0);
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

    // Phase 3: Subtitle appears (after 900ms)
    subtitleOpacity.value = withDelay(900, withTiming(1, { duration: 300 }));

    // Phase 4: Fade out and finish (after 2500ms)
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

  const subtitleStyle = useAnimatedStyle(() => ({
    opacity: subtitleOpacity.value,
  }));

  const containerStyle = useAnimatedStyle(() => ({
    opacity: containerOpacity.value,
  }));

  return (
    <Reanimated.View style={[styles.container, containerStyle]}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      <LinearGradient
        colors={['#FEFEFE', '#FFF9F0', '#FFF5E6']}
        style={styles.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      {/* Vòng trang trí */}
      <Reanimated.View style={[styles.decorCircle, styles.circle1, circle1Style]} />
      <Reanimated.View style={[styles.decorCircle, styles.circle2, circle2Style]} />

      {/* Nội dung chính */}
      <View style={styles.content}>
        <Reanimated.View style={logoStyle}>
          <View style={styles.logoStack}>
            <View style={[styles.logoLayer, styles.logoLayer1]} />
            <View style={[styles.logoLayer, styles.logoLayer2]} />
            <View style={[styles.logoLayer, styles.logoLayerMain]}>
              <Image
                source={require('../../assets/icon.png')}
                style={styles.logo}
                resizeMode="contain"
              />
            </View>
          </View>
        </Reanimated.View>

        <Reanimated.View style={[styles.subtitleContainer, subtitleStyle]}>
          <Text style={styles.subtitle}>Wellspring Innovation Spaces</Text>
        </Reanimated.View>
      </View>

      <Reanimated.View style={[styles.accentLine, subtitleStyle]} />
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
  logoLayer: {
    position: 'absolute',
    borderRadius: 32,
  },
  logoLayer1: {
    width: 120,
    height: 130,
    top: 15,
    backgroundColor: '#E4E4E7',
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
    backgroundColor: '#D6D3D1',
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
});

export default SplashScreen;

// @ts-nocheck
import React, { useEffect } from 'react';
import { View, Text, Image, StyleSheet, StatusBar, ImageBackground } from 'react-native';
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  runOnJS,
} from 'react-native-reanimated';
import Constants from 'expo-constants';
import KVIcon from '../../assets/theme/new-year/KV.svg';
import DecorIcon1 from '../../assets/theme/new-year/1.svg';
import DecorIcon2 from '../../assets/theme/new-year/2.svg';
import DecorIcon3 from '../../assets/theme/new-year/3.svg';
import DecorIcon4 from '../../assets/theme/new-year/4.svg';
import DecorIcon5 from '../../assets/theme/new-year/5.svg';

interface SplashScreenProps {
  onFinish: () => void;
}

const SplashScreen: React.FC<SplashScreenProps> = ({ onFinish }) => {
  // Animation values
  const iconOpacity = useSharedValue(0);
  const kvOpacity = useSharedValue(0);
  const versionOpacity = useSharedValue(0);
  const decor1Opacity = useSharedValue(0);
  const decor2Opacity = useSharedValue(0);
  const decor3Opacity = useSharedValue(0);
  const decor4Opacity = useSharedValue(0);
  const decor5Opacity = useSharedValue(0);
  const containerOpacity = useSharedValue(1);

  useEffect(() => {
    console.log('🎬 SplashScreen useEffect starting animations...');

    // Phase 1: Icon-splash fade in (after 200ms)
    iconOpacity.value = withDelay(200, withTiming(1, { duration: 500 }));

    // Phase 2: KV fade in (after 700ms)
    kvOpacity.value = withDelay(700, withTiming(1, { duration: 400 }));

    // Phase 3: Version appears (after 1100ms)
    versionOpacity.value = withDelay(1100, withTiming(1, { duration: 300 }));

    // Phase 4: Decorative images fade in lần lượt từ trên xuống
    decor1Opacity.value = withDelay(1300, withTiming(1, { duration: 300 }));
    decor2Opacity.value = withDelay(1450, withTiming(1, { duration: 300 }));
    decor3Opacity.value = withDelay(1600, withTiming(1, { duration: 300 }));
    decor4Opacity.value = withDelay(1750, withTiming(1, { duration: 300 }));
    decor5Opacity.value = withDelay(1900, withTiming(1, { duration: 300 }));

    // Phase 5: Fade out and finish (after 2800ms)
    containerOpacity.value = withDelay(
      2800,
      withTiming(0, { duration: 400 }, (finished) => {
        if (finished) {
          console.log('🎬 Animation finished, calling onFinish');
          runOnJS(onFinish)();
        }
      })
    );
  }, []);

  const iconStyle = useAnimatedStyle(() => ({
    opacity: iconOpacity.value,
  }));

  const kvStyle = useAnimatedStyle(() => ({
    opacity: kvOpacity.value,
  }));

  const versionStyle = useAnimatedStyle(() => ({
    opacity: versionOpacity.value,
  }));

  const decor1Style = useAnimatedStyle(() => ({
    opacity: decor1Opacity.value,
  }));

  const decor2Style = useAnimatedStyle(() => ({
    opacity: decor2Opacity.value,
  }));

  const decor3Style = useAnimatedStyle(() => ({
    opacity: decor3Opacity.value,
  }));

  const decor4Style = useAnimatedStyle(() => ({
    opacity: decor4Opacity.value,
  }));

  const decor5Style = useAnimatedStyle(() => ({
    opacity: decor5Opacity.value,
  }));

  const containerStyle = useAnimatedStyle(() => ({
    opacity: containerOpacity.value,
  }));

  return (
    <Reanimated.View style={[styles.container, containerStyle]}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      {/* Nền Tết 2026 */}
      <ImageBackground
        source={require('../../assets/theme/new-year/splashpage.png')}
        style={styles.gradient}
        resizeMode="cover"
      />

      {/* Main content */}
      <View style={styles.content}>
        {/* Icon splash - Logo W với gradient */}
        <Reanimated.View style={[styles.iconContainer, iconStyle]}>
          <Image
            source={require('../../assets/theme/new-year/icon-splash.png')}
            style={styles.iconSplash}
            resizeMode="contain"
          />
        </Reanimated.View>

        {/* KV - Key Visual / Slogan */}
        <Reanimated.View style={[styles.kvContainer, kvStyle]}>
          <KVIcon width={280} height={80} />
        </Reanimated.View>

        {/* Version text */}
        <Reanimated.View style={[styles.versionContainer, versionStyle]}>
          <Text style={styles.versionText}>v{Constants.expoConfig?.version || '1.0.0'}</Text>
        </Reanimated.View>

        {/* Decorative images dưới version - Absolute positioning */}
        <View style={styles.decorContainer}>
          {/* Ảnh 1 */}
          <Reanimated.View style={[styles.decorItem, { top: 0, left: '0%' }, decor1Style]}>
            <DecorIcon1 width={130} height={130} />
          </Reanimated.View>

          {/* Ảnh 2 */}
          <Reanimated.View style={[styles.decorItem, { top: 130, left: '0%' }, decor2Style]}>
            <DecorIcon2 width={110} height={110} />
          </Reanimated.View>

          {/* Ảnh 3 */}
          <Reanimated.View style={[styles.decorItem, { top: 240, left: '-20%' }, decor3Style]}>
            <DecorIcon3 width={130} height={130} />
          </Reanimated.View>

          {/* Ảnh 4 */}
          <Reanimated.View style={[styles.decorItem, { top: 360, left: '5%' }, decor4Style]}>
            <DecorIcon4 width={100} height={100} />
          </Reanimated.View>

          {/* Ảnh 5 */}
          <Reanimated.View style={[styles.decorItem, { top: 420, right: '5%' }, decor5Style]}>
            <DecorIcon5 width={100} height={100} />
          </Reanimated.View>
        </View>
      </View>
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
  content: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconSplash: {
    width: 280,
    height: 180,
  },
  kvContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  versionContainer: {
    alignItems: 'center',
  },
  versionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#03687F',
    letterSpacing: 1,
  },
  decorContainer: {
    position: 'relative',
    marginTop: 20,
    width: '100%',
    height: 500,
  },
  decorItem: {
    position: 'absolute',
  },
});

export default SplashScreen;

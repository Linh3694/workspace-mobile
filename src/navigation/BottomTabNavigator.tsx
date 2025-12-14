import React, { useEffect, useState } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { ROUTES } from '../constants/routes';
import HomeScreen from '../screens/Home/HomeScreen';
import NotificationsScreen from '../screens/Notifications/NotificationsScreen';
import ProfileScreen from '../screens/Profile/ProfileScreen';
import WislifeScreen from '../screens/Wislife/WislifeScreen';
// @ts-ignore
import { Text, View, StyleSheet, Platform, Pressable } from 'react-native';
import MenuIcon from '../assets/menu.svg';
import WislifeIcon from '../assets/wislife.svg';
import NotificationIcon from '../assets/notification.svg';
import ProfileIcon from '../assets/profile.svg';
// @ts-ignore
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { notificationCenterService } from '../services/notificationCenterService';
// @ts-ignore
import Animated, {
  useAnimatedStyle,
  withSpring,
  useSharedValue,
} from 'react-native-reanimated';
// Liquid Glass - chỉ hoạt động khi đã prebuild, không dùng được trong Expo Go
let LiquidGlassView: any = null;
let isLiquidGlassSupported = false;

try {
  const liquidGlass = require('@callstack/liquid-glass');
  LiquidGlassView = liquidGlass.LiquidGlassView;
  isLiquidGlassSupported = liquidGlass.isLiquidGlassSupported ?? false;
} catch (e) {
  // Module không tồn tại (Expo Go hoặc chưa prebuild)
  if (__DEV__) {
    console.log('⚠️ Liquid Glass module not available (Expo Go or not prebuilt)');
  }
}

const Tab = createBottomTabNavigator();

// Log để debug liquid glass support
if (__DEV__) {
  console.log('🔮 Liquid Glass Supported:', isLiquidGlassSupported);
  console.log('📱 Platform:', Platform.OS, Platform.Version);
}

// Custom Glass Tab Bar Component
const GlassTabBar = ({ state, descriptors, navigation }: any) => {
  const insets = useSafeAreaInsets();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (__DEV__) {
      console.log('🔮 Tab Bar - isLiquidGlassSupported:', isLiquidGlassSupported);
    }

    // Lấy unread notification count
    const fetchUnreadCount = async () => {
      try {
        const count = await notificationCenterService.getUnreadCount();
        setUnreadCount(count);
      } catch (error) {
        console.error('Error fetching unread count:', error);
      }
    };

    fetchUnreadCount();

    // Poll every 30 seconds để update count
    const interval = setInterval(fetchUnreadCount, 30000);

    return () => clearInterval(interval);
  }, []);

  const renderBackground = () => {
    // Sử dụng native Liquid Glass nếu được hỗ trợ (iOS 26+)
    if (isLiquidGlassSupported) {
      return (
        <LiquidGlassView
          // eslint-disable-next-line
          {...{ style: StyleSheet.absoluteFill, cornerRadius: 999 } as any}
        />
      );
    }

    // Fallback với BlurView cho iOS cũ và Android
    return (
      <>
        <BlurView
          intensity={80}
          tint="light"
          // eslint-disable-next-line
          {...{ style: StyleSheet.absoluteFill } as any}
        />
        <View style={styles.glassOverlay} />
      </>
    );
  };

  return (
    <View style={[styles.tabBarWrapper, { paddingBottom: Math.max(insets.bottom, 16) }]}>
      <View style={[
        styles.tabBarContainer,
        // Nếu dùng LiquidGlass thì không cần border và background
        isLiquidGlassSupported && styles.liquidGlassContainer
      ]}>
        {renderBackground()}
        <View style={styles.tabBarContent}>
          {state.routes.map((route: any, index: number) => {
            const { options } = descriptors[route.key];
            const isFocused = state.index === index;

            const onPress = () => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });

              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(route.name);
              }
            };

            return (
              <TabBarButton
                key={route.key}
                route={route}
                isFocused={isFocused}
                onPress={onPress}
                options={options}
                badgeCount={route.name === ROUTES.MAIN.NOTIFICATIONS ? unreadCount : undefined}
              />
            );
          })}
        </View>
      </View>
    </View>
  );
};

// Animated Tab Button
const TabBarButton = ({ route, isFocused, onPress, badgeCount }: any) => {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
    };
  });

  const handlePressIn = () => {
    scale.value = withSpring(0.9, { damping: 15, stiffness: 400 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 400 });
  };

  const getIcon = () => {
    const iconColor = isFocused ? '#0A2240' : '#9CA3AF';
    const iconSize = 24;

    switch (route.name) {
      case ROUTES.MAIN.HOME:
        return <MenuIcon width={iconSize} height={iconSize} color={iconColor} />;
      case ROUTES.MAIN.WISLIFE:
        return <WislifeIcon width={iconSize} height={iconSize} color={iconColor} />;
      case ROUTES.MAIN.NOTIFICATIONS:
        return <NotificationIcon width={iconSize} height={iconSize} color={iconColor} />;
      case ROUTES.MAIN.PROFILE:
        return <ProfileIcon width={iconSize} height={iconSize} color={iconColor} />;
      default:
        return null;
    }
  };

  const getLabel = () => {
    switch (route.name) {
      case ROUTES.MAIN.HOME:
        return 'Home';
      case ROUTES.MAIN.WISLIFE:
        return 'Wislife';
      case ROUTES.MAIN.NOTIFICATIONS:
        return 'Notifications';
      case ROUTES.MAIN.PROFILE:
        return 'Profile';
      default:
        return route.name;
    }
  };

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={styles.tabButton}
    >
      {/* @ts-ignore - Animated.View types issue */}
      <Animated.View style={[styles.tabButtonInner, animatedStyle]}>
        {/* Glass highlight for focused tab */}
        {isFocused && !isLiquidGlassSupported && <View style={styles.focusedBackground} />}
        
        <View style={styles.iconContainer}>
          {getIcon()}
          {/* Notification badge */}
          {badgeCount !== undefined && badgeCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {badgeCount > 99 ? '99+' : badgeCount}
              </Text>
            </View>
          )}
        </View>
        
        <Text
          style={[
            styles.tabLabel,
            { color: isFocused ? '#0A2240' : '#9CA3AF' },
          ]}
          numberOfLines={1}
        >
          {getLabel()}
        </Text>
      </Animated.View>
    </Pressable>
  );
};

const BottomTabNavigator = ({ route }: { route: any }) => {
  const initialRouteName = route?.params?.screen || ROUTES.TABS.HOME;

  return (
    <Tab.Navigator
      id={undefined}
      tabBar={(props) => <GlassTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
      initialRouteName={initialRouteName}
    >
      <Tab.Screen
        name={ROUTES.MAIN.HOME}
        component={HomeScreen}
      />
      <Tab.Screen
        name={ROUTES.MAIN.WISLIFE}
        component={WislifeScreen}
      />
      <Tab.Screen
        name={ROUTES.MAIN.NOTIFICATIONS}
        component={NotificationsScreen}
      />
      <Tab.Screen
        name={ROUTES.MAIN.PROFILE}
        component={ProfileScreen}
      />
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  tabBarWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  tabBarContainer: {
    borderRadius: 999, // Full pill shape
    overflow: 'hidden',
    // Glass effect border
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.6)',
    // Shadow for depth
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.15,
        shadowRadius: 25,
      },
      android: {
        elevation: 12,
      },
    }),
  },
  liquidGlassContainer: {
    // Khi dùng native Liquid Glass, không cần border/shadow vì nó tự xử lý
    borderWidth: 0,
    borderColor: 'transparent',
    backgroundColor: 'transparent',
  },
  glassOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  tabBarContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    gap: 8,
  },
  tabButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabButtonInner: {
    width: 75, // Giảm từ 90 xuống 75 để vừa 4 tabs
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
  },
  focusedBackground: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
  },
  iconContainer: {
    marginBottom: 2,
    position: 'relative',
  },
  tabLabel: {
    fontSize: 10,
    fontFamily: 'Mulish-SemiBold',
    letterSpacing: 0.2,
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -10,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontFamily: 'Mulish-Bold',
    fontWeight: '700',
  },
});

export default BottomTabNavigator;

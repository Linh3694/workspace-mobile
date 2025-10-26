import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { ROUTES } from '../constants/routes';
import HomeScreen from '../screens/Home/HomeScreen';
import AttendanceHome from '../screens/Attendance/AttendanceHome';
import WislifeScreen from '../screens/Wislife/WislifeScreen';
import NotificationsScreen from '../screens/Notifications/NotificationsScreen';
import ProfileScreen from '../screens/Profile/ProfileScreen';
import { Text, View } from 'react-native';
import MenuIcon from '../assets/menu.svg';
import DocumentIcon from '../assets/document-icon.svg';
import WislifeIcon from '../assets/wislife.svg';
import NotificationIcon from '../assets/notification.svg';
import ProfileIcon from '../assets/profile.svg';

const Tab = createBottomTabNavigator();

const tabBarLabel = (label: string, focused: boolean) => (
  <Text
    className={
      focused ? 'mt-1 font-medium text-sm text-[#0A2240]' : 'mt-1 font-medium text-sm text-gray-400'
    }>
    {label}
  </Text>
);

const BottomTabNavigator = ({ route }: { route: any }) => {
  const initialRouteName = route?.params?.screen || ROUTES.TABS.HOME;
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          borderTopWidth: 1,
          height: 90,
          paddingBottom: 16,
          paddingTop: 8,
        },
      }}
      initialRouteName={initialRouteName}>
      <Tab.Screen
        name={ROUTES.MAIN.HOME}
        component={HomeScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <View className="items-center">
              <MenuIcon width={28} height={28} />
            </View>
          ),
          tabBarLabel: ({ focused }) => tabBarLabel('WisWork', focused),
        }}
      />
      <Tab.Screen
        name="Attendance"
        component={AttendanceHome}
        options={{
          tabBarIcon: ({ focused }) => (
            <View className="items-center">
              <DocumentIcon width={28} height={28} />
            </View>
          ),
          tabBarLabel: ({ focused }) => tabBarLabel('Điểm danh', focused),
        }}
      />
      <Tab.Screen
        name={ROUTES.MAIN.WISLIFE}
        component={WislifeScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <View className="items-center">
              <WislifeIcon width={28} height={28} />
            </View>
          ),
          tabBarLabel: ({ focused }) => tabBarLabel('Social', focused),
        }}
      />
      {/* <Tab.Screen
         name={ROUTES.MAIN.NOTIFICATIONS}
         component={NotificationsScreen}
         options={{
           tabBarIcon: ({ focused }) => (
             <View className="items-center">
               <NotificationIcon width={28} height={28} />
             </View>
           ),
           tabBarLabel: ({ focused }) => tabBarLabel('Thông báo', focused),
         }}
       /> */}
      <Tab.Screen
        name={ROUTES.MAIN.PROFILE}
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <View className="items-center">
              <ProfileIcon width={28} height={28} />
            </View>
          ),
          tabBarLabel: ({ focused }) => tabBarLabel('WisMe', focused),
        }}
      />
    </Tab.Navigator>
  );
};

export default BottomTabNavigator;

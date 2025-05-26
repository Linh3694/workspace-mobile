import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { ROUTES } from '../constants/routes';
import HomeScreen from '../screens/Home/HomeScreen';
import ChatScreen from '../screens/Chat/ChatScreen';
import WislifeScreen from '../screens/Wislife/WislifeScreen';
import NotificationsScreen from '../screens/Notifications/NotificationsScreen';
import ProfileScreen from '../screens/Profile/ProfileScreen';
import { Text, View } from 'react-native';
import MenuIcon from '../assets/menu.svg';
import ChatIcon from '../assets/chat.svg';
import WislifeIcon from '../assets/wislife.svg';
import NotificationIcon from '../assets/notification.svg';
import ProfileIcon from '../assets/profile.svg';

const Tab = createBottomTabNavigator();

const tabBarLabel = (label: string, focused: boolean) => (
    <Text className={focused ? 'text-sm font-medium text-[#0A2240] mt-1' : 'text-sm font-medium text-gray-400 mt-1'}>{label}</Text>
);

const HIDDEN_ROUTES = ['ChatDetail'];

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
            initialRouteName={initialRouteName}
        >
            <Tab.Screen
                name={ROUTES.MAIN.HOME}
                component={HomeScreen}
                options={{
                    tabBarIcon: ({ focused }) => (
                        <View className="items-center">
                            <MenuIcon width={28} height={28} />
                        </View>
                    ),
                    tabBarLabel: ({ focused }) => tabBarLabel('Ứng dụng', focused),
                }}
            /> 
            <Tab.Screen
                name={ROUTES.MAIN.CHAT}
                component={ChatScreen}
                options={({ route }) => ({
                    tabBarIcon: ({ focused }) => (
                        <View className="items-center">
                            <ChatIcon width={28} height={28} />
                        </View>
                    ),
                    tabBarLabel: ({ focused }) => tabBarLabel('Tin nhắn', focused),
                })}
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
                    tabBarLabel: ({ focused }) => tabBarLabel('Wislife', focused),
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
                    tabBarLabel: ({ focused }) => tabBarLabel('Hồ sơ', focused),
                }}
            />
        </Tab.Navigator>
    );
};

export default BottomTabNavigator; 
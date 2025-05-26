import React, { useState, useEffect } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import BottomTabNavigator from './BottomTabNavigator';
import WelcomeScreen from '../screens/Login/WelcomeScreen';
import LoginScreen from '../screens/Login/SignInScreen';
import { ROUTES } from '../constants/routes';
import ChatDetailScreen from '../screens/Chat/ChatDetailScreen';
import TicketGuestScreen from '../screens/Ticket/TicketGuestScreen';
import TicketAdminScreen from '../screens/Ticket/TicketAdminScreen';
import TicketCreate from '../screens/Ticket/TicketCreate';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ChatInitScreen from '../screens/Chat/ChatInitScreen';
import TicketAdminDetail from '../screens/Ticket/TicketAdminDetail';
import TicketGuestDetail from '../screens/Ticket/TicketGuestDetail';
import DevicesScreen from '../screens/Devices/DevicesScreen';
import DevicesDetailScreen from '../screens/Devices/DevicesDetailScreen';
import DeviceAssignmentHistoryScreen from '../screens/Devices/DeviceAssignmentHistoryScreen';
import { useAuth } from '../context/AuthContext';

const Stack = createNativeStackNavigator<RootStackParamList>();

export type User = {
    _id: string;
    email: string;
    fullname: string;
    avatar?: string;
    role?: string;
    lastSeen?: number;
    isOnline?: boolean;
};

export type RootStackParamList = {
    [ROUTES.SCREENS.WELCOME]: undefined;
    [ROUTES.SCREENS.LOGIN]: undefined;
    [ROUTES.SCREENS.MAIN]: {
        screen?: string;
        params?: {
            forwardMode?: boolean;
            ticketId?: string;
        }
    };
    [ROUTES.SCREENS.CHAT_DETAIL]: { user: User; chatId?: string };
    [ROUTES.SCREENS.CHAT_INIT]: { chatId: string; senderId: string };
    [ROUTES.SCREENS.TICKET_DETAIL]: { ticketId: string };
    [ROUTES.SCREENS.TICKET_CREATE]: undefined;
    [ROUTES.SCREENS.TICKET_ADMIN_DETAIL]: { ticketId: string };
    [ROUTES.SCREENS.TICKET_GUEST_DETAIL]: { ticketId: string };
    [ROUTES.SCREENS.TICKET]: undefined;
    [ROUTES.SCREENS.TICKET_ADMIN]: undefined;
    [ROUTES.SCREENS.TICKET_GUEST]: undefined;
    [ROUTES.SCREENS.DEVICES]: undefined;
    [ROUTES.SCREENS.DEVICE_DETAIL]: { deviceId: string; deviceType: 'laptop' | 'monitor' | 'printer' | 'projector' | 'tool' };
    [ROUTES.SCREENS.DEVICE_ASSIGNMENT_HISTORY]: { deviceId: string; deviceType: 'laptop' | 'monitor' | 'printer' | 'projector' | 'tool'; deviceName: string };
};

const MainTabWrapper = ({ route }: { route: any }) => <BottomTabNavigator route={route} />;

const AppNavigator = () => {
    const [ticketComponent, setTicketComponent] = useState(() => TicketGuestScreen);
    const { isAuthenticated, loading } = useAuth();

    useEffect(() => {
        const checkUserRole = async () => {
            try {
                // Kiểm tra trực tiếp từ AsyncStorage
                const storedRole = await AsyncStorage.getItem('userRole');
                console.log('AppNavigator - UserRole from AsyncStorage:', storedRole);
                
                const userData = await AsyncStorage.getItem('user');
                if (userData) {
                    const user = JSON.parse(userData);
                    const role = (user.role || '').toLowerCase().trim();
                    console.log('AppNavigator - Current user role from user object:', role);
                    
                    // Kiểm tra cụ thể cho user
                    if (role === 'user' || storedRole === 'user') {
                        console.log('Người dùng có vai trò USER -> setTicketComponent to TicketGuestScreen');
                        setTicketComponent(() => TicketGuestScreen);
                        return;
                    }

                    // Phân quyền: superadmin, admin, technical -> TicketAdminScreen
                    if (['superadmin', 'admin', 'technical'].includes(role)) {
                        console.log('Người dùng có vai trò', role, '-> điều hướng đến TicketAdminScreen');
                        setTicketComponent(() => TicketAdminScreen);
                    } else {
                        console.log('Người dùng có vai trò không xác định:', role, '-> điều hướng đến TicketGuestScreen');
                        setTicketComponent(() => TicketGuestScreen);
                    }
                } else {
                    console.log('Không tìm thấy thông tin người dùng, mặc định điều hướng đến TicketGuestScreen');
                    setTicketComponent(() => TicketGuestScreen);
                }
            } catch (error) {
                console.error('Lỗi khi kiểm tra role:', error);
                setTicketComponent(() => TicketGuestScreen);
            }
        };

        if (isAuthenticated) {
            checkUserRole();
        }
    }, [isAuthenticated]);

    if (loading) {
        // Có thể thêm màn hình loading ở đây
        return null;
    }

    return (
            <Stack.Navigator
                screenOptions={{
                    headerShown: false,
                    animation: 'slide_from_right',
                }}
            >
                {!isAuthenticated ? (
                    // Auth Stack
                    <>
                        <Stack.Screen
                            name={ROUTES.SCREENS.WELCOME}
                            component={WelcomeScreen}
                        />
                        <Stack.Screen
                            name={ROUTES.SCREENS.LOGIN}
                            component={LoginScreen}
                        />
                    </>
                ) : (
                    // App Stack
                    <>
                        <Stack.Screen
                            name={ROUTES.SCREENS.MAIN}
                            component={MainTabWrapper}
                            initialParams={{ screen: 'Home' }}
                        />
                        <Stack.Screen
                            name={ROUTES.SCREENS.TICKET}
                            component={ticketComponent}
                            options={{ headerShown: false }}
                        />
                        <Stack.Screen
                            name={ROUTES.SCREENS.CHAT_DETAIL}
                            component={ChatDetailScreen}
                            options={{ headerShown: false }}
                        />
                        <Stack.Screen
                            name={ROUTES.SCREENS.CHAT_INIT}
                            component={ChatInitScreen}
                            options={{ headerShown: false }}
                        />
                        <Stack.Screen
                            name={ROUTES.SCREENS.TICKET_CREATE}
                            component={TicketCreate}
                            options={{ headerShown: false }}
                        />
                        <Stack.Screen
                            name={ROUTES.SCREENS.TICKET_ADMIN_DETAIL}
                            component={TicketAdminDetail}
                            options={{ headerShown: false }}
                        />
                        <Stack.Screen
                            name={ROUTES.SCREENS.TICKET_GUEST_DETAIL}
                            component={TicketGuestDetail}
                            options={{ headerShown: false }}
                        />
                        <Stack.Screen
                            name={ROUTES.SCREENS.TICKET_ADMIN}
                            component={TicketAdminScreen}
                            options={{ headerShown: false }}
                        />
                        <Stack.Screen
                            name={ROUTES.SCREENS.TICKET_GUEST}
                            component={TicketGuestScreen}
                            options={{ headerShown: false }}
                        />
                        <Stack.Screen
                            name={ROUTES.SCREENS.DEVICES}
                            component={DevicesScreen}
                            options={{ headerShown: false }}
                        />
                        <Stack.Screen
                            name={ROUTES.SCREENS.DEVICE_DETAIL}
                            component={DevicesDetailScreen}
                            options={{ headerShown: false }}
                        />
                        <Stack.Screen
                            name={ROUTES.SCREENS.DEVICE_ASSIGNMENT_HISTORY}
                            component={DeviceAssignmentHistoryScreen}
                            options={{ headerShown: false }}
                        />
                    </>
                )}
            </Stack.Navigator>
    );
};

export default AppNavigator;

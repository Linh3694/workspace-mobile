import React, { useEffect } from 'react';
import { View, ActivityIndicator, Text } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../../config/constants';
import { ROUTES } from '../../constants/routes';

type Props = NativeStackScreenProps<RootStackParamList, 'ChatInit'>;

const ChatInitScreen = ({ route, navigation }: Props) => {
    const { chatId, senderId } = route.params;

    useEffect(() => {
        const fetchUserAndNavigate = async () => {
            try {
                // Hiển thị loading
                const token = await AsyncStorage.getItem('authToken');
                if (!token) {
                    // Nếu chưa đăng nhập, chuyển về màn hình đăng nhập
                    navigation.reset({
                        index: 0,
                        routes: [{ name: ROUTES.AUTH.LOGIN }],
                    });
                    return;
                }

                // Gọi API lấy thông tin người dùng
                const response = await fetch(`${API_BASE_URL}/api/users/${senderId}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (response.ok) {
                    const userData = await response.json();
                    // Chuyển đến màn hình chat với thông tin người dùng và chat
                    navigation.replace('ChatDetail', {
                        chatId,
                        user: userData
                    });
                } else {
                    // Nếu không lấy được thông tin người dùng, quay về màn hình chính
                    navigation.replace('Main', {});
                }
            } catch (error) {
                console.error('Lỗi khi lấy thông tin người dùng:', error);
                // Nếu có lỗi, quay về màn hình chính
                navigation.replace('Main', {});
            }
        };

        fetchUserAndNavigate();
    }, [chatId, senderId, navigation]);

    return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
            <ActivityIndicator size="large" color="#009483" />
            <Text style={{ marginTop: 16, color: '#666', fontFamily: 'Inter', fontWeight: 'medium' }}>Đang tải cuộc trò chuyện...</Text>
        </View>
    );
};

export default ChatInitScreen; 
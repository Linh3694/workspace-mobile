import React, { useLayoutEffect, useRef } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    Animated,
    Easing,
    Dimensions,
    Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMicrosoftLogin } from '../../hooks/useMicrosoftLogin';
import MicrosoftIcon from '../../assets/microsoft.svg';
import { ROUTES } from '../../constants/routes';
import { API_BASE_URL } from '../../config/constants';
import ApplogoFull from '../../assets/app-logo-full.svg';

type RootStackParamList = {
    Welcome: undefined;
    Login: undefined;
    SignIn: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const WelcomeScreen = () => {
    const navigation = useNavigation<NavigationProp>();
    const { width: screenWidth } = Dimensions.get('window');
    const BANNER_WIDTH = 1100;
    const BANNER_HEIGHT = 480;

    const translateX = useRef(new Animated.Value(0)).current;

    useLayoutEffect(() => {
        let isMounted = true;
        const animate = () => {
            if (!isMounted) return;
            translateX.setValue(0);
            Animated.timing(translateX, {
                toValue: -BANNER_WIDTH,
                duration: 18000,
                easing: Easing.linear,
                useNativeDriver: true,
            }).start(() => {
                if (isMounted) animate();
            });
        };
        animate();
        return () => { isMounted = false; };
    }, [translateX]);

    // Sử dụng hook đăng nhập Microsoft
    const { request, promptAsync } = useMicrosoftLogin((token) => {
        // Lưu token, chuyển màn hình, v.v.
    });

    return (
        <View className="flex-1 bg-white">
            <View className="flex-1 w-full items-center justify-center mt-[5%]">
                <View>
                    <Text className="text-xl text-primary text-center mb-3" style={{ fontFamily: 'Mulish-ExtraBold' }}>
                            Chào mừng Thầy Cô đến với
                        </Text>
                    <ApplogoFull width={390} height={40} />
                    <Text className="text-xl text-primary text-center mt-6" style={{ fontFamily: 'Mulish-SemiBold' }}>
                        Không cần mò mẫm, làm việc sáng suốt
                    </Text>
                    </View>
                    {/* Banner động */}
                    <View
                        style={{
                            width: screenWidth,
                            height: BANNER_HEIGHT,
                            overflow: 'hidden',
                            alignItems: 'center',
                            justifyContent: 'center',
                            alignSelf: 'center',
                        }}
                    className="my-[5%]"
                    >
                        <Animated.View
                            style={{
                                flexDirection: 'row',
                                width: BANNER_WIDTH * 3,
                                height: BANNER_HEIGHT,
                                transform: [{ translateX }],
                            }}
                        >
                            <Animated.Image
                                source={require('../../assets/welcome.png')}
                                resizeMode="cover"
                                style={{ width: BANNER_WIDTH, height: BANNER_HEIGHT }}
                            />
                            <Animated.Image
                                source={require('../../assets/welcome.png')}
                                resizeMode="cover"
                                style={{ width: BANNER_WIDTH, height: BANNER_HEIGHT }}
                            />
                            <Animated.Image
                                source={require('../../assets/welcome.png')}
                                resizeMode="cover"
                                style={{ width: BANNER_WIDTH, height: BANNER_HEIGHT }}
                            />
                        </Animated.View>
                    </View>
                <View className=" w-full items-center">
                    <TouchableOpacity
                        onPress={() => promptAsync()}
                        className="w-4/5 flex-row items-center justify-center rounded-full bg-secondary/10 py-4"
                        disabled={!request}
                    >
                        <View style={{ marginRight: 8 }}>
                            <MicrosoftIcon width={24} height={24} />
                        </View>
                        <Text className="text-secondary font-bold">Đăng nhập với Microsoft</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => navigation.navigate(ROUTES.SCREENS.LOGIN)}>
                        <Text className="mt-4 text-text-secondary text-base font-semibold">Đăng nhập bằng tài khoản</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
};

export default WelcomeScreen; 
import React, { useEffect, useState } from 'react';
// @ts-ignore
import { View, Text, SafeAreaView, TouchableOpacity, ScrollView, StyleSheet, TextInput, Alert, Modal, Animated, StatusBar, Keyboard, Platform, TouchableWithoutFeedback, PanResponder } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { ROUTES } from '../../constants/routes';
import { Ionicons, MaterialIcons, FontAwesome, Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import TicketIcon from '../../assets/ticket-icon.svg';
import DevicesIcon from '../../assets/devices-icon.svg';
import DocumentIcon from '../../assets/document-icon.svg';
import LibraryIcon from '../../assets/library-icon.svg';
import PolygonIcon from '../../assets/polygon.svg';
import attendanceService from '../../services/attendanceService';
// Define type cho navigation
type HomeScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, typeof ROUTES.SCREENS.MAIN>;

const HomeScreen = () => {
    const navigation = useNavigation<HomeScreenNavigationProp>();
    const insets = useSafeAreaInsets();
    const [fullName, setFullName] = useState('');
    const [userRole, setUserRole] = useState('');
    const [checkInTime, setCheckInTime] = useState('--:--');
    const [checkOutTime, setCheckOutTime] = useState('--:--');
    const [employeeCode, setEmployeeCode] = useState('');

    useEffect(() => {
        const fetchUser = async () => {
            try {
                const userData = await AsyncStorage.getItem('user');
                
                if (userData) {
                    const user = JSON.parse(userData);
                    setFullName(user.fullname || '');
                    setUserRole(user.role || '');
                    setEmployeeCode(user.employeeCode || user.employee_code || '');
                }
            } catch (e) {
                console.error('Error fetching user data:', e);
                setFullName('');
                setUserRole('');
                setEmployeeCode('');
            }
        };
        fetchUser();
    }, []);



    // Fetch attendance data khi có employeeCode
    useEffect(() => {
        const fetchTodayAttendance = async () => {
            if (!employeeCode) {
                setCheckInTime('Chưa có');
                setCheckOutTime('Chưa có');
                return;
            }

            try {
                const attendanceData = await attendanceService.getTodayAttendance(employeeCode);
                if (attendanceData) {
                    const formattedCheckIn = attendanceService.formatTime(attendanceData.checkInTime);
                    const formattedCheckOut = attendanceService.formatTime(attendanceData.checkOutTime);

                    setCheckInTime(formattedCheckIn);
                    setCheckOutTime(formattedCheckOut);
                } else {
                    setCheckInTime('--:--');
                    setCheckOutTime('--:--');
                }
            } catch (error) {
                console.error('Lỗi khi lấy dữ liệu chấm công:', error);
                setCheckInTime('--:--');
                setCheckOutTime('--:--');
            }
        };

        fetchTodayAttendance();
    }, [employeeCode]);

    // Function để kiểm tra chi tiết tất cả các lần check-in
    const checkDetailedAttendance = async () => {
        if (!employeeCode) {
            console.log('No employeeCode available');
            return;
        }

        try {
            console.log('=== KIỂM TRA CHI TIẾT TẤT CẢ CÁC LẦN CHECK-IN ===');
            const detailedData = await attendanceService.getTodayAttendanceWithDetails(employeeCode);
            
            if (detailedData && detailedData.rawData && detailedData.rawData.length > 0) {
                console.log(`Tổng cộng có ${detailedData.rawData.length} lần check-in hôm nay:`);
                
                // Sắp xếp theo thời gian
                const sortedCheckIns = detailedData.rawData.sort((a, b) => 
                    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
                );
                
                sortedCheckIns.forEach((checkIn, index) => {
                    const time = attendanceService.formatTime(checkIn.timestamp);
                    console.log(`${index + 1}. ${time} - Thiết bị: ${checkIn.deviceId}`);
                });
                
                const firstCheckIn = attendanceService.formatTime(sortedCheckIns[0].timestamp);
                const lastCheckIn = attendanceService.formatTime(sortedCheckIns[sortedCheckIns.length - 1].timestamp);
                
                console.log(`Giờ vào sớm nhất: ${firstCheckIn}`);
                console.log(`Giờ ra muộn nhất: ${lastCheckIn}`);
                
                // Hiển thị alert với thông tin chi tiết
               
            } else {
                Alert.alert('Thông báo', 'Không có dữ liệu chi tiết check-in hôm nay');
            }
        } catch (error) {
            Alert.alert('Lỗi', 'Không thể lấy chi tiết chấm công');
        }
    };

    const navigateToTicket = async () => {
        try {
            const userData = await AsyncStorage.getItem('user');
            if (userData) {
                const user = JSON.parse(userData);
                const role = (user.role || '').toLowerCase().trim();
                
                // Phân quyền điều hướng
                if (['superadmin', 'admin', 'technical'].includes(role)) {
                    console.log('Điều hướng đến TicketAdmin vì người dùng có vai trò:', role);
                    navigation.navigate(ROUTES.SCREENS.TICKET_ADMIN);
                } else {
                    console.log('Điều hướng đến TicketGuest vì người dùng có vai trò:', role);
                    navigation.navigate(ROUTES.SCREENS.TICKET_GUEST);
                }
            } else {
                console.log('Không tìm thấy thông tin người dùng, điều hướng đến TicketGuest');
                navigation.navigate(ROUTES.SCREENS.TICKET_GUEST);
            }
        } catch (error) {
            console.error('Lỗi khi kiểm tra quyền người dùng:', error);
            // Mặc định điều hướng đến TicketGuest nếu có lỗi
            navigation.navigate(ROUTES.SCREENS.TICKET_GUEST);
        }
    };

    const navigateToDevices = () => {
        navigation.navigate(ROUTES.SCREENS.DEVICES);
    };

    const menuItems = [
        { id: 1, title: 'Tickets', component: TicketIcon, description: 'Ứng dụng Ticket', onPress: navigateToTicket },
        { id: 2, title: 'Thiết bị', component: DevicesIcon, description: 'Quản lý thiết bị', onPress: navigateToDevices },
        { id: 3, title: 'Tài liệu', component: DocumentIcon, description: 'Quản lý tài liệu', onPress: () => { } },
        { id: 4, title: 'Thư viện', component: LibraryIcon, description: 'Quản lý thư viện', onPress: () => { } },
    ];

    const [searchQuery, setSearchQuery] = useState('');
    const [searchHistory, setSearchHistory] = useState<string[]>([]);
    const [searchResults, setSearchResults] = useState(menuItems);

    // iOS-style search states
    const [isSearchFocused, setIsSearchFocused] = useState(false);
    const [showSearchModal, setShowSearchModal] = useState(false);
    const [keyboardHeight, setKeyboardHeight] = useState(0);
    const slideUpAnimation = useState(new Animated.Value(0))[0];
    const fadeAnimation = useState(new Animated.Value(0))[0];

    const handleSearch = (text: string) => {
        setSearchQuery(text);
        const results = menuItems.filter(item =>
            item.title.toLowerCase().includes(text.toLowerCase())
        );
        setSearchResults(results);
    };
    const handleSelectItem = (title: string) => {
        const item = menuItems.find(i => i.title === title);
        if (item) {
            item.onPress();
            setSearchHistory(prev => [title, ...prev.filter(t => t !== title)]);
            setSearchQuery('');
            setSearchResults(menuItems);
        }
    };

    // iOS-style search handlers
    const openIOSSearch = () => {
        setShowSearchModal(true);
        setIsSearchFocused(true);
        
        // Animate slide up and fade in
        Animated.parallel([
            Animated.timing(slideUpAnimation, {
                toValue: 1,
                duration: 300,
                useNativeDriver: true,
            }),
            Animated.timing(fadeAnimation, {
                toValue: 1,
                duration: 300,
                useNativeDriver: true,
            }),
        ]).start();
    };

    const closeIOSSearch = () => {
        // Start animation immediately without waiting for keyboard
        Animated.parallel([
            Animated.timing(slideUpAnimation, {
                toValue: 0,
                duration: 250,
                useNativeDriver: true,
            }),
            Animated.timing(fadeAnimation, {
                toValue: 0,
                duration: 250,
                useNativeDriver: true,
            }),
        ]).start(() => {
            setShowSearchModal(false);
            setIsSearchFocused(false);
            setSearchQuery('');
            setSearchResults(menuItems);
            setKeyboardHeight(0);
        });

        // Dismiss keyboard asynchronously
        Keyboard.dismiss();
    };

    const handleModalPress = () => {
        // Always close modal immediately, regardless of keyboard state
        closeIOSSearch();
    };

    // PanResponder for swipe gestures
    const panResponder = PanResponder.create({
        onMoveShouldSetPanResponder: (evt, gestureState) => {
            // Respond to horizontal swipes with at least 20px movement
            return Math.abs(gestureState.dx) > 20 && Math.abs(gestureState.dy) < 100;
        },
        onPanResponderMove: (evt, gestureState) => {
            // Optional: Add visual feedback during swipe
        },
        onPanResponderRelease: (evt, gestureState) => {
            // If swipe left with sufficient velocity or distance
            if (gestureState.dx < -100 || gestureState.vx < -0.5) {
                closeIOSSearch();
            }
        },
    });

    const handleIOSSearch = (text: string) => {
        setSearchQuery(text);
        const results = menuItems.filter(item =>
            item.title.toLowerCase().includes(text.toLowerCase()) ||
            item.description.toLowerCase().includes(text.toLowerCase())
        );
        setSearchResults(results);
    };

    const handleIOSSelectItem = (title: string) => {
        const item = menuItems.find(i => i.title === title);
        if (item) {
            setSearchHistory(prev => [title, ...prev.filter(t => t !== title)]);
            closeIOSSearch();
            // Delay navigation to allow modal to close
            setTimeout(() => {
                item.onPress();
            }, 100);
        }
    };

    // Keyboard listeners
    useEffect(() => {
        const keyboardDidShowListener = Keyboard.addListener(
            'keyboardDidShow',
            (e) => setKeyboardHeight(e.endCoordinates.height)
        );
        const keyboardDidHideListener = Keyboard.addListener(
            'keyboardDidHide',
            () => setKeyboardHeight(0)
        );

        return () => {
            keyboardDidShowListener.remove();
            keyboardDidHideListener.remove();
        };
    }, []);

    // Gradient border container
    const GradientBorderContainer = ({ children }: { children: React.ReactNode }) => {
        return (
            <View style={styles.gradientBorderContainer}>
                <LinearGradient
                    colors={['#FFCE02', '#BED232']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.gradientBorder}
                />
                <View style={styles.innerContainer}>
                    {children}
                </View>
            </View>
        );
    };

    return (
        <LinearGradient
            colors={[
                'rgba(240, 80, 35, 0.03)',   // #F05023 at 5% opacity
                'rgba(255, 206, 2, 0.06)',   // #FFCE02 at 5% opacity
                'rgba(190, 210, 50, 0.04)',  // #BED232 at 4% opacity
                'rgba(0, 148, 131, 0.07)',   // #009483 at 7% opacity
            ]}
            locations={[0, 0.22, 0.85, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ flex: 1 }}
        >
            <ScrollView keyboardShouldPersistTaps="always">
                <View className="w-full items-center mt-[20%]">
                    <Text className="text-2xl text-primary font-medium mb-2 text-center">Xin chào WISer</Text>
                    <MaskedView
                        maskElement={
                            <Text className="text-4xl font-bold text-center" style={{ backgroundColor: 'transparent' }}>{fullName}</Text>
                        }
                    >
                        <LinearGradient
                            colors={["#F05023", "#F5AA1E"]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                        >
                            <Text className="text-4xl font-bold opacity-0 text-center">{fullName}</Text>
                        </LinearGradient>
                    </MaskedView>

                    {/* Attendance Timeline */}
                    <View className="w-full px-5 mt-6">
                        {/* Time labels with detail button */}
                        <View className="flex-row justify-between items-center">
                            <Text className="text-base font-semibold text-teal-700 left-[5%]">{checkInTime}</Text>
                           
                            <Text className="text-base font-semibold text-teal-700 right-[3%]">{checkOutTime}</Text>
                        </View>
                        {/* Timeline bar with markers */}
                        <View className="relative h-1 bg-gray-200 rounded-full my-2">
                            {/* Highlighted segment */}
                            <LinearGradient
                                colors={['#F3F6DE', '#FFCE02']}
                                locations={[0, 1]}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={{
                                    position: 'absolute',
                                    left: '5%',
                                    right: '5%',
                                    height: 4,
                                    borderRadius: 2,
                                }}
                            />
                            {/* Entry arrow */}
                            <View style={{ position: 'absolute', left: '3%', top: -7, alignItems: 'center', }}>
                                <PolygonIcon width={18} height={18} />
                                <Text className="text-base text-teal-700 text-start">Giờ vào</Text>
                            </View>
                            {/* Exit arrow */}
                            <View style={{ position: 'absolute', right: '3%', top: -7, alignItems: 'center', }}>
                                <PolygonIcon width={18} height={18} />
                                <Text className="text-base text-teal-700 text-start">Giờ ra</Text>

                            </View>

                        </View>
                    </View>

                    <View className="w-full mt-[10%] px-5">
                        <GradientBorderContainer>
                            <LinearGradient
                                colors={[
                                    'rgba(255, 206, 2, 0.05)',   // #FFCE02 at 5% opacity
                                    'rgba(190, 210, 50, 0.05)',  // #BED232 at 4% opacity
                                ]}
                                start={{ x: 1, y: 0 }}
                                end={{ x: 0, y: 1 }}
                            >
                                <View className="flex-row flex-wrap justify-between p-4">
                                {menuItems.map((item) => (
                                    <TouchableOpacity
                                        key={item.id}
                                        className="w-[25%] items-center mt-2"
                                        onPress={item.onPress}
                                    >
                                        <item.component width={80} height={80} />
                                        <Text className="text-sm text-center mt-2">{item.title}</Text>

                                    </TouchableOpacity>
                                ))}

                                </View>
                            </LinearGradient>
                        </GradientBorderContainer>
                    </View>
                </View>
                <View className="w-full mt-[10%] px-5">
                    <Text className="text-xl font-medium text-primary mb-5 text-center">Bạn cần tìm kiếm gì?</Text>
                    {/* iOS-style Search Bar */}
                    <TouchableOpacity 
                        className="bg-white rounded-2xl border border-gray-300 flex-row items-center px-4 py-3 mb-3"
                        onPress={openIOSSearch}
                    >
                        <FontAwesome name="search" size={18} color="#A1A1AA" />
                        <Text className="flex-1 ml-3 text-gray-400">Hỏi Wis</Text>
                    </TouchableOpacity>
                    
                    {/* Search History */}
                    {searchHistory.length > 0 && (
                        <View className="mt-2">
                            <Text className="text-lg font-semibold text-gray-700 mb-2">Tìm kiếm gần đây</Text>
                            {searchHistory.slice(0, 3).map(title => {
                                const item = menuItems.find(i => i.title === title);
                                if (!item) return null;
                                return (
                                    <TouchableOpacity
                                        key={title}
                                        className="flex-row items-center py-2 border-b border-gray-200 ml-2 pb-4"
                                        onPress={() => handleSelectItem(title)}
                                    >
                                        <item.component width={40} height={40} />
                                        <Text className="text-gray-700 ml-2">{title}</Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    )}
                </View>

                {/* iOS-style Search Modal */}
                <Modal
                    visible={showSearchModal}
                    animationType="none"
                    transparent={false}
                    statusBarTranslucent={true}
                >
                    <LinearGradient
                        colors={[
                            'rgba(240, 80, 35, 0.03)',   // #F05023 at 5% opacity
                            'rgba(255, 206, 2, 0.06)',   // #FFCE02 at 5% opacity
                            'rgba(190, 210, 50, 0.04)',  // #BED232 at 4% opacity
                            'rgba(0, 148, 131, 0.07)',   // #009483 at 7% opacity
                        ]}
                        locations={[0, 0.22, 0.85, 1]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={{ flex: 1 }}
                    >
                        <TouchableWithoutFeedback onPress={handleModalPress}>
                            <View style={{ 
                                flex: 1, 
                                // paddingTop: Platform.OS === 'android' ? insets.top : 0 
                            }}>
                                <StatusBar barStyle="dark-content" />
                                
                                {/* Animated Container */}
                                <Animated.View 
                                    {...panResponder.panHandlers}
                                    style={{
                                        flex: 1,
                                        opacity: fadeAnimation,
                                        transform: [{
                                            translateY: slideUpAnimation.interpolate({
                                                inputRange: [0, 1],
                                                outputRange: [20, 0],
                                            }),
                                        }],
                                    }}
                                >
                                    {/* Header with close button */}
                                    <View className="px-4 py-8 flex-row justify-end items-center">
                                        {/* <TouchableOpacity 
                                            onPress={closeIOSSearch}
                                            className="px-2 py-1"
                                        >
                                            <Text className="text-blue-500 text-base font-medium">Hủy</Text>
                                        </TouchableOpacity> */}
                                    </View>

                                    {/* Search Content */}
                                    <ScrollView
                                        className="flex-1"
                                        style={{ marginBottom: keyboardHeight > 0 ? keyboardHeight + 80 : 80 }}
                                        showsVerticalScrollIndicator={false}
                                        keyboardShouldPersistTaps="always"
                                    >
                                        {searchQuery !== '' ? (
                                            /* Search Results in Suggestion Box + Recent Searches Below */
                                            <View className="px-1">
                                                {/* Results in Suggestion Box */}
                                                <View className="py-4 mx-2 rounded-xl px-4">
                                                    <Text className="text-gray-900 font-semibold text-lg mb-3">Kết quả phù hợp</Text>
                                                    <GradientBorderContainer>
                                                        <LinearGradient
                                                            colors={[
                                                                'rgba(255, 206, 2, 0.05)',   // #FFCE02 at 5% opacity
                                                                'rgba(190, 210, 50, 0.05)',  // #BED232 at 4% opacity
                                                            ]}
                                                            start={{ x: 1, y: 0 }}
                                                            end={{ x: 0, y: 1 }}
                                                        >
                                                            <View className="p-4">
                                                                {searchResults.length > 0 ? (
                                                                    <View className="flex-row flex-wrap justify-between">
                                                                        {searchResults.map(item => (
                                                                            <TouchableOpacity
                                                                                key={item.id}
                                                                                className="w-[25%] items-center mt-2"
                                                                                onPress={() => handleIOSSelectItem(item.title)}
                                                                            >
                                                                                <item.component width={80} height={80} />
                                                                                <Text className="text-sm text-center mt-2">{item.title}</Text>
                                                                            </TouchableOpacity>
                                                                        ))}
                                                                    </View>
                                                                ) : (
                                                                    <View className="items-center py-8">
                                                                        <FontAwesome name="search" size={48} color="#ccc" />
                                                                        <Text className="text-gray-500 mt-4 text-base">Không tìm thấy kết quả</Text>
                                                                        <Text className="text-gray-400 text-sm mt-1">Thử tìm kiếm với từ khóa khác</Text>
                                                                    </View>
                                                                )}
                                                            </View>
                                                        </LinearGradient>
                                                    </GradientBorderContainer>
                                                </View>

                                                {/* Recent Searches Below */}
                                                {searchHistory.length > 0 && (
                                                    <View className="py-4 mx-2 mb-4 rounded-xl px-4">
                                                        <Text className="text-gray-900 font-semibold text-lg mb-3">Tìm kiếm gần đây</Text>
                                                        {searchHistory.map(title => {
                                                            const item = menuItems.find(i => i.title === title);
                                                            if (!item) return null;
                                                            return (
                                                                <TouchableOpacity
                                                                    key={title}
                                                                    className="flex-row items-center py-3 border-b border-gray-100 last:border-b-0"
                                                                    onPress={() => handleIOSSelectItem(title)}
                                                                >
                                                                    <FontAwesome name="clock-o" size={16} color="#666" />
                                                                    <Text className="text-gray-700 ml-3 flex-1">{title}</Text>
                                                                </TouchableOpacity>
                                                            );
                                                        })}
                                                    </View>
                                                )}
                                            </View>
                                        ) : (
                                            /* Suggestions + Recent Searches */
                                            <View className="px-1">
                                                {/* Suggestions */}
                                                <View className="py-4 mx-2 rounded-xl px-4">
                                                    <Text className="text-gray-900 font-semibold text-lg mb-3">Gợi ý</Text>
                                                    <GradientBorderContainer>
                                                        <LinearGradient
                                                            colors={[
                                                                'rgba(255, 206, 2, 0.05)',   // #FFCE02 at 5% opacity
                                                                'rgba(190, 210, 50, 0.05)',  // #BED232 at 4% opacity
                                                            ]}
                                                            start={{ x: 1, y: 0 }}
                                                            end={{ x: 0, y: 1 }}
                                                        >
                                                            <View className="flex-row flex-wrap justify-between p-4">
                                                                {menuItems.map((item) => (
                                                                    <TouchableOpacity
                                                                        key={item.id}
                                                                        className="w-[25%] items-center mt-2"
                                                                        onPress={() => handleIOSSelectItem(item.title)}
                                                                    >
                                                                        <item.component width={80} height={80} />
                                                                        <Text className="text-sm text-center mt-2">{item.title}</Text>
                                                                    </TouchableOpacity>
                                                                ))}
                                                            </View>
                                                        </LinearGradient>
                                                    </GradientBorderContainer>
                                                </View>

                                                {/* Recent Searches Below */}
                                                {searchHistory.length > 0 && (
                                                    <View className="py-4 mx-2 mb-4 rounded-xl px-4">
                                                        <Text className="text-gray-900 font-semibold text-lg mb-3">Tìm kiếm gần đây</Text>
                                                        {searchHistory.map(title => {
                                                            const item = menuItems.find(i => i.title === title);
                                                            if (!item) return null;
                                                            return (
                                                                <TouchableOpacity
                                                                    key={title}
                                                                    className="flex-row items-center py-3 border-b border-gray-100 last:border-b-0"
                                                                    onPress={() => handleIOSSelectItem(title)}
                                                                >
                                                                    <FontAwesome name="clock-o" size={16} color="#666" />
                                                                    <Text className="text-gray-700 ml-3 flex-1">{title}</Text>
                                                                </TouchableOpacity>
                                                            );
                                                        })}
                                                    </View>
                                                )}
                                            </View>
                                        )}
                                    </ScrollView>

                                    {/* Search Bar at Bottom */}
                                    <View 
                                        className="px-4 py-3 bg-transparent"
                                        style={{ 
                                            position: 'absolute',
                                            bottom: keyboardHeight > 0 ? keyboardHeight : 0,
                                            left: 0,
                                            right: 0,
                                            paddingBottom: Platform.OS === 'ios' && keyboardHeight === 0 ? insets.bottom : 16,
                                            zIndex: 10,
                                        }}
                                    >
                                        <TouchableWithoutFeedback>
                                            <View className="flex-1 bg-white border border-gray-300 rounded-full flex-row items-center px-3 py-4">
                                                <FontAwesome name="search" size={16} color="#666" />
                                                <TextInput
                                                    value={searchQuery}
                                                    onChangeText={handleIOSSearch}
                                                    placeholder="Tìm kiếm"
                                                    className="flex-1 ml-3"
                                                    autoFocus={true}
                                                    returnKeyType="search"
                                                />
                                            </View>
                                        </TouchableWithoutFeedback>
                                    </View>
                                </Animated.View>
                            </View>
                        </TouchableWithoutFeedback>
                    </LinearGradient>
                </Modal>
            </ScrollView>
        </LinearGradient>
    );
};

const styles = StyleSheet.create({
    gradientBorderContainer: {
        width: '100%',
        borderRadius: 16,
        position: 'relative',
        padding: 2, // This is the border width
    },
    gradientBorder: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        borderRadius: 16,
    },
    innerContainer: {
        backgroundColor: 'white',
        borderRadius: 15, // Slightly smaller to show gradient border
        width: '100%',
        overflow: 'hidden',
    }
});

export default HomeScreen;


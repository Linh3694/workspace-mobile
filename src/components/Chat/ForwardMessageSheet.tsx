import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    FlatList,
    Image,
    ActivityIndicator,
    Modal,
    Pressable,
    Alert
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User } from '../../types/user';
import { Message } from '../../types/chat';
import { API_BASE_URL } from '../../config/constants';
import Avatar from './Avatar';
import MessageContent from './MessageContent';
import NotificationModal from '../../components/NotificationModal';

interface ForwardMessageSheetProps {
    message: Message;
    currentUser: User;
    onClose: () => void;
    onForward: (userId: string) => Promise<void>;
    visible: boolean;
}

const ForwardMessageSheet = ({ message, currentUser, onClose, onForward, visible }: ForwardMessageSheetProps) => {
    const [recentChats, setRecentChats] = useState<User[]>([]);
    const [departmentUsers, setDepartmentUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchText, setSearchText] = useState('');
    const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
    const [showNotification, setShowNotification] = useState(false);

    useEffect(() => {
        if (visible) {
            fetchUsers();
        }
    }, [visible]);

    const fetchUsers = async () => {
        try {
            const token = await AsyncStorage.getItem('authToken');
            if (!token) {
                throw new Error('No token found');
            }

            const recentResponse = await fetch(`${API_BASE_URL}/api/chats/recent-users`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            const recentData = await recentResponse.json();
            setRecentChats(recentData.users || []);
            console.log(currentUser.department)
            const deptResponse = await fetch(`${API_BASE_URL}/api/users/department/${currentUser.department}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            console.log(deptResponse)
            const deptData = await deptResponse.json();
            setDepartmentUsers(deptData.users?.filter((user: User) => user._id !== currentUser._id) || []);
            setLoading(false);
        } catch (error) {
            console.error('Error fetching users:', error);
            setLoading(false);
        }
    };

    const renderUserItem = ({ item }: { item: User }) => (
        <TouchableOpacity
            className="items-center justify-center"
            onPress={() => {
                if (!selectedUsers.find(u => u._id === item._id)) {
                    setSelectedUsers([...selectedUsers, item]);
                }
            }}
        >
            <View className="w-fit items-center">
                <Avatar user={item} size={60} statusSize={15} />
                <Text className="text-xs text-center text-gray-900">
                    {item.fullname}
                </Text>
            </View>
        </TouchableOpacity>
    );

    const renderSectionHeader = (title: string, color?: string) => (
        <View className="ml-[5%] mb-[2%] items-center justify-center py-2">
            <View className={`self-start px-3 py-1 rounded-full ${color ?? 'bg-white  border-gray-300'}`}>
                <Text className={`text-sm font-medium ${color ? 'text-[#3DB838]' : 'text-[#757575]'}`}>{title}</Text>
            </View>
        </View>
    );

    // const renderSection = (section: { title: string, data: User[] }) => (
    //     <>
    //         {section.data.length > 0 && (
    //             <View className="mb-6">
    //                 {renderSectionHeader(section.title)}
    //                 <View className="flex-row">
    //                     {section.data.map((user: User) => (
    //                         <View key={user._id}>
    //                             {renderUserItem({ item: user })}
    //                         </View>
    //                     ))}
    //                 </View>
    //             </View>
    //         )}
    //     </>
    // );

    const filteredRecentChats = recentChats.filter(user =>
        user.fullname.toLowerCase().includes(searchText.toLowerCase())
    );

    const filteredDepartmentUsers = departmentUsers.filter(user =>
        user.fullname.toLowerCase().includes(searchText.toLowerCase())
    );

    const handleForwardMessages = async () => {
        try {
            if (selectedUsers.length === 0) {
                Alert.alert('Thông báo', 'Vui lòng chọn người nhận tin nhắn');
                return;
            }

            setLoading(true);

            await Promise.all(
                selectedUsers.map(user => onForward(user._id))
            );

            setSelectedUsers([]);
            setLoading(false);
            onClose();
            
            // Hiển thị thông báo sau khi đóng sheet
            setTimeout(() => {
                setShowNotification(true);
            }, 300);

        } catch (error) {
            setLoading(false);
            console.error('Lỗi khi chuyển tiếp tin nhắn:', error);
            Alert.alert('Lỗi', 'Không thể chuyển tiếp tin nhắn. Vui lòng thử lại.');
        }
    };

    return (
        <>
            <NotificationModal
                visible={showNotification}
                type="success"
                message="Đã chuyển tiếp tin nhắn"
                onClose={() => setShowNotification(false)}
            />
            <Modal
                visible={visible}
                animationType="slide"
                transparent={true}
                onRequestClose={onClose}
                statusBarTranslucent
                hardwareAccelerated
            >
                <Pressable 
                    className="flex-1 bg-black/50 justify-end" 
                    onPress={onClose}
                    style={{ opacity: visible ? 1 : 0 }}
                >
                    <Pressable
                        className="h-[90%] bg-[#F5F5ED] rounded-t-3xl overflow-hidden"
                        onPress={e => e.stopPropagation()}
                        style={{
                            transform: [{ translateY: visible ? 0 : 1000 }],
                        }}
                    >
                        <View className="items-center py-2">
                            <View className="w-24 h-1.5 rounded-full bg-gray-300" />
                        </View>
                        <View className="flex-1">
                            {/* Search bar */}
                            <View className="flex-row items-center m-4 px-4 py-2.5 bg-gray-100 border border-gray-300 rounded-full">
                                <MaterialIcons name="search" size={20} color="#666" />
                                <TextInput
                                    className="flex-1 ml-2 text-base"
                                    placeholder="Tìm kiếm"
                                    value={searchText}
                                    onChangeText={setSearchText}
                                />
                            </View>

                            {selectedUsers.length > 0 && (
                                <View className="mb-4">
                                    {renderSectionHeader('Đã chọn', 'bg-[#E6F6EE]')}
                                    <View className="flex-row flex-wrap px-[4%]">
                                        {selectedUsers.map((user, idx) => (
                                            <View
                                                key={user._id + '-' + idx}
                                                className="w-[33%] items-center mb-4"
                                            >
                                                <TouchableOpacity
                                                    className="items-center"
                                                    onPress={() => setSelectedUsers(selectedUsers.filter(u => u._id !== user._id))}
                                                >
                                                    <View>
                                                        <Avatar user={user} size={60} statusSize={15} />
                                                        <View className="absolute bottom-0 right-0 bg-green-500 w-6 h-6 rounded-full items-center justify-center">
                                                            <MaterialIcons name="check" size={16} color="white" />
                                                        </View>
                                                    </View>
                                                    <Text className="text-xs text-center mt-1">{user.fullname}</Text>
                                                </TouchableOpacity>
                                            </View>
                                        ))}
                                    </View>
                                </View>
                            )}

                            <FlatList
                                ListHeaderComponent={
                                    <>
                                        {/* Gần đây */}
                                        {filteredRecentChats.length > 0 && (
                                            <View className="mb-4">
                                                {renderSectionHeader('Gần đây')}
                                                <View className="flex-row flex-wrap px-[4%]">
                                                    {filteredRecentChats.map(user => (
                                                        <View
                                                            key={user._id}
                                                            className="w-[33%] items-center mb-4"
                                                        >
                                                            {renderUserItem({ item: user })}
                                                        </View>
                                                    ))}
                                                </View>
                                            </View>
                                        )}

                                        {/* Phòng ban */}
                                        {filteredDepartmentUsers.length > 0 && (
                                            <View className="mb-4">
                                                {renderSectionHeader('Phòng Công Nghệ Thông Tin')}
                                                <View className="flex-row flex-wrap px-[4%]">
                                                    {filteredDepartmentUsers.map(user => (
                                                        <View
                                                            key={user._id}
                                                            className="w-[33%] items-center mb-4"
                                                        >
                                                            {renderUserItem({ item: user })}
                                                        </View>
                                                    ))}
                                                </View>
                                            </View>
                                        )}
                                    </>
                                }
                                data={[]}
                                renderItem={null}
                            />

                            {/* Nội dung tin nhắn + nút gửi */}
                        </View>
                        <View className="flex-row items-center px-4 py-3 mb-[10%] border-t border-gray-200 ">
                            <View className="flex-1 bg-gray-100 rounded-lg px-3 py-2 mr-3">
                                <MessageContent message={message} isPreview={true} />
                            </View>
                            <TouchableOpacity
                                onPress={handleForwardMessages}
                                disabled={loading || selectedUsers.length === 0}
                            >
                                {loading ? (
                                    <ActivityIndicator color="#FF5733" />
                                ) : (
                                    <MaterialIcons
                                        name="send"
                                        size={28}
                                        color={selectedUsers.length === 0 ? "#ccc" : "#FF5733"}
                                    />
                                )}
                            </TouchableOpacity>
                        </View>
                    </Pressable>
                </Pressable>
            </Modal>
        </>
    );
};

export default ForwardMessageSheet; 
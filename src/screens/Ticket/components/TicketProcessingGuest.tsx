import React, { useState, useEffect } from 'react';
import { View, Text, ActivityIndicator, ScrollView, Image, TouchableOpacity, TextInput } from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../../../config/constants';
import { AntDesign, FontAwesome } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { getAvatar } from '../../../utils/avatar';

interface TicketProcessingGuestProps {
    ticketId: string;
}

interface SubTask {
    _id: string;
    status: string;
    title: string;
    assignedTo?: {
        _id: string;
        fullname: string;
        avatarUrl?: string;
    };
}

interface Feedback {
    rating: number;
    comment?: string;
    badges?: string[];
}

interface Ticket {
    _id: string;
    status: string;
    subTasks: SubTask[];
    assignedTo?: {
        _id: string;
        fullname: string;
        avatarUrl?: string;
        jobTitle?: string;
        rating?: number;
    };
    cancellationReason?: string;
    feedback?: Feedback;
}

const getStatusLabel = (status: string) => {
    switch (status) {
        case 'Assigned':
        case 'assigned':
            return 'Đã nhận';
        case 'Processing':
        case 'processing':
        case 'In Progress':
            return 'Đang xử lý';
        case 'Waiting for Customer':
        case 'waiting for customer':
            return 'Chờ phản hồi';
        case 'Done':
        case 'done':
        case 'Completed':
        case 'completed':
            return 'Hoàn thành';
        case 'Closed':
        case 'closed':
            return 'Đã đóng';
        case 'Cancelled':
        case 'cancelled':
            return 'Đã huỷ';
        default:
            return status;
    }
};

const getStatusColor = (status: string) => {
    switch (status) {
        case 'Assigned':
        case 'assigned':
            return 'bg-[#002855]';
        case 'Processing':
        case 'processing':
        case 'In Progress':
            return 'bg-[#F59E0B]';
        case 'Waiting for Customer':
        case 'waiting for customer':
            return 'bg-orange-500';
        case 'Done':
        case 'done':
        case 'Completed':
        case 'completed':
            return 'bg-[#BED232]';
        case 'Closed':
        case 'closed':
            return 'bg-[#009483]';
        case 'Cancelled':
        case 'cancelled':
            return 'bg-[#F05023]';
        default:
            return 'bg-gray-500';
    }
};

// Mapping ticket status to text colors for non-editable pill
const getStatusTextColor = (status: string) => {
    switch (status.toLowerCase()) {
        case 'assigned':
            return '#002855';
        case 'processing':
        case 'in progress':
            return '#F59E0B';
        case 'waiting for customer':
            return '#F97316';
        case 'done':
        case 'completed':
            return '#4CAF50';
        case 'closed':
            return '#9E9E9E';
        case 'cancelled':
            return '#F05023';
        default:
            return '#222222';
    }
};

const TicketProcessingGuest: React.FC<TicketProcessingGuestProps> = ({ ticketId }) => {
    const [loading, setLoading] = useState(true);
    const [ticket, setTicket] = useState<Ticket | null>(null);
    const [subTasks, setSubTasks] = useState<SubTask[]>([]);
    const [selectedOption, setSelectedOption] = useState<string | null>(null);
    const [rating, setRating] = useState(0);
    const [review, setReview] = useState('');
    const [selectedBadges, setSelectedBadges] = useState<string[]>([]);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        fetchTicketDetails();
    }, [ticketId]);

    const fetchTicketDetails = async () => {
        try {
            setLoading(true);
            const token = await AsyncStorage.getItem('authToken');
            const res = await axios.get(`${API_BASE_URL}/api/tickets/${ticketId}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data: Ticket = res.data.success && res.data.ticket ? res.data.ticket : res.data;
            setTicket(data);
            setSubTasks(data.subTasks || []);
        } catch (err) {
            console.error('Lỗi khi lấy ticket:', err);
        } finally {
            setLoading(false);
        }
    };

    // Thêm hàm xác nhận đánh giá
    const handleSubmitFeedback = async () => {
        if (rating === 0) {
            Toast.show({
                type: 'error',
                text1: 'Vui lòng chọn số sao',
            });
            return;
        }
        
        try {
            setSubmitting(true);
            const token = await AsyncStorage.getItem('authToken');
            const response = await axios.post(
                `${API_BASE_URL}/api/tickets/${ticketId}/feedback`,
                {
                    rating,
                    comment: review,
                    badges: selectedBadges
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            
            if (response.data.success) {
                Toast.show({
                    type: 'success',
                    text1: 'Đánh giá đã được gửi thành công',
                });
                
                // Thêm đoạn này: Cập nhật trạng thái ticket thành "Closed"
                try {
                    const updateResponse = await axios.put(
                        `${API_BASE_URL}/api/tickets/${ticketId}`,
                        { 
                            status: "Closed",
                            notifyAction: "feedback_added" // Thêm tham số để xác định loại notification
                        },
                        { headers: { Authorization: `Bearer ${token}` } }
                    );
                } catch (updateError) {
                    console.error('Lỗi khi cập nhật trạng thái ticket:', updateError);
                }
                
                fetchTicketDetails(); // Refresh ticket
            }
        } catch (error) {
            console.error('Lỗi khi gửi đánh giá', error);
            Toast.show({
                type: 'error',
                text1: 'Không thể gửi đánh giá',
            });
        } finally {
            setSubmitting(false);
        }
    };
    
    // Thêm hàm mở lại ticket
    const handleReopenTicket = async () => {
        try {
            setSubmitting(true);
            const token = await AsyncStorage.getItem('authToken');
            const response = await axios.put(
                `${API_BASE_URL}/api/tickets/${ticketId}`,
                { 
                    status: 'Processing',
                    notifyAction: 'reopen_ticket' // Thêm action để xác định loại thông báo
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            
            if (response.data.success) {
                Toast.show({
                    type: 'success',
                    text1: 'Ticket đã được mở lại',
                });
                fetchTicketDetails(); // Làm mới dữ liệu ticket
            }
        } catch (error) {
            console.error('Lỗi khi mở lại ticket', error);
            Toast.show({
                type: 'error',
                text1: 'Không thể mở lại ticket',
            });
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <View className="flex-1 justify-center items-center">
                <ActivityIndicator size="large" color="#F05023" />
            </View>
        );
    }

    // Hiển thị khi không có ticket
    if (!ticket) {
        return (
            <ScrollView className="flex-1 p-4">
                <Text className="text-gray-500 text-center">Không thể tải thông tin ticket</Text>
            </ScrollView>
        );
    }

    // Determine text color for status pill
    const statusTextColor = getStatusTextColor(ticket?.status || '');

    // Hiển thị UI dựa vào trạng thái ticket
    return (
        <ScrollView className="flex-1 p-4">
            {/* Header - Trạng thái */}
            <View className="bg-gray-50 p-4 rounded-2xl my-4">
                <Text className="text-lg font-semibold text-gray-700 mb-2">Trạng thái</Text>
                <View className="bg-white py-2 px-4 rounded-full">
                    <Text style={{
                        fontFamily: 'Mulish-Bold',
                        fontSize: 16,
                        color: statusTextColor,
                    }}>
                        {getStatusLabel(ticket.status)}
                    </Text>
                </View>
            </View>

            {/* Nội dung dựa vào trạng thái */}
            {ticket.status.toLowerCase() === 'assigned' && (
                <View className="bg-gray-50 p-4 rounded-xl">
                    <Text className="text-base font-bold mb-3 text-gray-700">Kỹ thuật viên</Text>
                    {ticket.assignedTo ? (
                        <View className="flex-row">
                            <View className="w-20 h-20 rounded-full mr-5 overflow-hidden bg-gray-200">
                                <Image 
                                    source={{ uri: getAvatar(ticket.assignedTo) }}
                                    className="w-full h-full"
                                    resizeMode="cover"
                                />
                            </View>
                            <View className="flex-1">
                                <Text className="font-bold text-base">{ticket.assignedTo.fullname}</Text>
                                <Text className="text-gray-500 text-sm">
                                    {ticket.assignedTo.jobTitle === 'technical' ? 'Kỹ thuật viên' : ticket.assignedTo.jobTitle || ''}
                                </Text>
                                
                                {/* Numeric rating */}
                                <View className="flex-row items-center mt-1">
                                    <Text style={{ fontSize: 16, color: '#374151', marginRight: 4 }}>
                                        {ticket.assignedTo.rating?.toFixed(1) || '0.0'}
                                    </Text>
                                    <AntDesign name="star" size={16} color="#FFD700" />
                                </View>
                            </View>
                        </View>
                    ) : (
                        <Text className="text-gray-500">Chưa có kỹ thuật viên được phân công</Text>
                    )}
                </View>
            )}

            {ticket.status.toLowerCase() === 'assigned' && (
                /* Công việc cần làm */
                <View className="bg-gray-50 p-4 rounded-xl mt-4">
                    <Text className="text-lg font-bold mb-2 text-gray-700">Công việc cần làm</Text>
                    <Text className="text-gray-400">Các bước thực hiện sẽ được hiển thị tại đây</Text>
                </View>
            )}

            {ticket.status.toLowerCase() === 'processing' && (
                <View className=" rounded-xl">
                    {/* Kỹ thuật viên */}
                    <View className="bg-[#f8f8f8] p-4 rounded-xl mb-4">
                        <Text className="text-base font-bold mb-3 text-gray-700">Kỹ thuật viên</Text>
                        {ticket.assignedTo ? (
                            <View className="flex-row">
                                <View className="w-20 h-20 rounded-full mr-5 overflow-hidden bg-gray-200">
                                    <Image
                                        source={{ uri: getAvatar(ticket.assignedTo) }}
                                        className="w-full h-full"
                                        resizeMode="cover"
                                    />
                                </View>
                                <View className="flex-1">
                                    <Text className="font-bold text-base">{ticket.assignedTo.fullname}</Text>
                                    <Text className="text-gray-500 text-sm">
                                        {ticket.assignedTo.jobTitle === 'technical'
                                            ? 'Kỹ thuật viên'
                                            : ticket.assignedTo.jobTitle || ''}
                                    </Text>
                                    <View className="flex-row items-center mt-1">
                                        <Text style={{ fontSize: 16, color: '#374151', marginRight: 4 }}>
                                            {ticket.assignedTo.rating?.toFixed(1) || '0.0'}
                                        </Text>
                                        <FontAwesome name="star" size={16} color="#FFD700" />
                                    </View>
                                </View>
                            </View>
                        ) : (
                            <Text className="text-gray-500">Chưa có kỹ thuật viên được phân công</Text>
                        )}
                    </View>
                    {/* Header với nút + */}
                    {subTasks && subTasks.length > 0 ? (
                        <View className="bg-[#f8f8f8] p-4 rounded-xl mb-4">
                            <Text className="text-base font-bold mb-3 text-gray-700">
                                Ticket đang được xử lý. Vui lòng chờ kĩ thuật viên hoàn thành các hạng mục sau
                            </Text>
                            {subTasks.map((task, index) => {
                                const isCompleted = task.status === 'Completed';
                                const isCancelled = task.status === 'Cancelled';
                                
                                // Cập nhật màu sắc theo TicketProcessing
                                let bgColor = '#fff';
                                let textColor = '#222';
                                let textDecorationLine = 'none';
                                
                                if (isCompleted) {
                                    bgColor = '#E4EFE6';
                                    textColor = '#009483';
                                } else if (isCancelled) {
                                    bgColor = '#EBEBEB';
                                    textColor = '#757575';
                                    textDecorationLine = 'line-through';
                                } else {
                                    // Kiểm tra nếu là task đầu tiên In Progress
                                    const isFirstInProgress = subTasks.filter(
                                        t => t.status === 'In Progress'
                                    )[0]?._id === task._id;
                                    
                                    if (isFirstInProgress) {
                                        bgColor = '#E6EEF6';
                                        textColor = '#002855';
                                    } else {
                                        bgColor = '#EBEBEB';
                                        textColor = '#757575';
                                    }
                                }
                                
                                return (
                                    <View 
                                        key={task._id} 
                                        className="flex-row justify-between items-center p-3 rounded-lg mb-2"
                                        style={{ backgroundColor: bgColor }}
                                    >
                                        <Text style={{ color: textColor, fontWeight: '500', textDecorationLine: textDecorationLine as any }}>
                                            {index + 1}. {task.title}
                                        </Text>
                                        <Text style={{ color: textColor, fontWeight: '500' }}>
                                            {isCompleted ? 'Hoàn thành' : isCancelled ? 'Huỷ' : 'Đang làm'}
                                        </Text>
                                    </View>
                                );
                            })}
                        </View>
                    ) : (
                        <Text className="text-base text-gray-700">
                            Ticket đang được xử lý, vui lòng chờ.
                        </Text>
                    )}
                </View>
            )}


            {ticket.status.toLowerCase() === 'done' && (
                <View className="rounded-2xl">
                    <View className="bg-[#f8f8f8] p-4 rounded-xl mb-4">
                        <Text className="text-base font-bold mb-3 text-gray-700">
                            Phản hồi
                        </Text>
                        <Text className="text-base font-bold mb-3 text-gray-700">
                            Yêu cầu đã được xử lý xong. Vui lòng nhận kết quả và kiểm tra chất lượng phục vụ
                        </Text>
                        <TouchableOpacity 
                            onPress={() => setSelectedOption('accept')}
                            className={`flex-row items-center p-3 rounded-lg ${selectedOption === 'accept' ? '' : ''}`}
                        >
                            <View className={`w-6 h-6 rounded-full border-2 mr-2 items-center justify-center ${selectedOption === 'accept' ? 'border-[#002855]' : 'border-gray-400'}`}>
                                {selectedOption === 'accept' && (
                                    <View className="w-3 h-3 rounded-full bg-[#002855]" />
                                )}
                            </View>
                            <Text className={`text-base font-medium ${selectedOption === 'accept' ? 'text-primary' : 'text-gray-700'}`}>
                                Chấp nhận kết quả
                            </Text>
                        </TouchableOpacity>
                        
                        <TouchableOpacity 
                            onPress={() => setSelectedOption('reject')}
                            className={`flex-row items-center p-3 rounded-lg  ${selectedOption === 'reject' ? '' : ''}`}
                        >
                            <View className={`w-6 h-6 rounded-full border-2 mr-2 items-center justify-center ${selectedOption === 'reject' ? 'border-[#002855]' : 'border-gray-400'}`}>
                                {selectedOption === 'reject' && (
                                    <View className="w-3 h-3 rounded-full bg-[#002855]" />
                                )}
                            </View>
                            <Text className={`text-base font-medium ${selectedOption === 'reject' ? 'text-primary' : 'text-gray-700'}`}>
                                Chưa đạt yêu cầu, cần xử lý lại
                            </Text>
                        </TouchableOpacity>
                    </View>
                    
                    {selectedOption === 'accept' && (
                        <View>
                            <View className="bg-[#f8f8f8] p-4 rounded-2xl mt-4">
                                {/* Đánh giá */}
                                <Text className="text-base font-semibold text-gray-700 mb-3">Đánh giá</Text>

                                {/* Stars */}
                            <View className="flex-row justify-center mb-3">
                                    {[1, 2, 3, 4, 5].map(i => (
                                        <TouchableOpacity key={i} onPress={() => setRating(i)}>
                                            <AntDesign
                                                name={i <= rating ? 'star' : 'staro'}
                                                size={30}
                                            color="#FFD700"
                                            style={{ marginHorizontal: 5 }}
                                        />
                                    </TouchableOpacity>
                                ))}
                            </View>

                                {/* Badges */}
                                <View className="flex-row flex-wrap justify-center mb-3">
                                    {['Nhiệt Huyết', 'Chu Đáo', 'Vui Vẻ', 'Tận Tình', 'Chuyên Nghiệp'].map(badge => {
                                        const isSelected = selectedBadges.includes(badge);
                                        return (
                                            <TouchableOpacity
                                                key={badge}
                                                onPress={() => {
                                                    if (isSelected) {
                                                        setSelectedBadges(selectedBadges.filter(b => b !== badge));
                                                    } else {
                                                        setSelectedBadges([...selectedBadges, badge]);
                                                    }
                                                }}
                                                className={`m-1 px-4 py-1 rounded-full ${isSelected ? 'bg-[#FFEBCC]' : 'bg-gray-200'
                                                    }`}
                                            >
                                                <Text className={`text-sm ${isSelected ? 'text-[#FFAA00]' : 'text-gray-600'
                                                    }`}>
                                                    {badge}
                                                </Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                            </View>

                                {/* Comment */}
                                <TextInput
                                    placeholder="Nhận xét của bạn (không bắt buộc)"
                                    value={review}
                                    onChangeText={setReview}
                                    multiline
                                    className="w-full p-3 mb-3 bg-gray-100 rounded-lg border border-gray-300"
                                    style={{ minHeight: 80, textAlignVertical: 'top' }}
                                />

                                {/* Confirm button */}

                            </View>
                            <TouchableOpacity
                                onPress={handleSubmitFeedback}
                                disabled={submitting}
                                className="bg-[#FF5733] py-3 rounded-full items-center mt-5"
                            >
                                <Text className="text-white font-bold">
                                    {submitting ? 'Đang xử lý...' : 'Xác nhận'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    )}
                    
                    {selectedOption === 'reject' && (
                        <View className="mt-4">
                            <TouchableOpacity 
                                className="bg-[#FF5733] py-3 rounded-full items-center"
                                onPress={handleReopenTicket}
                                disabled={submitting}
                            >
                                <Text className="text-white font-bold">
                                    {submitting ? 'Đang xử lý...' : 'Mở lại ticket'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            )}

            {ticket.status.toLowerCase() === 'cancelled' && ticket.cancellationReason && (
                <View className="bg-red-50 p-4 rounded-xl">
                    <Text className="text-base font-bold mb-2 text-red-700">Lý do huỷ ticket:</Text>
                    <Text className="text-red-600">{ticket.cancellationReason}</Text>
                </View>
            )}

            {ticket.status.toLowerCase() === 'closed' && ticket.feedback && (
                <View className="bg-gray-50 p-4 rounded-xl">
                    <Text className="text-base font-bold mb-3 text-gray-700">Phản hồi của bạn:</Text>
                    
                    {/* Rating hiển thị */}
                    <View className="flex-row justify-center mb-3">
                        {[1, 2, 3, 4, 5].map((star) => (
                            <AntDesign 
                                key={star}
                                name={star <= (ticket.feedback?.rating || 0) ? "star" : "staro"}
                                size={30}
                                color="#FFD700"
                                style={{ marginHorizontal: 3 }}
                            />
                        ))}
                    </View>
                    
                    {ticket.feedback?.comment && (
                        <View className="mb-3 p-3 bg-gray-100 rounded-lg">
                            <Text className="text-gray-700 italic">"{ticket.feedback.comment}"</Text>
                        </View>
                    )}
                    
                    {ticket.feedback?.badges && ticket.feedback.badges.length > 0 && (
                        <View className="flex-row flex-wrap justify-center">
                            {ticket.feedback.badges.map((badge, index) => (
                                <View key={index} className="bg-[#FFEBCC] rounded-full px-3 py-1 m-1">
                                    <Text style={{ color: '#FFAA00', fontFamily: 'Mulish-Bold', fontSize: 12 }}>
                                        {badge}
                                    </Text>
                                </View>
                            ))}
                        </View>
                    )}
                </View>
            )}
        </ScrollView>
    );
};

export default TicketProcessingGuest; 
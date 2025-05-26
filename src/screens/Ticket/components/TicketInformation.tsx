import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, ActivityIndicator, Image, TouchableOpacity } from 'react-native';
import axios from 'axios';
import { API_BASE_URL } from '../../../config/constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Modal from 'react-native-modal';

interface TicketInformationProps {
    ticketId: string;
    onRefresh?: () => void;
}

interface Attachment {
    filename: string;
    url: string;
}

interface Ticket {
    ticketCode: string;
    title: string;
    description: string;
    status: string;
    priority: string;
    creator: {
        fullname: string;
        email: string;
    };
    assignedTo: {
        fullname: string;
        email: string;
    };
    createdAt: string;
    notes: string;
    attachments: Attachment[];
}

const TicketInformation: React.FC<TicketInformationProps> = ({ ticketId, onRefresh }) => {
    const [ticket, setTicket] = useState<Ticket | null>(null);
    const [loading, setLoading] = useState(true);
    const [previewImage, setPreviewImage] = useState<string | null>(null);

    useEffect(() => {
        fetchTicketDetails();
    }, [ticketId]);

    const fetchTicketDetails = async () => {
        try {
            const token = await AsyncStorage.getItem('authToken');
            const response = await axios.get(`${API_BASE_URL}/api/tickets/${ticketId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (response.data.success) {
                setTicket(response.data.ticket);
                onRefresh?.();
            }
        } catch (error) {
            console.error('Lỗi khi lấy thông tin ticket:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('vi-VN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const statusColor = (status: string) => {
        switch (status) {
            case 'Assigned':
                return 'bg-[#002855]';
            case 'Processing':
                return 'bg-[#F59E0B]';
            case 'Done':
                return 'bg-[#BED232]';
            case 'Closed':
                return 'bg-[#009483]';
            case 'Cancelled':
                return 'bg-[#F05023]';
            default:
                return 'bg-gray-500';
        }
    };

    const statusLabel = (status: string) => {
        switch (status) {
            case 'Assigned':
                return 'Đã tiếp nhận';
            case 'Processing':
                return 'Đang xử lý';
            case 'Done':
                return 'Đã xử lý';
            case 'Closed':
                return 'Đã đóng';
            case 'Cancelled':
                return 'Đã hủy';
            default:
                return status;
        }
    };

    if (loading) {
        return (
            <View className="flex-1 justify-center items-center">
                <ActivityIndicator size="large" color="#002855" />
            </View>
        );
    }

    if (!ticket) {
        return (
            <View className="flex-1 justify-center items-center">
                <Text className="text-gray-500 font-medium">Không tìm thấy thông tin ticket</Text>
            </View>
        );
    }

    return (
        <ScrollView className="flex-1 bg-white p-4">
            <View className="bg-[#F8F8F8] rounded-xl p-4 mb-4">
                <Text className="text-lg font-semibold text-[#002855] mb-2">Thông tin chung</Text>

                <View className="mb-3 flex flex-row items-center justify-between">
                    <Text className="text-[#757575] text-base font-semibold">Mã yêu cầu</Text>
                    <Text className="text-base text-[#002855] font-medium">{ticket.ticketCode}</Text>
                </View>

                <View className="mb-3 flex flex-row items-center justify-between">
                    <Text className="text-[#757575] text-base font-semibold">Người thực hiện</Text>
                    <Text className="text-base text-[#002855] font-medium">{ticket.assignedTo?.fullname || 'Chưa phân công'}</Text>
                </View>

                <View className="mb-3 flex flex-row items-center justify-between">
                    <Text className="text-[#757575] text-base font-semibold">Ngày yêu cầu</Text>
                    <View className="flex-row items-center">
                        <Text className="text-base text-[#002855] font-medium">{formatDate(ticket.createdAt)}</Text>
                    </View>
                </View>

                <View className="mb-3 flex flex-row items-center justify-between">
                    <Text className="text-[#757575] text-base font-semibold">Trạng thái</Text>
                    <View className={`${statusColor(ticket.status)} rounded-lg px-3 py-1`}>
                        <Text className="text-base text-white font-semibold">{statusLabel(ticket.status)}</Text>
                    </View>
                </View>
            </View>

            <View className="bg-[#F8F8F8] rounded-xl p-4 mb-4">
                <Text className="text-lg font-bold text-[#002855] mb-2">Nội dung yêu cầu</Text>

                <View className="mb-3">
                    <Text className=" text-[#002855] font-semibold text-base">Tiêu đề</Text>
                    <Text className="text-base text-[#757575] font-medium mt-1">{ticket.title}</Text>
                </View>

                <View className="mb-3">
                    <Text className="text-[#002855] font-semibold text-base">Chi tiết</Text>
                    <Text className="text-base text-[#757575] font-medium mt-1">{ticket.description}</Text>
                </View>

                <View className="mb-3">
                    <Text className="text-[#002855] font-semibold text-base">Ảnh</Text>
                    <View className="flex-row items-center mt-1 flex-wrap gap-2">
                        {ticket.attachments && ticket.attachments.length > 0 ? (
                            ticket.attachments.map((attachment, index) => (
                                <TouchableOpacity key={index} onPress={() => setPreviewImage(`${API_BASE_URL}/uploads/Tickets/${attachment.url}`)}>
                                    <Image
                                        source={{ uri: `${API_BASE_URL}/uploads/Tickets/${attachment.url}` }}
                                        className="w-20 h-20 rounded-lg"
                                        onError={(e) => console.error('Lỗi tải ảnh:', e.nativeEvent.error)}
                                    />
                                </TouchableOpacity>
                            ))
                        ) : (
                            <Text className="text-sm text-[#757575] font-medium">Không có ảnh đính kèm</Text>
                        )}
                    </View>
                </View>

                <View className="mb-3">
                    <Text className="text-[#002855] font-semibold text-base">Ghi chú</Text>
                    <View className="flex-row items-center mt-1">
                        <Text className="text-base text-[#757575] font-medium mt-1">{ticket.notes}</Text>
                    </View>
                </View>
            </View>

            <Modal
                isVisible={!!previewImage}
                onBackdropPress={() => setPreviewImage(null)}
                onSwipeComplete={() => setPreviewImage(null)}
                swipeDirection={['down']}
                style={{ margin: 0, justifyContent: 'center', alignItems: 'center' }}
            >
                <View style={{ width: '100%', alignItems: 'center' }}>
                    
                    {previewImage && (
                        <Image
                            source={{ uri: previewImage }}
                            style={{ width: '90%', height: '70%', resizeMode: 'contain' }}
                        />
                    )}
                </View>
            </Modal>
        </ScrollView >
    );
};

export default TicketInformation; 
import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, ActivityIndicator } from 'react-native';
import axios from 'axios';
import { API_BASE_URL } from '../../../config/constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WebView } from 'react-native-webview';

interface TicketHistoryProps {
    ticketId: string;
}

interface HistoryItem {
    _id: string;
    timestamp: string;
    action: string;
    user: {
        _id: string;
        fullname: string;
    };
}

const TicketHistory: React.FC<TicketHistoryProps> = ({ ticketId }) => {
    const [history, setHistory] = useState<HistoryItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchHistory();
    }, [ticketId]);

    const fetchHistory = async () => {
        try {
            const token = await AsyncStorage.getItem('authToken');
            const response = await axios.get(`${API_BASE_URL}/api/tickets/${ticketId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (response.data.success) {
                setHistory(response.data.ticket.history || []);
            }
        } catch (error) {
            console.error('Lỗi khi lấy lịch sử:', error);
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

    // Hàm để loại bỏ các thẻ HTML và chỉ giữ lại text
    const stripHtml = (html: string) => {
        return html.replace(/<\/?[^>]+(>|$)/g, "");
    };

    // Hàm để bao bọc nội dung HTML trong cấu trúc HTML hoàn chỉnh
    const wrapInHtml = (content: string) => {
        return `
        <html>
            <head>
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                        font-size: 14px;
                        color: #333;
                        margin: 0;
                        padding: 0;
                    }
                    strong {
                        font-weight: 600;
                    }
                </style>
            </head>
            <body>
                ${content}
            </body>
        </html>
        `;
    };

    if (loading) {
        return (
            <View className="flex-1 justify-center items-center">
                <ActivityIndicator size="large" color="#002855" />
            </View>
        );
    }

    return (
        <View className="flex-1">
            {history.length === 0 ? (
                <View className="flex-1 justify-center items-center py-8">
                    <Text className="text-gray-500 font-medium">Chưa có lịch sử hoạt động</Text>
                </View>
            ) : (
                <ScrollView className="flex-1">
                    {[...history].reverse().map((item, index) => (
                        <View key={index} className="mb-4">
                            <View className="ml-6 bg-[#F8F8F8] rounded-xl p-3 font-medium">
                                <Text className=" text-gray-500 text-sm font-medium mb-1">
                                    {formatDate(item.timestamp)}
                                </Text>
                                {/* Sử dụng WebView để hiển thị HTML */}
                                <WebView
                                    originWhitelist={['*']}
                                    source={{ html: wrapInHtml(item.action) }}
                                    style={{ height: 40, backgroundColor: 'transparent' }}
                                    scrollEnabled={false}
                                />
                                {/* Phòng trường hợp WebView không hiển thị đúng */}
                                <Text className="hidden">{stripHtml(item.action)}</Text>
                            </View>
                        </View>
                    ))}
                </ScrollView>
            )}
        </View>
    );
};

export default TicketHistory; 
import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import { WebView } from 'react-native-webview';
import { getTicketHistory } from '../../../services/ticketService';

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
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchHistory();
  }, [ticketId]);

  const fetchHistory = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      const historyData = await getTicketHistory(ticketId);
      setHistory(historyData);
    } catch (error) {
      console.error('Lỗi khi lấy lịch sử:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => fetchHistory(true);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Wrap HTML content in proper structure
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
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color="#002855" />
      </View>
    );
  }

  return (
    <View className="flex-1">
      {history.length === 0 ? (
        <View className="flex-1 items-center justify-center py-8">
          <Text className="font-medium text-gray-500">Chưa có lịch sử hoạt động</Text>
        </View>
      ) : (
        <ScrollView
          className="flex-1"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#F05023']} tintColor="#F05023" />
          }>
          {[...history].reverse().map((item, index) => (
            <View key={item._id || index} className="mb-4">
              <View className="ml-6 rounded-xl bg-[#F8F8F8] p-3 font-medium">
                <Text className="mb-1 font-medium text-sm text-gray-500">
                  {formatDate(item.timestamp)}
                </Text>
                <WebView
                  originWhitelist={['*']}
                  source={{ html: wrapInHtml(item.action) }}
                  style={{ height: 40, backgroundColor: 'transparent' }}
                  scrollEnabled={false}
                />
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
};

export default TicketHistory;

import React, { useState } from 'react';
import { View, Text, Image, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { API_BASE_URL } from '../../config/constants';
import ConfirmModal from '../../components/ConfirmModal';
import NotificationModal from '../../components/NotificationModal';
import { Message, MessageReaction } from '../../types/message';
import Avatar from './Avatar';
import MessageContent from './MessageContent';

type Props = {
    pinnedMessages: Message[];
    onPress: (message: Message) => void;
    onUnpin: (messageId: string) => void;
};

const PinnedMessageBanner = ({ pinnedMessages, onPress, onUnpin }: Props) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
    const [notification, setNotification] = useState<{
        visible: boolean;
        type: 'success' | 'error';
        message: string;
    }>({
        visible: false,
        type: 'success',
        message: ''
    });

    if (!pinnedMessages || pinnedMessages.length === 0) return null;

    const message = pinnedMessages[currentIndex];

    // Hàm để hiển thị nội dung phù hợp với loại tin nhắn
    const renderContent = () => {
        if (!message) return null;
        return <MessageContent message={message} isPreview={true} />;
    };

    return (
        <View style={{
            position: 'relative',
            flexDirection: 'row',
            alignItems: 'center',
            padding: 8,
            marginHorizontal: 12,
            marginTop: 4,
            marginBottom: 0,
            borderRadius: 9999,
            overflow: 'hidden',
            backgroundColor: '#BED232'
        }}>
            <LinearGradient
                colors={['#BED232', '#009483']}
                start={{ x: 1, y: 1 }}
                end={{ x: 0, y: 0 }}
                style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    top: 0,
                    bottom: 0,
                    borderRadius: 9999,
                }}
            />
            <View style={{
                position: 'absolute',
                left: 2,
                right: 2,
                top: 2,
                bottom: 2,
                borderRadius: 9999,
            }}
                className="bg-yellow-50"
            />
            <TouchableOpacity
                style={{ flex: 1 }}
                onPress={() => onPress(message)}
            >
                <View>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View style={{ marginRight: 8 }}>
                            <View style={{
                                backgroundColor: 'white',
                                flex: 1,
                                margin: 2,
                                borderRadius: 12,
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}>
                                {message?.sender && (
                                    <Avatar user={message.sender} size={24} statusSize={0} />
                                )}
                            </View>
                        </View>
                        {renderContent()}
                    </View>
                </View>
            </TouchableOpacity>

            {pinnedMessages.length > 1 && (
                <View style={{ flexDirection: 'row', marginHorizontal: 8 }}>
                    <TouchableOpacity
                        style={{ padding: 5 }}
                        disabled={currentIndex === 0}
                        onPress={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
                    >
                        <Ionicons
                            name="chevron-back"
                            size={20}
                            color={currentIndex === 0 ? '#ccc' : '#757575'}
                        />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={{ padding: 5 }}
                        disabled={currentIndex === pinnedMessages.length - 1}
                        onPress={() => setCurrentIndex(prev => Math.min(pinnedMessages.length - 1, prev + 1))}
                    >
                        <Ionicons
                            name="chevron-forward"
                            size={20}
                            color={currentIndex === pinnedMessages.length - 1 ? '#ccc' : '#757575'}
                        />
                    </TouchableOpacity>
                </View>
            )}

            <TouchableOpacity
                style={{ padding: 5 }}
                onPress={() => {
                    setSelectedMessageId(message._id);
                    setShowConfirmModal(true);
                }}
            >
                <Ionicons name="close" size={18} color="#757575" />
            </TouchableOpacity>

            <ConfirmModal
                visible={showConfirmModal}
                title="Bỏ ghim"
                message="Bạn có muốn bỏ ghim tin nhắn này?"
                onCancel={() => {
                    setShowConfirmModal(false);
                    setSelectedMessageId(null);
                }}
                onConfirm={() => {
                    if (selectedMessageId) {
                        onUnpin(selectedMessageId);
                        setNotification({
                            visible: true,
                            type: 'success',
                            message: 'Đã bỏ ghim tin nhắn'
                        });
                    }
                    setShowConfirmModal(false);
                    setSelectedMessageId(null);
                }}
            />

            <NotificationModal
                visible={notification.visible}
                type={notification.type}
                message={notification.message}
                onClose={() => setNotification(prev => ({ ...prev, visible: false }))}
            />
        </View>
    );
};

export default PinnedMessageBanner; 
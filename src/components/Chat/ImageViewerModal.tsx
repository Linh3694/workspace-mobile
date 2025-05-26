import React from 'react';
import { View, Text, TouchableOpacity, Platform, Dimensions, Modal } from 'react-native';
import ImageViewer from 'react-native-image-zoom-viewer';
import { API_BASE_URL } from '../../config/constants';
import { processImageUrl } from '../../utils/image';

interface ImageViewerModalProps {
    images: { uri: string }[];
    imageIndex: number;
    visible: boolean;
    onRequestClose: () => void;
}

const ImageViewerModal: React.FC<ImageViewerModalProps> = ({
    images,
    imageIndex,
    visible,
    onRequestClose
}) => {
    // Xử lý URL ảnh
    const processedImages = images.map(img => ({
        url: processImageUrl(img.uri)
    }));

    const screenWidth = Dimensions.get('window').width;
    const screenHeight = Dimensions.get('window').height;
    const maxImageHeight = screenHeight - 160; // Để lại khoảng trống cho header và footer

    return (
        <Modal visible={visible} transparent={true} animationType="fade">
            <ImageViewer
                imageUrls={processedImages}
                index={imageIndex}
                onCancel={onRequestClose}
                enableSwipeDown={true}
                onSwipeDown={onRequestClose}
                backgroundColor="rgba(0, 0, 0, 0.95)"
                saveToLocalByLongPress={false}
                renderHeader={(currentIndex: number = 0) => (
                    <View style={{
                        padding: 16,
                        paddingTop: Platform.OS === 'ios' ? 50 : 16,
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        width: '100%',
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        zIndex: 100,
                        height: 80,
                        backgroundColor: 'rgba(0, 0, 0, 0.4)'
                    }}>
                        <TouchableOpacity
                            onPress={onRequestClose}
                            style={{
                                padding: 8,
                                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                                borderRadius: 20
                            }}
                        >
                            <Text style={{
                                color: 'white',
                                fontSize: 16,
                                fontFamily: 'Inter',
                                fontWeight: 'bold'
                            }}>✕</Text>
                        </TouchableOpacity>
                        <View style={{
                            backgroundColor: 'rgba(0, 0, 0, 0.5)',
                            padding: 8,
                            borderRadius: 20
                        }}>
                            <Text style={{
                                color: 'white',
                                fontSize: 16,
                                fontFamily: 'Inter',
                                fontWeight: 'medium'
                            }}>
                                {currentIndex + 1}/{processedImages.length}
                            </Text>
                        </View>
                    </View>
                )}
                renderFooter={() => (
                    <View style={{
                        height: 80,
                        backgroundColor: 'rgba(0, 0, 0, 0.4)',
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0
                    }} />
                )}
                renderIndicator={() => <View />}
                maxOverflow={160}
                enableImageZoom={true}
                style={{
                    paddingVertical: 80
                }}
                menus={() => <View />}
            />
        </Modal>
    );
};

export default ImageViewerModal; 
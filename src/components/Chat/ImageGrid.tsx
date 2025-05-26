import React, { useMemo, memo } from 'react';
import { View, Image, TouchableOpacity, Text, Dimensions, GestureResponderEvent } from 'react-native';
import { API_BASE_URL } from '../../config/constants';
import { processImageUrl } from '../../utils/image';

type ImageGridProps = {
    images: string[];
    onPress: (index: number) => void;
    onLongPress?: (index: number, event: GestureResponderEvent) => void;
    onPressOut?: () => void;
};

const ImageGrid = memo(({ images, onPress, onLongPress, onPressOut }: ImageGridProps) => {
    // Memoize screen dimensions and calculations
    const { maxWidth, gap, processedImages } = useMemo(() => {
        const screenWidth = Dimensions.get('window').width;
        const maxWidth = screenWidth * 0.7;
        const gap = 2;
        const processedImages = images.map(processImageUrl);
        
        return { maxWidth, gap, processedImages };
    }, [images]);

    // Memoize layout calculations
    const layoutConfig = useMemo(() => {
        const itemWidth = maxWidth / 3 - (gap * 2 / 3);
        const itemHeight = (maxWidth / 3) * 0.8;
        
        return { itemWidth, itemHeight };
    }, [maxWidth, gap]);

    if (images.length === 1) {
        return (
            <TouchableOpacity
                onPress={() => onPress(0)}
                onLongPress={(event) => onLongPress && onLongPress(0, event)}
                onPressOut={onPressOut}
                delayLongPress={500}
            >
                <Image
                    source={{ uri: processedImages[0] }}
                    style={{ width: maxWidth, height: maxWidth * 0.75, borderRadius: 12 }}
                    resizeMode="cover"
                />
            </TouchableOpacity>
        );
    } else if (images.length === 2) {
        return (
            <View style={{ flexDirection: 'row', width: maxWidth }}>
                <TouchableOpacity
                    onPress={() => onPress(0)}
                    onLongPress={(event) => onLongPress && onLongPress(0, event)}
                    onPressOut={onPressOut}
                    delayLongPress={500}
                    style={{ flex: 1, marginRight: gap / 2 }}
                >
                    <Image
                        source={{ uri: processedImages[0] }}
                        style={{ width: '100%', height: maxWidth / 2, borderRadius: 12 }}
                        resizeMode="cover"
                    />
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={() => onPress(1)}
                    onLongPress={(event) => onLongPress && onLongPress(1, event)}
                    onPressOut={onPressOut}
                    delayLongPress={500}
                    style={{ flex: 1, marginLeft: gap / 2 }}
                >
                    <Image
                        source={{ uri: processedImages[1] }}
                        style={{ width: '100%', height: maxWidth / 2, borderRadius: 12 }}
                        resizeMode="cover"
                    />
                </TouchableOpacity>
            </View>
        );
    } else if (images.length === 3) {
        // Ba ảnh: 1 lớn bên trái, 2 nhỏ bên phải xếp dọc
        return (
            <View style={{ flexDirection: 'row', width: maxWidth }}>
                <TouchableOpacity
                    onPress={() => onPress(0)}
                    onLongPress={(event) => onLongPress && onLongPress(0, event)}
                    onPressOut={onPressOut}
                    delayLongPress={500}
                    style={{ width: maxWidth / 2 - gap / 2, marginRight: gap / 2 }}
                >
                    <Image
                        source={{ uri: processedImages[0] }}
                        style={{ width: '100%', height: maxWidth / 2, borderRadius: 12 }}
                        resizeMode="cover"
                    />
                </TouchableOpacity>
                <View style={{ flexDirection: 'column', width: maxWidth / 2 - gap / 2, marginLeft: gap / 2 }}>
                    <TouchableOpacity
                        onPress={() => onPress(1)}
                        onLongPress={(event) => onLongPress && onLongPress(1, event)}
                        onPressOut={onPressOut}
                        delayLongPress={500}
                        style={{ marginBottom: gap / 2 }}
                    >
                        <Image
                            source={{ uri: processedImages[1] }}
                            style={{ width: '100%', height: maxWidth / 4 - gap / 2, borderRadius: 12 }}
                            resizeMode="cover"
                        />
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => onPress(2)}
                        onLongPress={(event) => onLongPress && onLongPress(2, event)}
                        onPressOut={onPressOut}
                        delayLongPress={500}
                        style={{ marginTop: gap / 2 }}
                    >
                        <Image
                            source={{ uri: processedImages[2] }}
                            style={{ width: '100%', height: maxWidth / 4 - gap / 2, borderRadius: 12 }}
                            resizeMode="cover"
                        />
                    </TouchableOpacity>
                </View>
            </View>
        );
    } else if (images.length === 4) {
        return (
            <View style={{ width: maxWidth }}>
                <View style={{ flexDirection: 'row' }}>
                    <TouchableOpacity
                        onPress={() => onPress(0)}
                        onLongPress={(event) => onLongPress && onLongPress(0, event)}
                        onPressOut={onPressOut}
                        delayLongPress={500}
                        style={{ width: maxWidth / 2 - gap / 2, marginRight: gap / 2, marginBottom: gap / 2 }}
                    >
                        <Image
                            source={{ uri: processedImages[0] }}
                            style={{ width: '100%', height: maxWidth / 2 - gap / 2, borderRadius: 12 }}
                            resizeMode="cover"
                        />
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => onPress(1)}
                        onLongPress={(event) => onLongPress && onLongPress(1, event)}
                        onPressOut={onPressOut}
                        delayLongPress={500}
                        style={{ width: maxWidth / 2 - gap / 2, marginLeft: gap / 2, marginBottom: gap / 2 }}
                    >
                        <Image
                            source={{ uri: processedImages[1] }}
                            style={{ width: '100%', height: maxWidth / 2 - gap / 2, borderRadius: 12 }}
                            resizeMode="cover"
                        />
                    </TouchableOpacity>
                </View>
                <View style={{ flexDirection: 'row' }}>
                    <TouchableOpacity
                        onPress={() => onPress(2)}
                        onLongPress={(event) => onLongPress && onLongPress(2, event)}
                        onPressOut={onPressOut}
                        delayLongPress={500}
                        style={{ width: maxWidth / 2 - gap / 2, marginRight: gap / 2, marginTop: gap / 2 }}
                    >
                        <Image
                            source={{ uri: processedImages[2] }}
                            style={{ width: '100%', height: maxWidth / 2 - gap / 2, borderRadius: 12 }}
                            resizeMode="cover"
                        />
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => onPress(3)}
                        onLongPress={(event) => onLongPress && onLongPress(3, event)}
                        onPressOut={onPressOut}
                        delayLongPress={500}
                        style={{ width: maxWidth / 2 - gap / 2, marginLeft: gap / 2, marginTop: gap / 2 }}
                    >
                        <Image
                            source={{ uri: processedImages[3] }}
                            style={{ width: '100%', height: maxWidth / 2 - gap / 2, borderRadius: 12 }}
                            resizeMode="cover"
                        />
                    </TouchableOpacity>
                </View>
            </View>
        );
    } else {
        // 5+ ảnh: hiển thị dạng lưới 3x2 (6 ảnh hoặc ít hơn)
        const displayImages = images.slice(0, Math.min(6, images.length));
        // Mỗi hàng có 3 ảnh
        const { itemWidth, itemHeight } = layoutConfig;

        return (
            <View style={{ width: maxWidth }}>
                {/* Hàng đầu tiên: 3 ảnh */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: gap }}>
                    {[0, 1, 2].map(idx => {
                        if (idx < displayImages.length) {
                            return (
                                <TouchableOpacity
                                    key={idx}
                                    onPress={() => onPress(idx)}
                                    onLongPress={(event) => onLongPress && onLongPress(idx, event)}
                                    onPressOut={onPressOut}
                                    delayLongPress={500}
                                    style={{ width: itemWidth, height: itemHeight }}
                                >
                                    <Image
                                        source={{ uri: processedImages[idx] }}
                                        style={{ width: '100%', height: '100%', borderRadius: 8 }}
                                        resizeMode="cover"
                                    />
                                </TouchableOpacity>
                            );
                        }
                        return <View key={idx} style={{ width: itemWidth, height: itemHeight }} />;
                    })}
                </View>

                {/* Hàng thứ hai: 3 ảnh còn lại nếu có */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    {[3, 4, 5].map(idx => {
                        if (idx < displayImages.length) {
                            return (
                                <TouchableOpacity
                                    key={idx}
                                    onPress={() => onPress(idx)}
                                    onLongPress={(event) => onLongPress && onLongPress(idx, event)}
                                    onPressOut={onPressOut}
                                    delayLongPress={500}
                                    style={{ width: itemWidth, height: itemHeight }}
                                >
                                    <Image
                                        source={{ uri: processedImages[idx] }}
                                        style={{ width: '100%', height: '100%', borderRadius: 8 }}
                                        resizeMode="cover"
                                    />
                                    {idx === 5 && images.length > 6 && (
                                        <View style={{
                                            position: 'absolute',
                                            width: '100%',
                                            height: '100%',
                                            backgroundColor: 'rgba(0,0,0,0.5)',
                                            borderRadius: 8,
                                            justifyContent: 'center',
                                            alignItems: 'center'
                                        }}>
                                            <Text style={{ color: 'white', fontSize: 18, fontWeight: 'bold' }}>
                                                +{images.length - 6}
                                            </Text>
                                        </View>
                                    )}
                                </TouchableOpacity>
                            );
                        }
                        return <View key={idx} style={{ width: itemWidth, height: itemHeight }} />;
                    })}
                </View>
            </View>
        );
    }
});

export default ImageGrid; 
import React, { useMemo, useCallback, memo } from 'react';
import { View, Text, TouchableOpacity, Image, FlatList } from 'react-native';
import { CustomEmoji } from '../../hooks/useEmojis';
import { API_BASE_URL } from '../../config/constants';

interface EmojiPickerProps {
    customEmojis: CustomEmoji[];
    handleSendEmoji: (emoji: CustomEmoji) => void;
    setShowEmojiPicker: React.Dispatch<React.SetStateAction<boolean>>;
}

const EmojiPicker: React.FC<EmojiPickerProps> = memo(({
    customEmojis,
    handleSendEmoji,
    setShowEmojiPicker
}) => {
    // Memoize grouped emojis
    const groupedEmojis = useMemo(() => {
        return customEmojis.reduce((acc: Record<string, CustomEmoji[]>, emoji) => {
            if (!acc[emoji.category]) {
                acc[emoji.category] = [];
            }
            acc[emoji.category].push(emoji);
            return acc;
        }, {});
    }, [customEmojis]);

    // Memoize flat emoji list for FlatList (chỉ emoji, không có header)
    const flatEmojiList = useMemo(() => {
        const result: CustomEmoji[] = [];
        
        Object.entries(groupedEmojis).forEach(([category, emojis]) => {
            emojis.forEach(emoji => {
                result.push(emoji);
            });
        });
        
        return result;
    }, [groupedEmojis]);

    const handleEmojiPress = useCallback((emoji: CustomEmoji) => {
        handleSendEmoji(emoji);
        setShowEmojiPicker(false);
    }, [handleSendEmoji, setShowEmojiPicker]);

    const renderItem = useCallback(({ item }: { item: CustomEmoji }) => {
        return (
            <TouchableOpacity
                style={{
                    width: 60,
                    height: 60,
                    justifyContent: 'center',
                    alignItems: 'center',
                    margin: 5
                }}
                onPress={() => handleEmojiPress(item)}
            >
                <Image
                    source={item.url}
                    style={{ width: 48, height: 48 }}
                    resizeMode="contain"
                />
            </TouchableOpacity>
        );
    }, [handleEmojiPress]);

    const keyExtractor = useCallback((item: CustomEmoji, index: number) => {
        return `emoji-${item._id}-${index}`;
    }, []);

    return (
        <View style={{
            height: 250,
            borderTopWidth: 1,
            borderTopColor: '#E0E0E0',
            width: '100%'
        }}>
            <FlatList
                data={flatEmojiList}
                renderItem={renderItem}
                keyExtractor={keyExtractor}
                numColumns={5}
                removeClippedSubviews={true}
                maxToRenderPerBatch={20}
                windowSize={10}
                initialNumToRender={20}
                getItemLayout={(data, index) => ({
                    length: 70,
                    offset: 70 * Math.floor(index / 5),
                    index,
                })}
            />
        </View>
    );
});

export default EmojiPicker; 
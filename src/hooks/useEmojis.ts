import { ImageSourcePropType } from 'react-native';
// hooks/useEmojis.ts
import { useState, useEffect } from 'react';
import emojiList from '../assets/emojis/emoji-codes.json';

// Map emoji codes to local asset requires
const emojiAssets: Record<string, any> = {
    hushed_face: require('../assets/emojis/hushed_face.gif'),
    clapping_hands: require('../assets/emojis/clapping_hands.gif'),
    grinning_squinting_face: require('../assets/emojis/grinning_squinting_face.gif'),
    loudly_crying_face: require('../assets/emojis/loudly_crying_face.gif'),
    smiling_face_with_heart_eyes: require('../assets/emojis/smiling_face_with_heart_eyes.gif'),
};

export type CustomEmoji = {
    _id: string;
    code: string;
    name: string;
    type: string;
    path: string;
    category: string;
    isDefault: boolean;
    url: ImageSourcePropType;
};

export const useEmojis = () => {
    const [customEmojis, setCustomEmojis] = useState<CustomEmoji[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const mapped = emojiList.map(({ code, name }) => ({
            _id: code,
            code,
            name,
            type: 'static',
            path: code,
            category: 'custom',
            isDefault: false,
            url: emojiAssets[code],
        }));
        setCustomEmojis(mapped);
        setLoading(false);
    }, []);

    return { customEmojis, loading };
};
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ChatScreen from '../screens/Chat/ChatScreen';
import ChatDetailScreen from '../screens/Chat/ChatDetailScreen';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

export interface User {
    _id: string;
    fullname: string;
    avatarUrl?: string;
}

export type ChatStackParamList = {
    ChatList: undefined;
    ChatDetail: { user: User; chatId?: string };
};

const Stack = createNativeStackNavigator<ChatStackParamList>();

const ChatStackNavigator = () => (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="ChatList" component={ChatScreen} />
        <Stack.Screen
            name="ChatDetail"
            component={ChatDetailScreen}
            options={{
                headerShown: false,
                presentation: 'card',
            }}
        />
    </Stack.Navigator>
);

export default ChatStackNavigator;

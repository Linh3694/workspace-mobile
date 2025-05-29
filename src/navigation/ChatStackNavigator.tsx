import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ChatScreen from '../screens/Chat/ChatScreen';
import ChatDetailScreen from '../screens/Chat/ChatDetailScreen';
import CreateGroupScreen from '../screens/Chat/CreateGroupScreen';
import GroupChatDetailScreen from '../screens/Chat/GroupChatDetailScreen';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { GroupInfo } from '../types/message';

export interface User {
    _id: string;
    fullname: string;
    avatarUrl?: string;
}

export type ChatStackParamList = {
    ChatScreen: undefined;
    ChatDetail: { user: User; chatId?: string };
    CreateGroup: { preSelectedUsers?: User[] } | undefined;
    GroupChatDetail: {
        chat: GroupInfo;
    };
};

const Stack = createNativeStackNavigator<ChatStackParamList>();

const ChatStackNavigator = () => (
    <Stack.Navigator 
        id="ChatStack"
        screenOptions={{ headerShown: false }}
    >
        <Stack.Screen name="ChatScreen" component={ChatScreen} />
        <Stack.Screen
            name="ChatDetail"
            component={ChatDetailScreen}
            options={{
                headerShown: false,
                presentation: 'card',
            }}
        />
        <Stack.Screen
            name="CreateGroup"
            component={CreateGroupScreen}
            options={{
                headerShown: false,
                presentation: 'modal',
            }}
        />
        <Stack.Screen
            name="GroupChatDetail"
            component={GroupChatDetailScreen}
            options={{
                headerShown: false,
                presentation: 'card',
            }}
        />
    </Stack.Navigator>
);

export default ChatStackNavigator;

import React from 'react';
import { View, Text, SafeAreaView } from 'react-native';

const SettingsScreen = () => {
    return (
        <SafeAreaView className="flex-1 bg-white">
            <View className="p-4">
                <Text className="text-2xl font-bold text-gray-800">Cài Đặt</Text>
            </View>
        </SafeAreaView>
    );
};

export default SettingsScreen; 
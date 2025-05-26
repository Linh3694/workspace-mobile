import React from 'react';
import { View } from 'react-native';

const PostSkeleton: React.FC = () => {
  return (
    <View className="bg-white mb-2 border-b border-gray-100 p-4">
      {/* Header Skeleton */}
      <View className="flex-row items-center mb-3">
        <View className="w-10 h-10 rounded-full bg-gray-200 mr-3" />
        <View className="flex-1">
          <View className="w-24 h-4 bg-gray-200 rounded mb-1" />
          <View className="w-16 h-3 bg-gray-200 rounded" />
        </View>
      </View>

      {/* Content Skeleton */}
      <View className="mb-3">
        <View className="w-full h-4 bg-gray-200 rounded mb-2" />
        <View className="w-3/4 h-4 bg-gray-200 rounded mb-2" />
        <View className="w-1/2 h-4 bg-gray-200 rounded" />
      </View>

      {/* Image Skeleton */}
      <View className="w-full h-48 bg-gray-200 rounded-lg mb-3" />

      {/* Actions Skeleton */}
      <View className="flex-row items-center justify-around pt-3 border-t border-gray-100">
        <View className="flex-row items-center">
          <View className="w-6 h-6 bg-gray-200 rounded mr-2" />
          <View className="w-12 h-4 bg-gray-200 rounded" />
        </View>
        <View className="flex-row items-center">
          <View className="w-6 h-6 bg-gray-200 rounded mr-2" />
          <View className="w-16 h-4 bg-gray-200 rounded" />
        </View>
      </View>
    </View>
  );
};

export default PostSkeleton; 
import React, { useState, useEffect } from 'react';
// @ts-ignore
import {View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, Alert, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { API_BASE_URL } from '../../config/constants';
import { User } from '../../navigation/AppNavigator';

interface CreateGroupScreenProps {
  route?: {
    params?: {
      preSelectedUsers?: User[];
    };
  };
}

const CreateGroupScreen: React.FC<CreateGroupScreenProps> = ({ route }) => {
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [searchText, setSearchText] = useState('');
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<User[]>(route?.params?.preSelectedUsers || []);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'info' | 'members'>('info');
  
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (step === 'members') {
      fetchUsers();
    }
  }, [step]);

  useEffect(() => {
    if (searchText.trim()) {
      const filtered = allUsers.filter(user => 
        user.fullname.toLowerCase().includes(searchText.toLowerCase()) ||
        user.email.toLowerCase().includes(searchText.toLowerCase())
      );
      setFilteredUsers(filtered);
    } else {
      setFilteredUsers(allUsers);
    }
  }, [searchText, allUsers]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('authToken');
      console.log('🔐 Fetching users with token:', token ? 'Found' : 'Not found');
      
      const response = await fetch(`${API_BASE_URL}/api/users`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      console.log('👥 Users API response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        const currentUserData = await AsyncStorage.getItem('user');
        const currentUser = currentUserData ? JSON.parse(currentUserData) : null;
        
        // Loại bỏ user hiện tại khỏi danh sách
        const otherUsers = data.filter((user: User) => user._id !== currentUser?._id);
        setAllUsers(otherUsers);
        setFilteredUsers(otherUsers);
        
        console.log('✅ Successfully fetched', otherUsers.length, 'users');
      } else {
        console.error('❌ Failed to fetch users:', response.status);
        Alert.alert('Lỗi', 'Không thể tải danh sách người dùng');
      }
    } catch (error) {
      console.error('❌ Error fetching users:', error);
      Alert.alert('Lỗi', 'Không thể tải danh sách người dùng: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUserToggle = (user: User) => {
    setSelectedUsers(prev => {
      const isSelected = prev.some(u => u._id === user._id);
      if (isSelected) {
        return prev.filter(u => u._id !== user._id);
      } else {
        return [...prev, user];
      }
    });
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      Alert.alert('Lỗi', 'Vui lòng nhập tên nhóm');
      return;
    }

    if (selectedUsers.length === 0) {
      Alert.alert('Lỗi', 'Vui lòng chọn ít nhất 1 thành viên');
      return;
    }

    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('authToken');
      console.log('🔑 Token:', token ? 'Found' : 'Not found');
      
      const requestBody = {
        name: groupName.trim(),
        description: groupDescription.trim(),
        participantIds: selectedUsers.map(u => u._id)
      };
      
      console.log('📤 Sending request to:', `${API_BASE_URL}/api/chats/group/create`);
      console.log('📤 Request body:', requestBody);
      
      const response = await fetch(`${API_BASE_URL}/api/chats/group/create`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      console.log('📥 Response status:', response.status);
      console.log('📥 Response ok:', response.ok);
      
      // Lấy response text trước để debug
      const responseText = await response.text();
      console.log('📥 Response text:', responseText);

      if (response.ok) {
        // Parse JSON nếu response ok
        const newGroup = JSON.parse(responseText);
        console.log('✅ Group created successfully:', newGroup);
        
        Alert.alert(
          'Thành công', 
          'Đã tạo nhóm thành công!',
          [
            {
              text: 'OK',
              onPress: () => {
                // Navigate back to ChatScreen where the new group will appear in the list
                navigation.goBack();
                // Note: ChatScreen sẽ tự động refresh và hiển thị group mới thông qua socket events
              }
            }
          ]
        );
      } else {
        // Xử lý lỗi response
        console.error('❌ API Error - Status:', response.status);
        console.error('❌ API Error - Response:', responseText);
        
        try {
          const errorData = JSON.parse(responseText);
          Alert.alert('Lỗi', errorData.message || 'Không thể tạo nhóm');
        } catch (parseError) {
          console.error('❌ Cannot parse error response as JSON:', parseError);
          Alert.alert('Lỗi', `Lỗi server (${response.status}): ${responseText.substring(0, 100)}`);
        }
      }
    } catch (error) {
      console.error('❌ Network Error:', error);
      Alert.alert('Lỗi', 'Có lỗi xảy ra khi tạo nhóm: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const renderUserItem = ({ item }: { item: User }) => {
    const isSelected = selectedUsers.some(u => u._id === item._id);
    
    return (
      <TouchableOpacity
        style={[styles.userItem, isSelected && styles.userItemSelected]}
        onPress={() => handleUserToggle(item)}
      >
        <View style={styles.userAvatar}>
          <Text style={styles.userAvatarText}>
            {item.fullname.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{item.fullname}</Text>
          <Text style={styles.userEmail}>{item.email}</Text>
        </View>
        <View style={styles.checkboxContainer}>
          {isSelected && (
            <MaterialIcons name="check-circle" size={24} color="#007AFF" />
          )}
          {!isSelected && (
            <View style={styles.uncheckedCircle} />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderInfoStep = () => (
    <ScrollView style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Thông tin nhóm</Text>
      
      <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>Tên nhóm *</Text>
        <TextInput
          style={styles.textInput}
          value={groupName}
          onChangeText={setGroupName}
          placeholder="Nhập tên nhóm"
          maxLength={100}
        />
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>Mô tả nhóm</Text>
        <TextInput
          style={[styles.textInput, styles.textArea]}
          value={groupDescription}
          onChangeText={setGroupDescription}
          placeholder="Nhập mô tả nhóm (không bắt buộc)"
          multiline
          numberOfLines={3}
          maxLength={500}
        />
      </View>

      <TouchableOpacity
        style={[styles.nextButton, !groupName.trim() && styles.disabledButton]}
        onPress={() => setStep('members')}
        disabled={!groupName.trim()}
      >
        <Text style={styles.nextButtonText}>Tiếp theo</Text>
        <MaterialIcons name="arrow-forward" size={20} color="#fff" />
      </TouchableOpacity>
    </ScrollView>
  );

  const renderMembersStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Chọn thành viên</Text>
      
      {selectedUsers.length > 0 && (
        <View style={styles.selectedContainer}>
          <Text style={styles.selectedLabel}>
            Đã chọn {selectedUsers.length} thành viên
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {selectedUsers.map(user => (
              <View key={user._id} style={styles.selectedUserChip}>
                <Text style={styles.selectedUserText}>
                  {user.fullname.split(' ').pop()}
                </Text>
                <TouchableOpacity onPress={() => handleUserToggle(user)}>
                  <MaterialIcons name="close" size={16} color="#666" />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      <View style={styles.searchContainer}>
        <MaterialIcons name="search" size={20} color="#666" />
        <TextInput
          style={styles.searchInput}
          value={searchText}
          onChangeText={setSearchText}
          placeholder="Tìm kiếm người dùng..."
        />
      </View>

      <FlatList
        data={filteredUsers}
        renderItem={renderUserItem}
        keyExtractor={(item) => item._id}
        style={styles.usersList}
        showsVerticalScrollIndicator={false}
      />

      <View style={styles.bottomButtons}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => setStep('info')}
        >
          <MaterialIcons name="arrow-back" size={20} color="#007AFF" />
          <Text style={styles.backButtonText}>Quay lại</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.createButton,
            (selectedUsers.length === 0 || loading) && styles.disabledButton
          ]}
          onPress={handleCreateGroup}
          disabled={selectedUsers.length === 0 || loading}
        >
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.createButtonText}>Đang tạo nhóm...</Text>
            </View>
          ) : (
            <Text style={styles.createButtonText}>Tạo nhóm</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView 
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Tạo nhóm mới</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Progress indicator */}
      <View style={styles.progressContainer}>
        <View style={[styles.progressStep, step === 'info' && styles.activeStep]}>
          <Text style={[styles.progressNumber, step === 'info' && styles.activeStepText]}>1</Text>
        </View>
        <View style={styles.progressLine} />
        <View style={[styles.progressStep, step === 'members' && styles.activeStep]}>
          <Text style={[styles.progressNumber, step === 'members' && styles.activeStepText]}>2</Text>
        </View>
      </View>

      {/* Content */}
      {step === 'info' ? renderInfoStep() : renderMembersStep()}
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E7',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  headerRight: {
    width: 24,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    backgroundColor: '#F8F9FA',
  },
  progressStep: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E5E5E7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeStep: {
    backgroundColor: '#007AFF',
  },
  progressNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  activeStepText: {
    color: '#fff',
  },
  progressLine: {
    width: 40,
    height: 2,
    backgroundColor: '#E5E5E7',
    marginHorizontal: 8,
  },
  stepContainer: {
    flex: 1,
    padding: 16,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 24,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#E5E5E7',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#F8F9FA',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 16,
    marginTop: 24,
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginRight: 8,
  },
  selectedContainer: {
    marginBottom: 16,
  },
  selectedLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  selectedUserChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E6F3FF',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
  },
  selectedUserText: {
    fontSize: 14,
    color: '#007AFF',
    marginRight: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    paddingLeft: 8,
    fontSize: 16,
  },
  usersList: {
    flex: 1,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderRadius: 8,
  },
  userItemSelected: {
    backgroundColor: '#F0F8FF',
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  userAvatarText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  userEmail: {
    fontSize: 14,
    color: '#666',
  },
  checkboxContainer: {
    width: 24,
    height: 24,
  },
  uncheckedCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E5E7',
  },
  bottomButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E5E7',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  backButtonText: {
    fontSize: 16,
    color: '#007AFF',
    marginLeft: 4,
  },
  createButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  disabledButton: {
    backgroundColor: '#B0B0B0',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default CreateGroupScreen; 
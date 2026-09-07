import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Linking,
    Modal,
    Platform,
    RefreshControl,
    SafeAreaView,
    ScrollView,
    Text,
    TextInput,
    View,
} from 'react-native';
import { TouchableOpacity } from '../../components/Common';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { ROUTES } from '../../constants/routes';
import { BASE_URL } from '../../config/constants.js';
import deviceService from '../../services/deviceService';
import { normalizeVietnameseName } from '../../utils/nameFormatter';
import type {
    HandoverRecord,
    HandoverSigningStatus,
    MyHandoversPayload,
} from '../../types/devices';

type ScreenNavigationProp = NativeStackNavigationProp<
    RootStackParamList,
    typeof ROUTES.SCREENS.MY_HANDOVERS
>;
type ScreenRouteProp = RouteProp<RootStackParamList, typeof ROUTES.SCREENS.MY_HANDOVERS>;

type TabKey = 'to-confirm' | 'in-use' | 'history' | 'to-approve';
type PendingAction = {
    record: HandoverRecord;
    type: 'confirm' | 'approve' | 'receiver-reject' | 'manager-reject';
};

// Thứ tự chuỗi ký: IT bàn giao -> Trưởng phòng duyệt -> Người nhận xác nhận.
const SIGNING_LABELS: Record<Exclude<HandoverSigningStatus, ''>, { text: string; bg: string }> = {
    pending_manager: { text: 'Chờ Trưởng phòng duyệt', bg: 'bg-blue-500' },
    pending_receiver: { text: 'Chờ người nhận xác nhận', bg: 'bg-amber-500' },
    completed: { text: 'Đã hoàn tất', bg: 'bg-green-600' },
    rejected: { text: 'Bị từ chối', bg: 'bg-red-500' },
    manual: { text: 'Ký bản giấy', bg: 'bg-gray-500' },
    cancelled: { text: 'Đã huỷ', bg: 'bg-gray-500' },
};

const DEVICE_TYPE_LABELS: Record<string, string> = {
    laptop: 'Laptop',
    monitor: 'Màn hình',
    printer: 'Máy in',
    projector: 'Máy chiếu',
    phone: 'Điện thoại',
    tool: 'Công cụ',
};

const formatDateTime = (value?: string) => {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(date.getHours())}:${pad(date.getMinutes())} ${pad(date.getDate())}/${pad(
        date.getMonth() + 1
    )}/${date.getFullYear()}`;
};

/**
 * "Tài sản của tôi" — nhân viên xác nhận biên bản bàn giao, Trưởng phòng IT
 * phê duyệt từ xa. Thay cho việc in A4 ký tươi.
 */
const MyHandoversScreen = () => {
    const navigation = useNavigation<ScreenNavigationProp>();
    const route = useRoute<ScreenRouteProp>();
    const insets = useSafeAreaInsets();
    const focusHandoverId = route.params?.handoverId;

    const [payload, setPayload] = useState<MyHandoversPayload | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [tab, setTab] = useState<TabKey>('to-confirm');
    const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
    const [reason, setReason] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const fetchData = useCallback(async () => {
        try {
            const data = await deviceService.getMyHandovers();
            setPayload(data);
        } catch (error) {
            console.error('Error fetching handovers:', error);
            Alert.alert('Lỗi', 'Không tải được danh sách bàn giao. Vui lòng thử lại.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void fetchData();
    }, [fetchData]);

    const handleRefresh = async () => {
        setRefreshing(true);
        await fetchData();
        setRefreshing(false);
    };

    const toConfirm = payload?.toConfirm ?? [];
    const toApprove = payload?.toApprove ?? [];
    const myDevices = payload?.myDevices ?? [];
    const history = payload?.history ?? [];
    const showApproveTab = toApprove.length > 0 || Boolean(payload?.isApprover);

    // Deep link từ push notification: mở đúng tab chứa hồ sơ được nhắc tới.
    const focusedTab = useMemo<TabKey | null>(() => {
        if (!focusHandoverId) return null;
        if (toConfirm.some((r) => r.name === focusHandoverId)) return 'to-confirm';
        if (toApprove.some((r) => r.name === focusHandoverId)) return 'to-approve';
        if (myDevices.some((r) => r.name === focusHandoverId)) return 'in-use';
        if (history.some((r) => r.name === focusHandoverId)) return 'history';
        return null;
    }, [focusHandoverId, toConfirm, toApprove, myDevices, history]);

    const activeTab: TabKey = focusedTab ?? (toConfirm.length > 0 ? 'to-confirm' : tab);

    const tabs: Array<{ key: TabKey; label: string; count?: number }> = [
        { key: 'to-confirm', label: 'Chờ xác nhận', count: toConfirm.length },
        { key: 'in-use', label: 'Đang dùng', count: myDevices.length },
        { key: 'history', label: 'Lịch sử' },
        ...(showApproveTab
            ? [{ key: 'to-approve' as TabKey, label: 'Chờ duyệt', count: toApprove.length }]
            : []),
    ];

    const records =
        activeTab === 'to-confirm'
            ? toConfirm
            : activeTab === 'to-approve'
              ? toApprove
              : activeTab === 'in-use'
                ? myDevices
                : history;

    const emptyMessage: Record<TabKey, string> = {
        'to-confirm': 'Không có biên bản nào chờ bạn xác nhận',
        'in-use': 'Bạn chưa được bàn giao thiết bị nào',
        history: 'Chưa có lịch sử bàn giao',
        'to-approve': 'Không có biên bản nào chờ bạn phê duyệt',
    };

    const needsReason =
        pendingAction?.type === 'receiver-reject' || pendingAction?.type === 'manager-reject';

    const submitAction = async () => {
        if (!pendingAction) return;
        if (needsReason && !reason.trim()) {
            Alert.alert('Thiếu thông tin', 'Vui lòng nhập lý do từ chối.');
            return;
        }
        setSubmitting(true);
        try {
            const id = pendingAction.record.name;
            if (pendingAction.type === 'confirm') {
                await deviceService.confirmHandover(id);
            } else if (pendingAction.type === 'approve') {
                await deviceService.approveHandover(id);
            } else if (pendingAction.type === 'receiver-reject') {
                await deviceService.rejectHandoverAsReceiver(id, reason.trim());
            } else {
                await deviceService.rejectHandoverAsManager(id, reason.trim());
            }
            setPendingAction(null);
            setReason('');
            await fetchData();
        } catch (error) {
            console.error('Error submitting handover action:', error);
            Alert.alert('Lỗi', 'Không thực hiện được thao tác. Vui lòng thử lại.');
        } finally {
            setSubmitting(false);
        }
    };

    const openDocument = async (record: HandoverRecord) => {
        if (!record.documentFileUrl) return;
        const url = record.documentFileUrl.startsWith('http')
            ? record.documentFileUrl
            : `${BASE_URL}${record.documentFileUrl}`;
        try {
            const canOpen = await Linking.canOpenURL(url);
            if (canOpen) {
                await Linking.openURL(url);
            } else {
                Alert.alert('Không thể mở file', 'Vui lòng mở biên bản trên máy tính.');
            }
        } catch (error) {
            console.error('Error opening handover document:', error);
            Alert.alert('Lỗi', 'Không mở được biên bản. Vui lòng thử lại sau.');
        }
    };

    const renderRecord = (record: HandoverRecord) => {
        const badge = record.signingStatus ? SIGNING_LABELS[record.signingStatus] : null;
        const highlighted = record.name === focusHandoverId;
        const specs = record.device.specs || {};
        const specText = [specs.processor, specs.ram, specs.storage].filter(Boolean).join(' · ');

        return (
            <View
                key={record.name}
                className={`bg-white rounded-xl p-4 mb-4 border ${
                    highlighted ? 'border-[#002855]' : 'border-gray-200'
                }`}
            >
                <View className="flex-row items-start justify-between mb-2">
                    <View className="flex-1 mr-2">
                        <Text className="text-base font-semibold text-[#002855]">
                            {record.device.name || '—'}
                        </Text>
                        <Text className="text-sm text-gray-600 mt-0.5">
                            {DEVICE_TYPE_LABELS[record.device.deviceType] || record.device.deviceType}
                            {record.device.serial ? ` · ${record.device.serial}` : ''}
                        </Text>
                        {specText ? (
                            <Text className="text-sm text-gray-500 mt-0.5">{specText}</Text>
                        ) : null}
                    </View>
                    {badge ? (
                        <View className={`px-2 py-1 rounded-full ${badge.bg}`}>
                            <Text className="text-xs text-white font-bold">{badge.text}</Text>
                        </View>
                    ) : null}
                </View>

                <View className="border-t border-gray-200 pt-2">
                    <Text className="text-sm text-gray-600">
                        Người bàn giao:{' '}
                        {normalizeVietnameseName(record.assignedBy?.fullname) || 'Không xác định'}
                    </Text>
                    <Text className="text-sm text-gray-600 mt-0.5">
                        Ngày bàn giao: {formatDateTime(record.startDate)}
                    </Text>
                    {record.receiverConfirmedOn ? (
                        <Text className="text-sm text-gray-600 mt-0.5">
                            Người nhận xác nhận: {formatDateTime(record.receiverConfirmedOn)}
                        </Text>
                    ) : null}
                    {record.managerApprovedOn ? (
                        <Text className="text-sm text-gray-600 mt-0.5">
                            Phê duyệt: {normalizeVietnameseName(record.approvedBy?.fullname) || '—'} ·{' '}
                            {formatDateTime(record.managerApprovedOn)}
                        </Text>
                    ) : null}
                    {record.signingStatus === 'pending_manager' ? (
                        <Text className="text-sm text-gray-600 mt-0.5">
                            {record.pendingApprovers?.length
                                ? `Chờ duyệt bởi: ${record.pendingApprovers
                                      .map((u) => normalizeVietnameseName(u.fullname) || u.fullname)
                                      .join(', ')}`
                                : 'Chưa xác định được người duyệt — Phòng IT cần có Lãnh đạo khác người nhận trên Sơ đồ tổ chức.'}
                        </Text>
                    ) : null}
                    {record.notes ? (
                        <Text className="text-sm text-gray-600 mt-0.5">Ghi chú: {record.notes}</Text>
                    ) : null}
                    {record.receiverRejectReason || record.managerRejectReason ? (
                        <Text className="text-sm text-red-600 mt-0.5">
                            Lý do từ chối: {record.receiverRejectReason || record.managerRejectReason}
                        </Text>
                    ) : null}
                </View>

                <View className="flex-row flex-wrap items-center mt-3">
                    {record.canConfirm ? (
                        <>
                            <TouchableOpacity
                                onPress={() => setPendingAction({ record, type: 'confirm' })}
                                className="bg-[#002855] px-4 py-2 rounded-lg mr-2 mb-2"
                            >
                                <Text className="text-white text-sm font-semibold">Xác nhận đã nhận</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => setPendingAction({ record, type: 'receiver-reject' })}
                                className="border border-red-500 px-4 py-2 rounded-lg mr-2 mb-2"
                            >
                                <Text className="text-red-500 text-sm font-semibold">Từ chối</Text>
                            </TouchableOpacity>
                        </>
                    ) : null}
                    {record.canApprove ? (
                        <>
                            <TouchableOpacity
                                onPress={() => setPendingAction({ record, type: 'approve' })}
                                className="bg-[#002855] px-4 py-2 rounded-lg mr-2 mb-2"
                            >
                                <Text className="text-white text-sm font-semibold">Phê duyệt</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => setPendingAction({ record, type: 'manager-reject' })}
                                className="border border-red-500 px-4 py-2 rounded-lg mr-2 mb-2"
                            >
                                <Text className="text-red-500 text-sm font-semibold">Từ chối</Text>
                            </TouchableOpacity>
                        </>
                    ) : null}
                    {record.documentFileUrl ? (
                        <TouchableOpacity
                            onPress={() => void openDocument(record)}
                            className="flex-row items-center mr-2 mb-2"
                        >
                            <MaterialCommunityIcons
                                name="file-document-outline"
                                size={16}
                                color="#002855"
                            />
                            <Text className="ml-1 text-sm text-[#002855] underline">Xem biên bản</Text>
                        </TouchableOpacity>
                    ) : null}
                </View>
            </View>
        );
    };

    if (loading) {
        return (
            <SafeAreaView
                className="flex-1 bg-white"
                style={{ paddingTop: Platform.OS === 'android' ? insets.top : 0 }}
            >
                <View className="flex-1 items-center justify-center">
                    <ActivityIndicator size="large" color="#002855" />
                    <Text className="text-base text-[#002855] mt-3">Đang tải...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView
            className="flex-1 bg-white"
            style={{ paddingTop: Platform.OS === 'android' ? insets.top : 0 }}
        >
            <View className="flex-row items-center justify-between px-5 py-4 bg-white">
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    className="w-10 h-10 items-center justify-center"
                >
                    <MaterialCommunityIcons name="arrow-left" size={24} color="#002855" />
                </TouchableOpacity>
                <View className="flex-1 mr-10">
                    <Text className="text-xl font-bold text-primary text-center">Tài sản của tôi</Text>
                </View>
            </View>

            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                className="flex-grow-0 px-5"
                contentContainerStyle={{ paddingBottom: 12 }}
            >
                {tabs.map((item) => {
                    const isActive = item.key === activeTab;
                    return (
                        <TouchableOpacity
                            key={item.key}
                            onPress={() => {
                                // Bỏ ghim deep link khi người dùng tự chọn tab khác
                                if (focusHandoverId) navigation.setParams({ handoverId: undefined });
                                setTab(item.key);
                            }}
                            className={`px-4 py-2 rounded-full mr-2 ${
                                isActive ? 'bg-[#002855]' : 'bg-gray-100'
                            }`}
                        >
                            <Text
                                className={`text-sm font-semibold ${
                                    isActive ? 'text-white' : 'text-gray-600'
                                }`}
                            >
                                {item.label}
                                {item.count ? ` (${item.count})` : ''}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>

            <ScrollView
                className="flex-1"
                contentContainerStyle={{ padding: 20, paddingTop: 8 }}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={handleRefresh}
                        colors={['#002855']}
                        tintColor="#002855"
                    />
                }
            >
                {records.length === 0 ? (
                    <View className="items-center justify-center py-16">
                        <MaterialCommunityIcons name="laptop" size={48} color="#9CA3AF" />
                        <Text className="text-base text-gray-500 mt-3 text-center">
                            {emptyMessage[activeTab]}
                        </Text>
                    </View>
                ) : (
                    records.map(renderRecord)
                )}
            </ScrollView>

            <Modal
                visible={Boolean(pendingAction)}
                transparent
                animationType="fade"
                onRequestClose={() => setPendingAction(null)}
            >
                <View className="flex-1 bg-black/50 items-center justify-center px-6">
                    <View className="bg-white rounded-2xl p-5 w-full">
                        <Text className="text-lg font-bold text-[#002855] mb-1">
                            {pendingAction?.type === 'confirm'
                                ? 'Xác nhận đã nhận thiết bị'
                                : pendingAction?.type === 'approve'
                                  ? 'Phê duyệt biên bản bàn giao'
                                  : 'Từ chối biên bản'}
                        </Text>
                        <Text className="text-sm text-gray-600 mb-3">
                            {pendingAction?.record.device.name}
                            {pendingAction?.record.device.serial
                                ? ` · ${pendingAction.record.device.serial}`
                                : ''}
                        </Text>

                        {pendingAction?.type === 'confirm' ? (
                            <Text className="text-sm text-gray-600 mb-3">
                                Khi xác nhận, bạn đồng ý đã nhận đúng thiết bị nêu trên và cam kết bảo
                                quản, sử dụng theo quy định. Xác nhận này thay cho chữ ký trên biên bản
                                giấy và được lưu vết kèm thời điểm, tài khoản của bạn.
                            </Text>
                        ) : null}

                        {needsReason ? (
                            <TextInput
                                value={reason}
                                onChangeText={setReason}
                                placeholder="Nhập lý do từ chối"
                                multiline
                                className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 mb-3"
                                style={{ minHeight: 80, textAlignVertical: 'top' }}
                            />
                        ) : null}

                        <View className="flex-row justify-end">
                            <TouchableOpacity
                                onPress={() => {
                                    setPendingAction(null);
                                    setReason('');
                                }}
                                className="px-4 py-2 rounded-lg mr-2"
                                disabled={submitting}
                            >
                                <Text className="text-sm text-gray-600 font-semibold">Huỷ</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => void submitAction()}
                                className={`px-4 py-2 rounded-lg ${
                                    needsReason ? 'bg-red-500' : 'bg-[#002855]'
                                }`}
                                disabled={submitting}
                            >
                                {submitting ? (
                                    <ActivityIndicator size="small" color="#ffffff" />
                                ) : (
                                    <Text className="text-sm text-white font-semibold">
                                        {needsReason
                                            ? 'Từ chối'
                                            : pendingAction?.type === 'approve'
                                              ? 'Phê duyệt'
                                              : 'Xác nhận'}
                                    </Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
};

export default MyHandoversScreen;

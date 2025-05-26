import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    ActivityIndicator,
    Alert,
    TextInput,
    TouchableOpacity,
    Platform,
    ScrollView,
    Modal,
    Animated,
    Dimensions,
    TouchableWithoutFeedback,
} from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Picker } from '@react-native-picker/picker';
import { API_BASE_URL } from '../../../config/constants';
import DropDownPicker from 'react-native-dropdown-picker';
import Toast from 'react-native-toast-message';

interface TicketProcessingProps {
    ticketId: string;
    onRefresh: () => void;
}

interface SubTask {
    _id: string;
    status: string;
    title: string;
}

interface Ticket {
    _id: string;
    status: string;
    cancelReason?: string;
    subTasks: SubTask[];
    feedback?: {
        rating: number;
        comment: string;
        badges?: string[];
    };
}

interface StatusOption {
    label: string;
    value: string;
}

const { height } = Dimensions.get('window');

const getStatusLabel = (status: string) => {
    switch (status) {
        case 'Assigned':
            return 'Đã nhận';
        case 'Processing':
            return 'Đang xử lý';
        case 'Waiting for Customer':
            return 'Chờ phản hồi';
        case 'Done':
            return 'Hoàn thành';
        case 'Closed':
            return 'Đã đóng';
        case 'Cancelled':
            return 'Đã huỷ';
        default:
            return status;
    }
};

// Admin can only choose these statuses
const statusOptions = ['Processing', 'Done', 'Cancelled'];

const TicketProcessing: React.FC<TicketProcessingProps> = ({
    ticketId,
    onRefresh,
}) => {
    const [loading, setLoading] = useState(true);
    const [ticket, setTicket] = useState<Ticket | null>(null);
    const [ticketStatus, setTicketStatus] = useState<string>('Processing');
    const [subTasks, setSubTasks] = useState<SubTask[]>([]);
    const [showCancelReasonInput, setShowCancelReasonInput] = useState(false);
    const [cancelReason, setCancelReason] = useState('');
    const [open, setOpen] = useState(false);
    const [value, setValue] = useState(ticketStatus);
    const [showAddSubTask, setShowAddSubTask] = useState(false);
    const [newSubTaskTitle, setNewSubTaskTitle] = useState("");
    const [showStatusModal, setShowStatusModal] = useState(false);
    const [selectedSubTask, setSelectedSubTask] = useState<SubTask | null>(null);
    const [statusModalAnim] = useState(new Animated.Value(0));
    const [statusSlideAnim] = useState(new Animated.Value(height));

    /* -------------------------------------------------------------------------- */
    /*                               FETCH DETAILS                                */
    /* -------------------------------------------------------------------------- */
    useEffect(() => {
        fetchTicketDetails();
    }, [ticketId]);

    const fetchTicketDetails = async () => {
        try {
            setLoading(true);
            const token = await AsyncStorage.getItem('authToken');
            const res = await axios.get(`${API_BASE_URL}/api/tickets/${ticketId}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data: Ticket =
                res.data.success && res.data.ticket ? res.data.ticket : res.data;
            setTicket(data);
            setTicketStatus(normalizeStatus(data.status));
            setSubTasks(data.subTasks || []);
        } catch (err) {
            console.error('Lỗi khi lấy ticket:', err);
        } finally {
            setLoading(false);
        }
    };

    /* -------------------------------------------------------------------------- */
    /*                            STATUS UPDATE HANDLER                           */
    /* -------------------------------------------------------------------------- */
    const handleUpdateStatus = async (newStatus: string) => {
        if (newStatus === 'Done' && subTasks.some((t) => t.status === 'In Progress')) {
            Toast.show({ type: 'error', text1: 'Bạn cần xử lý hết các subtask trước khi hoàn thành.' });
            return;
        }
        if (newStatus === 'Cancelled' && !cancelReason.trim()) {
            setShowCancelReasonInput(true);
            return;
        }
        await updateStatusAPI(newStatus, newStatus === 'Cancelled' ? cancelReason : '');
    };

    const updateStatusAPI = async (newStatus: string, reason = '') => {
        try {
            const token = await AsyncStorage.getItem('authToken');
            const payload: any = { status: newStatus };
            if (newStatus === 'Cancelled' && reason) payload.cancelReason = reason;

            const res = await axios.put(
                `${API_BASE_URL}/api/tickets/${ticketId}`,
                payload,
                { headers: { Authorization: `Bearer ${token}` } },
            );

            // In log để debug
            console.log('API response:', res);
            const httpStatus = res.status;
            if (httpStatus && httpStatus >= 200 && httpStatus < 300) {
                Toast.show({ type: 'success', text1: 'Cập nhật trạng thái thành công!' });
                setTicketStatus(newStatus);
                fetchTicketDetails();
            } else {
                console.error('Lỗi cập nhật trạng thái:', res, res?.data);
                Toast.show({ type: 'error', text1: 'Không thể cập nhật trạng thái.' });
            }
        } catch (err: any) {
            // Luôn fetch lại ticket để kiểm tra trạng thái thực tế
            await fetchTicketDetails();
            // Sau khi fetch xong, kiểm tra ticketStatus mới nhất
            // (ticketStatus sẽ được cập nhật trong fetchTicketDetails)
            setTimeout(() => {
                if (ticketStatus === newStatus) {
                    Toast.show({ type: 'success', text1: 'Cập nhật trạng thái thành công!' });
                } else {
                    console.error('Lỗi cập nhật trạng thái:', err, err?.response?.data);
                    Toast.show({ type: 'error', text1: 'Không thể cập nhật trạng thái.' });
                }
            }, 500); // Đợi state cập nhật, có thể điều chỉnh thời gian nếu cần
        }
    };

    /* -------------------------------------------------------------------------- */
    /*                          CANCEL TICKET CONFIRMATION                        */
    /* -------------------------------------------------------------------------- */
    const confirmCancel = async () => {
        if (!cancelReason.trim()) {
            Toast.show({ type: 'info', text1: 'Vui lòng nhập lý do huỷ.' });
            return;
        }
        await updateStatusAPI('Cancelled', cancelReason.trim());
        setCancelReason('');
        setShowCancelReasonInput(false);
    };

    /* -------------------------------------------------------------------------- */
    /*                           HELPER – LABEL & COLOR                           */
    /* -------------------------------------------------------------------------- */
    const normalizeStatus = (status = '') => {
        const lower = status.toLowerCase();
        if (lower === 'processing' || lower === 'processing') return 'Processing';
        if (lower === 'done' || lower === 'completed') return 'Done';
        if (lower === 'cancelled') return 'Cancelled';
        if (lower === 'closed') return 'Closed';
        return status;
    };

    /* -------------------------------------------------------------------------- */
    /*                                   RENDER                                   */
    /* -------------------------------------------------------------------------- */
    useEffect(() => {
        setValue(ticketStatus);
    }, [ticketStatus]);

    // Mapping ticket status to pill background colors
    const statusColors: Record<string, string> = {
        Processing: '#FFAA00',       // vàng/hoạt động
        Done: '#4CAF50',             // xanh lá cây
        Cancelled: '#F44336',        // đỏ
        Closed: '#9E9E9E',           // ghi
    };
    const currentStatusColor = statusColors[ticketStatus] || '#FFFFFF';

    // Create dropdown items based on current status
    const getStatusItems = () => {
        // If ticket is closed, show all status options
        if (ticketStatus === 'Closed') {
            // Make sure to include current status in the dropdown
            return [
                { label: getStatusLabel('Closed'), value: 'Closed' },
                ...statusOptions.map(s => ({
                    label: getStatusLabel(s),
                    value: s,
                }))
            ];
        }
        // Otherwise, only show normal options
        return statusOptions.map(s => ({
            label: getStatusLabel(s),
            value: s,
        }));
    };

    // Hàm thêm subtask
    const handleAddSubTask = async () => {
        if (!newSubTaskTitle.trim()) {
            Toast.show({ type: 'info', text1: 'Tiêu đề subtask không được để trống.' });
            return;
        }
        try {
            // Lấy user hiện tại từ AsyncStorage
            const userStr = await AsyncStorage.getItem('user');
            let assignedTo = '';
            if (userStr) {
                const userObj = JSON.parse(userStr);
                assignedTo = userObj.fullname;
            }
            if (!assignedTo) {
                Toast.show({ type: 'error', text1: 'Không tìm thấy thông tin người dùng hiện tại.' });
                return;
            }
            const token = await AsyncStorage.getItem('authToken');
            const res = await axios.post(
                `${API_BASE_URL}/api/tickets/${ticketId}/subtasks`,
                {
                    title: newSubTaskTitle,
                    assignedTo: assignedTo,
                    status: "In Progress",
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            if (res.data.success) {
                Toast.show({ type: 'success', text1: 'Thêm subtask thành công!' });
                const updated = res.data.ticket;
                setTicket(updated);
                setNewSubTaskTitle("");
                setShowAddSubTask(false);
            }
        } catch (error) {
            Toast.show({ type: 'error', text1: 'Lỗi thêm subtask.' });
        }
    };

    const handleUpdateSubTaskStatus = async (subTaskId: string, newStatus: string) => {
        try {
            const token = await AsyncStorage.getItem('authToken');
            const res = await axios.put(
                `${API_BASE_URL}/api/tickets/${ticketId}/subtasks/${subTaskId}`,
                { status: newStatus },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            if (res.data.success) {
                Toast.show({ type: 'success', text1: 'Cập nhật subtask thành công!' });
                setTicket((prev) => {
                    if (!prev) return prev;
                    return {
                        ...prev,
                        subTasks: prev.subTasks.map((task) =>
                            task._id === subTaskId ? { ...task, status: newStatus } : task
                        ),
                    };
                });
                fetchTicketDetails();
            }
        } catch (error) {
            Toast.show({ type: 'error', text1: 'Lỗi cập nhật subtask.' });
        }
    };

    // Modal animation effects
    useEffect(() => {
        if (showStatusModal) {
            Animated.parallel([
                Animated.timing(statusModalAnim, {
                    toValue: 1,
                    duration: 200,
                    useNativeDriver: true,
                }),
                Animated.spring(statusSlideAnim, {
                    toValue: 0,
                    tension: 50,
                    friction: 8,
                    useNativeDriver: true,
                })
            ]).start();
        } else {
            Animated.parallel([
                Animated.timing(statusModalAnim, {
                    toValue: 0,
                    duration: 200,
                    useNativeDriver: true,
                }),
                Animated.timing(statusSlideAnim, {
                    toValue: height,
                    duration: 200,
                    useNativeDriver: true,
                })
            ]).start();
        }
    }, [showStatusModal]);

    // Open status selection modal
    const openStatusModal = (subTask: SubTask) => {
        if (ticketStatus === 'Cancelled' || ticketStatus === 'Closed') return;
        setSelectedSubTask(subTask);
        setShowStatusModal(true);
    };

    // Close status modal
    const closeStatusModal = () => {
        setShowStatusModal(false);
        setSelectedSubTask(null);
    };

    // Handle status selection
    const handleStatusSelect = (status: StatusOption) => {
        if (selectedSubTask) {
            handleUpdateSubTaskStatus(selectedSubTask._id, status.value);
            closeStatusModal();
        }
    };

    // Get status options for subtask
    const getSubTaskStatusOptions = (): StatusOption[] => {
        if (!selectedSubTask) return [];
        
        const inProgressTasks = ticket?.subTasks.filter(t => t.status === "In Progress") || [];
        const isFirstInProgress = inProgressTasks.length > 0 && inProgressTasks[0]._id === selectedSubTask._id;
        
        return [
            { 
                label: isFirstInProgress ? 'Đang xử lý' : 'Chờ xử lý', 
                value: 'In Progress' 
            },
            { 
                label: 'Hoàn thành', 
                value: 'Completed' 
            },
            { 
                label: 'Huỷ', 
                value: 'Cancelled' 
            }
        ];
    };

    // Function to render feedback if ticket is closed
    const renderFeedback = () => {
        if (ticketStatus !== 'Closed' || !ticket?.feedback) return null;

        return (
            <View className="bg-[#f8f8f8] p-4 rounded-2xl mt-4">
                {/* Title */}
                <View className="flex-row items-center gap-4">
                    <Text className="text-primary font-semibold text-lg mb-3">Phản hồi</Text>

                    {/* Star Rating */}
                    <View className="flex-row mb-3">
                        {[1, 2, 3, 4, 5].map(i => (
                            <Text
                                key={i}
                                style={{
                                    fontSize: 30,
                                    color: i <= ticket.feedback.rating ? '#FFD700' : '#E0E0E0',
                                    marginRight: 4,
                                }}
                            >
                                ★
                            </Text>
                        ))}
                    </View>
                </View>

                {/* Badges (if any) */}
                {ticket.feedback.badges && ticket.feedback.badges.length > 0 && (
                    <View className="flex-row flex-wrap mb-3">
                        {ticket.feedback.badges.map(badge => (
                            <View
                                key={badge}
                                style={{
                                    backgroundColor: '#FFEBCC',
                                    borderRadius: 20,
                                    paddingHorizontal: 12,
                                    paddingVertical: 4,
                                    marginRight: 8,
                                    marginBottom: 8,
                                }}
                            >
                                <Text style={{ color: '#FFAA00', fontFamily: 'Mulish-Bold' }}>
                                    {badge}
                                </Text>
                            </View>
                        ))}
                    </View>
                )}

                {/* Comment Box */}
                <View
                    style={{
                        borderWidth: 1,
                        borderColor: '#D1D5DB',
                        borderRadius: 12,
                        padding: 12,
                        minHeight: 150,
                    }}
                >
                    <Text style={{ color: '#374151', fontSize: 16, lineHeight: 24 }}>
                        {ticket.feedback.comment}
                    </Text>
                </View>
            </View>
        );
    };

    if (loading) {
        return (
            <View className="flex-1 justify-center items-center">
                <ActivityIndicator size="large" color="#002855" />
            </View>
        );
    }

    return (
        <View className="flex-1 bg-white p-4">
            {/* STATUS BAR */}
            <View className="h-[20%] flex-col items-start justify-center p-4 gap-4 bg-[#f8f8f8] mt-4 rounded-2xl mb-2">
                <Text className="font-semibold text-lg mr-2">Trạng thái:</Text>
                <View style={{ zIndex: 1000, flex: 1 }}>
                    <DropDownPicker
                        open={open}
                        value={value}
                        items={getStatusItems()}
                        setOpen={setOpen}
                        setValue={(callback) => {
                            const newValue = callback(value);
                            if (newValue !== ticketStatus) handleUpdateStatus(newValue);
                            setValue(newValue);
                        }}
                        disabled={loading || ticketStatus === 'Closed'}
                        placeholder="Chọn trạng thái"
                        style={{
                            borderWidth: 0,
                            backgroundColor: '#fff',
                            borderRadius: 25,
                            height: 50,
                            justifyContent: 'center',
                            paddingHorizontal: 16,
                        }}
                        dropDownContainerStyle={{
                            borderWidth: 0,
                            backgroundColor: '#f9f9f9',
                            borderRadius: 25,
                            paddingHorizontal: 0,
                        }}
                        listItemContainerStyle={{
                            backgroundColor: '#fff',
                            paddingVertical: 5,
                        }}
                        listItemLabelStyle={{
                            fontFamily: 'Mulish-SemiBold',
                            fontSize: 16,
                            color: '#222222',
                        }}
                        textStyle={{
                            fontSize: 16,
                            color: currentStatusColor,
                            fontFamily: 'Mulish-SemiBold',
                            fontWeight: '600',
                        }}
                        labelStyle={{
                            fontFamily: 'Mulish-SemiBold',
                            fontWeight: '700',
                        }}
                        placeholderStyle={{
                            fontFamily: 'Mulish-SemiBold',
                            fontSize: 16,
                            color: '#9E9E9E',
                            fontWeight: '600',
                        }}
                        selectedItemLabelStyle={{
                            fontFamily: 'Muslish-SemiBold',
                            fontSize: 16,
                            color: '#002855',
                            fontWeight: '600',
                        }}
                    />
                </View>
            </View>

            {/* CANCEL REASON INPUT */}
            {showCancelReasonInput && (
                <View className=" p-4 rounded-lg">
                    <Text className="font-medium mb-2">Lý do huỷ ticket:</Text>
                    <TextInput
                        value={cancelReason}
                        onChangeText={setCancelReason}
                        placeholder="Nhập lý do huỷ..."
                        className="bg-[#f8f8f8] p-3 rounded-lg font-medium mb-2"
                        multiline
                    />
                    <View className="flex-row justify-end">
                        <TouchableOpacity
                            onPress={() => {
                                setCancelReason('');
                                setShowCancelReasonInput(false);
                            }}
                            className="bg-gray-200 px-4 py-2 rounded-lg mr-2">
                            <Text className="font-medium">Huỷ bỏ</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={confirmCancel}
                            className="bg-red-500 px-4 py-2 rounded-lg">
                            <Text className="font-medium text-white">Xác nhận</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            )}

            {/* HIỂN THỊ LÝ DO HUỶ (NẾU CÓ) */}
            {ticketStatus === 'Cancelled' && ticket?.cancelReason && (
                <View className="bg-red-100 p-4 rounded-lg mt-4">
                    <Text className="font-bold text-red-600">Lý do huỷ ticket:</Text>
                    <Text className="text-red-600 font-medium">{ticket.cancelReason}</Text>
                </View>
            )}

            {/* HIỂN THỊ FEEDBACK NẾU TRẠNG THÁI LÀ CLOSED */}
            {renderFeedback()}

            {/* SUBTASKS OR COMPLETION BANNER */}
            {ticketStatus !== 'Closed' && (
                ticketStatus === 'Done' ? (
                    <View className="mt-2 mb-2 bg-[#f3f4f6] rounded-2xl p-4">
                        <Text className="text-center text-gray-600" style={{ fontSize: 16, lineHeight: 24 }}>
                            Vui lòng thông báo tới người dùng kiểm tra kết quả và chất lượng phục vụ
                        </Text>
                    </View>
                ) : (
                    <View className="mt-6 mb-2 bg-[#f8f8f8] rounded-2xl p-4">
                        <View className="flex-row items-center justify-between mb-2">
                            <Text className="font-semibold text-lg">Danh sách công việc</Text>
                            <TouchableOpacity
                                onPress={() => setShowAddSubTask(true)}
                                className=" px-4  rounded-lg">
                                <Text className="text-primary text-3xl font-medium">+</Text>
                            </TouchableOpacity>
                        </View>
                        {showAddSubTask && (
                            <View className="flex-row items-center mb-3">
                                <TextInput
                                    value={newSubTaskTitle}
                                    onChangeText={setNewSubTaskTitle}
                                    placeholder="Nhập việc cần làm"
                                        className="flex-1 bg-[#ebebeb] p-3 rounded-lg mr-2"
                                    />
                                    <TouchableOpacity
                                        onPress={handleAddSubTask}
                                        className="bg-[#009483] px-3 py-2 rounded-lg mr-2">
                                        <Text className="text-white font-medium">Thêm</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={() => {
                                            setShowAddSubTask(false);
                                            setNewSubTaskTitle("");
                                        }}
                                        className="bg-gray-400 px-3 py-2 rounded-lg">
                                        <Text className="text-white font-medium">Huỷ</Text>
                                    </TouchableOpacity>
                                </View>
                            )}

                            {/* HIỂN THỊ SUBTASK */}
                            {ticket && ticket.subTasks && ticket.subTasks.length > 0 ? (
                                ticket.subTasks.map((task) => {
                                    // Xác định subtask đầu tiên "In Progress"
                                    const inProgressTasks = ticket.subTasks.filter(
                                        (t) => t.status === "In Progress"
                                    );
                                    const isFirstInProgress =
                                        inProgressTasks.length > 0 &&
                                        inProgressTasks[0]._id === task._id;

                                    // Xác định style dựa trên trạng thái
                                    let containerStyle = { marginBottom: 10, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 12 };
                                    let textColor = '#222';
                                    let bgColor = '#fff';
                                    let textDecorationLine: 'none' | 'line-through' = 'none';
                                    if (task.status === "Completed") {
                                        bgColor = '#E4EFE6';
                                        textColor = '#009483';
                                    } else if (task.status === "Cancelled") {
                                        bgColor = '#EBEBEB';
                                        textColor = '#757575';
                                        textDecorationLine = 'line-through';
                                    } else if (task.status === "In Progress") {
                                        if (isFirstInProgress) {
                                            bgColor = '#E6EEF6';
                                            textColor = '#002855';
                                        } else {
                                            bgColor = '#EBEBEB';
                                            textColor = '#757575';
                                        }
                                    }

                                    // Hàm mở modal chọn trạng thái
                                    const showStatusActionSheet = () => {
                                        openStatusModal(task);
                                    };

                                    return (
                                        <TouchableOpacity
                                            key={task._id}
                                            onPress={showStatusActionSheet}
                                            disabled={ticketStatus === 'Cancelled' || ticketStatus === 'Closed'}
                                            style={[containerStyle, { backgroundColor: bgColor, opacity: (ticketStatus === 'Cancelled' || ticketStatus === 'Closed') ? 0.5 : 1 }]}
                                        >
                                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <Text className="font-semibold text-lg" style={{ color: textColor, textDecorationLine }}>{task.title}</Text>
                                                <Text className="font-semibold text-lg" style={{ color: textColor }}>{task.status === 'In Progress'
                                                    ? (isFirstInProgress ? 'Đang xử lý' : 'Chờ xử lý')
                                                    : task.status === 'Completed'
                                                        ? 'Hoàn thành'
                                                        : 'Đã huỷ'}</Text>
                                            </View>
                                        </TouchableOpacity>
                                    );
                                })
                            ) : (
                                <Text className="text-center text-sm text-gray-500 font-medium">Không có subtask</Text>
                            )}
                        </View>
                    )
            )}

            {/* Status Selection Modal */}
            <Modal
                visible={showStatusModal}
                transparent
                animationType="none"
                statusBarTranslucent
            >
                <TouchableWithoutFeedback onPress={closeStatusModal}>
                    <Animated.View
                        className="flex-1 bg-black/40 justify-center items-center"
                        style={{ opacity: statusModalAnim }}
                    >
                        <TouchableWithoutFeedback>
                            <Animated.View
                                className="w-[80%] bg-white rounded-[14px] overflow-hidden"
                                style={{
                                    transform: [{
                                        translateY: statusSlideAnim
                                    }]
                                }}
                            >
                                <View className="p-5">
                                    <Text className="text-lg font-semibold text-black text-center mb-2.5">
                                        Chọn trạng thái
                                    </Text>
                                    <View className="max-h-[200px]">
                                        {getSubTaskStatusOptions().map((option, index) => (
                                            <TouchableOpacity
                                                key={option.value}
                                                onPress={() => handleStatusSelect(option)}
                                                className="py-3"
                                            >
                                                <Text className="text-base text-[#333333] text-center">
                                                    {option.label}
                                                </Text>
                                                {index < getSubTaskStatusOptions().length - 1 && (
                                                    <View className="h-[0.5px] bg-[#E5E5E5] mt-3" />
                                                )}
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                    <View className="flex-row mt-2.5 -mx-5 border-t border-[#E5E5E5]">
                                        <TouchableOpacity
                                            className="flex-1 py-3 items-center justify-center bg-transparent"
                                            onPress={closeStatusModal}
                                        >
                                            <Text className="text-[17px] text-[#666666] font-medium">
                                                Hủy
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </Animated.View>
                        </TouchableWithoutFeedback>
                    </Animated.View>
                </TouchableWithoutFeedback>
            </Modal>
        </View>
    );
};

export default TicketProcessing;
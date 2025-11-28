import React, { useState, useEffect } from 'react';
// @ts-ignore
import {
  View,
  Text,
  ActivityIndicator,
  TextInput,
  TouchableOpacity,
  Animated,
  Dimensions,
} from 'react-native';
import {
  getTicketDetail,
  updateTicket,
  createSubTask,
  updateSubTaskStatus,
  type Ticket,
  type SubTask,
} from '../../../services/ticketService';
import Toast from 'react-native-toast-message';
import AsyncStorage from '@react-native-async-storage/async-storage';
import CustomLiquidActionSheet from '../../../../components/CustomLiquidActionSheet';

interface TicketProcessingProps {
  ticketId: string;
  ticketCode?: string;
  onRefresh: () => void;
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

const TicketProcessing: React.FC<TicketProcessingProps> = ({ ticketId, ticketCode, onRefresh }) => {
  const [loading, setLoading] = useState(true);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [ticketStatus, setTicketStatus] = useState<string>('Processing');
  const [subTasks, setSubTasks] = useState<SubTask[]>([]);
  const [showCancelReasonInput, setShowCancelReasonInput] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [open, setOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState(ticketStatus);
  const [showAddSubTask, setShowAddSubTask] = useState(false);
  const [newSubTaskTitle, setNewSubTaskTitle] = useState('');
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showTicketStatusSheet, setShowTicketStatusSheet] = useState(false);
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
      const data = await getTicketDetail(ticketId);
      if (data) {
        setTicket(data);
        setTicketStatus(normalizeStatus(data.status));
        setSubTasks(data.subTasks || []);
      }
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
      const payload: any = { status: newStatus };
      if (newStatus === 'Cancelled' && reason) payload.cancellationReason = reason;

      await updateTicket(ticketId, payload);

      Toast.show({ type: 'success', text1: 'Cập nhật trạng thái thành công!' });
      setTicketStatus(newStatus);
      fetchTicketDetails();
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
    setSelectedStatus(ticketStatus);
  }, [ticketStatus]);

  // Mapping ticket status to pill background colors
  const statusColors: Record<string, string> = {
    Processing: '#FFAA00', // vàng/hoạt động
    Done: '#4CAF50', // xanh lá cây
    Cancelled: '#F44336', // đỏ
    Closed: '#9E9E9E', // ghi
  };
  const currentStatusColor = statusColors[ticketStatus] || '#FFFFFF';

  // Create dropdown items based on current status
  const getStatusItems = () => {
    // If ticket is closed, show all status options
    if (ticketStatus === 'Closed') {
      // Make sure to include current status in the dropdown
      return [
        { label: getStatusLabel('Closed'), value: 'Closed' },
        ...statusOptions.map((s) => ({
          label: getStatusLabel(s),
          value: s,
        })),
      ];
    }
    // Otherwise, only show normal options
    return statusOptions.map((s) => ({
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
        assignedTo = userObj._id || userObj.email; // Sử dụng _id hoặc email làm assignedTo
      }
      if (!assignedTo) {
        Toast.show({ type: 'error', text1: 'Không tìm thấy thông tin người dùng hiện tại.' });
        return;
      }

      await createSubTask(ticketId, {
        title: newSubTaskTitle,
        assignedTo: assignedTo,
      });

      Toast.show({ type: 'success', text1: 'Thêm subtask thành công!' });
      setNewSubTaskTitle('');
      setShowAddSubTask(false);
      fetchTicketDetails(); // Refresh ticket data
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Lỗi thêm subtask.' });
    }
  };

  const handleUpdateSubTaskStatus = async (subTaskId: string, newStatus: string) => {
    try {
      await updateSubTaskStatus(ticketId, subTaskId, newStatus);

      Toast.show({ type: 'success', text1: 'Cập nhật subtask thành công!' });
      fetchTicketDetails(); // Refresh data from server
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
        }),
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
        }),
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

    const inProgressTasks = ticket?.subTasks.filter((t) => t.status === 'In Progress') || [];
    const isFirstInProgress =
      inProgressTasks.length > 0 && inProgressTasks[0]._id === selectedSubTask._id;

    return [
      {
        label: isFirstInProgress ? 'Đang xử lý' : 'Chờ xử lý',
        value: 'In Progress',
      },
      {
        label: 'Hoàn thành',
        value: 'Completed',
      },
      {
        label: 'Huỷ ',
        value: 'Cancelled',
      },
    ];
  };

  // Function to render feedback if ticket is closed
  const renderFeedback = () => {
    if (ticketStatus !== 'Closed' || !ticket?.feedback) return null;

    return (
      <View className="mt-4 rounded-2xl bg-[#f8f8f8] p-4">
        {/* Title */}
        <View className="flex-row items-center gap-4">
          <Text className="mb-3 font-semibold text-lg text-primary">Phản hồi</Text>

          {/* Star Rating */}
          <View className="mb-3 flex-row">
            {[1, 2, 3, 4, 5].map((i) => (
              <Text
                key={i}
                style={{
                  fontSize: 30,
                  color: i <= ticket.feedback.rating ? '#FFD700' : '#E0E0E0',
                  marginRight: 4,
                }}>
                ★
              </Text>
            ))}
          </View>
        </View>

        {/* Badges (if any) */}
        {ticket.feedback.badges && ticket.feedback.badges.length > 0 && (
          <View className="mb-3 flex-row flex-wrap">
            {ticket.feedback.badges.map((badge) => (
              <View
                key={badge}
                style={{
                  backgroundColor: '#FFEBCC',
                  borderRadius: 20,
                  paddingHorizontal: 12,
                  paddingVertical: 4,
                  marginRight: 8,
                  marginBottom: 8,
                }}>
                <Text style={{ color: '#FFAA00', fontFamily: 'Mulish-Bold' }}>{badge}</Text>
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
          }}>
          <Text style={{ color: '#374151', fontSize: 16, lineHeight: 24 }}>
            {ticket.feedback.comment}
          </Text>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color="#002855" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white p-4">
      {/* STATUS BAR */}
      <View
        className="mb-2 mt-4 h-auto flex-col items-start justify-center gap-4 rounded-2xl bg-[#f8f8f8] p-4"
        style={{ position: 'relative', zIndex: 1 }}>
        <Text className="mr-2 font-semibold text-lg">Trạng thái:</Text>
        <View style={{ width: '100%' }}>
          <TouchableOpacity
            onPress={() => setShowTicketStatusSheet(true)}
            style={{
              backgroundColor: '#fff',
              borderRadius: 25,
              height: 50,
              justifyContent: 'center',
              paddingHorizontal: 16,
            }}>
            <Text style={{ fontSize: 16 }}>{getStatusLabel(selectedStatus)}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* CANCEL REASON INPUT */}
      {showCancelReasonInput && (
        <View className=" rounded-lg p-4">
          <Text className="mb-2 font-medium">Lý do huỷ ticket:</Text>
          <TextInput
            value={cancelReason}
            onChangeText={setCancelReason}
            placeholder="Nhập lý do huỷ..."
            className="mb-2 rounded-lg bg-[#f8f8f8] p-3 font-medium"
            multiline
          />
          <View className="flex-row justify-end">
            <TouchableOpacity
              onPress={() => {
                setCancelReason('');
                setShowCancelReasonInput(false);
              }}
              className="mr-2 rounded-lg bg-gray-200 px-4 py-2">
              <Text className="font-medium">Huỷ bỏ</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={confirmCancel} className="rounded-lg bg-red-500 px-4 py-2">
              <Text className="font-medium text-white">Xác nhận</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* HIỂN THỊ LÝ DO HUỶ (NẾU CÓ) */}
      {ticketStatus === 'Cancelled' && ticket?.cancellationReason && (
        <View className="mt-4 rounded-lg bg-red-100 p-4">
          <Text className="font-bold text-red-600">Lý do huỷ ticket:</Text>
          <Text className="font-medium text-red-600">{ticket.cancellationReason}</Text>
        </View>
      )}

      {/* HIỂN THỊ FEEDBACK NẾU TRẠNG THÁI LÀ CLOSED */}
      {renderFeedback()}

      {/* SUBTASKS OR COMPLETION BANNER */}
      {ticketStatus !== 'Closed' &&
        (ticketStatus === 'Done' ? (
          <View className="mb-2 mt-2 rounded-2xl bg-[#f3f4f6] p-4">
            <Text className="text-center text-gray-600" style={{ fontSize: 16, lineHeight: 24 }}>
              Vui lòng thông báo tới người dùng kiểm tra kết quả và chất lượng phục vụ
            </Text>
          </View>
        ) : (
          <View className="mb-2 mt-6 rounded-2xl bg-[#f8f8f8] p-4">
            <View className="mb-2 flex-row items-center justify-between">
              <Text className="font-semibold text-lg">Danh sách công việc</Text>
              <TouchableOpacity
                onPress={() => setShowAddSubTask(true)}
                className=" rounded-lg  px-4">
                <Text className="font-medium text-3xl text-primary">+</Text>
              </TouchableOpacity>
            </View>
            {showAddSubTask && (
              <View className="mb-3 flex-row items-center">
                <TextInput
                  value={newSubTaskTitle}
                  onChangeText={setNewSubTaskTitle}
                  placeholder="Nhập việc cần làm"
                  className="mr-2 flex-1 rounded-lg bg-[#ebebeb] p-3"
                />
                <TouchableOpacity
                  onPress={handleAddSubTask}
                  className="mr-2 rounded-lg bg-[#009483] px-3 py-2">
                  <Text className="font-medium text-white">Thêm</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    setShowAddSubTask(false);
                    setNewSubTaskTitle('');
                  }}
                  className="rounded-lg bg-gray-400 px-3 py-2">
                  <Text className="font-medium text-white">Huỷ</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* HIỂN THỊ SUBTASK */}
            {ticket && ticket.subTasks && ticket.subTasks.length > 0 ? (
              ticket.subTasks.map((task) => {
                // Xác định subtask đầu tiên "In Progress"
                const inProgressTasks = ticket.subTasks.filter((t) => t.status === 'In Progress');
                const isFirstInProgress =
                  inProgressTasks.length > 0 && inProgressTasks[0]._id === task._id;

                // Xác định style dựa trên trạng thái
                let containerStyle = {
                  marginBottom: 10,
                  borderRadius: 20,
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                };
                let textColor = '#222';
                let bgColor = '#fff';
                let textDecorationLine: 'none' | 'line-through' = 'none';
                if (task.status === 'Completed') {
                  bgColor = '#E4EFE6';
                  textColor = '#009483';
                } else if (task.status === 'Cancelled') {
                  bgColor = '#EBEBEB';
                  textColor = '#757575';
                  textDecorationLine = 'line-through';
                } else if (task.status === 'In Progress') {
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
                    style={[
                      containerStyle,
                      {
                        backgroundColor: bgColor,
                        opacity:
                          ticketStatus === 'Cancelled' || ticketStatus === 'Closed' ? 0.5 : 1,
                      },
                    ]}>
                    <View
                      style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}>
                      <Text
                        className="font-semibold text-lg"
                        style={{ color: textColor, textDecorationLine }}>
                        {task.title}
                      </Text>
                      <Text className="font-semibold text-lg" style={{ color: textColor }}>
                        {task.status === 'In Progress'
                          ? isFirstInProgress
                            ? 'Đang xử lý'
                            : 'Chờ xử lý'
                          : task.status === 'Completed'
                            ? 'Hoàn thành'
                            : 'Đã huỷ'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })
            ) : (
              <Text className="text-center font-medium text-sm text-gray-500">
                Không có subtask
              </Text>
            )}
          </View>
        ))}

      {/* Status Selection Modal */}
      <CustomLiquidActionSheet
        visible={showTicketStatusSheet}
        options={getStatusItems()}
        onSelect={(value) => {
          handleUpdateStatus(value);
          setSelectedStatus(value);
          setShowTicketStatusSheet(false);
        }}
        onCancel={() => setShowTicketStatusSheet(false)}
      />
    </View>
  );
};

export default TicketProcessing;

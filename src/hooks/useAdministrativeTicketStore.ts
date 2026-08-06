import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';
import type {
  AdministrativeTicket,
  AdminTicketMessage,
  AdminSubTask,
  AdministrativeSupportMember,
  AdminFeedbackData,
} from '../services/administrativeTicketService';
import {
  getAdminTicketDetail,
  getAdminSubTasks,
  updateAdminTicket,
  assignAdminTicketToMe,
  assignAdminTicketToUser,
  cancelAdminTicket,
  acceptAdminFeedback,
  createAdminSubTask,
  updateAdminSubTaskStatus,
  updateAdminSubTask,
  deleteAdminSubTask,
  getAdministrativeSupportTeamMembers,
  getAdminTicketMessages,
} from '../services/administrativeTicketService';

/** Trạng thái chọn trên UI (khớp ADMIN_TICKET_STAFF_STATUS_OPTIONS + Cancel flow) */
export type AdministrativeTicketStatusUi = 'In Progress' | 'Done' | 'Cancelled';

export type AdministrativeSubTaskStatusUi = 'In Progress' | 'Completed' | 'Cancelled';

interface AdministrativeTicketUIState {
  showCancelModal: boolean;
  showAssignModal: boolean;
  showConfirmAssignModal: boolean;
  showSubTaskStatusModal: boolean;
  showSubTaskAssignModal: boolean;
  showTicketStatusSheet: boolean;
  showCompleteModal: boolean;
  cancelReason: string;
  selectedSubTask: AdminSubTask | null;
  pendingStatus: AdministrativeTicketStatusUi | '';
  feedbackRating: number;
  feedbackComment: string;
  feedbackBadges: string[];
}

interface AdministrativeTicketStore {
  currentTicketId: string | null;
  ticket: AdministrativeTicket | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;

  messages: AdminTicketMessage[];
  messagesLoading: boolean;
  messagesError: string | null;

  supportTeamMembers: AdministrativeSupportMember[];
  supportTeamLoading: boolean;

  actionLoading: boolean;
  /** Message lỗi THẬT của hành động vừa chạy (do backend trả) — UI hiện thay câu chung chung. */
  actionError: string | null;
  ui: AdministrativeTicketUIState;

  fetchTicket: (ticketId: string) => Promise<void>;
  fetchMessages: (ticketId: string) => Promise<void>;
  fetchSupportTeam: () => Promise<void>;
  refreshTicket: () => Promise<void>;

  assignToMe: () => Promise<boolean>;
  assignToUser: (userId: string, userName?: string) => Promise<boolean>;
  cancelTicket: (reason: string) => Promise<boolean>;
  completeTicket: (feedback: AdminFeedbackData) => Promise<boolean>;
  updateStatus: (status: AdministrativeTicketStatusUi) => Promise<boolean>;

  addSubTask: (title: string, assignedTo?: string) => Promise<boolean>;
  updateSubTaskStatus: (
    subTaskId: string,
    status: AdministrativeSubTaskStatusUi
  ) => Promise<boolean>;
  updateSubTaskAssignee: (subTaskId: string, assignedTo: string) => Promise<boolean>;
  deleteSubTask: (subTaskId: string) => Promise<boolean>;

  addMessage: (message: AdminTicketMessage) => void;

  setUI: (updates: Partial<AdministrativeTicketUIState>) => void;
  openCancelModal: () => void;
  closeCancelModal: () => void;
  openAssignModal: () => void;
  closeAssignModal: () => void;
  openConfirmAssignModal: () => void;
  closeConfirmAssignModal: () => void;
  openSubTaskStatusModal: (subTask: AdminSubTask) => void;
  closeSubTaskStatusModal: () => void;
  openSubTaskAssignModal: (subTask: AdminSubTask) => void;
  closeSubTaskAssignModal: () => void;
  openTicketStatusSheet: () => void;
  closeTicketStatusSheet: () => void;
  setCancelReason: (reason: string) => void;
  openCompleteModal: () => void;
  closeCompleteModal: () => void;
  setFeedbackRating: (rating: number) => void;
  setFeedbackComment: (comment: string) => void;
  setFeedbackBadges: (badges: string[]) => void;

  reset: () => void;
}

const initialUIState: AdministrativeTicketUIState = {
  showCancelModal: false,
  showAssignModal: false,
  showConfirmAssignModal: false,
  showSubTaskStatusModal: false,
  showSubTaskAssignModal: false,
  showTicketStatusSheet: false,
  showCompleteModal: false,
  cancelReason: '',
  selectedSubTask: null,
  pendingStatus: '',
  feedbackRating: 0,
  feedbackComment: '',
  feedbackBadges: [],
};

const initialState = {
  currentTicketId: null,
  ticket: null,
  loading: false,
  refreshing: false,
  error: null,
  messages: [] as AdminTicketMessage[],
  messagesLoading: false,
  messagesError: null,
  supportTeamMembers: [] as AdministrativeSupportMember[],
  supportTeamLoading: false,
  actionLoading: false,
  actionError: null,
  ui: initialUIState,
};

/**
 * Bóc message lỗi để UI hiện đúng lý do.
 *
 * `administrativeTicketService` đã ném `Error(out.message)` với message thật của
 * backend ("Không có quyền sửa", "Vui lòng hoàn thành tất cả công việc con trước
 * khi kết thúc ticket"…). Trước đây các action chỉ `console.error` rồi trả false
 * nên message đó bị vứt và người dùng luôn chỉ thấy "Không thể cập nhật".
 */
function actionErrorMessage(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message.trim() : '';
  return message || fallback;
}

async function loadTicketWithSubtasks(ticketId: string): Promise<AdministrativeTicket | null> {
  const [detail, subTasks] = await Promise.all([
    getAdminTicketDetail(ticketId),
    getAdminSubTasks(ticketId),
  ]);
  if (!detail) return null;
  return { ...detail, subTasks };
}

export const useAdministrativeTicketStore = create<AdministrativeTicketStore>()(
  subscribeWithSelector((set, get) => ({
    ...initialState,

    fetchTicket: async (ticketId: string) => {
      set({ loading: true, error: null, currentTicketId: ticketId });
      try {
        const ticketData = await loadTicketWithSubtasks(ticketId);
        if (ticketData) {
          set({ ticket: ticketData, loading: false });
        } else {
          set({ error: 'Không tìm thấy ticket', loading: false });
        }
      } catch (error: unknown) {
        console.error('Lỗi khi lấy thông tin ticket HC:', error);
        set({
          error: error instanceof Error ? error.message : 'Lỗi khi lấy thông tin ticket',
          loading: false,
        });
      }
    },

    fetchMessages: async (ticketId: string) => {
      set({ messagesLoading: true, messagesError: null });
      try {
        const messagesData = await getAdminTicketMessages(ticketId);
        set({ messages: messagesData, messagesLoading: false });
      } catch (error: unknown) {
        console.error('Lỗi khi lấy messages HC:', error);
        set({
          messagesError: error instanceof Error ? error.message : 'Lỗi khi lấy messages',
          messagesLoading: false,
        });
      }
    },

    fetchSupportTeam: async () => {
      set({ supportTeamLoading: true });
      try {
        const members = await getAdministrativeSupportTeamMembers();
        set({
          supportTeamMembers: members,
          supportTeamLoading: false,
        });
      } catch (error) {
        console.error('Error fetching HC support team:', error);
        set({ supportTeamLoading: false });
      }
    },

    refreshTicket: async () => {
      const { currentTicketId } = get();
      if (currentTicketId) {
        set({ refreshing: true });
        try {
          const ticketData = await loadTicketWithSubtasks(currentTicketId);
          if (ticketData) {
            set({ ticket: ticketData });
          }
          const messagesData = await getAdminTicketMessages(currentTicketId);
          set({ messages: messagesData });
        } catch (error) {
          console.error('Error refreshing ticket HC:', error);
        } finally {
          set({ refreshing: false });
        }
      }
    },

    assignToMe: async () => {
      const { currentTicketId } = get();
      if (!currentTicketId) return false;
      set({ actionLoading: true, actionError: null });
      try {
        await assignAdminTicketToMe(currentTicketId);
        await get().refreshTicket();
        set({ actionLoading: false });
        return true;
      } catch (error) {
        console.error('Error assigning ticket HC:', error);
        set({
          actionLoading: false,
          actionError: actionErrorMessage(error, 'Không thể nhận ticket'),
        });
        return false;
      }
    },

    assignToUser: async (userId: string, _userName?: string) => {
      const { currentTicketId } = get();
      if (!currentTicketId) return false;
      set({ actionLoading: true, actionError: null });
      try {
        await assignAdminTicketToUser(currentTicketId, userId);
        await get().refreshTicket();
        set({ actionLoading: false });
        return true;
      } catch (error) {
        console.error('Error assigning ticket HC to user:', error);
        set({
          actionLoading: false,
          actionError: actionErrorMessage(error, 'Không thể giao ticket'),
        });
        return false;
      }
    },

    cancelTicket: async (reason: string) => {
      const { currentTicketId } = get();
      if (!currentTicketId) return false;
      set({ actionLoading: true, actionError: null });
      try {
        await cancelAdminTicket(currentTicketId, reason);
        await get().refreshTicket();
        set({
          actionLoading: false,
          ui: { ...get().ui, cancelReason: '', showCancelModal: false },
        });
        return true;
      } catch (error) {
        console.error('Error cancelling ticket HC:', error);
        set({
          actionLoading: false,
          actionError: actionErrorMessage(error, 'Không thể huỷ ticket'),
        });
        return false;
      }
    },

    completeTicket: async (feedback: AdminFeedbackData) => {
      const { currentTicketId } = get();
      if (!currentTicketId) return false;
      set({ actionLoading: true, actionError: null });
      try {
        await acceptAdminFeedback(currentTicketId, feedback);
        await get().refreshTicket();
        set({
          actionLoading: false,
          ui: {
            ...get().ui,
            showCompleteModal: false,
            feedbackRating: 0,
            feedbackComment: '',
            feedbackBadges: [],
          },
        });
        return true;
      } catch (error) {
        console.error('Error completing ticket HC:', error);
        set({
          actionLoading: false,
          actionError: actionErrorMessage(error, 'Không thể gửi đánh giá'),
        });
        return false;
      }
    },

    updateStatus: async (status: AdministrativeTicketStatusUi) => {
      const { currentTicketId, ticket } = get();
      if (!currentTicketId) return false;

      if (status === 'Done') {
        const subTasks = ticket?.subTasks || [];
        const hasInProgress = subTasks.some((t) => t.status === 'In Progress');
        if (hasInProgress) {
          return false;
        }
      }

      set({ actionLoading: true, actionError: null });
      try {
        await updateAdminTicket({
          ticket_id: currentTicketId,
          status,
        });
        await get().refreshTicket();
        set({ actionLoading: false });
        return true;
      } catch (error) {
        console.error('Error updating ticket HC status:', error);
        set({
          actionLoading: false,
          actionError: actionErrorMessage(error, 'Không thể cập nhật'),
        });
        return false;
      }
    },

    addSubTask: async (title: string, assignedTo?: string) => {
      const { currentTicketId } = get();
      if (!currentTicketId) return false;
      set({ actionLoading: true, actionError: null });
      try {
        await createAdminSubTask(currentTicketId, { title, assignedTo });
        await get().refreshTicket();
        set({ actionLoading: false });
        return true;
      } catch (error) {
        console.error('Error adding subtask HC:', error);
        set({
          actionLoading: false,
          actionError: actionErrorMessage(error, 'Không thể thêm công việc con'),
        });
        return false;
      }
    },

    updateSubTaskStatus: async (subTaskId: string, status: AdministrativeSubTaskStatusUi) => {
      const { currentTicketId } = get();
      if (!currentTicketId) return false;
      set({ actionLoading: true, actionError: null });
      try {
        await updateAdminSubTaskStatus(currentTicketId, subTaskId, status);
        await get().refreshTicket();
        set({ actionLoading: false });
        return true;
      } catch (error) {
        console.error('Error updating subtask HC:', error);
        set({
          actionLoading: false,
          actionError: actionErrorMessage(error, 'Không thể cập nhật công việc con'),
        });
        return false;
      }
    },

    updateSubTaskAssignee: async (subTaskId: string, assignedTo: string) => {
      const { currentTicketId } = get();
      if (!currentTicketId) return false;
      set({ actionLoading: true, actionError: null });
      try {
        await updateAdminSubTask(currentTicketId, subTaskId, { assignedTo });
        await get().refreshTicket();
        set({ actionLoading: false });
        return true;
      } catch (error) {
        console.error('Error updating subtask assignee HC:', error);
        set({
          actionLoading: false,
          actionError: actionErrorMessage(error, 'Không thể đổi người thực hiện'),
        });
        return false;
      }
    },

    deleteSubTask: async (subTaskId: string) => {
      const { currentTicketId } = get();
      if (!currentTicketId) return false;
      set({ actionLoading: true, actionError: null });
      try {
        await deleteAdminSubTask(currentTicketId, subTaskId);
        await get().refreshTicket();
        set({ actionLoading: false });
        return true;
      } catch (error) {
        console.error('Error deleting subtask HC:', error);
        set({
          actionLoading: false,
          actionError: actionErrorMessage(error, 'Không thể xoá công việc con'),
        });
        return false;
      }
    },

    addMessage: (message: AdminTicketMessage) => {
      set((state) => {
        const exists = state.messages.some((m) => m._id === message._id);
        if (exists) return state;
        return { messages: [...state.messages, message] };
      });
    },

    setUI: (updates: Partial<AdministrativeTicketUIState>) => {
      set((state) => ({
        ui: { ...state.ui, ...updates },
      }));
    },

    openCancelModal: () => set((state) => ({ ui: { ...state.ui, showCancelModal: true } })),
    closeCancelModal: () =>
      set((state) => ({ ui: { ...state.ui, showCancelModal: false, cancelReason: '' } })),

    openAssignModal: () => {
      get().fetchSupportTeam();
      set((state) => ({ ui: { ...state.ui, showAssignModal: true } }));
    },
    closeAssignModal: () => set((state) => ({ ui: { ...state.ui, showAssignModal: false } })),

    openConfirmAssignModal: () =>
      set((state) => ({ ui: { ...state.ui, showConfirmAssignModal: true } })),
    closeConfirmAssignModal: () =>
      set((state) => ({ ui: { ...state.ui, showConfirmAssignModal: false } })),

    openSubTaskStatusModal: (subTask: AdminSubTask) =>
      set((state) => ({
        ui: { ...state.ui, showSubTaskStatusModal: true, selectedSubTask: subTask },
      })),
    closeSubTaskStatusModal: () =>
      set((state) => ({
        ui: { ...state.ui, showSubTaskStatusModal: false, selectedSubTask: null },
      })),

    openSubTaskAssignModal: (subTask: AdminSubTask) => {
      get().fetchSupportTeam();
      set((state) => ({
        ui: {
          ...state.ui,
          selectedSubTask: subTask,
          showSubTaskStatusModal: false,
          showSubTaskAssignModal: true,
        },
      }));
    },
    closeSubTaskAssignModal: () =>
      set((state) => ({
        ui: { ...state.ui, showSubTaskAssignModal: false, selectedSubTask: null },
      })),

    openTicketStatusSheet: () =>
      set((state) => ({ ui: { ...state.ui, showTicketStatusSheet: true } })),
    closeTicketStatusSheet: () =>
      set((state) => ({ ui: { ...state.ui, showTicketStatusSheet: false } })),

    setCancelReason: (reason: string) =>
      set((state) => ({ ui: { ...state.ui, cancelReason: reason } })),

    openCompleteModal: () => set((state) => ({ ui: { ...state.ui, showCompleteModal: true } })),
    closeCompleteModal: () =>
      set((state) => ({
        ui: {
          ...state.ui,
          showCompleteModal: false,
          feedbackRating: 0,
          feedbackComment: '',
          feedbackBadges: [],
        },
      })),
    setFeedbackRating: (rating: number) =>
      set((state) => ({ ui: { ...state.ui, feedbackRating: rating } })),
    setFeedbackComment: (comment: string) =>
      set((state) => ({ ui: { ...state.ui, feedbackComment: comment } })),
    setFeedbackBadges: (badges: string[]) =>
      set((state) => ({ ui: { ...state.ui, feedbackBadges: badges } })),

    reset: () => set(initialState),
  }))
);

export const useAdministrativeTicket = () => useAdministrativeTicketStore((state) => state.ticket);
export const useAdministrativeTicketLoading = () =>
  useAdministrativeTicketStore((state) => state.loading);
export const useAdministrativeTicketError = () =>
  useAdministrativeTicketStore((state) => state.error);
/** Trạng thái modal/sheet UI (tương đương useTicketUI bên IT) */
export const useAdministrativeTicketUI = () => useAdministrativeTicketStore((state) => state.ui);
export const useAdministrativeActionLoading = () =>
  useAdministrativeTicketStore((state) => state.actionLoading);

/**
 * Lý do thất bại của hành động vừa chạy, để toast nói đúng vấn đề thay vì
 * "Không thể cập nhật".
 *
 * KHÔNG phải hook và cố ý như vậy: phải gọi NGAY SAU `await <action>()`. Giá trị
 * lấy từ hook là snapshot lúc render nên luôn là lỗi của lần trước, còn store ghi
 * `actionError` trong lúc await — chỉ `getState()` mới đọc được giá trị mới.
 */
export const getAdministrativeActionError = (fallback: string): string =>
  useAdministrativeTicketStore.getState().actionError || fallback;

export const useCanSendAdministrativeMessage = () => {
  const ticket = useAdministrativeTicketStore((state) => state.ticket);
  const status = ticket?.status?.toLowerCase() || '';
  return status === 'in progress' || status === 'waiting for customer';
};

export const useHasIncompleteAdministrativeSubTasks = () => {
  const ticket = useAdministrativeTicketStore((state) => state.ticket);
  const subTasks = ticket?.subTasks || [];
  return subTasks.some((task) => task.status !== 'Completed' && task.status !== 'Cancelled');
};

export const useAdministrativeTicketData = () =>
  useAdministrativeTicketStore(
    useShallow((state) => ({
      ticket: state.ticket,
      loading: state.loading,
      refreshing: state.refreshing,
      error: state.error,
    }))
  );

export const useAdministrativeTicketMessages = () =>
  useAdministrativeTicketStore(
    useShallow((state) => ({
      messages: state.messages,
      messagesLoading: state.messagesLoading,
      loading: state.messagesLoading,
      messagesError: state.messagesError,
      addMessage: state.addMessage,
    }))
  );

export const useAdministrativeTicketSubTasks = () =>
  useAdministrativeTicketStore(
    useShallow((state) => ({
      subTasks: state.ticket?.subTasks || [],
      hasIncompleteSubTasks: (state.ticket?.subTasks || []).some(
        (task) => task.status !== 'Completed' && task.status !== 'Cancelled'
      ),
    }))
  );

export const useAdministrativeTicketActions = () =>
  useAdministrativeTicketStore(
    useShallow((state) => ({
      fetchTicket: state.fetchTicket,
      fetchMessages: state.fetchMessages,
      refreshTicket: state.refreshTicket,
      assignToMe: state.assignToMe,
      assignToUser: state.assignToUser,
      cancelTicket: state.cancelTicket,
      completeTicket: state.completeTicket,
      updateStatus: state.updateStatus,
      addSubTask: state.addSubTask,
      updateSubTaskStatus: state.updateSubTaskStatus,
      updateSubTaskAssignee: state.updateSubTaskAssignee,
      deleteSubTask: state.deleteSubTask,
      actionLoading: state.actionLoading,
      actionError: state.actionError,
    }))
  );

export const useAdministrativeTicketUIActions = () =>
  useAdministrativeTicketStore(
    useShallow((state) => ({
      setUI: state.setUI,
      openCancelModal: state.openCancelModal,
      closeCancelModal: state.closeCancelModal,
      openAssignModal: state.openAssignModal,
      closeAssignModal: state.closeAssignModal,
      openConfirmAssignModal: state.openConfirmAssignModal,
      closeConfirmAssignModal: state.closeConfirmAssignModal,
      openSubTaskStatusModal: state.openSubTaskStatusModal,
      closeSubTaskStatusModal: state.closeSubTaskStatusModal,
      openSubTaskAssignModal: state.openSubTaskAssignModal,
      closeSubTaskAssignModal: state.closeSubTaskAssignModal,
      openTicketStatusSheet: state.openTicketStatusSheet,
      closeTicketStatusSheet: state.closeTicketStatusSheet,
      setCancelReason: state.setCancelReason,
      openCompleteModal: state.openCompleteModal,
      closeCompleteModal: state.closeCompleteModal,
      setFeedbackRating: state.setFeedbackRating,
      setFeedbackComment: state.setFeedbackComment,
      setFeedbackBadges: state.setFeedbackBadges,
    }))
  );

export const useAdministrativeSupportTeam = () =>
  useAdministrativeTicketStore(
    useShallow((state) => ({
      members: state.supportTeamMembers,
      loading: state.supportTeamLoading,
      fetch: state.fetchSupportTeam,
    }))
  );

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';
import type { Ticket, Message, SubTask, SupportTeamMember } from '../services/ticketService';
import {
  getTicketDetail,
  updateTicket,
  assignTicketToMe,
  assignTicketToUser,
  cancelTicket as cancelTicketApi,
  acceptFeedback as acceptFeedbackApi,
  createSubTask as createSubTaskApi,
  updateSubTaskStatus as updateSubTaskStatusApi,
  getSupportTeamMembers,
  getTicketMessages,
  Feedback,
} from '../services/ticketService';

// ============================================================================
// Types
// ============================================================================

export type TicketStatus =
  | 'Assigned'
  | 'Processing'
  | 'Waiting for Customer'
  | 'Done'
  | 'Closed'
  | 'Cancelled';
export type SubTaskStatus = 'In Progress' | 'Completed' | 'Cancelled';

interface TicketUIState {
  // Modals
  showCancelModal: boolean;
  showAssignModal: boolean;
  showConfirmAssignModal: boolean;
  showSubTaskStatusModal: boolean;
  showTicketStatusSheet: boolean;
  showCompleteModal: boolean;

  // Modal data
  cancelReason: string;
  selectedSubTask: SubTask | null;
  pendingStatus: TicketStatus | '';
  feedbackRating: number;
  feedbackComment: string;
  feedbackBadges: string[];
}

interface TicketStore {
  // ============================================================================
  // State
  // ============================================================================

  // Current ticket data
  currentTicketId: string | null;
  ticket: Ticket | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;

  // Messages
  messages: Message[];
  messagesLoading: boolean;
  messagesError: string | null;

  // Support team
  supportTeamMembers: SupportTeamMember[];
  supportTeamLoading: boolean;

  // Action loading
  actionLoading: boolean;

  // UI states
  ui: TicketUIState;

  // ============================================================================
  // Actions - Data fetching
  // ============================================================================

  fetchTicket: (ticketId: string) => Promise<void>;
  fetchMessages: (ticketId: string) => Promise<void>;
  fetchSupportTeam: () => Promise<void>;
  refreshTicket: () => Promise<void>;

  // ============================================================================
  // Actions - Ticket operations
  // ============================================================================

  assignToMe: () => Promise<boolean>;
  assignToUser: (userId: string, userName?: string) => Promise<boolean>;
  cancelTicket: (reason: string) => Promise<boolean>;
  completeTicket: (feedback: Feedback) => Promise<boolean>;
  updateStatus: (status: TicketStatus) => Promise<boolean>;

  // ============================================================================
  // Actions - SubTask operations
  // ============================================================================

  addSubTask: (title: string) => Promise<boolean>;
  updateSubTaskStatus: (subTaskId: string, status: SubTaskStatus) => Promise<boolean>;

  // ============================================================================
  // Actions - Messages
  // ============================================================================

  addMessage: (message: Message) => void;

  // ============================================================================
  // Actions - UI controls
  // ============================================================================

  setUI: (updates: Partial<TicketUIState>) => void;
  openCancelModal: () => void;
  closeCancelModal: () => void;
  openAssignModal: () => void;
  closeAssignModal: () => void;
  openConfirmAssignModal: () => void;
  closeConfirmAssignModal: () => void;
  openSubTaskStatusModal: (subTask: SubTask) => void;
  closeSubTaskStatusModal: () => void;
  openTicketStatusSheet: () => void;
  closeTicketStatusSheet: () => void;
  setCancelReason: (reason: string) => void;
  openCompleteModal: () => void;
  closeCompleteModal: () => void;
  setFeedbackRating: (rating: number) => void;
  setFeedbackComment: (comment: string) => void;
  setFeedbackBadges: (badges: string[]) => void;

  // ============================================================================
  // Actions - Reset
  // ============================================================================

  reset: () => void;
}

// ============================================================================
// Initial State
// ============================================================================

const initialUIState: TicketUIState = {
  showCancelModal: false,
  showAssignModal: false,
  showConfirmAssignModal: false,
  showSubTaskStatusModal: false,
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
  messages: [],
  messagesLoading: false,
  messagesError: null,
  supportTeamMembers: [],
  supportTeamLoading: false,
  actionLoading: false,
  ui: initialUIState,
};

// ============================================================================
// Store
// ============================================================================

export const useTicketStore = create<TicketStore>()(
  subscribeWithSelector((set, get) => ({
    ...initialState,

    // ============================================================================
    // Actions - Data fetching
    // ============================================================================

    fetchTicket: async (ticketId: string) => {
      set({ loading: true, error: null, currentTicketId: ticketId });
      try {
        const ticketData = await getTicketDetail(ticketId);
        if (ticketData) {
          set({ ticket: ticketData, loading: false });
        } else {
          set({ error: 'Không tìm thấy ticket', loading: false });
        }
      } catch (error: any) {
        console.error('Lỗi khi lấy thông tin ticket:', error);
        set({ error: error?.message || 'Lỗi khi lấy thông tin ticket', loading: false });
      }
    },

    fetchMessages: async (ticketId: string) => {
      set({ messagesLoading: true, messagesError: null });
      try {
        const messagesData = await getTicketMessages(ticketId);
        set({ messages: messagesData, messagesLoading: false });
      } catch (error: any) {
        console.error('Lỗi khi lấy messages:', error);
        set({ messagesError: error?.message || 'Lỗi khi lấy messages', messagesLoading: false });
      }
    },

    fetchSupportTeam: async () => {
      set({ supportTeamLoading: true });
      try {
        const members = await getSupportTeamMembers();
        set({ supportTeamMembers: members, supportTeamLoading: false });
      } catch (error) {
        console.error('Error fetching support team:', error);
        set({ supportTeamLoading: false });
      }
    },

    refreshTicket: async () => {
      const { currentTicketId } = get();
      if (currentTicketId) {
        set({ refreshing: true });
        try {
          const ticketData = await getTicketDetail(currentTicketId);
          if (ticketData) {
            set({ ticket: ticketData });
          }
          // Also refresh messages
          const messagesData = await getTicketMessages(currentTicketId);
          set({ messages: messagesData });
        } catch (error) {
          console.error('Error refreshing ticket:', error);
        } finally {
          set({ refreshing: false });
        }
      }
    },

    // ============================================================================
    // Actions - Ticket operations
    // ============================================================================

    assignToMe: async () => {
      const { currentTicketId } = get();
      if (!currentTicketId) return false;

      set({ actionLoading: true });
      try {
        await assignTicketToMe(currentTicketId);
        await get().refreshTicket();
        set({ actionLoading: false });
        return true;
      } catch (error) {
        console.error('Error assigning ticket:', error);
        set({ actionLoading: false });
        return false;
      }
    },

    assignToUser: async (userId: string, _userName?: string) => {
      const { currentTicketId } = get();
      if (!currentTicketId) return false;

      set({ actionLoading: true });
      try {
        await assignTicketToUser(currentTicketId, userId);
        await get().refreshTicket();
        set({ actionLoading: false });
        return true;
      } catch (error) {
        console.error('Error assigning ticket:', error);
        set({ actionLoading: false });
        return false;
      }
    },

    cancelTicket: async (reason: string) => {
      const { currentTicketId } = get();
      if (!currentTicketId) return false;

      set({ actionLoading: true });
      try {
        await cancelTicketApi(currentTicketId, reason);
        await get().refreshTicket();
        set({
          actionLoading: false,
          ui: { ...get().ui, cancelReason: '', showCancelModal: false },
        });
        return true;
      } catch (error) {
        console.error('Error cancelling ticket:', error);
        set({ actionLoading: false });
        return false;
      }
    },

    completeTicket: async (feedback: Feedback) => {
      const { currentTicketId } = get();
      if (!currentTicketId) return false;

      set({ actionLoading: true });
      try {
        await acceptFeedbackApi(currentTicketId, feedback);
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
        console.error('Error completing ticket:', error);
        set({ actionLoading: false });
        return false;
      }
    },

    updateStatus: async (status: TicketStatus) => {
      const { currentTicketId, ticket } = get();
      if (!currentTicketId) return false;

      // Validate: không thể chuyển sang Done nếu còn subtask chưa hoàn thành
      if (status === 'Done') {
        const subTasks = ticket?.subTasks || [];
        const hasInProgress = subTasks.some((t) => t.status === 'In Progress');
        if (hasInProgress) {
          return false;
        }
      }

      set({ actionLoading: true });
      try {
        await updateTicket(currentTicketId, { status });
        await get().refreshTicket();
        set({ actionLoading: false });
        return true;
      } catch (error) {
        console.error('Error updating status:', error);
        set({ actionLoading: false });
        return false;
      }
    },

    // ============================================================================
    // Actions - SubTask operations
    // ============================================================================

    addSubTask: async (title: string) => {
      const { currentTicketId } = get();
      if (!currentTicketId) return false;

      set({ actionLoading: true });
      try {
        await createSubTaskApi(currentTicketId, { title });
        await get().refreshTicket();
        set({ actionLoading: false });
        return true;
      } catch (error) {
        console.error('Error adding subtask:', error);
        set({ actionLoading: false });
        return false;
      }
    },

    updateSubTaskStatus: async (subTaskId: string, status: SubTaskStatus) => {
      const { currentTicketId } = get();
      if (!currentTicketId) return false;

      set({ actionLoading: true });
      try {
        await updateSubTaskStatusApi(currentTicketId, subTaskId, status);
        await get().refreshTicket();
        set({ actionLoading: false });
        return true;
      } catch (error) {
        console.error('Error updating subtask:', error);
        set({ actionLoading: false });
        return false;
      }
    },

    // ============================================================================
    // Actions - Messages
    // ============================================================================

    addMessage: (message: Message) => {
      set((state) => {
        // Check duplicate by _id to prevent duplicate messages
        const exists = state.messages.some((m) => m._id === message._id);
        if (exists) {
          return state; // No change if message already exists
        }
        return {
          messages: [...state.messages, message],
        };
      });
    },

    // ============================================================================
    // Actions - UI controls
    // ============================================================================

    setUI: (updates: Partial<TicketUIState>) => {
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

    openSubTaskStatusModal: (subTask: SubTask) =>
      set((state) => ({
        ui: { ...state.ui, showSubTaskStatusModal: true, selectedSubTask: subTask },
      })),
    closeSubTaskStatusModal: () =>
      set((state) => ({
        ui: { ...state.ui, showSubTaskStatusModal: false, selectedSubTask: null },
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

    // ============================================================================
    // Actions - Reset
    // ============================================================================

    reset: () => set(initialState),
  }))
);

// ============================================================================
// Selectors (with shallow comparison to prevent infinite loops)
// ============================================================================

// Primitive selectors (no need for shallow - they return primitives/same reference)
export const useTicket = () => useTicketStore((state) => state.ticket);
export const useTicketLoading = () => useTicketStore((state) => state.loading);
export const useTicketError = () => useTicketStore((state) => state.error);
export const useTicketUI = () => useTicketStore((state) => state.ui);
export const useActionLoading = () => useTicketStore((state) => state.actionLoading);

// Computed values
export const useCanSendMessage = () => {
  const ticket = useTicketStore((state) => state.ticket);
  const status = ticket?.status?.toLowerCase();
  return status === 'processing' || status === 'waiting for customer';
};

export const useHasIncompleteSubTasks = () => {
  const ticket = useTicketStore((state) => state.ticket);
  const subTasks = ticket?.subTasks || [];
  return subTasks.some((task) => task.status !== 'Completed' && task.status !== 'Cancelled');
};

// Object selectors with shallow comparison
export const useTicketData = () =>
  useTicketStore(
    useShallow((state) => ({
      ticket: state.ticket,
      loading: state.loading,
      refreshing: state.refreshing,
      error: state.error,
    }))
  );

export const useTicketMessages = () =>
  useTicketStore(
    useShallow((state) => ({
      messages: state.messages,
      messagesLoading: state.messagesLoading,
      loading: state.messagesLoading,
      messagesError: state.messagesError,
      addMessage: state.addMessage,
    }))
  );

export const useTicketSubTasks = () =>
  useTicketStore(
    useShallow((state) => ({
      subTasks: state.ticket?.subTasks || [],
      hasIncompleteSubTasks: (state.ticket?.subTasks || []).some(
        (task) => task.status !== 'Completed' && task.status !== 'Cancelled'
      ),
    }))
  );

export const useTicketActions = () =>
  useTicketStore(
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
      actionLoading: state.actionLoading,
    }))
  );

export const useTicketUIActions = () =>
  useTicketStore(
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

export const useSupportTeam = () =>
  useTicketStore(
    useShallow((state) => ({
      members: state.supportTeamMembers,
      loading: state.supportTeamLoading,
      fetch: state.fetchSupportTeam,
    }))
  );

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

  addSubTask: (title: string) => Promise<boolean>;
  updateSubTaskStatus: (subTaskId: string, status: AdministrativeSubTaskStatusUi) => Promise<boolean>;

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
  ui: initialUIState,
};

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
      set({ actionLoading: true });
      try {
        await assignAdminTicketToMe(currentTicketId);
        await get().refreshTicket();
        set({ actionLoading: false });
        return true;
      } catch (error) {
        console.error('Error assigning ticket HC:', error);
        set({ actionLoading: false });
        return false;
      }
    },

    assignToUser: async (userId: string, _userName?: string) => {
      const { currentTicketId } = get();
      if (!currentTicketId) return false;
      set({ actionLoading: true });
      try {
        await assignAdminTicketToUser(currentTicketId, userId);
        await get().refreshTicket();
        set({ actionLoading: false });
        return true;
      } catch (error) {
        console.error('Error assigning ticket HC to user:', error);
        set({ actionLoading: false });
        return false;
      }
    },

    cancelTicket: async (reason: string) => {
      const { currentTicketId } = get();
      if (!currentTicketId) return false;
      set({ actionLoading: true });
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
        set({ actionLoading: false });
        return false;
      }
    },

    completeTicket: async (feedback: AdminFeedbackData) => {
      const { currentTicketId } = get();
      if (!currentTicketId) return false;
      set({ actionLoading: true });
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
        set({ actionLoading: false });
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

      set({ actionLoading: true });
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
        set({ actionLoading: false });
        return false;
      }
    },

    addSubTask: async (title: string) => {
      const { currentTicketId } = get();
      if (!currentTicketId) return false;
      set({ actionLoading: true });
      try {
        await createAdminSubTask(currentTicketId, { title });
        await get().refreshTicket();
        set({ actionLoading: false });
        return true;
      } catch (error) {
        console.error('Error adding subtask HC:', error);
        set({ actionLoading: false });
        return false;
      }
    },

    updateSubTaskStatus: async (subTaskId: string, status: AdministrativeSubTaskStatusUi) => {
      const { currentTicketId } = get();
      if (!currentTicketId) return false;
      set({ actionLoading: true });
      try {
        await updateAdminSubTaskStatus(currentTicketId, subTaskId, status);
        await get().refreshTicket();
        set({ actionLoading: false });
        return true;
      } catch (error) {
        console.error('Error updating subtask HC:', error);
        set({ actionLoading: false });
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

export const useAdministrativeTicket = () =>
  useAdministrativeTicketStore((state) => state.ticket);
export const useAdministrativeTicketLoading = () =>
  useAdministrativeTicketStore((state) => state.loading);
export const useAdministrativeTicketError = () =>
  useAdministrativeTicketStore((state) => state.error);
/** Trạng thái modal/sheet UI (tương đương useTicketUI bên IT) */
export const useAdministrativeTicketUI = () =>
  useAdministrativeTicketStore((state) => state.ui);
export const useAdministrativeActionLoading = () =>
  useAdministrativeTicketStore((state) => state.actionLoading);

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
      actionLoading: state.actionLoading,
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

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';
import type { Feedback, FeedbackListParams, SupportTeamUser } from '../services/feedbackService';
import {
  getFeedbackList,
  getFeedbackDetail,
  assignFeedback,
  addFeedbackReply,
  updateFeedbackStatus,
  closeFeedback as closeFeedbackApi,
  deleteFeedback as deleteFeedbackApi,
  getUsersForAssignment,
  updateFeedbackAssignment,
} from '../services/feedbackService';

// ============================================================================
// Types
// ============================================================================

export type FeedbackStatus =
  | 'Mới'
  | 'Đang xử lý'
  | 'Chờ phản hồi phụ huynh'
  | 'Đã phản hồi'
  | 'Đóng'
  | 'Tự động đóng'
  | 'Hoàn thành';

interface FeedbackUIState {
  // Modals
  showAssignModal: boolean;
  showStatusModal: boolean;

  // Filter
  filterStatus: string;
  searchTerm: string;
}

interface FeedbackStore {
  // ============================================================================
  // State
  // ============================================================================

  // List data
  feedbackList: Feedback[];
  listLoading: boolean;
  listRefreshing: boolean;
  listError: string | null;
  totalCount: number;
  currentPage: number;
  pageLength: number;

  // Current feedback detail
  currentFeedbackId: string | null;
  feedback: Feedback | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;

  // Support team
  supportTeamMembers: SupportTeamUser[];
  supportTeamLoading: boolean;

  // Action loading
  actionLoading: boolean;

  // UI states
  ui: FeedbackUIState;

  // ============================================================================
  // Actions - List
  // ============================================================================

  fetchFeedbackList: (params?: FeedbackListParams) => Promise<void>;
  refreshList: () => Promise<void>;

  // ============================================================================
  // Actions - Detail
  // ============================================================================

  fetchFeedback: (feedbackId: string) => Promise<void>;
  refreshFeedback: () => Promise<void>;

  // ============================================================================
  // Actions - Support team
  // ============================================================================

  fetchSupportTeam: () => Promise<void>;

  // ============================================================================
  // Actions - Feedback operations
  // ============================================================================

  assignToUser: (userId: string, priority?: string) => Promise<boolean>;
  addReply: (
    content: string,
    isInternal?: boolean,
    attachments?: { uri: string; name: string; type: string }[]
  ) => Promise<boolean>;
  updateStatus: (status: FeedbackStatus) => Promise<boolean>;
  closeFeedback: () => Promise<boolean>;
  deleteFeedback: () => Promise<boolean>;
  updateAssignment: (assignedTo?: string, priority?: string) => Promise<boolean>;

  // ============================================================================
  // Actions - UI controls
  // ============================================================================

  setUI: (updates: Partial<FeedbackUIState>) => void;
  openAssignModal: () => void;
  closeAssignModal: () => void;
  openStatusModal: () => void;
  closeStatusModal: () => void;
  setFilterStatus: (status: string) => void;
  setSearchTerm: (term: string) => void;

  // ============================================================================
  // Actions - Reset
  // ============================================================================

  reset: () => void;
  resetDetail: () => void;
}

// ============================================================================
// Initial State
// ============================================================================

const initialUIState: FeedbackUIState = {
  showAssignModal: false,
  showStatusModal: false,
  filterStatus: '',
  searchTerm: '',
};

const initialState = {
  // List
  feedbackList: [],
  listLoading: false,
  listRefreshing: false,
  listError: null,
  totalCount: 0,
  currentPage: 1,
  pageLength: 20,

  // Detail
  currentFeedbackId: null,
  feedback: null,
  loading: false,
  refreshing: false,
  error: null,

  // Support team
  supportTeamMembers: [],
  supportTeamLoading: false,

  // Action
  actionLoading: false,

  // UI
  ui: initialUIState,
};

// ============================================================================
// Store
// ============================================================================

export const useFeedbackStore = create<FeedbackStore>()(
  subscribeWithSelector((set, get) => ({
    ...initialState,

    // ============================================================================
    // Actions - List
    // ============================================================================

    fetchFeedbackList: async (params?: FeedbackListParams) => {
      set({ listLoading: true, listError: null });
      try {
        const { ui } = get();
        const finalParams: FeedbackListParams = {
          page: params?.page || 1,
          page_length: params?.page_length || 20,
          // Filter only "Góp ý" type for this screen
          feedback_type: 'Góp ý',
          ...params,
        };

        // Apply UI filters
        if (ui.filterStatus) {
          finalParams.status = ui.filterStatus;
        }
        if (ui.searchTerm) {
          finalParams.search = ui.searchTerm;
        }

        const response = await getFeedbackList(finalParams);

        if (response.success && response.data) {
          set({
            feedbackList: response.data.data || [],
            totalCount: response.data.total || 0,
            currentPage: response.data.page || 1,
            pageLength: response.data.page_length || 20,
            listLoading: false,
          });
        } else {
          set({
            listError: response.message || 'Lỗi khi lấy danh sách feedback',
            listLoading: false,
          });
        }
      } catch (error: any) {
        console.error('Error fetching feedback list:', error);
        set({
          listError: error?.message || 'Lỗi khi lấy danh sách feedback',
          listLoading: false,
        });
      }
    },

    refreshList: async () => {
      set({ listRefreshing: true });
      try {
        const { ui, pageLength } = get();
        const params: FeedbackListParams = {
          page: 1,
          page_length: pageLength,
          feedback_type: 'Góp ý',
        };

        if (ui.filterStatus) {
          params.status = ui.filterStatus;
        }
        if (ui.searchTerm) {
          params.search = ui.searchTerm;
        }

        const response = await getFeedbackList(params);

        if (response.success && response.data) {
          set({
            feedbackList: response.data.data || [],
            totalCount: response.data.total || 0,
            currentPage: 1,
          });
        }
      } catch (error) {
        console.error('Error refreshing feedback list:', error);
      } finally {
        set({ listRefreshing: false });
      }
    },

    // ============================================================================
    // Actions - Detail
    // ============================================================================

    fetchFeedback: async (feedbackId: string) => {
      set({ loading: true, error: null, currentFeedbackId: feedbackId });
      try {
        const response = await getFeedbackDetail(feedbackId);

        if (response.success && response.data) {
          set({ feedback: response.data, loading: false });
        } else {
          set({
            error: response.message || 'Không tìm thấy feedback',
            loading: false,
          });
        }
      } catch (error: any) {
        console.error('Error fetching feedback detail:', error);
        set({
          error: error?.message || 'Lỗi khi lấy thông tin feedback',
          loading: false,
        });
      }
    },

    refreshFeedback: async () => {
      const { currentFeedbackId } = get();
      if (!currentFeedbackId) return;

      set({ refreshing: true });
      try {
        const response = await getFeedbackDetail(currentFeedbackId);

        if (response.success && response.data) {
          set({ feedback: response.data });
        }
      } catch (error) {
        console.error('Error refreshing feedback:', error);
      } finally {
        set({ refreshing: false });
      }
    },

    // ============================================================================
    // Actions - Support team
    // ============================================================================

    fetchSupportTeam: async () => {
      set({ supportTeamLoading: true });
      try {
        const response = await getUsersForAssignment();

        if (response.success && response.data) {
          set({ supportTeamMembers: response.data, supportTeamLoading: false });
        } else {
          set({ supportTeamLoading: false });
        }
      } catch (error) {
        console.error('Error fetching support team:', error);
        set({ supportTeamLoading: false });
      }
    },

    // ============================================================================
    // Actions - Feedback operations
    // ============================================================================

    assignToUser: async (userId: string, priority?: string) => {
      const { currentFeedbackId } = get();
      if (!currentFeedbackId) return false;

      set({ actionLoading: true });
      try {
        const response = await assignFeedback(currentFeedbackId, userId, priority);

        if (response.success) {
          await get().refreshFeedback();
          set({ actionLoading: false, ui: { ...get().ui, showAssignModal: false } });
          return true;
        } else {
          set({ actionLoading: false });
          return false;
        }
      } catch (error) {
        console.error('Error assigning feedback:', error);
        set({ actionLoading: false });
        return false;
      }
    },

    addReply: async (
      content: string,
      isInternal: boolean = false,
      attachments?: { uri: string; name: string; type: string }[]
    ) => {
      const { currentFeedbackId } = get();
      if (!currentFeedbackId) return false;

      set({ actionLoading: true });
      try {
        const response = await addFeedbackReply(
          currentFeedbackId,
          content,
          isInternal,
          attachments || []
        );

        if (response.success) {
          await get().refreshFeedback();
          set({ actionLoading: false });
          return true;
        } else {
          set({ actionLoading: false });
          return false;
        }
      } catch (error) {
        console.error('Error adding reply:', error);
        set({ actionLoading: false });
        return false;
      }
    },

    updateStatus: async (status: FeedbackStatus) => {
      const { currentFeedbackId } = get();
      if (!currentFeedbackId) return false;

      set({ actionLoading: true });
      try {
        const response = await updateFeedbackStatus(currentFeedbackId, status);

        if (response.success) {
          await get().refreshFeedback();
          set({ actionLoading: false });
          return true;
        } else {
          set({ actionLoading: false });
          return false;
        }
      } catch (error) {
        console.error('Error updating status:', error);
        set({ actionLoading: false });
        return false;
      }
    },

    closeFeedback: async () => {
      const { currentFeedbackId } = get();
      if (!currentFeedbackId) return false;

      set({ actionLoading: true });
      try {
        const response = await closeFeedbackApi(currentFeedbackId);

        if (response.success) {
          await get().refreshFeedback();
          set({ actionLoading: false });
          return true;
        } else {
          set({ actionLoading: false });
          return false;
        }
      } catch (error) {
        console.error('Error closing feedback:', error);
        set({ actionLoading: false });
        return false;
      }
    },

    deleteFeedback: async () => {
      const { currentFeedbackId } = get();
      if (!currentFeedbackId) return false;

      set({ actionLoading: true });
      try {
        const response = await deleteFeedbackApi(currentFeedbackId);

        if (response.success) {
          set({ actionLoading: false });
          return true;
        } else {
          set({ actionLoading: false });
          return false;
        }
      } catch (error) {
        console.error('Error deleting feedback:', error);
        set({ actionLoading: false });
        return false;
      }
    },

    updateAssignment: async (assignedTo?: string, priority?: string) => {
      const { currentFeedbackId } = get();
      if (!currentFeedbackId) return false;

      set({ actionLoading: true });
      try {
        const response = await updateFeedbackAssignment(currentFeedbackId, assignedTo, priority);

        if (response.success) {
          await get().refreshFeedback();
          set({ actionLoading: false, ui: { ...get().ui, showAssignModal: false } });
          return true;
        } else {
          set({ actionLoading: false });
          return false;
        }
      } catch (error) {
        console.error('Error updating assignment:', error);
        set({ actionLoading: false });
        return false;
      }
    },

    // ============================================================================
    // Actions - UI controls
    // ============================================================================

    setUI: (updates: Partial<FeedbackUIState>) => {
      set((state) => ({
        ui: { ...state.ui, ...updates },
      }));
    },

    openAssignModal: () => {
      get().fetchSupportTeam();
      set((state) => ({ ui: { ...state.ui, showAssignModal: true } }));
    },
    closeAssignModal: () => set((state) => ({ ui: { ...state.ui, showAssignModal: false } })),

    openStatusModal: () => set((state) => ({ ui: { ...state.ui, showStatusModal: true } })),
    closeStatusModal: () => set((state) => ({ ui: { ...state.ui, showStatusModal: false } })),

    setFilterStatus: (status: string) => {
      set((state) => ({ ui: { ...state.ui, filterStatus: status } }));
      // Refetch list with new filter
      get().fetchFeedbackList({ page: 1 });
    },

    setSearchTerm: (term: string) => {
      set((state) => ({ ui: { ...state.ui, searchTerm: term } }));
    },

    // ============================================================================
    // Actions - Reset
    // ============================================================================

    reset: () => set(initialState),

    resetDetail: () =>
      set({
        currentFeedbackId: null,
        feedback: null,
        loading: false,
        refreshing: false,
        error: null,
        actionLoading: false,
      }),
  }))
);

// ============================================================================
// Selectors
// ============================================================================

export const useFeedback = () => useFeedbackStore((state) => state.feedback);
export const useFeedbackLoading = () => useFeedbackStore((state) => state.loading);
export const useFeedbackError = () => useFeedbackStore((state) => state.error);
export const useFeedbackUI = () => useFeedbackStore((state) => state.ui);
export const useActionLoading = () => useFeedbackStore((state) => state.actionLoading);

// Check if current user can reply (only assigned user can reply)
export const useCanReply = () => {
  const feedback = useFeedbackStore((state) => state.feedback);
  // If feedback is assigned and not closed, can reply
  return (
    feedback?.assigned_to &&
    !['Đóng', 'Tự động đóng', 'Hoàn thành'].includes(feedback?.status || '')
  );
};

export const useFeedbackListData = () =>
  useFeedbackStore(
    useShallow((state) => ({
      feedbackList: state.feedbackList,
      loading: state.listLoading,
      refreshing: state.listRefreshing,
      error: state.listError,
      totalCount: state.totalCount,
      currentPage: state.currentPage,
    }))
  );

export const useFeedbackData = () =>
  useFeedbackStore(
    useShallow((state) => ({
      feedback: state.feedback,
      loading: state.loading,
      refreshing: state.refreshing,
      error: state.error,
    }))
  );

export const useFeedbackActions = () =>
  useFeedbackStore(
    useShallow((state) => ({
      fetchFeedbackList: state.fetchFeedbackList,
      refreshList: state.refreshList,
      fetchFeedback: state.fetchFeedback,
      refreshFeedback: state.refreshFeedback,
      assignToUser: state.assignToUser,
      addReply: state.addReply,
      updateStatus: state.updateStatus,
      closeFeedback: state.closeFeedback,
      deleteFeedback: state.deleteFeedback,
      updateAssignment: state.updateAssignment,
      actionLoading: state.actionLoading,
    }))
  );

export const useFeedbackUIActions = () =>
  useFeedbackStore(
    useShallow((state) => ({
      setUI: state.setUI,
      openAssignModal: state.openAssignModal,
      closeAssignModal: state.closeAssignModal,
      openStatusModal: state.openStatusModal,
      closeStatusModal: state.closeStatusModal,
      setFilterStatus: state.setFilterStatus,
      setSearchTerm: state.setSearchTerm,
    }))
  );

export const useSupportTeam = () =>
  useFeedbackStore(
    useShallow((state) => ({
      members: state.supportTeamMembers,
      loading: state.supportTeamLoading,
      fetch: state.fetchSupportTeam,
    }))
  );

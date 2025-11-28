import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { Ticket, Message, SubTask } from '../services/ticketService';

interface TicketStore {
  // Ticket data
  ticket: Ticket | null;
  loading: boolean;
  error: string | null;

  // Messages
  messages: Message[];
  messagesLoading: boolean;
  messagesError: string | null;

  // Subtasks
  subtasks: SubTask[];
  subtasksLoading: boolean;
  subtasksError: string | null;

  // UI states
  selectedMessage: Message | null;
  previewImage: string | null;
  isDragging: boolean;
  showStatusDialog: boolean;
  pendingStatus: string;

  // Computed values
  canSendMessage: boolean;
  hasIncompleteSubTasks: boolean;
  isLoading: boolean;

  // Actions
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setTicket: (ticket: Ticket) => void;
  updateTicket: (updates: Partial<Ticket>) => void;
  setMessagesLoading: (loading: boolean) => void;
  setMessagesError: (error: string | null) => void;
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
  setSubTasksLoading: (loading: boolean) => void;
  setSubTasksError: (error: string | null) => void;
  setSubTasks: (subtasks: SubTask[]) => void;
  updateSubTask: (id: string, updates: Partial<SubTask>) => void;
  addSubTask: (subtask: SubTask) => void;
  setSelectedMessage: (message: Message | null) => void;
  setPreviewImage: (image: string | null) => void;
  setDragging: (dragging: boolean) => void;
  setStatusDialog: (show: boolean, status?: string) => void;
  reset: () => void;
}

const initialState = {
  ticket: null,
  loading: false,
  error: null,
  messages: [],
  messagesLoading: false,
  messagesError: null,
  subtasks: [],
  subtasksLoading: false,
  subtasksError: null,
  selectedMessage: null,
  previewImage: null,
  isDragging: false,
  showStatusDialog: false,
  pendingStatus: '',
};

export const useTicketStore = create<TicketStore>()(
  subscribeWithSelector((set, get) => ({
    ...initialState,

    // Computed values (reactive)
    get canSendMessage() {
      const { ticket } = get();
      return ticket?.status === 'Processing' || ticket?.status === 'Waiting for Customer';
    },

    get hasIncompleteSubTasks() {
      const { subtasks } = get();
      return subtasks.some((task) => task.status !== 'Completed' && task.status !== 'Cancelled');
    },

    get isLoading() {
      const { loading, messagesLoading, subtasksLoading } = get();
      return loading || messagesLoading || subtasksLoading;
    },

    // Actions
    setLoading: (loading) => set({ loading }),
    setError: (error) => set({ error }),
    setTicket: (ticket) => set({ ticket, error: null }),
    updateTicket: (updates) =>
      set((state) => ({
        ticket: state.ticket ? { ...state.ticket, ...updates } : null,
      })),

    setMessagesLoading: (loading) => set({ messagesLoading: loading }),
    setMessagesError: (error) => set({ messagesError: error }),
    setMessages: (messages) => set({ messages, messagesError: null }),
    addMessage: (message) =>
      set((state) => ({
        messages: [...state.messages, message],
      })),

    setSubTasksLoading: (loading) => set({ subtasksLoading: loading }),
    setSubTasksError: (error) => set({ subtasksError: error }),
    setSubTasks: (subtasks) => set({ subtasks, subtasksError: null }),
    updateSubTask: (id, updates) =>
      set((state) => ({
        subtasks: state.subtasks.map((subtask) =>
          subtask._id === id ? { ...subtask, ...updates } : subtask
        ),
      })),
    addSubTask: (subtask) =>
      set((state) => ({
        subtasks: [...state.subtasks, subtask],
      })),

    setSelectedMessage: (message) => set({ selectedMessage: message }),
    setPreviewImage: (image) => set({ previewImage: image }),
    setDragging: (dragging) => set({ isDragging: dragging }),
    setStatusDialog: (show, status = '') =>
      set({
        showStatusDialog: show,
        pendingStatus: status,
      }),

    reset: () => set(initialState),
  }))
);

// Selectors for performance (only re-render when specific state changes)
export const useTicketData = () =>
  useTicketStore((state) => ({
    ticket: state.ticket,
    loading: state.loading,
    error: state.error,
    canSendMessage: state.canSendMessage,
  }));

export const useTicketMessages = () => {
  const messages = useTicketStore((state) => state.messages);
  const messagesLoading = useTicketStore((state) => state.messagesLoading);
  const messagesError = useTicketStore((state) => state.messagesError);
  const addMessage = useTicketStore((state) => state.addMessage);

  return {
    messages,
    messagesLoading,
    messagesError,
    addMessage,
  };
};

export const useTicketSubTasks = () =>
  useTicketStore((state) => ({
    subtasks: state.subtasks,
    subtasksLoading: state.subtasksLoading,
    subtasksError: state.subtasksError,
    hasIncompleteSubTasks: state.hasIncompleteSubTasks,
  }));

export const useTicketUI = () =>
  useTicketStore((state) => ({
    selectedMessage: state.selectedMessage,
    previewImage: state.previewImage,
    isDragging: state.isDragging,
    showStatusDialog: state.showStatusDialog,
    pendingStatus: state.pendingStatus,
  }));

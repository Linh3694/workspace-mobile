import { useState, useEffect, useCallback } from 'react';
import {
  getMyTickets,
  getAllTickets,
  getTicketDetail,
  createTicket,
  updateTicket,
  deleteTicket,
  sendMessage,
  getTicketMessages,
  getTicketHistory,
  assignTicketToMe,
  cancelTicket,
  reopenTicket,
  getTicketCategories,
  getSubTasks,
  createSubTask,
  updateSubTaskStatus,
  acceptFeedback,
  type Ticket,
  type Message,
  type TicketCategory,
  type SubTask,
  type Feedback,
  type TicketHistoryEntry,
} from '../services/ticketService';

// Hook for getting user's tickets
export const useMyTickets = () => {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTickets = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getMyTickets();
      setTickets(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch tickets');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const refetch = fetchTickets;

  return {
    tickets,
    loading,
    error,
    refetch,
  };
};

// Hook for getting all tickets (admin)
export const useAllTickets = () => {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTickets = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getAllTickets();
      setTickets(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch tickets');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const refetch = fetchTickets;

  return {
    tickets,
    loading,
    error,
    refetch,
  };
};

// Hook for getting ticket detail
export const useTicketDetail = (ticketId: string | undefined) => {
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTicket = useCallback(async () => {
    if (!ticketId) return;

    try {
      setLoading(true);
      setError(null);
      const data = await getTicketDetail(ticketId);
      setTicket(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch ticket detail');
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => {
    fetchTicket();
  }, [fetchTicket]);

  const refetch = fetchTicket;

  return {
    ticket,
    loading,
    error,
    refetch,
  };
};

// Hook for ticket messages
export const useTicketMessages = (ticketId: string | undefined) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMessages = useCallback(async () => {
    if (!ticketId) return;

    try {
      setLoading(true);
      setError(null);
      const data = await getTicketMessages(ticketId);
      setMessages(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch messages');
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  const addMessage = useCallback((message: Message) => {
    setMessages((prev) => [...prev, message]);
  }, []);

  const refetch = fetchMessages;

  return {
    messages,
    loading,
    error,
    addMessage,
    refetch,
  };
};

// Hook for ticket history
export const useTicketHistory = (ticketId: string | undefined) => {
  const [history, setHistory] = useState<TicketHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    if (!ticketId) return;

    try {
      setLoading(true);
      setError(null);
      const data = await getTicketHistory(ticketId);
      setHistory(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch history');
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const refetch = fetchHistory;

  return {
    history,
    loading,
    error,
    refetch,
  };
};

// Hook for ticket categories
export const useTicketCategories = () => {
  const [categories, setCategories] = useState<TicketCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCategories = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getTicketCategories();
      setCategories(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch categories');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const refetch = fetchCategories;

  return {
    categories,
    loading,
    error,
    refetch,
  };
};

// Hook for subtasks
export const useSubTasks = (ticketId: string | undefined) => {
  const [subtasks, setSubtasks] = useState<SubTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSubtasks = useCallback(async () => {
    if (!ticketId) return;

    try {
      setLoading(true);
      setError(null);
      const data = await getSubTasks(ticketId);
      setSubtasks(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch subtasks');
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => {
    fetchSubtasks();
  }, [fetchSubtasks]);

  const addSubtask = useCallback((subtask: SubTask) => {
    setSubtasks((prev) => [...prev, subtask]);
  }, []);

  const updateSubtask = useCallback((subtaskId: string, updates: Partial<SubTask>) => {
    setSubtasks((prev) => prev.map((st) => (st._id === subtaskId ? { ...st, ...updates } : st)));
  }, []);

  const refetch = fetchSubtasks;

  return {
    subtasks,
    loading,
    error,
    addSubtask,
    updateSubtask,
    refetch,
  };
};

// Hook for sending messages
export const useSendMessage = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = useCallback(
    async (ticketId: string, messageData: { text?: string; images?: any[] }) => {
      try {
        setLoading(true);
        setError(null);
        const message = await sendMessage(ticketId, messageData);
        return message;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to send message';
        setError(errorMessage);
        throw new Error(errorMessage);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return {
    send,
    loading,
    error,
  };
};

// Hook for updating tickets
export const useUpdateTicket = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = useCallback(async (ticketId: string, updates: Partial<Ticket>) => {
    try {
      setLoading(true);
      setError(null);
      const ticket = await updateTicket(ticketId, updates);
      return ticket;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update ticket';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    update,
    loading,
    error,
  };
};

// Hook for creating tickets
export const useCreateTicket = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = useCallback(
    async (ticketData: {
      title: string;
      description: string;
      category: string;
      notes?: string;
      priority?: string;
      files?: any[];
    }) => {
      try {
        setLoading(true);
        setError(null);
        const ticket = await createTicket(ticketData);
        return ticket;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to create ticket';
        setError(errorMessage);
        throw new Error(errorMessage);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return {
    create,
    loading,
    error,
  };
};

// Hook for ticket actions
export const useTicketActions = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const assignToMe = useCallback(async (ticketId: string) => {
    try {
      setLoading(true);
      setError(null);
      const ticket = await assignTicketToMe(ticketId);
      return ticket;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to assign ticket';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  const cancel = useCallback(async (ticketId: string, reason: string) => {
    try {
      setLoading(true);
      setError(null);
      const ticket = await cancelTicket(ticketId, reason);
      return ticket;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to cancel ticket';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  const reopen = useCallback(async (ticketId: string) => {
    try {
      setLoading(true);
      setError(null);
      const ticket = await reopenTicket(ticketId);
      return ticket;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to reopen ticket';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  const submitFeedback = useCallback(async (ticketId: string, feedback: Feedback) => {
    try {
      setLoading(true);
      setError(null);
      const ticket = await acceptFeedback(ticketId, feedback);
      return ticket;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to submit feedback';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    assignToMe,
    cancel,
    reopen,
    submitFeedback,
    loading,
    error,
  };
};

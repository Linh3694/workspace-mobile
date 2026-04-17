import { useState, useEffect, useCallback } from 'react';
import {
  getMyAdminTickets,
  getAllAdminTickets,
  getAdminTicketDetail,
  sendAdminTicketMessage,
  getAdminTicketMessages,
  getAdminTicketHistory,
  getAdminTicketCategories,
  createAdminTicket,
  updateAdminTicket,
  assignAdminTicketToMe,
  cancelAdminTicket,
  reopenAdminTicket,
  acceptAdminFeedback,
  type AdministrativeTicket,
  type AdminTicketMessage,
  type AdminTicketCategory,
  type AdminTicketHistoryEntry,
  type AdminFeedbackData,
} from '../services/administrativeTicketService';

export const useMyAdministrativeTickets = () => {
  const [tickets, setTickets] = useState<AdministrativeTicket[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTickets = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getMyAdminTickets();
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

  return { tickets, loading, error, refetch: fetchTickets };
};

export const useAllAdministrativeTickets = () => {
  const [tickets, setTickets] = useState<AdministrativeTicket[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTickets = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getAllAdminTickets();
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

  return { tickets, loading, error, refetch: fetchTickets };
};

export const useAdministrativeTicketDetail = (ticketId: string | undefined) => {
  const [ticket, setTicket] = useState<AdministrativeTicket | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTicket = useCallback(async () => {
    if (!ticketId) return;
    try {
      setLoading(true);
      setError(null);
      const data = await getAdminTicketDetail(ticketId);
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

  return { ticket, loading, error, refetch: fetchTicket };
};

export const useAdministrativeTicketMessagesHook = (ticketId: string | undefined) => {
  const [messages, setMessages] = useState<AdminTicketMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMessages = useCallback(async () => {
    if (!ticketId) return;
    try {
      setLoading(true);
      setError(null);
      const data = await getAdminTicketMessages(ticketId);
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

  const addMessage = useCallback((message: AdminTicketMessage) => {
    setMessages((prev) => [...prev, message]);
  }, []);

  return { messages, loading, error, addMessage, refetch: fetchMessages };
};

export const useAdministrativeTicketHistory = (ticketId: string | undefined) => {
  const [history, setHistory] = useState<AdminTicketHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    if (!ticketId) return;
    try {
      setLoading(true);
      setError(null);
      const data = await getAdminTicketHistory(ticketId);
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

  return { history, loading, error, refetch: fetchHistory };
};

export const useAdministrativeTicketCategories = () => {
  const [categories, setCategories] = useState<AdminTicketCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCategories = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getAdminTicketCategories();
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

  return { categories, loading, error, refetch: fetchCategories };
};

export const useSendAdministrativeMessage = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = useCallback(
    async (
      id: string,
      messageData: { text?: string; images?: { uri: string; name: string; type: string }[] }
    ) => {
      try {
        setLoading(true);
        setError(null);
        await sendAdminTicketMessage(id, messageData.text || '', messageData.images);
        return true;
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

  return { send, loading, error };
};

export const useCreateAdministrativeTicket = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = useCallback(
    async (payload: Parameters<typeof createAdminTicket>[0]) => {
      try {
        setLoading(true);
        setError(null);
        const ticket = await createAdminTicket(payload);
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

  return { create, loading, error };
};

export const useUpdateAdministrativeTicket = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = useCallback(async (payload: Parameters<typeof updateAdminTicket>[0]) => {
    try {
      setLoading(true);
      setError(null);
      const ticket = await updateAdminTicket(payload);
      return ticket;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update ticket';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  return { update, loading, error };
};

export const useAdministrativeTicketActionsHook = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const assignToMe = useCallback(async (ticketId: string) => {
    try {
      setLoading(true);
      setError(null);
      return await assignAdminTicketToMe(ticketId);
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
      return await cancelAdminTicket(ticketId, reason);
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
      return await reopenAdminTicket(ticketId);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to reopen ticket';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  const submitFeedback = useCallback(async (ticketId: string, feedback: AdminFeedbackData) => {
    try {
      setLoading(true);
      setError(null);
      await acceptAdminFeedback(ticketId, feedback);
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

/**
 * Notification Center — Phase 3: notification-service (PostgreSQL inbox).
 * Map REST → NotificationData cho NotificationsScreen / HomeScreen.
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { notificationRequest } = require('./notificationApiClient');

export interface NotificationData {
  _id?: string;
  id?: string;
  title: string | { vi: string; en: string };
  message: string | { vi: string; en: string };
  data: Record<string, unknown>;
  read: boolean;
  createdAt: string;
  eventTimestamp?: string;
  type?: string;
  student_name?: string;
}

export interface NotificationListResponse {
  success: boolean;
  data: {
    notifications: NotificationData[];
    unread_count: number;
    total: number;
  };
  message?: string;
}

export interface GetNotificationsParams {
  type?: string;
  status?: string;
  limit?: number;
  offset?: number;
  include_read?: boolean;
}

type InboxApiRow = {
  id: string;
  title: string;
  body: string;
  titleVi?: string | null;
  titleEn?: string | null;
  bodyVi?: string | null;
  bodyEn?: string | null;
  eventType: string;
  readAt?: string | null;
  createdAt: string;
  dataJson?: Record<string, unknown> | null;
};

function mapRow(row: InboxApiRow): NotificationData {
  const baseData =
    row.dataJson && typeof row.dataJson === 'object' ? { ...row.dataJson } : {};

  const title: string | { vi: string; en: string } =
    row.titleVi || row.titleEn
      ? {
          vi: row.titleVi || row.title || '',
          en: row.titleEn || row.title || '',
        }
      : row.title || '';

  const message: string | { vi: string; en: string } =
    row.bodyVi || row.bodyEn
      ? {
          vi: row.bodyVi || row.body || '',
          en: row.bodyEn || row.body || '',
        }
      : row.body || '';

  return {
    id: row.id,
    title,
    message,
    data: {
      ...baseData,
      type:
        (baseData.type as string | undefined) || row.eventType || 'system',
    },
    read: Boolean(row.readAt),
    createdAt:
      typeof row.createdAt === 'string'
        ? row.createdAt
        : new Date(row.createdAt).toISOString(),
    type: row.eventType,
  };
}

class NotificationCenterService {
  private basePath = '/api/notifications/inbox';

  async getNotifications(
    params: GetNotificationsParams = {}
  ): Promise<NotificationListResponse> {
    try {
      const limit = params.limit || 200;
      const offset = params.offset || 0;
      const page = Math.floor(offset / Math.max(limit, 1)) + 1;
      const readFilter =
        params.status === 'unread'
          ? 'unread'
          : params.status === 'read'
            ? 'read'
            : 'all';

      const res = await notificationRequest({
        method: 'GET',
        url: this.basePath,
        params: {
          page,
          pageSize: limit,
          readFilter,
        },
      });

      const body = res.data as {
        success?: boolean;
        data?: { items: InboxApiRow[]; total: number };
        message?: string;
      };

      if (!body.success || !body.data) {
        return {
          success: false,
          data: {
            notifications: [],
            unread_count: 0,
            total: 0,
          },
          message: body.message || 'Failed',
        };
      }

      let notifications = body.data.items.map(mapRow);

      if (params.include_read === false) {
        notifications = notifications.filter((n) => !n.read);
      }
      if (params.type) {
        notifications = notifications.filter(
          (n) =>
            n.type === params.type ||
            String(n.data?.type) === params.type
        );
      }

      const unreadRes = await this.getUnreadCount();
      const unread_count = unreadRes.success
        ? unreadRes.data.unread_count
        : notifications.filter((x) => !x.read).length;

      return {
        success: true,
        data: {
          notifications,
          unread_count,
          total: body.data.total,
        },
      };
    } catch (error: unknown) {
      console.error('❌ [NotificationCenter] Error:', error);
      return {
        success: false,
        data: {
          notifications: [],
          unread_count: 0,
          total: 0,
        },
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async getUnreadCount(): Promise<{ success: boolean; data: { unread_count: number } }> {
    try {
      const res = await notificationRequest({
        method: 'GET',
        url: '/api/notifications/inbox/unread-count',
      });
      const body = res.data as {
        success?: boolean;
        data?: { count: number };
      };
      const count = body.data?.count ?? 0;
      return { success: true, data: { unread_count: count } };
    } catch {
      return { success: false, data: { unread_count: 0 } };
    }
  }

  async markAsRead(
    notificationId: string
  ): Promise<{ success: boolean; message?: string }> {
    try {
      const res = await notificationRequest({
        method: 'POST',
        url: `${this.basePath}/${encodeURIComponent(notificationId)}/read`,
        data: {},
      });
      return { success: Boolean(res.data?.success !== false) };
    } catch (e) {
      return {
        success: false,
        message: e instanceof Error ? e.message : 'Unknown error',
      };
    }
  }

  async markAllAsRead(): Promise<{ success: boolean; message?: string }> {
    try {
      await notificationRequest({
        method: 'POST',
        url: '/api/notifications/inbox/read-all',
        data: {},
      });
      return { success: true };
    } catch (e) {
      return {
        success: false,
        message: e instanceof Error ? e.message : 'Unknown error',
      };
    }
  }

  /** Chưa có API xoá trên notification-service */
  async deleteNotification(
    _notificationId: string
  ): Promise<{ success: boolean; message?: string }> {
    return {
      success: false,
      message: 'delete_notification chưa được hỗ trợ trên notification-service',
    };
  }
}

export const notificationCenterService = new NotificationCenterService();
export default notificationCenterService;

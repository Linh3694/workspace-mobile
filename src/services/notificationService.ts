import { EventEmitter } from 'events';

export interface NotificationData {
  id: string;
  type: 'success' | 'warning' | 'error' | 'info';
  title: string;
  message: string;
  duration?: number;
  icon?: string;
  groupId?: string;
  userId?: string;
  timestamp: Date;
}

class NotificationService extends EventEmitter {
  private notifications: NotificationData[] = [];

  showNotification(notification: Omit<NotificationData, 'id' | 'timestamp'>) {
    const newNotification: NotificationData = {
      ...notification,
      id: `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      duration: notification.duration || 3000,
    };

    this.notifications.push(newNotification);
    this.emit('notification', newNotification);

    // Auto remove after duration
    if (newNotification.duration && newNotification.duration > 0) {
      setTimeout(() => {
        this.removeNotification(newNotification.id);
      }, newNotification.duration);
    }

    return newNotification.id;
  }

  removeNotification(id: string) {
    this.notifications = this.notifications.filter(n => n.id !== id);
    this.emit('notificationRemoved', id);
  }

  clearAllNotifications() {
    this.notifications = [];
    this.emit('allNotificationsCleared');
  }

  getNotifications() {
    return [...this.notifications];
  }

  // Group-specific notification methods
  showMemberAddedNotification(groupName: string, memberName: string, addedBy: string) {
    return this.showNotification({
      type: 'success',
      title: 'Thành viên mới',
      message: `${memberName} đã được ${addedBy} thêm vào nhóm "${groupName}"`,
      icon: 'person-add',
      duration: 4000,
    });
  }

  showMemberRemovedNotification(groupName: string, memberName: string, removedBy: string) {
    return this.showNotification({
      type: 'warning',
      title: 'Thành viên bị xóa',
      message: `${memberName} đã bị ${removedBy} xóa khỏi nhóm "${groupName}"`,
      icon: 'person-remove',
      duration: 4000,
    });
  }

  showMemberLeftNotification(groupName: string, memberName: string) {
    return this.showNotification({
      type: 'info',
      title: 'Thành viên rời nhóm',
      message: `${memberName} đã rời khỏi nhóm "${groupName}"`,
      icon: 'exit-to-app',
      duration: 4000,
    });
  }

  showAdminPromotedNotification(groupName: string, memberName: string, promotedBy: string) {
    return this.showNotification({
      type: 'success',
      title: 'Admin mới',
      message: `${memberName} đã được ${promotedBy} thăng chức admin trong nhóm "${groupName}"`,
      icon: 'admin-panel-settings',
      duration: 4000,
    });
  }

  showAdminDemotedNotification(groupName: string, memberName: string, demotedBy: string) {
    return this.showNotification({
      type: 'warning',
      title: 'Gỡ quyền admin',
      message: `${memberName} đã bị ${demotedBy} gỡ quyền admin trong nhóm "${groupName}"`,
      icon: 'admin-panel-settings',
      duration: 4000,
    });
  }

  showGroupInfoUpdatedNotification(groupName: string, updatedBy: string) {
    return this.showNotification({
      type: 'info',
      title: 'Cập nhật thông tin nhóm',
      message: `${updatedBy} đã cập nhật thông tin nhóm "${groupName}"`,
      icon: 'edit',
      duration: 3000,
    });
  }

  showYouWereAddedNotification(groupName: string, addedBy: string) {
    return this.showNotification({
      type: 'success',
      title: 'Bạn được thêm vào nhóm',
      message: `${addedBy} đã thêm bạn vào nhóm "${groupName}"`,
      icon: 'group-add',
      duration: 5000,
    });
  }

  showYouWereRemovedNotification(groupName: string, removedBy: string) {
    return this.showNotification({
      type: 'error',
      title: 'Bạn bị xóa khỏi nhóm',
      message: `${removedBy} đã xóa bạn khỏi nhóm "${groupName}"`,
      icon: 'group',
      duration: 5000,
    });
  }

  showYouBecameAdminNotification(groupName: string, promotedBy: string) {
    return this.showNotification({
      type: 'success',
      title: 'Bạn được thăng chức admin',
      message: `${promotedBy} đã thăng bạn làm admin nhóm "${groupName}"`,
      icon: 'admin-panel-settings',
      duration: 5000,
    });
  }
}

export const notificationService = new NotificationService();
export default notificationService; 
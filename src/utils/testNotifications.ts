import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Utility functions to test push notifications without a real device
 */

// Schedule a local notification (works on emulator)
export const sendTestLocalNotification = async (
  title: string = 'Test Notification',
  body: string = 'This is a test notification from the app'
) => {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: { type: 'test', timestamp: new Date().toISOString() },
        sound: 'default',
      },
      trigger: null, // Send immediately
    });
    console.log('✅ Local notification sent successfully');
    return true;
  } catch (error) {
    console.error('❌ Error sending local notification:', error);
    return false;
  }
};

// Schedule notification with delay (to test background handling)
export const sendDelayedTestNotification = async (seconds: number = 5) => {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Delayed Test',
        body: `This notification was scheduled ${seconds} seconds ago`,
        data: { type: 'delayed_test' },
        sound: 'default',
      },
      trigger: { seconds },
    });
    console.log(`✅ Notification scheduled for ${seconds} seconds`);
    return true;
  } catch (error) {
    console.error('❌ Error scheduling notification:', error);
    return false;
  }
};

// Test attendance notification format
export const sendTestAttendanceNotification = async () => {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '✅ Chấm công thành công',
        body: 'Nguyễn Văn A đã chấm công lúc 08:00',
        data: {
          type: 'attendance',
          employeeCode: 'TEST001',
          employeeName: 'Nguyễn Văn A',
          timestamp: new Date().toISOString(),
          deviceName: 'Test Device',
        },
        sound: 'default',
      },
      trigger: null,
    });
    console.log('✅ Test attendance notification sent');
    return true;
  } catch (error) {
    console.error('❌ Error:', error);
    return false;
  }
};

// Test ticket notification format
export const sendTestTicketNotification = async () => {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🎫 Ticket mới',
        body: 'Bạn có ticket hỗ trợ mới cần xử lý',
        data: {
          type: 'ticket_created',
          ticketId: 'TEST-TICKET-001',
          ticketCode: 'TK-001',
          action: 'new_ticket_admin',
        },
        sound: 'default',
      },
      trigger: null,
    });
    console.log('✅ Test ticket notification sent');
    return true;
  } catch (error) {
    console.error('❌ Error:', error);
    return false;
  }
};

// Get notification permissions status and token info
export const getNotificationDebugInfo = async () => {
  const { status } = await Notifications.getPermissionsAsync();
  const projectId = Constants?.expoConfig?.extra?.eas?.projectId;
  
  let token = null;
  let tokenError = null;
  
  // Try to get token on real device OR emulator in dev mode
  if (Device.isDevice || __DEV__) {
    try {
      const tokenResult = await Notifications.getExpoPushTokenAsync({
        projectId,
      });
      token = tokenResult.data;
    } catch (error: any) {
      tokenError = error.message;
    }
  }

  const debugInfo = {
    isDevice: Device.isDevice,
    platform: Platform.OS,
    permissionStatus: status,
    projectId,
    pushToken: token,
    tokenError,
    deviceName: Device.deviceName,
    osVersion: Device.osVersion,
  };

  console.log('📱 Notification Debug Info:', JSON.stringify(debugInfo, null, 2));
  return debugInfo;
};

// Cancel all scheduled notifications
export const cancelAllTestNotifications = async () => {
  await Notifications.cancelAllScheduledNotificationsAsync();
  await Notifications.dismissAllNotificationsAsync();
  console.log('🧹 All notifications cancelled');
};


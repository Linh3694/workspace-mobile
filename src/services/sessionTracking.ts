/**
 * Session Tracking Service
 * Track app opens, resumes, and user activity for Parent Portal Analytics
 */

import api from './api';

interface SessionTrackingResponse {
  success: boolean;
  message?: string;
}

class SessionTrackingService {
  /**
   * Track when user opens or resumes the app
   * Call this on:
   * - App start (cold start)
   * - App resume (from background)
   * 
   * @returns Promise<SessionTrackingResponse>
   */
  async trackAppSession(): Promise<SessionTrackingResponse> {
    try {
      const response = await api.post<SessionTrackingResponse>(
        '/api/method/erp.api.parent_portal.session_tracking.track_app_session'
      );
      
      console.log('📱 [Session Tracking] App session tracked successfully');
      return response.data || { success: false };
    } catch (error) {
      console.error('❌ [Session Tracking] Failed to track app session:', error);
      // Don't throw error - tracking should fail silently
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Optional: Track when user closes or backgrounds the app
   * 
   * @returns Promise<SessionTrackingResponse>
   */
  async trackAppClose(): Promise<SessionTrackingResponse> {
    try {
      const response = await api.post<SessionTrackingResponse>(
        '/api/method/erp.api.parent_portal.session_tracking.track_app_close'
      );
      
      console.log('📱 [Session Tracking] App close tracked successfully');
      return response.data || { success: false };
    } catch (error) {
      console.error('❌ [Session Tracking] Failed to track app close:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

export const sessionTrackingService = new SessionTrackingService();
export default sessionTrackingService;

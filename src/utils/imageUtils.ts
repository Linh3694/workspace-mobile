/**
 * Utility functions for handling image URLs in mobile app
 */

import { API_BASE_URL } from '../config/constants';

/**
 * Convert relative image URL from backend to full URL
 * @param relativeUrl - Relative URL from backend (e.g., "/files/image.jpg" or "files/image.jpg")
 * @returns Full URL or undefined if no image
 */
export function getFullImageUrl(relativeUrl: string | null | undefined): string | undefined {
  if (!relativeUrl || relativeUrl.trim() === '') {
    return undefined;
  }

  // If already a full URL (starts with http/https), return as is
  if (relativeUrl.startsWith('http://') || relativeUrl.startsWith('https://')) {
    return relativeUrl;
  }

  // If starts with file:// (React Native file system), return as is
  if (relativeUrl.startsWith('file://')) {
    return relativeUrl;
  }

  // If starts with blob: (for preview), return as is
  if (relativeUrl.startsWith('blob:')) {
    return relativeUrl;
  }

  // Get base URL from constants
  const baseUrl = API_BASE_URL;

  // Ensure relative URL starts with /
  const normalizedPath = relativeUrl.startsWith('/') ? relativeUrl : `/${relativeUrl}`;

  return `${baseUrl}${normalizedPath}`;
}

/**
 * Check if image URL is valid and should be displayed
 * @param imageUrl - Image URL to check
 * @returns True if image should be displayed
 */
export function hasValidImage(imageUrl: string | null | undefined): boolean {
  return Boolean(imageUrl && imageUrl.trim() !== '');
}

/**
 * Get optimized image URL for different screen sizes
 * @param imageUrl - Original image URL
 * @param size - Desired size (thumbnail, medium, large)
 * @returns Optimized URL
 */
export function getOptimizedImageUrl(
  imageUrl: string | null | undefined,
  size: 'thumbnail' | 'medium' | 'large' = 'medium'
): string | undefined {
  const fullUrl = getFullImageUrl(imageUrl);
  if (!fullUrl) return undefined;

  // For now, just return the full URL
  // In the future, you could implement image optimization service
  return fullUrl;
}














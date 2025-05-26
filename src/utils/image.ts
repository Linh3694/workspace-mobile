import { API_BASE_URL } from '../config/constants';

export const processImageUrl = (url: string | undefined) => {
    if (!url) return 'https://via.placeholder.com/150'; // Fallback image
    return url.startsWith('http') ? url : `${API_BASE_URL}${url}`;
};
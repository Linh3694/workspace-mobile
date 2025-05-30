import { API_BASE_URL } from '../config/constants';

export const processImageUrl = (url: string | undefined) => {
    if (!url) return 'https://via.placeholder.com/150'; // Fallback image
    
    // Xử lý đặc biệt cho ticket icons - trả về placeholder
    if (url === 'ticket-icon.svg' || url === 'ticket.svg') {
        return 'https://via.placeholder.com/150/F9FBEB/F88F19?text=🎫'; // Ticket icon placeholder với màu giống SVG
    }
    
    // Nếu đã là URL đầy đủ (http/https), trả về nguyên bản
    if (url.startsWith('http')) {
        return url;
    }
    
    // Nếu đường dẫn bắt đầu bằng '/', thêm API_BASE_URL
    if (url.startsWith('/')) {
        return `${API_BASE_URL}${url}`;
    }
    
    // Nếu là đường dẫn tương đối, thêm API_BASE_URL và '/'
    return `${API_BASE_URL}/${url}`;
};
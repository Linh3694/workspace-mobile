/**
 * React Native vẫn có thể gửi cookie session Frappe (sid) cùng Bearer → resume session hỏng (user=null) → HTTP 417.
 * API mobile chỉ cần Authorization; tắt credentials để axios không đính kèm cookie.
 */
import axios from 'axios';

axios.defaults.withCredentials = false;

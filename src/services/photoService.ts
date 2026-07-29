import api from '../utils/api';

/** Ảnh trong DocType `SIS Photo` (ảnh lớp / ảnh HS). */
export interface SISPhoto {
  name?: string;
  title?: string;
  type?: string;
  student_id?: string;
  class_id?: string;
  photo?: string;
  status?: string;
}

const PHOTO_URL = '/method/erp.sis.doctype.sis_photo.sis_photo';

class PhotoService {
  /** Ảnh đại diện lớp theo năm học — dùng cho avatar nhóm chat lớp (giống web). */
  async getClassPhotos(classId: string, schoolYearId?: string, limit = 10): Promise<SISPhoto[]> {
    try {
      const response = await api.get(`${PHOTO_URL}.get_photos_list`, {
        params: {
          photo_type: 'class',
          class_id: classId,
          school_year_id: schoolYearId,
          page: 1,
          limit,
        },
      });
      const result = response.data?.message || response.data;
      const photos = result?.data;
      return Array.isArray(photos) ? photos : [];
    } catch (error) {
      console.error('Error fetching class photos:', error);
      return [];
    }
  }
}

export const photoService = new PhotoService();

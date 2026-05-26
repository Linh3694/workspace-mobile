import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL } from '../config/constants';
import { Post, PostsResponse, CreatePostResponse, CreatePostData, MediaFile } from '../types/post';

class PostService {
  private async getAuthHeaders() {
    const token = await AsyncStorage.getItem('authToken');
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }

  private async getMultipartHeaders() {
    const token = await AsyncStorage.getItem('authToken');
    return {
      Authorization: `Bearer ${token}`,
      // Don't set Content-Type for multipart, let fetch set it
    };
  }

  /** Feed nhật ký theo lớp — audienceType class (giáo viên GVCN/phó) */
  async getClassFeed(
    classId: string,
    schoolYearId: string,
    page = 1,
    limit = 10
  ): Promise<PostsResponse['data']> {
    try {
      const headers = await this.getAuthHeaders();
      const q = new URLSearchParams({
        classId,
        schoolYearId,
        page: String(page),
        limit: String(limit),
      }).toString();
      const url = `${BASE_URL}/api/social/class-feed?${q}`;
      const response = await fetch(url, { headers });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch class feed: ${response.status} ${errorText}`);
      }
      const data: PostsResponse = await response.json();
      return data.data;
    } catch (e) {
      console.error('[PostService] getClassFeed:', e);
      throw e;
    }
  }

  async createClassPost(payload: {
    classId: string;
    schoolYearId: string;
    content: string;
    files: MediaFile[];
    type?: Post['type'];
    /** Mention tags (Mongo user id) — tùy chọn */
    tags?: string[];
  }): Promise<Post> {
    const headers = await this.getMultipartHeaders();
    const formData = new FormData();
    const text =
      payload.content.trim() ||
      (payload.files?.length ? `Bài chia sẻ từ lớp` : '');
    formData.append('content', text);
    formData.append('type', payload.type || 'Chia sẻ');
    formData.append('visibility', 'public');
    formData.append('audienceType', 'class');
    formData.append('classId', payload.classId);
    formData.append('schoolYearId', payload.schoolYearId);
    if (payload.tags?.length) {
      formData.append('tags', JSON.stringify(payload.tags));
    }
    (payload.files || []).forEach((file) => {
      formData.append('files', {
        uri: file.uri,
        type: file.type,
        name: file.name,
      } as unknown as Blob);
    });
    const response = await fetch(`${BASE_URL}/api/social/`, {
      method: 'POST',
      headers,
      body: formData as unknown as BodyInit,
    });
    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`Failed to create class post: ${response.status} ${errorText}`);
    }
    const data: CreatePostResponse = await response.json();
    return data.data;
  }

  async getNewsfeed(page = 1, limit = 10): Promise<PostsResponse['data']> {
    try {
      const headers = await this.getAuthHeaders();
      console.log(
        '🔍 [PostService] Fetching newsfeed:',
        `${BASE_URL}/api/social/newsfeed?page=${page}&limit=${limit}`
      );
      console.log('🔍 [PostService] Headers:', headers);

      const response = await fetch(`${BASE_URL}/api/social/newsfeed?page=${page}&limit=${limit}`, {
        headers,
      });

      console.log('🔍 [PostService] Response status:', response.status);
      console.log('🔍 [PostService] Response ok:', response.ok);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('🔍 [PostService] Error response:', errorText);
        throw new Error(`Failed to fetch newsfeed: ${response.status} ${errorText}`);
      }

      const data: PostsResponse = await response.json();
      console.log('🔍 [PostService] Success response:', data);
      return data.data;
    } catch (error) {
      console.error('🔍 [PostService] Fetch error:', error);
      throw error;
    }
  }

  async searchPosts(query: string, page = 1, limit = 10): Promise<PostsResponse['data']> {
    const headers = await this.getAuthHeaders();
    const response = await fetch(
      `${BASE_URL}/api/social/search?q=${encodeURIComponent(query)}&page=${page}&limit=${limit}`,
      { headers }
    );

    if (!response.ok) {
      throw new Error('Failed to search posts');
    }

    const data: PostsResponse = await response.json();
    return data.data;
  }

  async createPost(postData: CreatePostData): Promise<Post> {
    const headers = await this.getMultipartHeaders();

    const formData = new FormData();
    formData.append('content', postData.content);
    formData.append('type', postData.type || 'Chia sẻ');
    formData.append('visibility', postData.visibility || 'public');

    if (postData.tags) {
      formData.append('tags', JSON.stringify(postData.tags));
    }

    if (postData.department) {
      formData.append('department', postData.department);
    }

    if (postData.badgeInfo) {
      formData.append('badgeInfo', JSON.stringify(postData.badgeInfo));
    }

    // Add files
    if (postData.files && postData.files.length > 0) {
      postData.files.forEach((file) => {
        formData.append('files', {
          uri: file.uri,
          type: file.type,
          name: file.name,
        } as any);
      });
    }

    // Lưu ý: cần dấu '/' cuối để Nginx match location /api/social/
    const response = await fetch(`${BASE_URL}/api/social/`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.error('🔴 [PostService] Create post failed:', response.status, errorText);
      throw new Error(`Failed to create post: ${response.status} ${errorText}`);
    }

    const data: CreatePostResponse = await response.json();
    return data.data;
  }

  async updatePost(postId: string, postData: Partial<CreatePostData>): Promise<Post> {
    const headers = await this.getAuthHeaders();
    const response = await fetch(`${BASE_URL}/api/social/${postId}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(postData),
    });

    if (!response.ok) {
      throw new Error('Failed to update post');
    }

    const data: CreatePostResponse = await response.json();
    return data.data;
  }

  async deletePost(postId: string): Promise<void> {
    const headers = await this.getAuthHeaders();
    const response = await fetch(`${BASE_URL}/api/social/${postId}`, {
      method: 'DELETE',
      headers,
    });

    if (!response.ok) {
      throw new Error('Failed to delete post');
    }
  }

  async addReaction(postId: string, type: string): Promise<Post> {
    const headers = await this.getAuthHeaders();
    const response = await fetch(`${BASE_URL}/api/social/${postId}/reactions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ type }),
    });

    if (!response.ok) {
      throw new Error('Failed to add reaction');
    }

    const data: CreatePostResponse = await response.json();
    return data.data;
  }

  async removeReaction(postId: string): Promise<Post> {
    const headers = await this.getAuthHeaders();
    const response = await fetch(`${BASE_URL}/api/social/${postId}/reactions`, {
      method: 'DELETE',
      headers,
    });

    if (!response.ok) {
      throw new Error('Failed to remove reaction');
    }

    const data: CreatePostResponse = await response.json();
    return data.data;
  }

  async addComment(postId: string, content: string): Promise<Post> {
    const headers = await this.getAuthHeaders();
    const response = await fetch(`${BASE_URL}/api/social/${postId}/comments`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ content }),
    });

    if (!response.ok) {
      throw new Error('Failed to add comment');
    }

    const data: CreatePostResponse = await response.json();
    return data.data;
  }

  async deleteComment(postId: string, commentId: string): Promise<Post> {
    const headers = await this.getAuthHeaders();
    const response = await fetch(`${BASE_URL}/api/social/${postId}/comments/${commentId}`, {
      method: 'DELETE',
      headers,
    });

    if (!response.ok) {
      throw new Error('Failed to delete comment');
    }

    const data: CreatePostResponse = await response.json();
    return data.data;
  }

  async getTrendingPosts(limit = 10, timeFrame = 7): Promise<Post[]> {
    const headers = await this.getAuthHeaders();
    const response = await fetch(
      `${BASE_URL}/api/social/trending?limit=${limit}&timeFrame=${timeFrame}`,
      { headers }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch trending posts');
    }

    const data = await response.json();
    return data.data;
  }

  async getPersonalizedFeed(page = 1, limit = 10): Promise<PostsResponse['data']> {
    const headers = await this.getAuthHeaders();
    const response = await fetch(
      `${BASE_URL}/api/social/personalized?page=${page}&limit=${limit}`,
      { headers }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch personalized feed');
    }

    const data: PostsResponse = await response.json();
    return data.data;
  }

  /**
   * Lấy chi tiết một bài post theo ID
   * @param postId - ID của bài post
   */
  async getPostById(postId: string): Promise<Post> {
    const headers = await this.getAuthHeaders();
    const response = await fetch(`${BASE_URL}/api/social/${postId}`, {
      headers,
    });

    if (!response.ok) {
      throw new Error('Failed to fetch post');
    }

    const data: CreatePostResponse = await response.json();
    return data.data;
  }

  // ========== CÁC METHODS MỚI CHO COMMENT FEATURES ==========

  // Thêm reaction cho comment
  async addCommentReaction(postId: string, commentId: string, type: string): Promise<Post> {
    const headers = await this.getAuthHeaders();
    const response = await fetch(
      `${BASE_URL}/api/social/${postId}/comments/${commentId}/reactions`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ type }),
      }
    );

    if (!response.ok) {
      throw new Error('Failed to add comment reaction');
    }

    const data: CreatePostResponse = await response.json();
    return data.data;
  }

  // Xóa reaction khỏi comment
  async removeCommentReaction(postId: string, commentId: string): Promise<Post> {
    const headers = await this.getAuthHeaders();
    const response = await fetch(
      `${BASE_URL}/api/social/${postId}/comments/${commentId}/reactions`,
      {
        method: 'DELETE',
        headers,
      }
    );

    if (!response.ok) {
      throw new Error('Failed to remove comment reaction');
    }

    const data: CreatePostResponse = await response.json();
    return data.data;
  }

  // Reply comment
  async replyComment(postId: string, commentId: string, content: string): Promise<Post> {
    const headers = await this.getAuthHeaders();
    const response = await fetch(`${BASE_URL}/api/social/${postId}/comments/${commentId}/replies`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ content }),
    });

    if (!response.ok) {
      throw new Error('Failed to reply comment');
    }

    const data: CreatePostResponse = await response.json();
    return data.data;
  }

  // ========== PIN POST FEATURE (CHỈ MOBILE BOD) ==========

  /**
   * Pin một bài viết (chỉ Mobile BOD)
   * Bài viết được pin sẽ hiển thị ở đầu danh sách cho tất cả mọi người
   */
  async pinPost(postId: string): Promise<Post> {
    const headers = await this.getAuthHeaders();
    const response = await fetch(`${BASE_URL}/api/social/${postId}/pin`, {
      method: 'POST',
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`Failed to pin post: ${response.status} ${errorText}`);
    }

    const data: CreatePostResponse = await response.json();
    return data.data;
  }

  /**
   * Unpin một bài viết (chỉ Mobile BOD)
   */
  async unpinPost(postId: string): Promise<Post> {
    const headers = await this.getAuthHeaders();
    const response = await fetch(`${BASE_URL}/api/social/${postId}/pin`, {
      method: 'DELETE',
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`Failed to unpin post: ${response.status} ${errorText}`);
    }

    const data: CreatePostResponse = await response.json();
    return data.data;
  }

  // ========== MENTION FEATURE ==========

  /**
   * Search users cho mention (@)
   * @param query - Search query (tên người dùng sau @)
   * @param limit - Số kết quả tối đa (default: 10)
   * @returns Array of user suggestions
   */
  async searchUsersForMention(
    query: string,
    limit = 10
  ): Promise<{ _id: string; fullname: string; email: string; avatarUrl?: string; department?: string; jobTitle?: string }[]> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(
        `${BASE_URL}/api/social/user/search?q=${encodeURIComponent(query)}&limit=${limit}`,
        { headers }
      );

      if (!response.ok) {
        console.error('[PostService] Search users failed:', response.status);
        return [];
      }

      const data = await response.json();
      return data.data || [];
    } catch (error) {
      console.error('[PostService] Search users error:', error);
      return [];
    }
  }

  /**
   * Add comment với mentions
   * @param postId - ID bài viết
   * @param content - Nội dung comment
   * @param mentions - Array of user IDs được mention
   */
  async addCommentWithMentions(postId: string, content: string, mentions: string[]): Promise<Post> {
    const headers = await this.getAuthHeaders();
    const response = await fetch(`${BASE_URL}/api/social/${postId}/comments`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ content, mentions }),
    });

    if (!response.ok) {
      throw new Error('Failed to add comment');
    }

    const data: CreatePostResponse = await response.json();
    return data.data;
  }

  /**
   * Reply comment với mentions
   * @param postId - ID bài viết
   * @param commentId - ID comment
   * @param content - Nội dung reply
   * @param mentions - Array of user IDs được mention
   */
  async replyCommentWithMentions(
    postId: string,
    commentId: string,
    content: string,
    mentions: string[]
  ): Promise<Post> {
    const headers = await this.getAuthHeaders();
    const response = await fetch(`${BASE_URL}/api/social/${postId}/comments/${commentId}/replies`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ content, mentions }),
    });

    if (!response.ok) {
      throw new Error('Failed to reply comment');
    }

    const data: CreatePostResponse = await response.json();
    return data.data;
  }
}

export const postService = new PostService();

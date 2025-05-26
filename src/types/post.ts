export interface User {
  _id: string;
  fullname: string;
  avatarUrl?: string;
  email: string;
  department?: string;
  jobTitle?: string;
}

export interface Reaction {
  _id: string;
  user: User;
  type: string;
  createdAt: string;
}

export interface Comment {
  _id: string;
  user: User;
  content: string;
  createdAt: string;
  reactions: Reaction[];
}

export interface Post {
  _id: string;
  author: User;
  content: string;
  type: 'Thông báo' | 'Chia sẻ' | 'Câu hỏi' | 'Badge' | 'Khác';
  visibility: 'public' | 'department';
  images: string[];
  videos: string[];
  tags: User[];
  reactions: Reaction[];
  comments: Comment[];
  isPinned: boolean;
  department?: {
    _id: string;
    name: string;
  };
  badgeInfo?: {
    badgeName: string;
    badgeIcon: string;
    message: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface MediaFile {
  uri: string;
  type: string;
  name: string;
  size?: number;
}

export interface CreatePostData {
  content: string;
  type?: Post['type'];
  visibility?: Post['visibility'];
  department?: string;
  tags?: string[];
  badgeInfo?: Post['badgeInfo'];
  files?: MediaFile[];
}

export interface PostsResponse {
  success: boolean;
  data: {
    posts: Post[];
    pagination: {
      currentPage: number;
      totalPages: number;
      totalPosts: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  };
}

export interface CreatePostResponse {
  success: boolean;
  message: string;
  data: Post;
} 
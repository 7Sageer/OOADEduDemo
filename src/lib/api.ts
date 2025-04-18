import axios from 'axios';

// 获取上下文数据（根据幻灯片页码）
export interface SlideContext {
  title: string;
  content: string;
  explanation: string;
  keywords: string[];
}

export const fetchSlideContext = async (pdfUrl: string, pageNumber: number): Promise<SlideContext> => {
  try {
    // 这里我们仍然使用axios来调用内部API
    const response = await axios.get(`/api/context?pdfUrl=${encodeURIComponent(pdfUrl)}&page=${pageNumber}`);
    return response.data;
  } catch (error) {
    console.error('获取幻灯片上下文失败:', error);
    throw error;
  }
}; 
import { useState, useCallback } from 'react';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

// 滑动上下文类型
interface SlideContext {
  title: string;
  content: string;
  explanation: string;
  keywords: string[];
  currentPage?: number;
  totalPages?: number;
}

// 消息类型
interface Message {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  function_call?: {
    name: string;
    arguments: Record<string, unknown>;
  };
}

// Canvas内容类型
interface CanvasContent {
  visible: boolean;
  content: string;
}

// 使用LLM Hook的返回类型
interface UseLLMReturn {
  messages: Message[];
  isLoading: boolean;
  error: string | null;
  canvasContent: CanvasContent;
  sendMessage: (content: string) => Promise<void>;
  clearMessages: () => void;
  clearCanvas: () => void;
  onSlideChange?: (pageNumber: number) => Promise<SlideContext | undefined>;
}

// 使用LLM Hook的参数类型
interface UseLLMParams {
  context?: SlideContext | null;
  includeHistory?: boolean;
  onSlideChange?: (pageNumber: number) => Promise<SlideContext | undefined>;
}

// LLM Hook
export default function useLLM({ 
  context = null,
  includeHistory = true,
  onSlideChange
}: UseLLMParams = {}): UseLLMReturn {
  // console.log('useLLM recieved context: ', context);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [canvasContent, setCanvasContent] = useState<CanvasContent>({
    visible: false,
    content: ''
  });

  // 处理函数调用
  const handleFunctionCall = useCallback(async (
    functionCall: { name: string; arguments: Record<string, unknown> },
    currentMessages: Message[]
  ): Promise<Message[]> => {
    let updatedMessages = [...currentMessages];
    
    if (functionCall.name === 'create_canvas') {
      try {
        const args = typeof functionCall.arguments === 'string' 
          ? JSON.parse(functionCall.arguments) 
          : functionCall.arguments;
          
        if (args && typeof args.content === 'string') {
          setCanvasContent({
            visible: true,
            content: args.content
          });
          
          // 添加函数调用结果消息
          const functionResultMessage: Message = {
            id: uuidv4(),
            role: 'tool',
            content: `已创建画布，展示内容。`
          };
          
          updatedMessages = [...updatedMessages, functionResultMessage];
        } else {
          console.error('Canvas内容格式无效');
        }
      } catch (e) {
        console.error('解析Canvas参数错误:', e);
      }
    } else if (functionCall.name === 'switch_slide') {
      try {
        const args = typeof functionCall.arguments === 'string' 
          ? JSON.parse(functionCall.arguments) 
          : functionCall.arguments;
          
        if (args && typeof args.pageNumber === 'number' && onSlideChange) {
          // 调用页面切换回调函数
          const contextData = await onSlideChange(args.pageNumber);
          
          // 添加函数调用结果消息，返回新页面的内容
          const functionResultMessage: Message = {
            id: uuidv4(),
            role: 'tool',
            content: `已切换到第${args.pageNumber}页。`
          };
          
          updatedMessages = [...updatedMessages, functionResultMessage];
          
          // 如果有返回的上下文数据，添加一个新消息显示页面内容
          if (contextData) {
            const pageContentMessage: Message = {
              id: uuidv4(),
              role: 'tool',
              content: `第${args.pageNumber}页内容：\n\n标题：${contextData.title}\n\n内容：${contextData.content}\n\n解释：${contextData.explanation}\n\n关键词：${contextData.keywords.join(', ')}`
            };
            
            updatedMessages = [...updatedMessages, pageContentMessage];
          }
        } else {
          console.error('切换幻灯片参数无效或未提供回调函数');
        }
      } catch (e) {
        console.error('解析切换幻灯片参数错误:', e);
      }
    }
    
    return updatedMessages;
  }, [onSlideChange]);

  // 发送消息到LLM并处理函数调用迭代
  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim()) return;

    try {
      setIsLoading(true);
      setError(null);

      // 创建新的用户消息
      const userMessage: Message = {
        id: uuidv4(),
        role: 'user',
        content
      };

      // 添加到消息列表
      setMessages(prev => [...prev, userMessage]);

      // 准备发送到API的消息
      let currentMessages = includeHistory 
        ? messages.concat(userMessage) 
        : [userMessage];
      
      // 更新上下文，确保包含当前页码和总页数
      const updatedContext = context ? {
        ...context,
        currentPage: context.currentPage || 1,
        totalPages: context.totalPages || 0
      } : null;

      // 迭代处理函数调用，直到没有函数调用为止
      let hasFunctionCall = true;
      let iterationCount = 0;
      const MAX_ITERATIONS = 5; // 设置最大迭代次数，防止无限循环
      
      while (hasFunctionCall && iterationCount < MAX_ITERATIONS) {
        iterationCount++;
        
        // 调用聊天API
        const response = await axios.post('/api/chat', {
          messages: currentMessages,
          context: updatedContext
        });

        // 处理LLM响应
        const llmResponse = response.data;
        
        // 检查响应结构是否完整
        if (!llmResponse || !llmResponse.choices || !llmResponse.choices.length) {
          throw new Error('LLM返回了无效的响应格式');
        }
        
        const assistantMessage = llmResponse.choices[0].message;
        
        // 检查消息结构是否完整
        if (!assistantMessage) {
          throw new Error('LLM响应中缺少消息内容');
        }

        // 创建助手消息
        const newAssistantMessage: Message = {
          id: uuidv4(),
          role: 'assistant',
          content: assistantMessage.content || '',
          ...(assistantMessage.function_call ? { function_call: assistantMessage.function_call } : {})
        };

        // 添加到当前消息列表
        currentMessages = [...currentMessages, newAssistantMessage];
        
        // 检查是否有函数调用
        if (newAssistantMessage.function_call) {
          // 处理函数调用并获取更新后的消息列表
          currentMessages = await handleFunctionCall(newAssistantMessage.function_call, currentMessages);
        } else {
          // 没有函数调用，结束迭代
          hasFunctionCall = false;
        }
      }
      
      // 更新最终的消息列表
      setMessages(currentMessages);
      
    } catch (err: unknown) {
      const errorMessage = err instanceof Error 
        ? err.message 
        : '与LLM通信时出错';
      
      setError(
        err instanceof Error && 'response' in err 
          ? ((err as { response?: { data?: { error?: string } } }).response?.data?.error || errorMessage)
          : errorMessage
      );
      console.error('LLM请求错误:', err);
    } finally {
      setIsLoading(false);
    }
  }, [messages, context, includeHistory, handleFunctionCall]);

  // 清除所有消息
  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  // 清除Canvas
  const clearCanvas = useCallback(() => {
    setCanvasContent({
      visible: false,
      content: ''
    });
  }, []);

  return {
    messages,
    isLoading,
    error,
    canvasContent,
    sendMessage,
    clearMessages,
    clearCanvas,
    onSlideChange
  };
} 
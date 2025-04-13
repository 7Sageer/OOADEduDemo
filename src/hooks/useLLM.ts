import { useState, useCallback } from 'react';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

// 滑动上下文类型
interface SlideContext {
  title: string;
  content: string;
  explanation: string;
  keywords: string[];
}

// 消息类型
interface Message {
  id: string;
  role: 'user' | 'assistant';
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
}

// 使用LLM Hook的参数类型
interface UseLLMParams {
  context?: SlideContext | null;
  includeHistory?: boolean;
}

// LLM Hook
export default function useLLM({ 
  context = null,
  includeHistory = true 
}: UseLLMParams = {}): UseLLMReturn {
  // console.log('useLLM recieved context: ', context);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [canvasContent, setCanvasContent] = useState<CanvasContent>({
    visible: false,
    content: ''
  });

  // 发送消息到LLM
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
      const messagesToSend = includeHistory 
        ? messages.concat(userMessage) 
        : [userMessage];
  

      // 调用聊天API
      const response = await axios.post('/api/chat', {
        messages: messagesToSend,
        context
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

      // 添加到消息列表
      setMessages(prev => [...prev, newAssistantMessage]);

      // 处理函数调用
      if (newAssistantMessage.function_call) {
        const functionCall = newAssistantMessage.function_call;
        
        if (functionCall && functionCall.name === 'create_canvas') {
          try {
            const args = typeof functionCall.arguments === 'string' 
              ? JSON.parse(functionCall.arguments) 
              : functionCall.arguments;
              
            if (args && typeof args.content === 'string') {
              setCanvasContent({
                visible: true,
                content: args.content
              });
            } else {
              console.error('Canvas内容格式无效');
            }
          } catch (e) {
            console.error('解析Canvas参数错误:', e);
          }
        }
      }
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
  }, [messages, context, includeHistory]);

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
    clearCanvas
  };
} 
import { OpenAI } from 'openai';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

// LLM接口类型定义
export interface FunctionCallArgs {
  name: string;
  arguments: Record<string, any>;
}

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  function_call?: FunctionCallArgs;
}

export interface FunctionDefinition {
  name: string;
  description: string;
  parameters: Record<string, any>;
}

export interface LLMResponse {
  id: string;
  choices: Array<{
    message: Message;
    finish_reason: string;
  }>;
}

// 创建OpenAI客户端
const createOpenAIClient = () => {
  return new OpenAI({
    apiKey: process.env.LLM_API_KEY || '',
    baseURL: process.env.LLM_BASE_URL || 'https://api.openai.com/v1',
    dangerouslyAllowBrowser: true
  });
};

// OpenAI客户端实例
const openai = createOpenAIClient();

// 发送消息到LLM
export const sendMessageToLLM = async (
  messages: Message[], 
  functions?: FunctionDefinition[]
): Promise<LLMResponse> => {
  try {
    const payload: any = {
      model: process.env.LLM_MODEL || 'gpt-4o',
      messages,
      temperature: 0.7,
    };

    // 如果提供了函数定义，添加到请求中
    if (functions && functions.length > 0) {
      payload.tools = functions.map(func => ({
        type: 'function',
        function: func
      }));
    }
    console.log('payload', payload);

    // 使用OpenAI SDK发送请求
    const response = await openai.chat.completions.create(payload);
    
    // 检查响应是否有效
    if (!response || !response.choices) {
      // throw new Error('LLM返回了无效的响应格式');
      return {
        id: uuidv4(),
        choices: []
      } as LLMResponse;
    }
    
    // 转换响应格式
    const formattedResponse: LLMResponse = {
      id: response.id || uuidv4(),
      choices: response.choices.map(choice => ({
        message: {
          role: choice.message.role as 'assistant',
          content: choice.message.content || '',
          ...(choice.message.tool_calls && choice.message.tool_calls.length > 0 
            ? {
                function_call: {
                  name: choice.message.tool_calls[0].function.name,
                  arguments: JSON.parse(choice.message.tool_calls[0].function.arguments)
                }
              } 
            : {})
        },
        finish_reason: choice.finish_reason || ''
      }))
    };
    return formattedResponse;
  } catch (error) {
    console.error('LLM API调用错误:', error);
    throw error;
  }
};

// 获取上下文数据（根据幻灯片页码）
export const fetchSlideContext = async (pdfUrl: string, pageNumber: number): Promise<any> => {
  try {
    // 这里我们仍然使用axios来调用内部API，不需要使用OpenAI SDK
    const response = await axios.get(`/api/context?pdfUrl=${encodeURIComponent(pdfUrl)}&page=${pageNumber}`);
    return response.data;
  } catch (error) {
    console.error('获取幻灯片上下文失败:', error);
    throw error;
  }
}; 
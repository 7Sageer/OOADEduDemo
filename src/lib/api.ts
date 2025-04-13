import { OpenAI } from 'openai';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { ChatCompletion } from 'openai/resources/chat/completions';
import { Stream } from 'openai/streaming';

// LLM接口类型定义
export interface FunctionCallArgs {
  name: string;
  arguments: Record<string, unknown>;
}

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  function_call?: FunctionCallArgs;
}

export interface FunctionDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
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
    // 将我们的Message类型转换为OpenAI SDK需要的格式
    const convertedMessages = messages.map(msg => ({
      role: msg.role,
      content: msg.content,
      ...(msg.function_call ? { function_call: msg.function_call } : {})
    }));

    // 配置OpenAI请求参数
    interface OpenAIPayload {
      model: string;
      messages: Array<{
        role: 'user' | 'assistant' | 'system';
        content: string;
        function_call?: FunctionCallArgs;
      }>;
      temperature: number;
      tools?: Array<{
        type: string;
        function: FunctionDefinition;
      }>;
    }

    const payload: OpenAIPayload = {
      model: process.env.LLM_MODEL || 'gpt-4o',
      messages: convertedMessages,
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
    const response = await openai.chat.completions.create(
      payload as unknown as Parameters<typeof openai.chat.completions.create>[0]
    );
    
    // 检查响应是否有效
    // OpenAI SDK的响应可能是Stream或ChatCompletion
    if (response instanceof Stream) {
      // 如果是Stream类型，我们可以选择处理它，或者像现在这样返回空结果
      // 处理流式响应通常需要不同的逻辑
      console.log("Received a stream response, returning empty choices.");
      return {
        id: uuidv4(),
        choices: []
      } as LLMResponse;
    } 
    
    // 现在我们知道它是ChatCompletion类型
    const chatCompletion = response as ChatCompletion;
    if (!chatCompletion || !chatCompletion.choices) {
      return {
        id: uuidv4(),
        choices: []
      } as LLMResponse;
    }
    
    // 转换响应格式
    const formattedResponse: LLMResponse = {
      id: chatCompletion.id || uuidv4(),
      choices: chatCompletion.choices.map((choice) => ({
        message: {
          role: choice.message.role as 'assistant',
          content: choice.message.content || '',
          ...(choice.message.tool_calls && choice.message.tool_calls.length > 0 && choice.message.tool_calls[0].type === 'function' 
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
export interface SlideContext {
  title: string;
  content: string;
  explanation: string;
  keywords: string[];
}

export const fetchSlideContext = async (pdfUrl: string, pageNumber: number): Promise<SlideContext> => {
  try {
    // 这里我们仍然使用axios来调用内部API，不需要使用OpenAI SDK
    const response = await axios.get(`/api/context?pdfUrl=${encodeURIComponent(pdfUrl)}&page=${pageNumber}`);
    return response.data;
  } catch (error) {
    console.error('获取幻灯片上下文失败:', error);
    throw error;
  }
}; 
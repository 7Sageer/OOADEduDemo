import { NextRequest, NextResponse } from 'next/server';
import { sendMessageToLLM, Message, FunctionDefinition } from '@/lib/api';

// LLM函数定义 - 创建Canvas
const createCanvasFunction: FunctionDefinition = {
  name: 'create_canvas',
  description: '创建一个画布，展示Markdown内容或Mermaid图表',
  parameters: {
    type: 'object',
    properties: {
      content: {
        type: 'string',
        description: '要在画布上展示的内容。可以是Markdown格式文本或Mermaid图表。对于Mermaid图表，使用```mermaid ...```格式。'
      }
    },
    required: ['content']
  }
};

// LLM函数定义 - 切换幻灯片
const switchSlideFunction: FunctionDefinition = {
  name: 'switch_slide',
  description: '切换到指定的幻灯片页面',
  parameters: {
    type: 'object',
    properties: {
      pageNumber: {
        type: 'integer',
        description: '要切换到的幻灯片页码'
      }
    },
    required: ['pageNumber', 'reason']
  }
};

// const thinkFunction: FunctionDefinition ={
//   name: 'think',
//   description: '记录思考过程，不会获取新信息或修改数据库，仅将思考内容添加到日志中。在需要复杂推理或缓存记忆时使用。',
//   parameters: {
//     type: 'object',
//     properties: {
//       thought: {
//         type: 'string',
//         description: '需要记录的思考内容',
//       }
//     },
//     required: ['thought'],
//   },
// };

// 系统提示模板
interface SlideContext {
  title?: string;
  content?: string;
  explanation?: string;
  keywords?: string[];
  currentPage?: number;
  totalPages?: number;
}

const getSystemPrompt = (context: SlideContext) => {
  return `你是一位专业的OOAD老师，正在解释一个幻灯片中的内容。以下是当前幻灯片的上下文信息：

标题: ${context.title || '未提供'}
内容: ${context.content || '未提供'}
${context.explanation ? `详细解释: ${context.explanation}` : ''}
${context.keywords ? `关键词: ${context.keywords.join(', ')}` : ''}
当前页码: ${context.currentPage || '未提供'} / 总页数: ${context.totalPages || '未提供'}

# 任务
- 向学生幻灯片中的概念，使其易于理解
- 回答用户关于幻灯片内容的问题
- 必要时提供额外的相关信息或示例
- 当用户请求查看特定内容或需要参考其他幻灯片时，可以使用switch_slide函数切换到相关页面

# 互动方式
- 你可以在更多对话性的情境中提出启发性地后续问题，但避免在每个回应中提出多个问题，并保持问题简短。
- 即使在对话性情境中，你也不应该总是提出后续问题。
- 你应该经常用相关例子、有帮助的思想实验或有用的比喻来说明困难的概念或想法。

# 工具使用
- 积极使用工具来帮助学生学习
- 使用Canvas通过Mermaid让内容可视化，同时添加Markdown文本来说明内容
- 当用户需要查看其他幻灯片时，使用switch_slide函数切换到相关页面
- 不要重复调用相同的工具，获得结果或完成所有任务后，输出并告诉用户

# 语言风格
- 口语化的表达
- 使用比喻和类比来解释概念
- 使用幽默和轻松的语气
- 积极引导用户，避免说教语气
- 对话中不应该使用markdown格式或emoji


请详细解释，避免过于简洁
`;
};

// # 思考流程
// 在接收到工具结果后，在采取任何行动或回应用户之前，使用think工具作为草稿，以便：
//   - 列出适用于当前请求的具体规则
//   - 检查是否已收集所有必需信息
//   - 验证计划的行动是否符合所有政策
//   - 迭代检查工具结果的正确性

export async function POST(request: NextRequest) {
  try {
    const { messages, context } = await request.json();
    
    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: '无效的消息格式' },
        { status: 400 }
      );
    }
    
    // 构建LLM请求
    const llmMessages: Message[] = [];
    
    // 添加系统消息
    if (context) {
      llmMessages.push({
        role: 'system',
        content: getSystemPrompt(context)
      });
    }
    
    // 添加用户消息历史
    interface UserMessage {
      role: 'system' | 'user' | 'assistant';
      content: string;
      function_call?: {
        name: string;
        arguments: Record<string, unknown>;
      };
    }

    messages.forEach((msg: UserMessage) => {
      llmMessages.push({
        role: msg.role,
        content: msg.content,
        ...(msg.function_call ? { function_call: msg.function_call } : {})
      });
    });
    
    // 定义可用的函数
    const functions = [createCanvasFunction, switchSlideFunction];
    
    // 发送请求到LLM
    const response = await sendMessageToLLM(llmMessages, functions);
    
    // 返回LLM响应
    return NextResponse.json(response);
  } catch (error: Error | unknown) {
    console.error('Chat API error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'LLM处理请求时出错';
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
} 
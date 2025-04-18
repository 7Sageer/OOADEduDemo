import { useRef, FormEvent, useEffect, ChangeEvent } from 'react';
import type { Message as VercelChatMessage } from '@ai-sdk/react'; // Import Vercel AI Message type

interface ChatProps {
  messages: VercelChatMessage[]; // Use VercelChatMessage type
  input: string;
  handleInputChange: (
    e: ChangeEvent<HTMLInputElement> | ChangeEvent<HTMLTextAreaElement>,
  ) => void;
  handleSubmit: (
    e: FormEvent<HTMLFormElement>,
  ) => void;
  isLoading: boolean;
}

export default function Chat({ 
  messages, 
  input, 
  handleInputChange, 
  handleSubmit: handleFormSubmitProp, // Rename prop to avoid conflict with internal function name
  isLoading 
}: ChatProps) {
  // input state is now managed by useChat, remove local input state
  // const [input, setInput] = useState(''); 
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // expandedTools state might not be needed if we don't expand tool *results*
  // const [expandedTools, setExpandedTools] = useState<{[key: string]: boolean}>({}); 

  // 自动滚动到最新消息
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView();
  };

  // 监听消息变化自动滚动
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 自动调整文本框高度 (Uses input prop now)
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 100)}px`;
    }
  }, [input]); 

  // 提交消息 (Uses handleSubmit prop from useChat)
  const handleSubmitInternal = async (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    
    // The actual sending logic is now handled by the handleSubmit function passed in props
    handleFormSubmitProp(e as FormEvent<HTMLFormElement>); // Call the prop function
    
    // Resetting textarea height might still be useful visually
    if (textareaRef.current) {
      textareaRef.current.style.height = '45px'; 
    }
  };

  // 处理按键事件 (使用回车发送)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => { // Type the event correctly
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmitInternal(e as unknown as FormEvent);
    }
  };

  // 获取消息气泡的样式 (Remove 'tool' case)
  const getMessageStyle = (role: VercelChatMessage['role']) => {
    switch(role) {
      case 'user':
        return 'bg-blue-600 text-white rounded-tr-none';
      case 'assistant':
        return 'bg-white border border-gray-200 shadow-sm rounded-tl-none';
      // case 'tool': // Removed this case
      //   return 'bg-green-50 border border-green-200 shadow-sm rounded-tl-none'; 
      case 'system': // System messages might not be displayed, but handle it
        return 'bg-gray-100 border border-gray-200 text-gray-500 text-xs italic p-2 text-center';
      case 'data': // Data messages might not be displayed
         return 'bg-purple-50 border border-purple-200 text-purple-700 text-xs italic p-2';
      default:
        return 'bg-white border border-gray-200 shadow-sm rounded-tl-none';
    }
  };

  // 获取消息文本的样式 (Remove 'tool' case)
  const getTextStyle = (role: VercelChatMessage['role']) => {
    switch(role) {
      case 'user':
        return 'text-white';
      case 'assistant':
        return 'text-gray-800';
      // case 'tool': // Removed this case
      //   return 'text-green-800';
      case 'system':
         return 'text-gray-600';
      case 'data':
         return 'text-purple-800';
      default:
        return 'text-gray-800';
    }
  };

  // 获取消息发送者名称 (Remove 'tool' case)
  const getSenderName = (role: VercelChatMessage['role']) => {
    switch(role) {
      case 'user':
        return '你';
      case 'assistant':
        return 'AI助手';
      // case 'tool': // Removed this case
      //   return '工具结果';
      case 'system':
        return '系统提示';
      case 'data':
         return '数据'; // Or hide data messages entirely
      default:
        return '未知';
    }
  };

  // 显示消息内容 (Remove specific 'tool' role handling)
  const renderMessageContent = (msg: VercelChatMessage) => {
    // Handle user and assistant roles
    if (msg.role === 'user' || msg.role === 'assistant') {
      return (
        <div className={`whitespace-pre-wrap text-xs sm:text-sm leading-relaxed ${getTextStyle(msg.role)}`}>
          {msg.content}
          {/* Render desired tool invocations from assistant messages */}
          {msg.role ==='assistant' && msg.toolInvocations && msg.toolInvocations.map((toolCall) => (
             <div key={toolCall.toolCallId} className="mt-2 p-2 border border-blue-200 bg-blue-50 rounded text-xs text-blue-700">
               请求调用工具: {toolCall.toolName} 
               {/* Optionally show args: <pre>{JSON.stringify(toolCall.args, null, 2)}</pre> */}
             </div>
           ))}
        </div>
      );
    }
    
    // Handle system/data messages (optional display)
     if (msg.role === 'system' || msg.role === 'data') {
       // return null; // Option to hide them
       return (
         <div className={`whitespace-pre-wrap text-xs italic ${getTextStyle(msg.role)}`}>
           {typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content, null, 2)}
         </div>
       );
     }

    // Fallback for any unexpected roles (shouldn't happen in practice)
    return (
        <div className={`whitespace-pre-wrap text-xs sm:text-sm leading-relaxed ${getTextStyle(msg.role)}`}>
          {`[${msg.role}] ${typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content, null, 2)}`}
        </div>
      );
  };

  return (
    <div className="flex flex-col h-full">
      {/* 消息列表区域 */}
      <div 
        ref={messagesContainerRef}
        className="flex-grow mb-2 sm:mb-4 p-3 sm:p-4 bg-gray-50 rounded-lg"
        style={{ 
          overflowY: "auto",
          scrollbarWidth: "thin",
          scrollbarColor: "#CBD5E0 #F9FAFB"
        }}
      >
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 sm:h-12 sm:w-12 text-gray-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
            <p className="text-sm sm:text-base">发送消息开始对话</p>
            <p className="text-xs text-gray-400 mt-1 sm:mt-2 text-center px-3">有关幻灯片内容的任何问题，我都会尽力回答</p>
          </div>
        ) : (
          <>
            <div className="space-y-2 sm:space-y-4">
              {messages.map((msg) => (
                // Decide which roles to render. Hide system/data by default?
                 (msg.role === 'user' || msg.role === 'assistant') && (
                    <div 
                      key={msg.id} 
                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div 
                        className={`max-w-[90%] sm:max-w-[85%] p-2 sm:p-3 rounded-lg ${getMessageStyle(msg.role)}`}
                      >
                        <div className="text-xs mb-0.5 sm:mb-1 font-medium flex items-center">
                          {getSenderName(msg.role)}
                           {/* Add any badges if needed */}
                        </div>
                        {renderMessageContent(msg)}
                      </div>
                    </div>
                 )
              ))}
            </div>
            <div ref={messagesEndRef} />
          </> 
        )}
      </div>

      {/* 输入框区域 */}
      <div className="w-full bg-white rounded-lg p-2 border border-gray-200 shadow-sm">
        <form onSubmit={handleSubmitInternal} className="flex w-full items-center space-x-2">
          <div className="flex-grow relative">
            <textarea
              ref={textareaRef}
              value={input} // Use input from useChat prop
              onChange={handleInputChange} // Use handler from useChat prop
              onKeyDown={handleKeyDown}
              placeholder="输入你的问题..."
              className="w-full p-2 sm:p-3 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent min-h-[45px] max-h-[80px] sm:max-h-[100px] transition-all text-sm sm:text-base leading-relaxed overflow-hidden"
              disabled={isLoading}
              style={{ lineHeight: "1.5", height: '45px' }}
            />
             {/* Removed clear button as input state is external */}
          </div>
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className={`px-3 sm:px-4 rounded-lg font-medium transition-colors flex items-center justify-center h-[45px] min-w-[60px] sm:min-w-[80px] text-sm ${ 
              !input.trim() || isLoading
                ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {isLoading ? (
              <>
                <div className="w-3 h-3 sm:w-4 sm:h-4 border-t-2 border-b-2 border-white rounded-full animate-spin mr-1 sm:mr-2"></div>
                <span className="truncate">思考中</span>
              </>
            ) : (
              <>
                发送
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 sm:h-4 sm:w-4 ml-1" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                </svg>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
} 
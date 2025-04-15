import { useState, useRef, FormEvent, useEffect } from 'react';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  function_call?: {
    name: string;
    arguments: Record<string, unknown>;
  };
}

interface ChatProps {
  onSendMessage: (message: string) => Promise<void>;
  messages: Message[];
  isLoading: boolean;
}

export default function Chat({ onSendMessage, messages, isLoading }: ChatProps) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [expandedTools, setExpandedTools] = useState<{[key: string]: boolean}>({});

  // 自动滚动到最新消息
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // 监听消息变化自动滚动
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 自动调整文本框高度
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 100)}px`;
    }
  }, [input]);

  // 提交消息
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const message = input.trim();
    setInput('');
    
    // 重置文本框高度
    if (textareaRef.current) {
      textareaRef.current.style.height = '45px';
    }
    
    await onSendMessage(message);
  };

  // 处理按键事件 (使用回车发送)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as unknown as FormEvent);
    }
  };

  // 切换工具消息的展开/折叠状态
  const toggleToolMessage = (id: string) => {
    setExpandedTools(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // 获取消息气泡的样式
  const getMessageStyle = (role: string) => {
    switch(role) {
      case 'user':
        return 'bg-blue-600 text-white rounded-tr-none';
      case 'assistant':
        return 'bg-white border border-gray-200 shadow-sm rounded-tl-none';
      case 'tool':
        return 'bg-green-50 border border-green-200 shadow-sm rounded-tl-none';
      default:
        return 'bg-white border border-gray-200 shadow-sm rounded-tl-none';
    }
  };

  // 获取消息文本的样式
  const getTextStyle = (role: string) => {
    switch(role) {
      case 'user':
        return 'text-white';
      case 'assistant':
        return 'text-gray-800';
      case 'tool':
        return 'text-green-800';
      default:
        return 'text-gray-800';
    }
  };

  // 获取消息发送者名称
  const getSenderName = (role: string) => {
    switch(role) {
      case 'user':
        return '你';
      case 'assistant':
        return 'AI助手';
      case 'tool':
        return '系统';
      default:
        return '未知';
    }
  };

  // 显示消息内容或折叠预览
  const renderMessageContent = (msg: Message) => {
    if (msg.role !== 'tool') {
      return (
        <div className={`whitespace-pre-wrap text-xs sm:text-sm leading-relaxed font-medium ${getTextStyle(msg.role)}`}>
          {msg.content}
        </div>
      );
    }
    
    const isExpanded = expandedTools[msg.id] || false;
    const previewContent = msg.content.length > 50 
      ? `${msg.content.substring(0, 50)}...` 
      : msg.content;
    
    return (
      <div className="w-full">
        <div 
          className={`whitespace-pre-wrap text-xs sm:text-sm leading-relaxed font-medium ${getTextStyle(msg.role)} ${isExpanded ? '' : 'cursor-pointer'}`}
          onClick={() => !isExpanded && toggleToolMessage(msg.id)}
        >
          {isExpanded ? msg.content : previewContent}
        </div>
        <button 
          onClick={() => toggleToolMessage(msg.id)}
          className="mt-1 text-xs text-green-700 hover:text-green-800 underline flex items-center"
        >
          {isExpanded ? (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
              收起
            </>
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
              展开
            </>
          )}
        </button>
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
                <div 
                  key={msg.id} 
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div 
                    className={`max-w-[90%] sm:max-w-[85%] p-2 sm:p-3 rounded-lg ${getMessageStyle(msg.role)}`}
                  >
                    <div className="text-xs mb-0.5 sm:mb-1 font-medium flex items-center">
                      {getSenderName(msg.role)}
                      {msg.role === 'tool' && (
                        <span className="ml-1 px-1.5 py-0.5 bg-green-100 text-green-700 rounded-full text-[10px]">
                          系统操作
                        </span>
                      )}
                    </div>
                    {renderMessageContent(msg)}
                  </div>
                </div>
              ))}
            </div>
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* 输入框区域 */}
      <div className="w-full bg-white rounded-lg p-2 border border-gray-200 shadow-sm">
        <form onSubmit={handleSubmit} className="flex w-full items-center space-x-2">
          <div className="flex-grow relative">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入你的问题..."
              className="w-full p-2 sm:p-3 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent min-h-[45px] max-h-[80px] sm:max-h-[100px] transition-all text-sm sm:text-base leading-relaxed overflow-hidden"
              disabled={isLoading}
              style={{ lineHeight: "1.5", height: '45px' }}
            />
            {input.length > 0 && !isLoading && (
              <button
                type="button"
                onClick={() => setInput('')}
                className="absolute right-2 sm:right-3 top-2 sm:top-3 text-gray-400 hover:text-gray-600"
                aria-label="清除输入"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </button>
            )}
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
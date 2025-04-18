'use client';

import { useState, useEffect, useRef, FormEvent } from 'react';
import PDFViewer from '@/components/PDFViewer';
import Chat from '@/components/Chat';
import Canvas from '@/components/Canvas';
import { fetchSlideContext } from '@/lib/api';
import { useChat } from '@ai-sdk/react';
import type { Message as VercelChatMessage } from 'ai/react';

// 幻灯片上下文
interface SlideContext {
  title: string;
  content: string;
  explanation: string;
  keywords: string[];
  currentPage?: number;
  totalPages?: number;
}

// Define structure for Canvas Content
interface CanvasContent {
  visible: boolean;
  content: string;
}

export default function Home() {
  // PDF状态
  const [pdfUrl, setPdfUrl] = useState<string>('/sample.pdf'); // 默认PDF
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(0);
  
  // 幻灯片上下文
  const [slideContext, setSlideContext] = useState<SlideContext | null>(null);
  // 添加标志以跟踪每个页面是否已生成介绍
  const [introGenerated, setIntroGenerated] = useState<{[page: number]: boolean}>({});
  
  // 添加一个标志，用于标识是否由LLM发起页面切换
  const [llmInitiatedPageChange, setLlmInitiatedPageChange] = useState<boolean>(false);
  
  // Ref for current page
  const currentPageRef = useRef(currentPage);

  // State for Canvas
  const [canvasContent, setCanvasContent] = useState<CanvasContent>({
    visible: false,
    content: '',
  });

  // 添加一个引用来跟踪当前是否正在处理工具调用
  const [isProcessingToolCall, setIsProcessingToolCall] = useState<boolean>(false);
  // 添加最大工具调用计数，防止无限循环
  const [toolCallCount, setToolCallCount] = useState<number>(0);
  const MAX_TOOL_CALLS = 10; // 设置最大工具调用次数

  // Function to clear canvas
  const clearCanvas = () => {
    setCanvasContent({ visible: false, content: '' });
  };

  // Your slide change handler
  const handleSlideChange = async (pageNumber: number): Promise<SlideContext | undefined> => {
    // Ensure page number is valid
    if (pageNumber < 1 || pageNumber > totalPages) {
      console.warn(`Attempted to switch to invalid page number: ${pageNumber}, Total pages: ${totalPages}`);
      // Return undefined or throw an error to indicate failure to the tool caller
      return undefined; 
    }

    console.log(`Switching to slide ${pageNumber}...`);
    // Set flag indicating LLM initiated the change
    setLlmInitiatedPageChange(true); 
    
    // Mark page as having intro generated (prevent auto-intro)
    setIntroGenerated(prev => ({ ...prev, [pageNumber]: true }));
    
    // Update current page state
    setCurrentPage(pageNumber);

    // Immediately fetch context for the new page
    try {
      const context = await fetchSlideContext(pdfUrl, pageNumber);
      console.log('Fetched context for page after switch:', pageNumber, context);
      
      const contextWithPageInfo = {
        ...context,
        currentPage: pageNumber,
        totalPages,
      };
      
      // Update slideContext state
      setSlideContext(contextWithPageInfo);
      
      // Return the new context data (useful for the LLM to confirm)
      return contextWithPageInfo;
    } catch (err) {
      console.error('Failed to load slide context after switch:', err);
      // Return undefined or throw to indicate failure
      return undefined; 
    }
  };

  // --- Vercel AI useChat Hook --- 
  const { 
    messages, 
    input, 
    handleInputChange, 
    handleSubmit, 
    isLoading, 
    error, 
    append,
    setMessages
  } = useChat({
    api: '/api/chat', 
    body: { 
      context: slideContext, 
    },
    async onToolCall({ toolCall }) {
      console.log("Tool call received:", toolCall);
      
      // 防止超过最大调用次数
      if (toolCallCount >= MAX_TOOL_CALLS) {
        console.warn(`已达到最大工具调用次数 (${MAX_TOOL_CALLS})，停止迭代调用`);
        return {
          toolCallId: toolCall.toolCallId,
          result: `已达到最大工具调用次数 (${MAX_TOOL_CALLS})，请重新开始对话`,
        };
      }
      
      // 设置工具调用处理状态为true
      setIsProcessingToolCall(true);
      // 增加工具调用计数
      setToolCallCount(prev => prev + 1);
      
      // Define expected argument types for clarity and type safety
      type CreateCanvasArgs = { content: string };
      type SwitchSlideArgs = { pageNumber: number };

      // Type guard for arguments remains
      if (!toolCall.args || typeof toolCall.args !== 'object') {
        setIsProcessingToolCall(false); // 重置处理状态
        return {
          toolCallId: toolCall.toolCallId,
          result: `Error: Invalid arguments received for tool ${toolCall.toolName}`
        };
      }

      let toolResult;

      if (toolCall.toolName === 'create_canvas') {
        // Cast args to the expected type after the check
        const args = toolCall.args as CreateCanvasArgs;
        if (typeof args.content === 'string') {
          setCanvasContent({
            visible: true,
            content: args.content,
          });
          toolResult = {
            toolCallId: toolCall.toolCallId,
            result: `Canvas created successfully.`,
          };
        } else {
          toolResult = { 
             toolCallId: toolCall.toolCallId,
             result: `Error: Missing or invalid 'content' argument for create_canvas.`
           };
        }
       } else if (toolCall.toolName === 'switch_slide') {
         // Cast args to the expected type
         const args = toolCall.args as SwitchSlideArgs;
        if (typeof args.pageNumber === 'number') {
           try {
             const contextData = await handleSlideChange(args.pageNumber);
             if (contextData) {
               toolResult = {
                 toolCallId: toolCall.toolCallId,
                 result: `Successfully switched to slide ${args.pageNumber}. New context: ${contextData.title}`,
               };
             } else {
                toolResult = { 
                   toolCallId: toolCall.toolCallId,
                   result: `Error: Failed to switch to slide ${args.pageNumber}. Could not load context or invalid page.`
                 };
             }
           } catch (e) {
             console.error("Error executing slide switch:", e);
             toolResult = {
               toolCallId: toolCall.toolCallId,
               result: `Error switching slide: ${e instanceof Error ? e.message : 'Unknown error'}`,
             };
           }
        } else {
           toolResult = { 
             toolCallId: toolCall.toolCallId,
             result: `Error: Missing or invalid 'pageNumber' argument for switch_slide.`
           };
        }
       } else {
         toolResult = {
           toolCallId: toolCall.toolCallId,
           result: `Tool ${toolCall.toolName} not implemented.`,
         };
       }

       // 工具调用完成后，迭代调用LLM
       setTimeout(async () => {
         try {
           // 使用空字符串作为输入，将工具结果传递给LLM
           await append({
             role: 'system',
             content: `继续处理和响应用户需求，根据工具调用的结果进行回应`
           });
         } catch (err) {
           console.error("迭代LLM调用失败:", err);
         } finally {
           setIsProcessingToolCall(false); // 重置处理状态
         }
       }, 100);

       return toolResult;
    },
    onError: (err) => {
      console.error("Chat error:", err);
      setIsProcessingToolCall(false); // 出错时重置处理状态
      setToolCallCount(0); // 重置工具调用计数
    },
    onFinish: (message) => {
      console.log("Chat finished, last message:", message);
      setIsProcessingToolCall(false); // 完成时重置处理状态
      
      // 如果完成时没有正在进行的工具调用，重置计数
      if (!isProcessingToolCall) {
        setToolCallCount(0);
      }
    },
  });

  // 当用户提交新消息时，重置工具调用计数
  const wrappedHandleSubmit = (event: FormEvent<HTMLFormElement>) => {
    setToolCallCount(0); // 重置工具调用计数
    handleSubmit(event);
  };

  // Function to clear chat messages (using useChat's setMessages)
  const clearMessages = () => {
    setMessages([]); 
    setIntroGenerated({}); // Also reset intro flags
    setToolCallCount(0); // 重置工具调用计数
  };

  // 侧边栏状态
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);
  
  // Canvas侧栏状态
  const [canvasSidebarOpen, setCanvasSidebarOpen] = useState<boolean>(false);

  // 当Canvas内容变化且可见时，自动打开Canvas侧栏
  useEffect(() => {
    if (canvasContent.visible) {
      setCanvasSidebarOpen(true);
    }
  }, [canvasContent.visible]);

  // 加载PDF文件
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const fileURL = URL.createObjectURL(file);
      setPdfUrl(fileURL);
      setCurrentPage(1);
      clearMessages();
      clearCanvas();
      setCanvasSidebarOpen(false);
      setIntroGenerated({});
      setLlmInitiatedPageChange(false);
    }
  };

  // 处理用户手动切换页面
  const handleUserPageChange = (pageNumber: number) => {
    // User manually changed page, reset LLM flag
    setLlmInitiatedPageChange(false);
    setCurrentPage(pageNumber);
  };

  // Update ref whenever currentPage changes
  useEffect(() => {
    currentPageRef.current = currentPage;
  }, [currentPage]);

  // 页面变化时加载新的上下文
  useEffect(() => {
    const loadContext = async () => {
      if (!pdfUrl || totalPages === 0) return; // Don't load if pdf/totalPages not ready
      try {
        console.log(`Loading context for page: ${currentPage} (Total: ${totalPages})`);
        const context = await fetchSlideContext(pdfUrl, currentPage);
        console.log('Fetched context for page:', currentPage, context);
        
        const contextWithPageInfo = {
          ...context,
          currentPage,
          totalPages
        };
        
        setSlideContext(contextWithPageInfo);
      } catch (err) {
        console.error('加载幻灯片上下文失败:', err);
        setSlideContext(null); // Clear context on error
      }
    };
    
    loadContext();
  }, [currentPage, pdfUrl, totalPages]);

  // 当slideContext更新且该页面首次加载时生成介绍
  useEffect(() => {
    const page = currentPageRef.current; 
    
    // Ensure context is valid, intro not generated, not LLM initiated change, and not loading
    if (slideContext && !introGenerated[page] && !llmInitiatedPageChange && !isLoading) {
      // Check if context actually changed for the current page
      if(slideContext.currentPage === page) { 
        const introPrompt = `向我讲解这页幻灯片`;
        console.log(`Sending intro for page ${page} based on context update. Context title: ${slideContext.title}`);
        // Use append to send the message programmatically
        append({ role: 'user', content: introPrompt }); 
        setIntroGenerated(prev => ({...prev, [page]: true}));
      }
    }
    
    // Reset flag after check
    if (llmInitiatedPageChange) {
      setLlmInitiatedPageChange(false);
    }
    // Depend on slideContext, introGenerated, llmInitiatedPageChange, isLoading, append
  }, [slideContext, introGenerated, llmInitiatedPageChange, isLoading, append]); 

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      {/* 导航栏 */}
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-blue-700">LLM EdTech Demo</h1>
          <div className="flex items-center space-x-3">
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="file" 
                accept=".pdf"
                onChange={handleFileChange}
                className="hidden"
                id="file-upload"
              />
              <label 
                htmlFor="file-upload" 
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium transition-colors cursor-pointer"
              >
                上传PDF
              </label>
            </label>
            {canvasContent.visible && (
              <button
                onClick={() => setCanvasSidebarOpen(!canvasSidebarOpen)}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md text-sm font-medium transition-colors"
              >
                {canvasSidebarOpen ? "隐藏画布" : "显示画布"}
              </button>
            )}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 rounded-md text-gray-500 hover:bg-gray-100 md:hidden flex items-center"
              aria-label={sidebarOpen ? "关闭对话" : "打开对话"}
            >
              {sidebarOpen ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </header>

      <main className="flex-grow container mx-auto px-2 sm:px-4 py-4 sm:py-6">
        <div className="flex flex-col md:flex-row gap-4 lg:gap-6 h-full relative">
          {/* 左侧：PDF查看器 */}
          <div className={`md:w-3/5 lg:w-2/3 transition-all duration-300 h-[78.5vh] ${sidebarOpen ? 'hidden md:block' : 'block'}`}>
            <div className="bg-white rounded-xl shadow-md overflow-hidden h-full">
              <PDFViewer 
                pdfUrl={pdfUrl}
                currentPage={currentPage}
                onPageChange={handleUserPageChange}
                totalPages={totalPages}
                setTotalPages={setTotalPages}
              />
            </div>
          </div>
          
          {/* 右侧：聊天界面 */}
          <div className={`md:w-2/5 lg:w-1/3 transition-all duration-300 h-[78.5vh] flex flex-col ${sidebarOpen ? 'block' : 'hidden md:flex'}`}>
            <div className="bg-white rounded-xl shadow-md h-full overflow-hidden flex flex-col">
              <div className="px-4 py-3 bg-blue-600 text-white flex justify-between items-center sticky top-0 z-10">
                <h2 className="text-lg font-medium">教学助手</h2>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={clearMessages}
                    className="px-3 py-1 text-xs bg-blue-700 hover:bg-blue-800 text-white rounded-md transition-colors"
                  >
                    清除对话
                  </button>
                  <button
                    onClick={() => setSidebarOpen(!sidebarOpen)}
                    className="p-1 rounded-md text-white hover:bg-blue-700 md:hidden"
                    aria-label="关闭"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
              
              {error && (
                <div className="m-3 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-sm">
                  错误: {error.message}
                </div>
              )}
              
              <div className="flex-grow overflow-hidden">
                <Chat 
                  messages={messages as VercelChatMessage[]}
                  input={input}
                  handleInputChange={handleInputChange}
                  handleSubmit={wrappedHandleSubmit}
                  isLoading={isLoading}
                />
              </div>
            </div>
          </div>
          
          {/* Canvas侧边栏 - 从右侧滑入 */}
          {canvasContent.visible && (
            <div 
              className={`fixed top-[64px] right-0 h-[calc(100vh-64px)] w-full md:w-1/2 lg:w-2/5 bg-white shadow-lg z-30 transition-all duration-300 transform ${
                canvasSidebarOpen ? 'translate-x-0' : 'translate-x-full'
              } overflow-y-auto`}
            >
              <div className="p-4 sticky top-0 bg-white border-b border-gray-200 flex justify-between items-center">
                <h2 className="text-lg font-semibold text-blue-700">可视化内容</h2>
                <button
                  onClick={() => setCanvasSidebarOpen(false)}
                  className="p-2 rounded-md text-gray-500 hover:bg-gray-100"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="p-4">
                <Canvas 
                  content={canvasContent.content}
                  visible={canvasContent.visible}
                  inView={canvasSidebarOpen}
                />
              </div>
            </div>
          )}
        </div>

        {/* 移动端切换按钮 */}
        <div className="md:hidden fixed bottom-4 right-4 z-20">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className={`p-3 rounded-full shadow-lg ${sidebarOpen ? 'bg-blue-600 text-white' : 'bg-white text-blue-600'}`}
            aria-label={sidebarOpen ? "查看幻灯片" : "查看对话"}
          >
            {sidebarOpen ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            )}
          </button>
        </div>
        
        {/* Canvas浮动切换按钮 */}
        {canvasContent.visible && !canvasSidebarOpen && (
          <div className="fixed bottom-4 left-4 z-20">
            <button
              onClick={() => setCanvasSidebarOpen(true)}
              className="p-3 rounded-full shadow-lg bg-green-600 text-white"
              aria-label="显示画布"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </button>
          </div>
        )}
      </main>

      {/* 页面底部 */}
      {/* <footer className="bg-gray-800 text-white py-3 mt-auto">
        <div className="container mx-auto px-4 text-center text-sm">
          <p>© {new Date().getFullYear()} LLM EdTech 平台 - 基于人工智能的教育科技解决方案</p>
        </div>
      </footer> */}
    </div>
  );
}

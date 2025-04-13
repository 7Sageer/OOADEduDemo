import { useState, useEffect, useRef, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';

// 配置PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

interface PDFViewerProps {
  pdfUrl: string;
  currentPage: number;
  onPageChange: (page: number) => void;
  totalPages: number;
  setTotalPages: (pages: number) => void;
}

export default function PDFViewer({ 
  pdfUrl, 
  currentPage,
  onPageChange,
  totalPages,
  setTotalPages
}: PDFViewerProps) {
  const [scale, setScale] = useState<number>(1.0);
  const [pageWidth, setPageWidth] = useState<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const [fitMode, setFitMode] = useState<'width' | 'none'>('width');
  const resizeTimeoutRef = useRef<number | null>(null);
  const isAdjustingRef = useRef<boolean>(false);
  const previousScaleRef = useRef<number>(1.0);

  const handleDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setTotalPages(numPages);
  };

  // 防抖函数
  const debounce = (callback: () => void, wait: number) => {
    if (resizeTimeoutRef.current) {
      window.clearTimeout(resizeTimeoutRef.current);
    }
    resizeTimeoutRef.current = window.setTimeout(() => {
      callback();
      resizeTimeoutRef.current = null;
    }, wait);
  };

  // 处理页面渲染成功，获取页面实际宽度
  const handlePageLoadSuccess = (page: { width: number }) => {
    if (!pageWidth || Math.abs(pageWidth - page.width) > 1) {
      setPageWidth(page.width);
      if (fitMode === 'width' && !isAdjustingRef.current) {
        requestAnimationFrame(() => {
          adjustToFitWidth();
        });
      }
    }
  };

  // 自适应宽度功能
  const adjustToFitWidth = useCallback(() => {
    if (!containerRef.current || !pageWidth || isAdjustingRef.current) return;
    
    isAdjustingRef.current = true;
    
    try {
      const containerWidth = containerRef.current.clientWidth - 40; // 减去内边距
      const newScale = containerWidth / pageWidth;
      
      // 只有当比例变化明显时才更新
      if (Math.abs(newScale - previousScaleRef.current) > 0.01) {
        previousScaleRef.current = newScale;
        setScale(newScale);
      }
    } finally {
      // 确保延迟一段时间后再允许下一次调整
      setTimeout(() => {
        isAdjustingRef.current = false;
      }, 200);
    }
  }, [pageWidth]);

  // 监听容器尺寸变化
  useEffect(() => {
    const currentContainer = containerRef.current;
    if (!currentContainer) return;
    
    const resizeObserver = new ResizeObserver(() => {
      if (fitMode === 'width' && !isAdjustingRef.current) {
        debounce(() => {
          adjustToFitWidth();
        }, 100);
      }
    });
    
    resizeObserver.observe(currentContainer);
    
    return () => {
      if (currentContainer) {
        resizeObserver.unobserve(currentContainer);
      }
      if (resizeTimeoutRef.current) {
        window.clearTimeout(resizeTimeoutRef.current);
      }
    };
  }, [adjustToFitWidth, fitMode]);

  // 在挂载和PDF变更时进行一次调整
  useEffect(() => {
    if (pageWidth && fitMode === 'width') {
      // 使用requestAnimationFrame确保DOM已更新
      requestAnimationFrame(() => {
        adjustToFitWidth();
      });
    }
  }, [pageWidth, adjustToFitWidth, fitMode, pdfUrl]);

  const zoomIn = () => {
    setFitMode('none');
    setScale(prev => {
      const newScale = Math.min(prev + 0.2, 2.5);
      previousScaleRef.current = newScale;
      return newScale;
    });
  };
  
  const zoomOut = () => {
    setFitMode('none');
    setScale(prev => {
      const newScale = Math.max(prev - 0.2, 0.5);
      previousScaleRef.current = newScale;
      return newScale;
    });
  };
  
  const resetZoom = () => {
    setFitMode('width');
    adjustToFitWidth();
  };

  // 页面导航
  const goToPrevPage = () => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1);
    }
  };

  const goToNextPage = () => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1);
    }
  };

  return (
    <div className="flex flex-col items-center w-full h-full">
      {/* PDF控制器 */}
      <div className="flex flex-wrap items-center justify-between w-full mb-3 p-2 sm:p-3 bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg shadow-sm">
        <div className="flex items-center space-x-1 sm:space-x-2 mb-2 sm:mb-0">
          <button 
            onClick={goToPrevPage} 
            disabled={currentPage <= 1}
            className="px-2 sm:px-3 py-1 sm:py-1.5 bg-blue-600 text-white rounded-md disabled:bg-blue-300 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors flex items-center text-sm"
            aria-label="上一页"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 sm:h-4 sm:w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            <span className="hidden xs:inline">上一页</span>
          </button>
          <div className="flex justify-center items-center px-2 sm:px-3 py-1 bg-white border border-gray-200 rounded-md shadow-sm text-sm">
            <span className="font-medium text-gray-700">{currentPage}</span>
            <span className="text-gray-400 mx-1">/</span>
            <span className="text-gray-500">{totalPages}</span>
          </div>
          <button 
            onClick={goToNextPage} 
            disabled={currentPage >= totalPages}
            className="px-2 sm:px-3 py-1 sm:py-1.5 bg-blue-600 text-white rounded-md disabled:bg-blue-300 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors flex items-center text-sm"
            aria-label="下一页"
          >
            <span className="hidden xs:inline">下一页</span>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 sm:h-4 sm:w-4 ml-1" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
        <div className="flex items-center space-x-1 sm:space-x-2">
          <button 
            onClick={zoomOut}
            className="p-1.5 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
            aria-label="缩小"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M5 10a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1z" clipRule="evenodd" />
            </svg>
          </button>
          <button 
            onClick={resetZoom}
            className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-md text-xs sm:text-sm whitespace-nowrap ${fitMode === 'width' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-white hover:bg-gray-800'} transition-colors`}
          >
            自适应
          </button>
          <button 
            onClick={zoomIn}
            className="p-1.5 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
            aria-label="放大"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </div>

      {/* PDF文档 */}
      <div 
        ref={containerRef} 
        className="border border-gray-200 rounded-lg shadow-lg w-full flex-grow overflow-auto bg-white p-5"
      >
        <Document
          file={pdfUrl}
          onLoadSuccess={handleDocumentLoadSuccess}
          loading={
            <div className="flex justify-center items-center p-6 sm:p-10 min-h-[300px] sm:min-h-[400px]">
              <div className="animate-spin rounded-full h-8 w-8 sm:h-12 sm:w-12 border-t-2 border-b-2 border-blue-500"></div>
              <span className="ml-3 text-gray-600 text-sm sm:text-base">加载中...</span>
            </div>
          }
          error={
            <div className="flex flex-col justify-center items-center p-6 sm:p-10 min-h-[300px] sm:min-h-[400px] bg-red-50">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 sm:h-12 sm:w-12 text-red-500 mb-3 sm:mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div className="text-red-600 font-medium text-sm sm:text-base">无法加载PDF文件</div>
              <div className="text-red-500 text-xs sm:text-sm mt-2">请检查文件格式或网络连接</div>
            </div>
          }
        >
          <div className="pdf-container" style={{ transition: 'transform 0.2s ease-in-out' }}>
            <Page 
              pageNumber={currentPage} 
              scale={scale}
              renderTextLayer={true}
              renderAnnotationLayer={true}
              className="mx-auto"
              onLoadSuccess={handlePageLoadSuccess}
              loading={
                <div className="flex justify-center items-center p-6 sm:p-10 min-h-[200px]">
                  <div className="animate-pulse bg-gray-200 rounded-md w-full h-full min-h-[300px] sm:min-h-[400px]"></div>
                </div>
              }
            />
          </div>
        </Document>
      </div>
    </div>
  );
} 
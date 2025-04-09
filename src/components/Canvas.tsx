import { useEffect, useRef, useState } from 'react';
import { marked } from 'marked';
import mermaid from 'mermaid';

interface CanvasProps {
  content: string;
  visible: boolean;
  inView?: boolean; // 是否在视图中（侧边栏是否打开）
}

// Initialize mermaid configuration
mermaid.initialize({
  startOnLoad: true, // 设置为true，允许mermaid自动初始化
  theme: 'neutral',
  securityLevel: 'loose',
  fontFamily: 'system-ui, sans-serif',
  logLevel: 3, // 设置日志级别，有助于调试
});

export default function Canvas({ content, visible, inView = true }: CanvasProps) {
  const [html, setHtml] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [mermaidRendered, setMermaidRendered] = useState<boolean>(false);

  // Effect 1: Parse Markdown and set HTML
  useEffect(() => {
    if (!visible || !content) {
      setHtml(''); // Clear html if not visible or no content
      setLoading(false); // Ensure loading is off
      setMermaidRendered(false); // Reset mermaid rendered state
      return;
    }

    let isMounted = true; // Flag to check if component is still mounted
    setLoading(true);
    setMermaidRendered(false); // Reset mermaid rendered state when content changes

    const processMarkdown = async () => {
      try {
        // Convert Markdown to HTML
        const parsedHtml = marked.parse(content);
        if (typeof parsedHtml === 'string' && isMounted) {
          setHtml(parsedHtml);
          // 不在这里设置loading为false，让第二个effect处理渲染完成后的状态
        } else if (isMounted) {
           setHtml(''); // Handle potential non-string result or unmount
           setLoading(false);
        }
      } catch (error) {
        console.error('Error processing markdown:', error);
        if (isMounted) {
            setHtml('Error processing Markdown.'); // Show error message
            setLoading(false);
        }
      }
    };

    processMarkdown();

    return () => {
      isMounted = false; // Cleanup function to set flag on unmount
    };
  }, [content, visible]); // Rerun when content or visibility changes

  // Effect 2: Render Mermaid and apply styles after HTML update or when inView changes
  useEffect(() => {
    // Don't run if html is empty, ref not set, or not in view
    if (!html || !canvasRef.current || !inView) {
      // 如果缺少必要条件，确保不会卡在loading状态
      if (loading) setLoading(false);
      return;
    }

    let isMounted = true;

    // Function to apply custom styles
    const addCustomStyles = () => {
      if (canvasRef.current) {
        // Add style to tables
        const tables = canvasRef.current.querySelectorAll('table');
        tables.forEach(table => {
          table.classList.add('border-collapse', 'w-full', 'my-4');
          const cells = table.querySelectorAll('th, td');
          cells.forEach(cell => {
            cell.classList.add('border', 'border-gray-300', 'px-4', 'py-2');
          });
          const headers = table.querySelectorAll('th');
          headers.forEach(header => {
            header.classList.add('bg-gray-100', 'font-semibold');
          });
        });

        // Add style to code blocks
        const codeBlocks = canvasRef.current.querySelectorAll('pre code');
        codeBlocks.forEach(block => {
          block.parentElement?.classList.add('bg-gray-800', 'text-white', 'rounded-md', 'p-4', 'my-4', 'overflow-x-auto');
          // Check if mermaid class is present, if so, remove background added by markedjs perhaps
          if (block.classList.contains('language-mermaid')) {
            block.parentElement?.classList.remove('bg-gray-800', 'text-white', 'p-4');
          }
        });

        // Add style to images
        const images = canvasRef.current.querySelectorAll('img');
        images.forEach(img => {
          img.classList.add('max-w-full', 'h-auto', 'rounded-md', 'my-4');
        });
      }
    };


    const renderMermaidAndStyle = async () => {
      try {
        // Ensure the DOM is updated after setHtml before trying to find mermaid elements
        await new Promise(resolve => setTimeout(resolve, 0));

        if (isMounted && canvasRef.current) {
            // 检查和清理现有的mermaid图表，避免重复渲染的问题
            const existingMermaidDivs = canvasRef.current.querySelectorAll('.mermaid');
            if (existingMermaidDivs.length > 0 && mermaidRendered) {
              // 如果已经渲染过mermaid且存在mermaid div，需要清除
              existingMermaidDivs.forEach(div => {
                if (div.parentNode) {
                  try {
                    div.parentNode.removeChild(div);
                  } catch (e) {
                    console.error('Error removing mermaid div:', e);
                  }
                }
              });
              // 重置mermaid渲染状态
              setMermaidRendered(false);
            }
            
            // 查找mermaid代码块
            const mermaidElements = canvasRef.current.querySelectorAll('code.language-mermaid');

            if (mermaidElements.length > 0) {
                 // Prepare elements for mermaid.run
                 const elementsToRender: HTMLElement[] = [];
                 mermaidElements.forEach((el, index) => {
                     const pre = el.parentElement;
                     if (pre) {
                         const container = document.createElement('div');
                         container.classList.add('mermaid');
                         container.setAttribute('id', `mermaid-graph-${index}-${Date.now()}`);
                         container.textContent = el.textContent || '';
                         pre.parentNode?.replaceChild(container, pre);
                         elementsToRender.push(container);
                     }
                 });

                 if (elementsToRender.length > 0) {
                    try {
                      // 确保mermaid已被初始化
                      if (typeof mermaid.run === 'function') {
                        await mermaid.run({ nodes: elementsToRender });
                      } else {
                        console.error('Mermaid.run is not a function. Mermaid may not be properly initialized.');
                      }
                      if (isMounted) {
                        setMermaidRendered(true);
                      }
                    } catch (mermaidError) {
                      console.error('Mermaid rendering error:', mermaidError);
                    }
                 }
            } else {
                // 没有mermaid图表时也要更新状态
                if (isMounted) {
                  setMermaidRendered(true);
                }
            }
            
            // Apply styles after mermaid rendering
            addCustomStyles();
        }
      } catch (err) {
        console.error('Failed to render mermaid or apply styles:', err);
        if (isMounted && canvasRef.current) {
            const errorDiv = document.createElement('div');
            errorDiv.className = 'text-red-600 p-4 border border-red-300 rounded bg-red-50 my-4';
            errorDiv.textContent = `Error rendering diagram: ${err instanceof Error ? err.message : String(err)}`;
            const container = canvasRef.current.querySelector('.markdown-content') || canvasRef.current;
            container.appendChild(errorDiv);
        }
      } finally {
          // 无论如何都要确保loading状态被重置
          if (isMounted) {
            setLoading(false);
          }
      }
    };

    // 调用渲染函数
    renderMermaidAndStyle();

    return () => {
        isMounted = false;
    }
  }, [html, inView, loading, mermaidRendered]); // 添加mermaidRendered作为依赖项

  if (!visible) return null;

  // 添加自定义样式到全局Markdown内容
  const customStyles = `
    .markdown-content h1 { 
      font-size: 1.8rem; 
      font-weight: 600; 
      margin-top: 1rem; 
      margin-bottom: 1rem;
      padding-bottom: 0.5rem;
      border-bottom: 1px solid #e5e7eb;
      color: #1e40af;
    }
    .markdown-content h2 { 
      font-size: 1.5rem; 
      font-weight: 600; 
      margin-top: 1.25rem; 
      margin-bottom: 0.75rem;
      color: #2563eb;
    }
    .markdown-content h3 { 
      font-size: 1.25rem; 
      font-weight: 600; 
      margin-top: 1rem; 
      margin-bottom: 0.75rem;
      color: #3b82f6;
    }
    .markdown-content p { 
      margin-bottom: 1rem; 
      line-height: 1.6;
    }
    .markdown-content ul, .markdown-content ol { 
      margin-bottom: 1rem; 
      padding-left: 1.5rem;
      line-height: 1.6;
    }
    .markdown-content ul { list-style-type: disc; }
    .markdown-content ol { list-style-type: decimal; }
    .markdown-content li { margin-bottom: 0.25rem; }
    .markdown-content a { 
      color: #2563eb; 
      text-decoration: none;
      border-bottom: 1px dotted #2563eb;
    }
    .markdown-content a:hover {
      text-decoration: none;
      border-bottom: 1px solid #2563eb;
    }
    .markdown-content blockquote {
      border-left: 4px solid #ddd;
      padding: 0 1rem;
      color: #666;
      margin: 1rem 0;
    }
    .markdown-content code:not(pre code) {
      background-color: #f3f4f6;
      padding: 0.2em 0.4em;
      border-radius: 0.25rem;
      font-family: ui-monospace, monospace;
      font-size: 0.9em;
    }
    .markdown-content .mermaid {
      margin: 1.5rem auto;
      text-align: center;
    }
    /* Style for the container div we create for mermaid */
    .markdown-content div.mermaid {
      margin: 1.5rem auto;
      text-align: center;
      background-color: transparent !important; /* Ensure no background interferes */
      padding: 0 !important; /* Ensure no padding interferes */
    }
    /* Ensure SVG itself is centered if needed */
     .markdown-content div.mermaid svg {
        display: block; /* or inline-block depending on desired layout */
        margin: auto;
        max-width: 100%; /* Ensure SVGs don't overflow in narrow sidebar */
     }
     /* 在侧栏中表格可能需要更小的字体和紧凑的布局 */
     .markdown-content table {
       font-size: 0.95rem;
     }
     .markdown-content th, .markdown-content td {
       padding: 0.5rem 0.75rem;
     }
     /* 确保图片不会超出容器 */
     .markdown-content img {
       max-width: 100%;
       height: auto;
     }
     /* 为代码块添加水平滚动以适应较窄的侧栏 */
     .markdown-content pre {
       overflow-x: auto;
     }
  `;

  return (
    <div className="canvas-container bg-white rounded-lg w-full min-h-[200px] transition-all">
      <style>{customStyles}</style>
      
      {loading && (
        <div className="flex justify-center items-center py-8 absolute inset-0 bg-white bg-opacity-75 z-10">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
          <span className="ml-3 text-gray-600">渲染中...</span>
        </div>
      )}
      
      <div 
        ref={canvasRef}
        className={`markdown-content relative ${loading ? 'opacity-30' : 'opacity-100'} ${html ? '' : 'hidden'}`} 
        dangerouslySetInnerHTML={{ __html: html }}
      />
      
      {!html && !loading && content && (
        <div className="flex justify-center items-center py-8">
          <span className="text-gray-500">正在准备内容...</span>
        </div>
      )}
      
      {content && (
        <div className="mt-4 pt-3 border-t border-gray-100 text-right">
          <button
            onClick={() => {
              // Find the main content area to copy, exclude potential error messages etc.
              const contentToCopy = canvasRef.current?.querySelector('.markdown-content') || canvasRef.current;
              if (contentToCopy) {
                try {
                  // Temporarily remove loading indicator if present for copying
                  const loader = contentToCopy.querySelector('.absolute.inset-0');
                  if(loader) loader.remove();

                  const range = document.createRange();
                  range.selectNode(contentToCopy);
                  window.getSelection()?.removeAllRanges();
                  window.getSelection()?.addRange(range);
                  document.execCommand('copy');
                  window.getSelection()?.removeAllRanges();
                  // Maybe add a visual cue for copy success
                  console.log('Content copied to clipboard');
                } catch (err) {
                  console.error('Failed to copy content:', err);
                }
              }
            }}
            className="text-sm text-gray-500 hover:text-blue-600 flex items-center ml-auto"
            title="Copy rendered content"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
              <path d="M8 2a1 1 0 000 2h2a1 1 0 100-2H8z" />
              <path d="M3 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v6h-4.586l1.293-1.293a1 1 0 00-1.414-1.414l-3 3a1 1 0 000 1.414l3 3a1 1 0 001.414-1.414L10.414 13H15v3a2 2 0 01-2 2H5a2 2 0 01-2-2V5zM15 11h2a1 1 0 110 2h-2v-2z" />
            </svg>
            复制内容
          </button>
        </div>
      )}
    </div>
  );
} 
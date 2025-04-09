# PDF文件指南

为了使EdTech平台正常工作，请将您的PDF幻灯片文件放置在此目录中。

## 默认PDF文件

系统默认会寻找名为`sample.pdf`的文件作为默认展示内容。您可以：

1. 将您的演示文稿重命名为`sample.pdf`并放在此目录中，或
2. 修改`src/app/page.tsx`文件中的默认值以指向您的PDF文件

```typescript
// 在page.tsx中找到并修改
const [pdfUrl, setPdfUrl] = useState<string>('/sample.pdf'); // 修改为您的PDF文件名
```

## 幻灯片上下文

系统使用`src/app/api/context/route.ts`中的示例数据为每个幻灯片提供上下文。在实际应用中，您需要：

1. 为每个幻灯片创建对应的上下文数据
2. 修改API实现以从数据库或文件系统加载这些数据

每个幻灯片的上下文数据格式如下：

```json
{
  "title": "幻灯片标题",
  "content": "幻灯片主要内容",
  "explanation": "详细解释",
  "keywords": ["关键词1", "关键词2"],
  "diagrams": [
    {
      "type": "mermaid",
      "content": "mermaid图表内容"
    }
  ]
}
``` 
import { NextRequest, NextResponse } from 'next/server';

// 实际项目中应该从数据库或文件系统加载
interface SlideContext {
  title: string;
  content: string;
  explanation: string;
  keywords: string[];
}

const SAMPLE_CONTEXTS: Record<string, Record<number, SlideContext>> = {
  '/sample.pdf': {
    "1": {
      "title": "设计模式 II",
      "content": "由Yuqun Zhang讲授的CS304课程，图片来自Head First Design Patterns",
      "explanation": "本页是课程的封面页，介绍了课程名称、讲师和资料来源。",
      "keywords": ["设计模式", "CS304", "Head First Design Patterns"]
    },
    "2": {
      "title": "观察者模式",
      "content": "本章将介绍观察者模式的概念和应用",
      "explanation": "这是观察者模式章节的标题页，预示了接下来将详细讲解观察者模式的内容。",
      "keywords": ["观察者模式", "设计模式"]
    },
    "3": {
      "title": "天气监控应用",
      "content": "创建一个使用WeatherData对象来更新三种不同显示的应用：'当前状况'、'天气统计'和'天气预报'",
      "explanation": "本页介绍了一个实际应用场景，描述了需要创建的天气监控应用程序及其主要组件。有一个图表显示了天气站、WeatherData对象和显示设备之间的关系。",
      "keywords": ["天气监控", "WeatherData", "显示设备"]
    },
    "4": {
      "title": "需要做什么？",
      "content": "WeatherData类有获取温度、湿度和压力的方法，以及在测量值更新时调用的measurementsChanged()方法。需要更新三种不同的显示。",
      "explanation": "这一页详细说明了任务规范，展示了WeatherData类的结构，并指出需要在measurementsChanged()方法中实现更新显示的功能。",
      "keywords": ["WeatherData", "measurementsChanged", "更新显示"]
    },
    "5": {
      "title": "问题规范",
      "content": "WeatherData类有获取温度、湿度和压力的getter和setter；measurementsChanged()方法在新的天气数据可用时被调用；我们需要实现三种不同的显示元素；系统必须可扩展，以便今后可能添加其他显示元素。",
      "explanation": "详细描述了系统需求和约束条件，强调了系统的可扩展性要求。",
      "keywords": ["系统需求", "可扩展性", "显示元素"]
    },
    "6": {
      "title": "初次尝试",
      "content": "一个简单的实现，通过直接在measurementsChanged()方法中更新所有显示。但这种实现存在问题：编码到实现而非接口，添加新显示需要修改程序。",
      "explanation": "展示了一个初步解决方案的代码实现，并指出了其设计缺陷，尤其是违反了'封装变化'的设计原则。",
      "keywords": ["初步实现", "设计缺陷", "封装变化"]
    },
    "7": {
      "title": "发布/订阅模式",
      "content": "类似于报纸和杂志的订阅机制：你订阅并接收任何新内容；你取消订阅就停止接收内容。",
      "explanation": "介绍了发布/订阅模式的基本概念，将其与现实生活中的订阅服务进行类比，并展示了一对多关系的图示。",
      "keywords": ["发布/订阅", "订阅机制", "一对多关系"]
    },
    "8": {
      "title": "观察者模式",
      "content": "观察者模式定义了对象之间的一对多依赖关系，当一个对象改变状态时，所有依赖它的对象都会得到通知并自动更新。",
      "explanation": "提供了观察者模式的正式定义，说明了它如何处理对象之间的依赖关系和状态变化通知。",
      "keywords": ["观察者模式", "一对多依赖", "状态变化通知"]
    },
    "9": {
      "title": "观察者模式结构",
      "content": "对象使用Subject接口注册和取消注册为观察者；每个主题可以有多个观察者；所有潜在的观察者需要实现Observer接口并提供update()方法；具体主题实现Subject接口和notifyObservers()方法；具体观察者可以是实现Observer接口并向具体主题注册的任何类。",
      "explanation": "详细说明了观察者模式的结构组成，包括Subject接口、Observer接口以及它们之间的关系。图表清晰地展示了各组件的职责和交互方式。",
      "keywords": ["Subject接口", "Observer接口", "注册机制", "通知机制"]
    },
    "10": {
      "title": "松耦合的力量",
      "content": "主题只知道观察者实现了给定接口；可以随时添加新的观察者；不需要修改主题来添加新类型的观察者；可以独立地重用主题或观察者；主题或观察者的变化不会相互影响。",
      "explanation": "解释了松耦合设计的优势，强调了观察者模式如何通过最小化对象之间的相互依赖，使系统更灵活、更能适应变化。",
      "keywords": ["松耦合", "灵活性", "可重用性", "可维护性"]
    }
  }
};

export async function GET(request: NextRequest) {
  // 解析请求参数
  const { searchParams } = new URL(request.url);
  const pdfUrl = searchParams.get('pdfUrl');
  const pageStr = searchParams.get('page');
  
  if (!pdfUrl || !pageStr) {
    return NextResponse.json(
      { error: '缺少必要参数' },
      { status: 400 }
    );
  }
  
  const page = parseInt(pageStr, 10);
  
  if (isNaN(page) || page < 1) {
    return NextResponse.json(
      { error: '页码参数无效' },
      { status: 400 }
    );
  }
  
  // 获取上下文数据
  // 在实际应用中，这里应该从数据库或其他存储中获取数据
  const pdfData = SAMPLE_CONTEXTS[pdfUrl] || SAMPLE_CONTEXTS['/sample.pdf']; // 默认使用示例数据
  const contextData = pdfData[page];
  
  if (!contextData) {
    return NextResponse.json(
      { error: '未找到该页面的上下文数据' },
      { status: 404 }
    );
  }
  
  return NextResponse.json(contextData);
} 
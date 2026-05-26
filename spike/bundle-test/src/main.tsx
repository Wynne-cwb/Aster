import React from 'react';
import { createRoot } from 'react-dom/client';
import {
  FluentProvider,
  webLightTheme,
  Button,
  Input,
  Text,
  Spinner,
} from '@fluentui/react-components';
import { create } from 'zustand';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// ---- Zustand store（模拟聊天状态，验证 Zustand 体积） ----
interface ChatMessage {
  role: 'user' | 'ai';
  content: string;
}

interface ChatStore {
  messages: ChatMessage[];
  addMessage: (msg: ChatMessage) => void;
}

const useChatStore = create<ChatStore>((set) => ({
  messages: [],
  addMessage: (msg) => set((state) => ({ messages: [...state.messages, msg] })),
}));

// ---- 最小 App 组件 ----
// 用具体 import（非 barrel）—— 避免 PITFALLS.md Pitfall 6 中的 Fluent v8 barrel 体积陷阱
function App(): React.ReactElement {
  const { messages, addMessage } = useChatStore();
  const [input, setInput] = React.useState('');

  const handleSend = (): void => {
    if (!input.trim()) return;
    addMessage({ role: 'user', content: input });
    addMessage({ role: 'ai', content: '**AI 回复**：' + input });
    setInput('');
  };

  return (
    <FluentProvider theme={webLightTheme}>
      <div style={{ padding: '16px', maxWidth: '400px' }}>
        <Text size={600} weight="semibold">
          Aster Bundle Test
        </Text>
        <div style={{ margin: '12px 0', display: 'flex', gap: '8px' }}>
          <Input
            value={input}
            onChange={(_e, d) => setInput(d.value)}
            placeholder="输入测试消息"
            style={{ flex: 1 }}
          />
          <Button appearance="primary" onClick={handleSend}>
            发送
          </Button>
        </div>
        <div>
          {messages.map((msg, i) => (
            <div key={i} style={{ marginBottom: '8px' }}>
              <Text weight={msg.role === 'user' ? 'semibold' : 'regular'}>
                {msg.role === 'user' ? '用户' : 'AI'}：
              </Text>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
            </div>
          ))}
        </div>
        <Spinner size="tiny" label="（Spinner 用于 bundle 测试）" />
      </div>
    </FluentProvider>
  );
}

// ---- Office.js 初始化后再渲染（与真实 Add-in 一致） ----
Office.onReady(() => {
  const container = document.getElementById('root');
  if (!container) {
    throw new Error('未找到 #root 容器');
  }
  const root = createRoot(container);
  root.render(<App />);
});

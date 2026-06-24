import { Code2, Paperclip, Send, Settings, Square } from 'lucide-react';
import { FormEvent, KeyboardEvent, useState } from 'react';

interface ComposerProps {
  isStreaming: boolean;
  isDisabled?: boolean;
  onSend: (content: string) => void;
  onStop: () => void;
}

export function Composer({ isStreaming, isDisabled = false, onSend, onStop }: ComposerProps) {
  const [value, setValue] = useState('');

  function submit(event: FormEvent) {
    event.preventDefault();
    const content = value.trim();
    if (!content || isStreaming || isDisabled) return;
    setValue('');
    onSend(content);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      submit(event);
    }
  }

  return (
    <form className="composer" onSubmit={submit}>
      <textarea
        aria-label="输入消息"
        placeholder="输入消息"
        rows={2}
        disabled={isDisabled}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={handleKeyDown}
      />
      <div className="composer-bottom">
        <div className="composer-tools">
          <button className="icon-button ghost" type="button" aria-label="附件">
            <Paperclip size={20} />
          </button>
          <button className="icon-button ghost" type="button" aria-label="代码模式">
            <Code2 size={20} />
          </button>
          <button className="icon-button ghost" type="button" aria-label="设置">
            <Settings size={20} />
          </button>
        </div>
        <div className="composer-submit">
          <span>Enter 发送，Shift + Enter 换行</span>
          {isStreaming ? (
            <button className="send-button stop" type="button" onClick={onStop} aria-label="停止生成">
              <Square size={18} />
            </button>
          ) : (
            <button className="send-button" type="submit" disabled={!value.trim() || isDisabled} aria-label="发送">
              <Send size={21} />
            </button>
          )}
        </div>
      </div>
    </form>
  );
}

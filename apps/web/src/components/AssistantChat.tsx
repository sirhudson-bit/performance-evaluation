'use client';

import { useState } from 'react';
import { apiClient, ApiClientError } from '@/lib/client';
import { Button, Alert } from '@/components/ui';

interface Message { role: 'user' | 'assistant'; content: string }

export function AssistantChat({ enabled, providerName }: { enabled: boolean; providerName: string | null }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function ask(event: React.FormEvent) {
    event.preventDefault();
    const text = input.trim();
    if (text.length < 2 || busy) return;
    setBusy(true);
    setError(null);
    setMessages((m) => [...m, { role: 'user', content: text }]);
    setInput('');
    try {
      const res = await apiClient<{ conversationId: number; reply: string; note: string }>('POST', '/ai/chat', {
        conversationId,
        message: text,
      });
      setConversationId(res.conversationId);
      setMessages((m) => [...m, { role: 'assistant', content: `${res.reply}\n\n_${res.note}_` }]);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'خطا در ارتباط با دستیار.');
    } finally {
      setBusy(false);
    }
  }

  function newConversation() {
    setConversationId(null);
    setMessages([]);
  }

  if (!enabled) {
    return <p className="text-sm text-slate-500">دستیار غیرفعال است.</p>;
  }

  return (
    <div className="space-y-4">
      {providerName ? <p className="text-xs text-slate-400">سرویس فعال: {providerName}</p> : null}
      <div className="min-h-64 space-y-3 rounded border border-slate-100 bg-slate-50 p-4">
        {messages.length === 0 ? (
          <p className="text-sm text-slate-400">پرسش خود را بنویسید. مثال: «مراحل ارسال ارزیابی چیست؟»</p>
        ) : (
          messages.map((m, i) => (
            <div key={i} className={`max-w-[85%] rounded p-3 text-sm ${m.role === 'user' ? 'ml-0 mr-auto bg-brand-600 text-white' : 'bg-white text-slate-700 shadow-card'}`} style={{ marginInlineStart: m.role === 'assistant' ? 0 : 'auto' }}>
              {m.content.split('\n').map((line, j) => (
                <p key={j} className="whitespace-pre-wrap leading-6">{line}</p>
              ))}
            </div>
          ))
        )}
        {busy ? <p className="text-xs text-slate-400" role="status">در حال دریافت پاسخ…</p> : null}
      </div>

      {error ? <Alert variant="danger">{error}</Alert> : null}

      <form onSubmit={ask} className="flex items-end gap-2">
        <label htmlFor="chat-input" className="sr-only">پرسش شما</label>
        <textarea
          id="chat-input"
          className="min-h-12 flex-1 rounded border border-slate-300 px-3 py-2 text-sm"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="پرسش خود را بنویسید…"
          rows={2}
        />
        <Button type="submit" disabled={busy || input.trim().length < 2}>{busy ? '…' : 'ارسال'}</Button>
        <Button type="button" variant="ghost" onClick={newConversation}>گفت‌وگوی جدید</Button>
      </form>
    </div>
  );
}

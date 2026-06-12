import React, { useState, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, Send, Disc3, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

const SUGGESTIONS = [
  'Take it darker 🌑',
  'Pick up the pace ⚡',
  'Something more melodic 🎵',
  'Add more bass 🔊',
  'Transition to jazz 🎷',
];

export default function DJChatPanel({ isOpen, onClose, onGenerate, sessionContext }) {
  const [messages, setMessages] = useState([
    { role: 'dj', content: "Hey! I'm your AI DJ. Tell me the vibe you're feeling, or just describe what you want to hear. I'll generate the perfect track for you. 🎧" }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (text) => {
    const msg = text.trim();
    if (!msg || isLoading) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: msg }]);
    setIsLoading(true);

    const contextStr = sessionContext
      ? `Current session: genre=${sessionContext.genre || 'any'}, mood=${sessionContext.mood || 'any'}, bpm=${sessionContext.bpm || 'any'}, energy=${sessionContext.energy || 5}/10.`
      : '';

    const response = await base44.integrations.Core.InvokeLLM({
      prompt: `You are AuraDJ, a friendly and expressive AI DJ persona. The user is in a music generation session.
${contextStr}
User message: "${msg}"

Respond in 1-2 sentences with enthusiasm. Then output a JSON block like:
\`\`\`json
{"title": "track title", "genre": "genre", "mood": "mood", "bpm": 120, "energy": 7, "prompt": "detailed music generation prompt"}
\`\`\`
Make the prompt very descriptive for music generation (instruments, rhythm, texture, feel).`,
      response_json_schema: null
    });

    // Parse DJ reply vs JSON params
    const raw = typeof response === 'string' ? response : JSON.stringify(response);
    const jsonMatch = raw.match(/```json\s*([\s\S]*?)```/);
    let params = null;
    let djReply = raw.replace(/```json[\s\S]*?```/g, '').trim();

    if (jsonMatch) {
      try { params = JSON.parse(jsonMatch[1]); } catch (_) {}
    }

    setMessages(prev => [...prev, { role: 'dj', content: djReply || "Let me cook up something special for you! 🎵" }]);
    setIsLoading(false);

    if (params && onGenerate) onGenerate(params);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ x: '100%', opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          className="fixed top-14 right-0 bottom-20 w-full sm:w-96 bg-card border-l border-border z-25 flex flex-col shadow-2xl"
          style={{ zIndex: 25 }}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                <Disc3 className="w-4 h-4 text-primary-foreground" />
              </div>
              <div>
                <p className="text-sm font-semibold">AI DJ</p>
                <p className="text-xs text-muted-foreground">Chat to shape your mix</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close chat">
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((msg, i) => (
              <div key={i} className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                <div className={cn(
                  'max-w-[80%] rounded-2xl px-3 py-2 text-sm leading-relaxed',
                  msg.role === 'user'
                    ? 'bg-primary text-primary-foreground rounded-br-sm'
                    : 'bg-secondary text-secondary-foreground rounded-bl-sm'
                )}>
                  {msg.content}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-secondary rounded-2xl rounded-bl-sm px-3 py-2">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Suggestions */}
          <div className="px-4 pb-2 flex gap-2 overflow-x-auto">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => sendMessage(s)}
                className="flex-shrink-0 text-xs px-3 py-1.5 rounded-full bg-accent text-accent-foreground border border-border hover:bg-primary hover:text-primary-foreground transition-colors duration-150 cursor-pointer"
              >
                {s}
              </button>
            ))}
          </div>

          {/* Input */}
          <div className="p-4 pt-2 border-t border-border">
            <form onSubmit={(e) => { e.preventDefault(); sendMessage(input); }} className="flex gap-2">
              <Input
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Tell your DJ what to play…"
                className="flex-1 text-sm"
                disabled={isLoading}
              />
              <Button type="submit" size="icon" disabled={isLoading || !input.trim()} aria-label="Send">
                <Send className="w-4 h-4" />
              </Button>
            </form>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
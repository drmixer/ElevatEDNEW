import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, Send, X, Bot, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChatMessage } from '../../types';
import getMarketingResponse from '../../services/getMarketingResponse';

const ChatBot: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      content: "Hi! I'm the ElevatED marketing assistant. Ask me about features, pricing, or how to get started - Home Learning. Elevated Together.",
      isUser: false,
      timestamp: new Date()
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatWindowRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (!isOpen) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    inputRef.current?.focus();

    const handleKeydown = (event: KeyboardEvent) => {
      if (!chatWindowRef.current) return;

      if (event.key === 'Escape') {
        event.preventDefault();
        setIsOpen(false);
        return;
      }

      if (event.key !== 'Tab') return;

      const focusableSelector =
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';
      const focusable = Array.from(
        chatWindowRef.current.querySelectorAll<HTMLElement>(focusableSelector),
      ).filter((el) => !el.hasAttribute('disabled') && el.getAttribute('aria-hidden') !== 'true');

      if (!focusable.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      }
    };

    document.addEventListener('keydown', handleKeydown);
    return () => {
      document.removeEventListener('keydown', handleKeydown);
      previouslyFocused?.focus();
    };
  }, [isOpen]);

  const getAIResponse = (userMessage: string): string => {
    const message = userMessage.toLowerCase();
    
    if (message.includes('pricing') || message.includes('cost') || message.includes('price')) {
      return "Plans: Free is $0/mo for 1 learner with up to 10 lessons/month and 3 tutor chats/day. Plus is $6.99/mo for the first student ($5.59/additional, up to 4) with roughly 100 lessons/month, generous tutor access, analytics, and weekly summaries. Pro is $9.99/mo for the first student ($7.99/additional, up to 6) with unlimited lessons/tutor, full analytics/exports, and priority support.";
    }
    
    if (message.includes('feature') || message.includes('what') || message.includes('how')) {
      return "ElevatED highlights: adaptive diagnostics, a hints-first AI learning assistant, real-time progress tracking, XP/streaks/badges for motivation, and a parent dashboard families trust. Each student gets a personalized path that updates after every session.";
    }
    
    if (message.includes('start') || message.includes('begin') || message.includes('signup')) {
      return "Click 'Start Learning Today' to create your account. Students take a quick adaptive diagnostic (about 15-20 minutes) to set their starting point, then unlock a personalized path. Parents can link accounts with a family code to set goals and monitor progress.";
    }
    
    if (message.includes('subject') || message.includes('math') || message.includes('english') || message.includes('science')) {
      return "We cover K-12 Math, English, Science, and Social Studies with reading-level-aware content and concept-specific difficulty adjustments. Lessons adapt to each learner's pace.";
    }
    
    if (message.includes('parent') || message.includes('track') || message.includes('progress')) {
      return "Parents see progress by student and subject, weekly AI summaries/digests, alerts for missed sessions or flagged concepts, and mastery analytics. Manage multiple children under one account and track trends over time.";
    }
    
    if (message.includes('ai') || message.includes('adaptive') || message.includes('personalized')) {
      return "Our AI uses diagnostics to set difficulty per concept, adapts after every quiz, and provides context-aware tutoring with hints-first guardrails. It shares full solutions on request. This chat is for product info only—homework help lives in the student tutor.";
    }
    
    return "ElevatED is an adaptive K-12 platform that pairs every student with a private AI tutor plus dashboards families trust. Ask about pricing, onboarding, or specific features and I'll share the details.";
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isTyping) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      content: inputMessage,
      isUser: true,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsTyping(true);

    let assistantContent = '';

    try {
      const marketingPrompt = [
        `Visitor question: ${userMessage.content.trim()}`,
        'Guidelines: keep the reply to 2-3 concise sentences, stay on-brand and outcome-focused, and avoid technical or implementation details. If the facts are missing, say you can connect them to ElevatED support instead of guessing.',
      ].join('\n\n');

      const result = await getMarketingResponse(marketingPrompt);
      assistantContent = result.message;
    } catch (error) {
      console.error('[ElevatED Landing Chatbot] Failed to fetch AI response.', error);
      assistantContent = `${getAIResponse(
        userMessage.content,
      )}\n\nOur live assistant is momentarily unavailable, so here are the key details instead.`;
    } finally {
      if (!assistantContent) {
        assistantContent = getAIResponse(userMessage.content);
      }

      // Add a short delay so the typing indicator feels natural.
      await new Promise(resolve => setTimeout(resolve, 400));

      const aiResponse: ChatMessage = {
        id: (Date.now() + 1).toString(),
        content: assistantContent,
        isUser: false,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, aiResponse]);
      setIsTyping(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <>
      {/* Chat Button */}
      <motion.button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-r from-brand-teal to-brand-blue text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center z-50 focus-ring"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        animate={{ 
          boxShadow: isOpen ? "0 0 0 4px rgba(51, 217, 193, 0.3)" : "0 10px 25px rgba(0, 0, 0, 0.2)"
        }}
        aria-label="Open ElevatED marketing assistant chat"
        aria-expanded={isOpen}
        aria-controls="landing-chat-window"
      >
        <MessageCircle className="h-6 w-6" />
      </motion.button>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            className="fixed bottom-24 right-6 w-80 h-96 bg-white rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden"
            role="dialog"
            aria-modal="true"
            aria-labelledby="chatbot-title"
            aria-describedby="chatbot-description"
            id="landing-chat-window"
            tabIndex={-1}
            ref={chatWindowRef}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-brand-teal to-brand-blue text-white p-4 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                  <Bot className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-semibold" id="chatbot-title">ElevatED Assistant</h3>
                  <p className="text-xs opacity-90" id="chatbot-description">Concise answers, on-brand.</p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 hover:bg-white/20 rounded-full transition-colors focus-ring"
                aria-label="Close chat assistant"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex items-center gap-2 bg-amber-50 text-amber-700 px-4 py-2 text-[11px] border-b border-amber-200">
              <Info className="h-3 w-3" />
              Answers are for product info only, not study help.
            </div>

            {/* Messages */}
            <div className="flex-1 p-4 overflow-y-auto space-y-4" role="log" aria-live="polite" aria-relevant="additions text">
              {messages.map((message) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] p-3 rounded-2xl ${
                      message.isUser
                        ? 'bg-brand-blue text-white'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    <p className="text-sm leading-relaxed">{message.content}</p>
                  </div>
                </motion.div>
              ))}
              
              {isTyping && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex justify-start"
                >
                  <div className="bg-gray-100 p-3 rounded-2xl">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                    </div>
                  </div>
                </motion.div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 border-t border-gray-200">
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Ask about features, pricing, or getting started..."
                  className="flex-1 p-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-teal text-sm"
                  aria-label="Message the ElevatED assistant"
                  ref={inputRef}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!inputMessage.trim()}
                  className="p-2 bg-brand-teal text-white rounded-xl hover:bg-brand-blue transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-ring"
                  aria-label="Send chat message"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default ChatBot;

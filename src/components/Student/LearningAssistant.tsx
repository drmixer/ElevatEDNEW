import React, { useEffect, useRef, useState } from 'react';
import { Send, X, Bot, Lightbulb, Target, BookOpen } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../contexts/AuthContext';
import { ChatMessage, Student } from '../../types';
import getTutorResponse from '../../services/getTutorResponse';
import trackEvent from '../../lib/analytics';

const LearningAssistant: React.FC = () => {
  const { user } = useAuth();
  const student = user as Student;
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      content: `Hi there! I'm your personal learning assistant. I can help with ${student.strengths[0] || 'your current subjects'}, study tips, or motivation. What would you like to work on today?`,
      isUser: false,
      timestamp: new Date(),
      role: 'assistant',
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [assistantError, setAssistantError] = useState<string | null>(null);
  const assistantWindowRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const quickActions = [
    { icon: Lightbulb, text: 'Get a study tip', action: 'study-tip' },
    { icon: Target, text: 'Review weak areas', action: 'review-weak' },
    { icon: BookOpen, text: 'Explain a concept', action: 'explain-concept' }
  ];

  const getContextualResponse = (userMessage: string): string => {
    const message = userMessage.toLowerCase();
    
    if (message.includes('help') || message.includes('stuck')) {
      return `I can see you're working on ${student.strengths[0] || 'several topics'}. When you're stuck, try breaking the problem into smaller steps. What specific part is challenging you? I can walk you through it step by step! 🤔`;
    }
    
    if (message.includes('motivation') || message.includes('tired') || message.includes('give up')) {
      return `You're doing amazing! You've already earned ${student.xp} XP and you're on a ${student.streakDays}-day streak! 🔥 Remember, every expert was once a beginner. What you're learning today is building your future success. Take a short break if you need one, then come back strong! 💪`;
    }
    
    if (message.includes('math') || message.includes('algebra') || message.includes('equation')) {
      return `Great choice focusing on math! I can see algebra is one of your strengths. For equations, remember the golden rule: whatever you do to one side, do to the other. Would you like me to walk through a specific type of problem with you? 📊`;
    }
    
    if (message.includes('english') || message.includes('writing') || message.includes('grammar')) {
      return `English skills are so important! For writing, I always recommend the 3-step approach: Plan (outline your ideas), Draft (write without worrying about perfection), and Revise (polish your work). What type of writing are you working on? 📝`;
    }
    
    if (message.includes('science') || message.includes('experiment') || message.includes('biology')) {
      return `Science is all about curiosity and discovery! The key is to understand the 'why' behind concepts, not just memorize facts. Try connecting what you learn to real-world examples. What science topic are you exploring? 🔬`;
    }
    
    if (message.includes('study tip') || message.includes('how to study')) {
      return `Here's a personalized study tip for you: Since ${student.weaknesses[0] || 'some areas'} need more practice, try the Feynman Technique - explain the concept in simple terms as if teaching a friend. This reveals gaps in understanding! Also, take breaks every 25 minutes (Pomodoro technique). 🧠`;
    }
    
    if (message.includes('weak') || message.includes('difficult') || message.includes('struggle')) {
      return `I notice you're working on improving in ${student.weaknesses[0] || 'certain areas'}. That's totally normal! Everyone has topics that challenge them more. The key is consistent practice and not being afraid to ask questions. Would you like some specific strategies for this topic? 🎯`;
    }
    
    return `That's a great question! Based on your learning profile (Level ${student.level}, strong in ${student.strengths[0] || 'multiple areas'}), I can help you tackle this. Can you tell me more about what you're working on so I can give you the most helpful guidance? 🤝`;
  };

  const handleQuickAction = (action: string) => {
    let message = '';
    switch (action) {
      case 'study-tip':
        message = 'Can you give me a study tip?';
        break;
      case 'review-weak':
        message = 'Help me review my weak areas';
        break;
      case 'explain-concept':
        message = 'Can you explain a concept to me?';
        break;
    }
    if (message) {
      void handleSendMessage(message);
    }
  };

  const handleSendMessage = async (customMessage?: string) => {
    const messageToSend = (customMessage ?? inputMessage).trim();
    if (!messageToSend.trim()) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      content: messageToSend,
      isUser: true,
      timestamp: new Date(),
      role: 'user',
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsTyping(true);
    setAssistantError(null);
    trackEvent('learning_assistant_message_sent', {
      studentId: student.id,
      length: messageToSend.length,
    });

    try {
      const contextWindow = [...messages, userMessage]
        .slice(-6)
        .map((entry) => `${entry.isUser ? 'Student' : 'Assistant'}: ${entry.content}`)
        .join('\n');

      const promptForModel = `${contextWindow}\nAssistant:`.slice(-1100);

      const response = await getTutorResponse(promptForModel, {
        mode: 'learning',
      });

      const aiResponse: ChatMessage = {
        id: (Date.now() + 1).toString(),
        content: response,
        isUser: false,
        timestamp: new Date(),
        role: 'assistant',
      };

      setMessages(prev => [...prev, aiResponse]);
      trackEvent('learning_assistant_message_received', {
        studentId: student.id,
        source: 'openrouter',
      });
    } catch (err) {
      console.error('[LearningAssistant] AI response failed', err);
      setAssistantError('The assistant is unavailable right now. Please try again in a moment.');

      const fallbackResponse: ChatMessage = {
        id: (Date.now() + 2).toString(),
        content: getContextualResponse(messageToSend),
        isUser: false,
        timestamp: new Date(),
        role: 'assistant',
      };

      setMessages(prev => [...prev, fallbackResponse]);
      trackEvent('learning_assistant_message_received', {
        studentId: student.id,
        source: 'rules-engine',
      });
    } finally {
      setIsTyping(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    inputRef.current?.focus();

    const handleKeydown = (event: KeyboardEvent) => {
      if (!assistantWindowRef.current) return;

      if (event.key === 'Escape') {
        event.preventDefault();
        setIsOpen(false);
        return;
      }

      if (event.key !== 'Tab') return;

      const focusableSelector =
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';
      const focusable = Array.from(
        assistantWindowRef.current.querySelectorAll<HTMLElement>(focusableSelector),
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

  return (
    <>
      {/* Assistant Button */}
      <motion.button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 left-6 w-14 h-14 bg-gradient-to-r from-brand-violet to-brand-blue text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center z-50 focus-ring"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        animate={{ 
          boxShadow: isOpen ? "0 0 0 4px rgba(151, 28, 181, 0.3)" : "0 10px 25px rgba(0, 0, 0, 0.2)"
        }}
        aria-label="Open learning assistant"
        aria-expanded={isOpen}
        aria-controls="learning-assistant-window"
      >
        <Bot className="h-6 w-6" />
      </motion.button>

      {/* Assistant Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            className="fixed bottom-24 left-6 w-80 h-96 bg-white rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden"
            role="dialog"
            aria-modal="true"
            aria-labelledby="learning-assistant-title"
            aria-describedby="learning-assistant-description"
            id="learning-assistant-window"
            tabIndex={-1}
            ref={assistantWindowRef}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-brand-violet to-brand-blue text-white p-4 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                  <Bot className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-semibold" id="learning-assistant-title">Learning Assistant</h3>
                  <p className="text-xs opacity-90" id="learning-assistant-description">Here to help you learn!</p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 hover:bg-white/20 rounded-full transition-colors focus-ring"
                aria-label="Close learning assistant"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Quick Actions */}
            <div className="p-3 border-b border-gray-200">
              <div className="flex space-x-2">
                {quickActions.map((action, index) => (
                  <button
                    key={index}
                    onClick={() => handleQuickAction(action.action)}
                    className="flex items-center space-x-1 px-3 py-2 bg-gray-100 hover:bg-brand-light-violet rounded-lg text-xs transition-colors focus-ring"
                    aria-label={action.text}
                  >
                    <action.icon className="h-3 w-3" />
                    <span>{action.text}</span>
                  </button>
                ))}
              </div>
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
                        ? 'bg-brand-violet text-white'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    <p className="text-sm leading-relaxed">{message.content}</p>
                  </div>
                </motion.div>
              ))}
              {assistantError && (
                <div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-xl p-3" role="alert">
                  {assistantError}
                </div>
              )}
              
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
            </div>

            {/* Input */}
            <div className="p-4 border-t border-gray-200">
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void handleSendMessage();
                    }
                  }}
                  placeholder="Ask me anything about your studies..."
                  className="flex-1 p-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-violet text-sm"
                  aria-label="Message the learning assistant"
                  ref={inputRef}
                />
                <button
                  onClick={() => handleSendMessage()}
                  disabled={!inputMessage.trim()}
                  className="p-2 bg-brand-violet text-white rounded-xl hover:bg-brand-blue transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-ring"
                  aria-label="Send learning assistant message"
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

export default LearningAssistant;

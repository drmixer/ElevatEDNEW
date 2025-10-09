import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, Send, X, Bot } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChatMessage } from '../../types';
import getTutorResponse from '../../services/getTutorResponse';

const MARKETING_SYSTEM_PROMPT =
  'You are ElevatED, the official marketing assistant for ElevatED—an adaptive K-12 learning platform. ' +
  'Always sound warm, encouraging, and confident. Only answer using the product facts provided to you. ' +
  'If you do not see the answer in the facts, say you are unsure and suggest contacting ElevatED support.';

const MARKETING_KNOWLEDGE = `
Product: ElevatED is a K-12 learning platform that gives every student a private AI tutor.
Audience: Families, students, and educators seeking personalized instruction across Math, English, Science, and Social Studies.
Core approach: Adaptive diagnostics determine each learner's starting point, then AI adjusts lesson difficulty, hints, and feedback in real time.
Student experience: Gamified journey with XP, streaks, badges, and story-driven missions that celebrate progress and keep motivation high.
AI Learning Assistant: Context-aware tutor that offers step-by-step guidance, study tips, and motivational check-ins aligned to each learner's profile.
Parent experience: Parent dashboard delivers real-time progress tracking, weekly AI-generated summaries, alerts for missed sessions, and detailed analytics on concept mastery.
Curriculum: Comprehensive K-12 coverage with concept-specific reinforcement, instant quiz feedback, and suggested review activities when learners struggle.
Pricing: Free tier with limited daily lessons and core subject access. Premium tier unlocks full adaptive content, AI assistant, detailed reports, and discounted add-on seats for additional children (starting at $9.99/month or $99/year).
Mission: Make adaptive, joyful learning accessible, with actionable insights that keep families involved.
Support: Encourage visitors to reach out through the contact options on the site for specifics like implementation timelines or school partnerships.
`;

const ChatBot: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      content: "Hi! I'm your ElevatED assistant. I can help you learn about our platform, pricing, features, and how to get started. What would you like to know?",
      isUser: false,
      timestamp: new Date()
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const getAIResponse = (userMessage: string): string => {
    const message = userMessage.toLowerCase();
    
    if (message.includes('pricing') || message.includes('cost') || message.includes('price')) {
      return "ElevatED offers a free tier with limited daily lessons and core subjects, plus a premium tier with full access to adaptive content, AI learning assistant, and detailed parent reports. Premium pricing starts at $9.99/month or $99/year. Parents can add additional children at a discounted rate!";
    }
    
    if (message.includes('feature') || message.includes('what') || message.includes('how')) {
      return "ElevatED features include: 🎯 Adaptive diagnostic assessments, 🤖 AI learning assistant, 📊 Real-time progress tracking, 🏆 XP system with badges and levels, 👨‍👩‍👧 Parent dashboard with insights, 📚 K-12 content for Math, English, Science, and Social Studies. Everything adapts to each student's learning pace!";
    }
    
    if (message.includes('start') || message.includes('begin') || message.includes('signup')) {
      return "Getting started is easy! Click 'Start Learning Today' to create your account. Students take a quick diagnostic assessment that adapts in real-time, then get a personalized learning path. Parents can link to their student's account and set learning goals. The diagnostic takes about 15-20 minutes and covers all core subjects.";
    }
    
    if (message.includes('subject') || message.includes('math') || message.includes('english') || message.includes('science')) {
      return "We cover all core K-12 subjects: Mathematics (from basic arithmetic to calculus), English (reading, writing, grammar), Science (biology, chemistry, physics, earth science), and Social Studies (history, geography, civics). Content adapts to grade level and individual learning pace with concept-specific difficulty adjustment.";
    }
    
    if (message.includes('parent') || message.includes('track') || message.includes('progress')) {
      return "Parents get comprehensive insights! The parent dashboard shows progress by student and subject, weekly AI-generated performance summaries, alerts for missed sessions or low scores, and detailed analytics on concept mastery. You can manage multiple children under one account and track learning trends over time.";
    }
    
    if (message.includes('ai') || message.includes('adaptive') || message.includes('personalized')) {
      return "Our AI engine creates truly personalized learning! It uses diagnostic results to assign difficulty levels per concept, adapts in real-time based on quiz performance, provides context-aware tutoring, and generates custom content that matches each student's reading level and learning style. The AI assistant knows exactly where each student is in their learning journey.";
    }
    
    return "ElevatED is an adaptive K-12 learning platform that pairs every student with a private AI tutor. Families get diagnostic assessments, personalized lesson paths, instant feedback, gamified motivation, and a parent dashboard with weekly AI summaries. Ask about pricing, onboarding, or specific features and I’ll share the details.";
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
        'Use the following ElevatED product facts when answering visitor questions.',
        MARKETING_KNOWLEDGE.trim(),
        `Visitor question: ${userMessage.content.trim()}`,
        'Craft a concise, friendly answer that stays within these facts.',
      ].join('\n\n');

      assistantContent = await getTutorResponse(marketingPrompt, MARKETING_SYSTEM_PROMPT);
    } catch (error) {
      console.error('[ElevatED Landing Chatbot] Failed to fetch AI response.', error);
      assistantContent = `${getAIResponse(
        userMessage.content,
      )}\n\nPs: Our live assistant is momentarily unavailable, so I shared our standard overview instead.`;
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
        className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-r from-brand-teal to-brand-blue text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center z-50"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        animate={{ 
          boxShadow: isOpen ? "0 0 0 4px rgba(51, 217, 193, 0.3)" : "0 10px 25px rgba(0, 0, 0, 0.2)"
        }}
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
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-brand-teal to-brand-blue text-white p-4 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                  <Bot className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-semibold">ElevatED Assistant</h3>
                  <p className="text-xs opacity-90">Always here to help!</p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 hover:bg-white/20 rounded-full transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 p-4 overflow-y-auto space-y-4">
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
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!inputMessage.trim()}
                  className="p-2 bg-brand-teal text-white rounded-xl hover:bg-brand-blue transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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

/**
 * ParentLearningAssistant - AI Assistant for Parents
 * 
 * Helps parents understand their children's learning progress and provides
 * actionable recommendations for supporting their education at home.
 * 
 * Key Features:
 * - Progress insights by subject
 * - Skill gap explanations
 * - Home activity suggestions
 * - Conversation starters for discussing learning
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Send,
    X,
    TrendingUp,
    Users,
    ChevronDown,
    HelpCircle,
    Home,
    MessageCircle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../contexts/AuthContext';
import type { ChatMessage, Parent, ParentChildSnapshot } from '../../types';
import getTutorResponse from '../../services/getTutorResponse';
import trackEvent from '../../lib/analytics';
import { formatSubjectLabel } from '../../lib/subjects';

interface ParentLearningAssistantProps {
    children: ParentChildSnapshot[];
}

type MessageRole = 'user' | 'assistant';

const PARENT_ASSISTANT_PALETTE = {
    background: '#F0FDF4',
    accent: '#059669',
    text: '#1F2937',
};

/**
 * Build a comprehensive context string from child data for AI prompts
 */
const buildChildContext = (children: ParentChildSnapshot[]): string => {
    if (!children.length) return 'No children linked yet.';

    const childSummaries = children.map((child) => {
        const subjects = child.masteryBySubject
            ?.map((s) => `${formatSubjectLabel(s.subject)}: ${s.mastery}% mastery`)
            .join(', ') || 'No subject data yet';

        const gaps = child.skillGaps
            ?.filter((g) => g.status === 'needs_attention')
            .map((g) => `${formatSubjectLabel(g.subject)}: ${g.summary}`)
            .join('; ') || 'No major skill gaps identified';

        const focusAreas = child.focusAreas?.length
            ? child.focusAreas.join(', ')
            : 'No specific focus areas';

        const recentActivity = child.recentActivity?.slice(0, 3)
            .map((a) => a.description)
            .join('; ') || 'No recent activity';

        return `
Child: ${child.name} (Grade ${child.grade}, Level ${child.level})
- XP: ${child.xp} | Streak: ${child.streakDays} days
- This Week: ${child.lessonsCompletedWeek} lessons, ${child.practiceMinutesWeek} minutes
- Subject Performance: ${subjects}
- Skill Gaps: ${gaps}
- Focus Areas: ${focusAreas}
- Recent Activity: ${recentActivity}
- Goal Progress: ${child.goalProgress ?? 0}%
        `.trim();
    });

    return childSummaries.join('\n\n');
};

/**
 * Generate parent-focused guided prompts based on child data
 */
const generateGuidedCards = (children: ParentChildSnapshot[]) => {
    const base = [
        { id: 'overview', label: 'How is my child doing?', prompt: 'Give me a brief overview of how my child is doing in their learning.' },
        { id: 'strengths', label: 'What are their strengths?', prompt: 'What subjects or skills is my child excelling in?' },
        { id: 'support', label: 'How can I help?', prompt: 'What can I do at home to support my child\'s learning this week?' },
        { id: 'concerns', label: 'Any concerns?', prompt: 'Are there any areas where my child might be struggling that I should know about?' },
    ];

    const contextual: { id: string; label: string; prompt: string }[] = [];

    // Add child-specific cards for multi-child families
    if (children.length > 1) {
        children.forEach((child) => {
            contextual.push({
                id: `child-${child.id}`,
                label: `About ${child.name}`,
                prompt: `Tell me specifically about ${child.name}'s progress and what I can do to help them.`,
            });
        });
    }

    // Add skill gap specific cards if any child has gaps
    const childWithGaps = children.find((c) => c.skillGaps?.some((g) => g.status === 'needs_attention'));
    if (childWithGaps) {
        const gapSubject = childWithGaps.skillGaps?.find((g) => g.status === 'needs_attention');
        if (gapSubject) {
            contextual.push({
                id: 'skill-gap',
                label: `Help with ${formatSubjectLabel(gapSubject.subject)}`,
                prompt: `My child seems to be struggling with ${formatSubjectLabel(gapSubject.subject)}. Can you explain what's happening and how I can help?`,
            });
        }
    }

    // Add streak-related card if child has good streak
    const streakChild = children.find((c) => c.streakDays >= 7);
    if (streakChild) {
        contextual.push({
            id: 'streak-celebrate',
            label: 'Celebrate their streak!',
            prompt: `${streakChild.name} has a ${streakChild.streakDays}-day streak! How can I celebrate and encourage them to keep going?`,
        });
    }

    return [...contextual, ...base].slice(0, 8);
};

/**
 * Quick action buttons for common parent questions
 */
const QUICK_ACTIONS = [
    { icon: TrendingUp, text: 'Progress overview', action: 'progress' },
    { icon: Home, text: 'Home activities', action: 'home-activities' },
    { icon: MessageCircle, text: 'Conversation starters', action: 'conversation' },
];

const ParentLearningAssistant: React.FC<ParentLearningAssistantProps> = ({ children }) => {
    const { user } = useAuth();
    const parent = user as Parent;

    const [isOpen, setIsOpen] = useState(false);
    const [selectedChild, setSelectedChild] = useState<ParentChildSnapshot | null>(
        children.length === 1 ? children[0] : null
    );
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputMessage, setInputMessage] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [assistantError, setAssistantError] = useState<string | null>(null);
    const [showChildSelector, setShowChildSelector] = useState(false);

    const assistantWindowRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Build intro message
    const buildIntroMessage = useCallback(() => {
        const childNames = children.map((c) => c.name).join(' and ');
        const childCount = children.length;

        if (childCount === 0) {
            return "Hi! I'm your ElevatED parent assistant. Once you've linked a learner to your account, I can help you understand their progress and provide tips for supporting their learning at home.";
        }

        if (childCount === 1) {
            const child = children[0];
            const status = child.goalProgress && child.goalProgress >= 80
                ? 'doing great'
                : child.skillGaps?.some((g) => g.status === 'needs_attention')
                    ? 'making progress with some areas to focus on'
                    : 'making steady progress';

            return `Hi! I'm your ElevatED parent assistant. I can help you understand ${child.name}'s learning journey. Currently, ${child.name} is ${status}. What would you like to know?`;
        }

        return `Hi! I'm your ElevatED parent assistant. I can help you understand how ${childNames} are doing with their learning. Select a child to focus on, or ask me about any of them. What would you like to know?`;
    }, [children]);

    // Initialize messages when opened
    useEffect(() => {
        if (isOpen && messages.length === 0) {
            setMessages([
                {
                    id: '1',
                    content: buildIntroMessage(),
                    isUser: false,
                    timestamp: new Date(),
                    role: 'assistant' as MessageRole,
                },
            ]);
        }
    }, [isOpen, buildIntroMessage, messages.length]);

    // Generate guided cards based on children's data
    const guidedCards = useMemo(() => generateGuidedCards(children), [children]);

    // Build context for AI
    const childContext = useMemo(() => {
        if (selectedChild) {
            return buildChildContext([selectedChild]);
        }
        return buildChildContext(children);
    }, [children, selectedChild]);

    /**
     * Handle sending a message
     */
    const handleSendMessage = async (customMessage?: string) => {
        const messageToSend = (customMessage ?? inputMessage).trim();
        if (!messageToSend.trim()) return;

        const userMessage: ChatMessage = {
            id: Date.now().toString(),
            content: messageToSend,
            isUser: true,
            timestamp: new Date(),
            role: 'user' as MessageRole,
        };

        setMessages((prev) => [...prev, userMessage]);
        setInputMessage('');
        setIsTyping(true);
        setAssistantError(null);

        trackEvent('parent_assistant_message_sent', {
            parentId: parent?.id,
            length: messageToSend.length,
            hasSelectedChild: Boolean(selectedChild),
            childCount: children.length,
        });

        try {
            // Build conversation context
            const conversationHistory = [...messages, userMessage]
                .slice(-6)
                .map((m) => `${m.isUser ? 'Parent' : 'Assistant'}: ${m.content}`)
                .join('\n');

            const promptForModel = `${conversationHistory}\nAssistant:`.slice(-1500);

            // Parent-focused system prompt
            const systemPrompt = `You are ElevatED's Parent Learning Assistant. Your role is to help parents understand their children's educational progress and provide actionable support recommendations.

CHILD DATA:
${childContext}

GUIDELINES:
1. Be warm, supportive, and non-judgmental
2. Celebrate successes and frame challenges as opportunities
3. Give specific, actionable recommendations parents can do at home
4. Explain educational concepts in parent-friendly terms
5. Keep responses concise (2-4 paragraphs max)
6. When discussing struggles, focus on solutions rather than problems
7. Suggest age-appropriate conversation starters when relevant
8. Never blame the child or parent for challenges
9. If asked about curriculum or teaching methods, defer to the child's teachers
10. Encourage consistent routines and positive reinforcement

RESPONSE FORMAT:
- Start with a brief acknowledgment
- Provide the key information or insight
- End with 1-2 actionable suggestions when appropriate
- Use emojis sparingly to maintain warmth (1-2 per response max)`;

            const response = await getTutorResponse(promptForModel, {
                mode: 'learning',
                systemPrompt,
                knowledge: `Parent: ${parent?.name ?? 'Parent'}. Viewing: ${selectedChild?.name ?? 'All children'}`,
            });

            const aiResponse: ChatMessage = {
                id: (Date.now() + 1).toString(),
                content: response.message,
                isUser: false,
                timestamp: new Date(),
                role: 'assistant' as MessageRole,
            };

            setMessages((prev) => [...prev, aiResponse]);

            trackEvent('parent_assistant_message_received', {
                parentId: parent?.id,
                source: 'openrouter',
            });
        } catch (err) {
            console.error('[ParentLearningAssistant] AI response failed', err);
            const errorMessage = err instanceof Error ? err.message : 'The assistant is unavailable right now.';
            setAssistantError(errorMessage);

            // Provide a fallback response
            const fallbackResponse: ChatMessage = {
                id: (Date.now() + 2).toString(),
                content: getFallbackResponse(messageToSend, children, selectedChild),
                isUser: false,
                timestamp: new Date(),
                role: 'assistant' as MessageRole,
            };

            setMessages((prev) => [...prev, fallbackResponse]);
        } finally {
            setIsTyping(false);
        }
    };

    /**
     * Handle quick action buttons
     */
    const handleQuickAction = (action: string) => {
        let message = '';
        switch (action) {
            case 'progress':
                message = selectedChild
                    ? `Give me an overview of ${selectedChild.name}'s progress this week.`
                    : 'Give me an overview of my children\'s progress this week.';
                break;
            case 'home-activities':
                message = 'What are some activities I can do at home to support their learning?';
                break;
            case 'conversation':
                message = 'Give me some conversation starters to discuss learning with my child.';
                break;
        }
        if (message) {
            void handleSendMessage(message);
        }
    };

    // Focus trap and keyboard handling
    useEffect(() => {
        if (!isOpen) return;

        const previouslyFocused = document.activeElement as HTMLElement | null;
        inputRef.current?.focus();

        const handleKeydown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                setIsOpen(false);
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
            {/* Floating Button */}
            <motion.button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-6 right-6 w-14 h-14 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center z-50 focus-ring"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                animate={{
                    boxShadow: isOpen
                        ? '0 0 0 4px rgba(5, 150, 105, 0.3)'
                        : '0 10px 25px rgba(0, 0, 0, 0.2)',
                }}
                aria-label="Open parent assistant"
                aria-expanded={isOpen}
                style={{
                    background: `linear-gradient(135deg, ${PARENT_ASSISTANT_PALETTE.accent}, #10B981)`,
                }}
            >
                <HelpCircle className="h-6 w-6" />
            </motion.button>

            {/* Assistant Window */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.8, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.8, y: 20 }}
                        className="fixed bottom-24 right-6 left-6 sm:left-auto sm:w-96 md:w-[28rem] h-[32rem] md:h-[36rem] bg-white rounded-2xl shadow-2xl z-[60] flex flex-col overflow-hidden"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="parent-assistant-title"
                        ref={assistantWindowRef}
                    >
                        {/* Header */}
                        <div
                            className="p-3 flex items-center justify-between"
                            style={{
                                background: `linear-gradient(135deg, ${PARENT_ASSISTANT_PALETTE.accent}, #10B981)`,
                                color: 'white',
                            }}
                        >
                            <div className="flex items-center gap-2">
                                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center border border-white/30">
                                    <Users className="h-5 w-5" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-sm" id="parent-assistant-title">
                                        Parent Assistant
                                    </h3>
                                    <p className="text-xs opacity-80">
                                        Understanding your child's journey
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setIsOpen(false)}
                                    className="p-2 bg-white/30 hover:bg-red-500 hover:text-white rounded-full transition-colors focus-ring"
                                    aria-label="Close parent assistant"
                                    title="Close"
                                >
                                    <X className="h-5 w-5" />
                                </button>
                            </div>
                        </div>

                        {/* Child Selector (for multi-child families) */}
                        {children.length > 1 && (
                            <div className="px-3 py-2 bg-emerald-50 border-b border-emerald-100">
                                <button
                                    type="button"
                                    onClick={() => setShowChildSelector(!showChildSelector)}
                                    className="w-full flex items-center justify-between text-sm text-emerald-800"
                                >
                                    <span className="font-medium">
                                        {selectedChild ? `Focusing on ${selectedChild.name}` : 'All children'}
                                    </span>
                                    <ChevronDown className={`h-4 w-4 transition-transform ${showChildSelector ? 'rotate-180' : ''}`} />
                                </button>

                                <AnimatePresence>
                                    {showChildSelector && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            className="mt-2 space-y-1 overflow-hidden"
                                        >
                                            <button
                                                onClick={() => {
                                                    setSelectedChild(null);
                                                    setShowChildSelector(false);
                                                }}
                                                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${!selectedChild
                                                    ? 'bg-emerald-200 text-emerald-900'
                                                    : 'bg-white text-gray-700 hover:bg-emerald-100'
                                                    }`}
                                            >
                                                All children
                                            </button>
                                            {children.map((child) => (
                                                <button
                                                    key={child.id}
                                                    onClick={() => {
                                                        setSelectedChild(child);
                                                        setShowChildSelector(false);
                                                    }}
                                                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${selectedChild?.id === child.id
                                                        ? 'bg-emerald-200 text-emerald-900'
                                                        : 'bg-white text-gray-700 hover:bg-emerald-100'
                                                        }`}
                                                >
                                                    {child.name} (Grade {child.grade})
                                                </button>
                                            ))}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        )}

                        {/* Quick Actions */}
                        <div className="p-3 border-b border-gray-200">
                            <div className="flex flex-wrap gap-2">
                                {QUICK_ACTIONS.map((action, index) => (
                                    <button
                                        key={index}
                                        onClick={() => handleQuickAction(action.action)}
                                        className="min-h-[44px] flex items-center space-x-1 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 rounded-lg text-xs transition-colors focus-ring text-emerald-800"
                                        aria-label={action.text}
                                    >
                                        <action.icon className="h-3 w-3" />
                                        <span>{action.text}</span>
                                    </button>
                                ))}
                            </div>

                            {/* Guided Cards */}
                            <div className="mt-3 grid grid-cols-2 gap-2">
                                {guidedCards.slice(0, 4).map((card) => (
                                    <button
                                        key={card.id}
                                        onClick={() => void handleSendMessage(card.prompt)}
                                        className="min-h-[44px] rounded-lg border border-gray-200 bg-gray-50 hover:border-emerald-400 text-left p-2 text-xs font-medium text-gray-700 transition focus-ring"
                                    >
                                        {card.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Messages */}
                        <div className="flex-1 p-4 overflow-y-auto space-y-4" role="log" aria-live="polite">
                            {messages.map((message) => (
                                <motion.div
                                    key={message.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}
                                >
                                    <div
                                        className={`max-w-[80%] p-3 rounded-2xl ${message.isUser
                                            ? 'bg-emerald-600 text-white'
                                            : 'bg-gray-100 text-gray-800'
                                            }`}
                                    >
                                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
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
                            <form
                                onSubmit={(e) => {
                                    e.preventDefault();
                                    void handleSendMessage();
                                }}
                                className="flex items-center gap-2"
                            >
                                <input
                                    ref={inputRef}
                                    type="text"
                                    value={inputMessage}
                                    onChange={(e) => setInputMessage(e.target.value)}
                                    placeholder="Ask about your child's progress..."
                                    className="flex-1 px-4 py-3 rounded-full border border-gray-200 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 text-sm outline-none transition-all"
                                    disabled={isTyping}
                                />
                                <button
                                    type="submit"
                                    disabled={!inputMessage.trim() || isTyping}
                                    className="w-12 h-12 rounded-full bg-emerald-600 text-white flex items-center justify-center hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus-ring"
                                    aria-label="Send message"
                                >
                                    <Send className="h-5 w-5" />
                                </button>
                            </form>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
};

/**
 * Fallback response when AI is unavailable
 */
function getFallbackResponse(
    message: string,
    children: ParentChildSnapshot[],
    selectedChild: ParentChildSnapshot | null
): string {
    const child = selectedChild ?? children[0];
    if (!child) {
        return "I can help you understand your child's learning once they've completed some activities. For now, you can explore the course catalog together!";
    }

    const lower = message.toLowerCase();

    if (lower.includes('progress') || lower.includes('doing')) {
        return `${child.name} has completed ${child.lessonsCompletedWeek} lessons this week and practiced for ${child.practiceMinutesWeek} minutes. Their current streak is ${child.streakDays} days! 🎯 Keep encouraging consistent daily practice.`;
    }

    if (lower.includes('help') || lower.includes('support')) {
        const weakSubject = child.masteryBySubject?.find((s) => s.mastery < 60);
        if (weakSubject) {
            return `You can support ${child.name}'s learning by spending 10-15 minutes discussing ${formatSubjectLabel(weakSubject.subject)} concepts. Ask open-ended questions like "What did you learn today?" and celebrate their effort, not just results.`;
        }
        return `Great ways to support ${child.name}: 1) Set a consistent learning time, 2) Celebrate their streak days, 3) Ask about what they're learning, 4) Make connections to real-world examples.`;
    }

    if (lower.includes('strength') || lower.includes('good at')) {
        const strongest = child.masteryBySubject?.reduce((a, b) => (a.mastery > b.mastery ? a : b));
        if (strongest) {
            return `${child.name} is showing strong performance in ${formatSubjectLabel(strongest.subject)} with ${strongest.mastery}% mastery! You can leverage this strength by connecting it to other subjects.`;
        }
    }

    if (lower.includes('concern') || lower.includes('struggle') || lower.includes('worry')) {
        const gaps = child.skillGaps?.filter((g) => g.status === 'needs_attention');
        if (gaps?.length) {
            return `I notice ${child.name} may benefit from extra support in ${formatSubjectLabel(gaps[0].subject)}. This is completely normal! Try breaking practice into smaller sessions and celebrate small wins.`;
        }
        return `${child.name} is making steady progress. Every learner has different paces - consistency matters more than speed. Keep encouraging them! 💪`;
    }

    return `${child.name} is at Level ${child.level} with ${child.xp} XP total. They've been learning regularly with a ${child.streakDays}-day streak. Ask me specific questions about their subjects, strengths, or how you can help at home!`;
}

export default ParentLearningAssistant;

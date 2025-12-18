/**
 * LessonCard Component
 * 
 * Styled card container for lesson phase content.
 */

import React from 'react';
import { motion } from 'framer-motion';

interface LessonCardProps {
    children: React.ReactNode;
    className?: string;
    animate?: boolean;
}

export const LessonCard: React.FC<LessonCardProps> = ({
    children,
    className = '',
    animate = true,
}) => {
    const Wrapper = animate ? motion.div : 'div';
    const animationProps = animate
        ? {
            initial: { opacity: 0, y: 20 },
            animate: { opacity: 1, y: 0 },
            exit: { opacity: 0, y: -20 },
            transition: { duration: 0.3, ease: 'easeOut' },
        }
        : {};

    return (
        <Wrapper
            {...animationProps}
            className={`
        bg-white rounded-2xl border border-slate-200 shadow-sm
        ${className}
      `}
        >
            {children}
        </Wrapper>
    );
};

/** Card with padding applied */
export const LessonCardPadded: React.FC<LessonCardProps> = ({
    children,
    className = '',
    animate = true,
}) => {
    return (
        <LessonCard animate={animate} className={`p-6 md:p-8 ${className}`}>
            {children}
        </LessonCard>
    );
};

/** Card header section */
export const LessonCardHeader: React.FC<{
    children: React.ReactNode;
    className?: string;
}> = ({ children, className = '' }) => {
    return (
        <div className={`border-b border-slate-100 px-6 py-4 md:px-8 md:py-5 ${className}`}>
            {children}
        </div>
    );
};

/** Card body section */
export const LessonCardBody: React.FC<{
    children: React.ReactNode;
    className?: string;
}> = ({ children, className = '' }) => {
    return <div className={`p-6 md:p-8 ${className}`}>{children}</div>;
};

/** Card footer section */
export const LessonCardFooter: React.FC<{
    children: React.ReactNode;
    className?: string;
}> = ({ children, className = '' }) => {
    return (
        <div className={`border-t border-slate-100 px-6 py-4 md:px-8 md:py-5 ${className}`}>
            {children}
        </div>
    );
};

export default LessonCard;

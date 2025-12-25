/**
 * Confetti - Lightweight confetti animation for celebrations
 *
 * Uses canvas for performance. Renders a burst of confetti particles
 * that fall with physics-based animation.
 */
import React, { useEffect, useRef, useCallback } from 'react';

interface ConfettiProps {
    /** Number of confetti pieces */
    count?: number;
    /** Duration in milliseconds */
    duration?: number;
    /** Colors to use */
    colors?: string[];
}

interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    rotation: number;
    rotationSpeed: number;
    width: number;
    height: number;
    color: string;
    opacity: number;
}

const DEFAULT_COLORS = [
    '#6366f1', // indigo
    '#8b5cf6', // purple
    '#ec4899', // pink
    '#f59e0b', // amber
    '#10b981', // emerald
    '#3b82f6', // blue
    '#f97316', // orange
];

const Confetti: React.FC<ConfettiProps> = ({
    count = 100,
    duration = 3000,
    colors = DEFAULT_COLORS,
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationRef = useRef<number | null>(null);
    const particlesRef = useRef<Particle[]>([]);
    const startTimeRef = useRef<number>(0);

    const createParticle = useCallback(
        (width: number, height: number): Particle => {
            // Start from center-top of viewport with spread
            const startX = width / 2 + (Math.random() - 0.5) * width * 0.5;
            const startY = height * 0.1;

            return {
                x: startX,
                y: startY,
                vx: (Math.random() - 0.5) * 15,
                vy: Math.random() * -10 + 5,
                rotation: Math.random() * 360,
                rotationSpeed: (Math.random() - 0.5) * 10,
                width: Math.random() * 10 + 5,
                height: Math.random() * 6 + 3,
                color: colors[Math.floor(Math.random() * colors.length)],
                opacity: 1,
            };
        },
        [colors]
    );

    const animate = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const width = canvas.width;
        const height = canvas.height;
        const elapsed = Date.now() - startTimeRef.current;
        const progress = Math.min(elapsed / duration, 1);

        // Clear canvas
        ctx.clearRect(0, 0, width, height);

        // Update and draw particles
        particlesRef.current.forEach((p) => {
            // Physics
            p.vy += 0.2; // gravity
            p.vx *= 0.99; // air resistance
            p.x += p.vx;
            p.y += p.vy;
            p.rotation += p.rotationSpeed;

            // Fade out in last 30%
            if (progress > 0.7) {
                p.opacity = 1 - (progress - 0.7) / 0.3;
            }

            // Draw
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate((p.rotation * Math.PI) / 180);
            ctx.globalAlpha = p.opacity;
            ctx.fillStyle = p.color;
            ctx.fillRect(-p.width / 2, -p.height / 2, p.width, p.height);
            ctx.restore();
        });

        // Continue animation
        if (progress < 1) {
            animationRef.current = requestAnimationFrame(animate);
        }
    }, [duration]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        // Set canvas size
        const handleResize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        };

        handleResize();
        window.addEventListener('resize', handleResize);

        // Create particles
        particlesRef.current = Array.from({ length: count }, () =>
            createParticle(canvas.width, canvas.height)
        );

        // Start animation
        startTimeRef.current = Date.now();
        animationRef.current = requestAnimationFrame(animate);

        return () => {
            window.removeEventListener('resize', handleResize);
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
        };
    }, [count, animate, createParticle]);

    return (
        <canvas
            ref={canvasRef}
            className="fixed inset-0 pointer-events-none z-[100]"
            aria-hidden="true"
        />
    );
};

export default Confetti;

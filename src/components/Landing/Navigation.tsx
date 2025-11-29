import React, { useEffect, useState } from 'react';
import { Menu, X } from 'lucide-react';
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from 'framer-motion';

interface NavigationProps {
  onGetStarted: () => void;
}

const Navigation: React.FC<NavigationProps> = ({ onGetStarted }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isCondensed, setIsCondensed] = useState(false);
  const rawProgress = useMotionValue(0);
  const smoothProgress = useSpring(rawProgress, {
    stiffness: 220,
    damping: 32,
    mass: 0.9,
  });

  useEffect(() => {
    let frame = 0;

    const updateProgress = () => {
      frame = 0;
      const scrollY = window.scrollY;
      const targetProgress = Math.min(scrollY / 220, 1);
      rawProgress.set(targetProgress);
      setIsCondensed(targetProgress > 0.15);
    };

    const handleScroll = () => {
      if (frame === 0) {
        frame = window.requestAnimationFrame(updateProgress);
      }
    };

    updateProgress();
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (frame) {
        window.cancelAnimationFrame(frame);
      }
    };
  }, [rawProgress]);

  const containerPaddingTop = useTransform(smoothProgress, [0, 1], [28, 14]);
  const containerPaddingBottom = useTransform(smoothProgress, [0, 1], [28, 14]);
  const containerPaddingLeft = useTransform(smoothProgress, [0, 1], [36, 26]);
  const containerPaddingRight = useTransform(smoothProgress, [0, 1], [36, 24]);
  const containerGap = useTransform(smoothProgress, [0, 1], [32, 20]);
  const containerBorderColor = useTransform(
    smoothProgress,
    [0, 1],
    ['rgba(255,255,255,0.5)', 'rgba(255,255,255,0.7)']
  );
  const containerShadow = useTransform(
    smoothProgress,
    [0, 1],
    ['0px 22px 48px rgba(137,23,237,0.18)', '0px 10px 24px rgba(10,30,60,0.12)']
  );

  const headingPaddingLeft = useTransform(smoothProgress, [0, 1], [180, 96]);
  const headingPaddingTop = useTransform(smoothProgress, [0, 1], [34, 18]);
  const headingPaddingBottom = useTransform(smoothProgress, [0, 1], [28, 20]);
  const logoScale = useTransform(smoothProgress, [0, 1], [1, 0.64]);
  const logoLeft = useTransform(smoothProgress, [0, 1], [-120, -80]);
  const logoTop = useTransform(smoothProgress, [0, 1], ['50%', '48%']);
  const logoOuterRadius = useTransform(smoothProgress, [0, 1], [88, 52]);
  const logoInnerSize = useTransform(smoothProgress, [0, 1], [228, 140]);
  const logoInnerRadius = useTransform(smoothProgress, [0, 1], [68, 44]);
  const logoHaloRadius = useTransform(smoothProgress, [0, 1], [92, 52]);
  const logoShadow = useTransform(
    smoothProgress,
    [0, 1],
    ['0px 32px 54px rgba(137,23,237,0.24)', '0px 18px 32px rgba(137,23,237,0.18)']
  );
  const logoBorderRadius = useTransform(smoothProgress, [0, 1], [48, 32]);
  const logoPadding = useTransform(smoothProgress, [0, 1], [0, 0]);
  const logoImageScale = useTransform(smoothProgress, [0, 1], [1.88, 2.02]);

  const navItems = [
    { name: 'Features', href: '#features' },
    { name: 'How It Works', href: '#how-it-works' },
    { name: 'Pricing', href: '#pricing' },
    { name: 'FAQ', href: '#faq' },
  ];
  const legalLinks = [
    { name: 'Privacy', href: '/legal/privacy' },
    { name: 'Terms', href: '/legal/terms' },
  ];

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  const scrollToSection = (href: string) => {
    const element = document.querySelector(href);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
    setIsMenuOpen(false);
  };

  return (
    <nav className="sticky top-0 z-50 px-4 sm:px-6 lg:px-8">
      <motion.div
        initial={{ opacity: 0, y: -24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className={`mx-auto max-w-7xl ${isCondensed ? 'pt-4' : 'pt-8'}`}
      >
        <div className="relative">
          <div className="absolute inset-0 -z-10 rounded-3xl bg-gradient-to-r from-brand-secondary/25 via-brand-primary/20 to-brand-accent/25 blur-lg" />
          <motion.div
            className="flex items-center justify-between rounded-[28px] border bg-white/85 backdrop-blur-lg overflow-visible"
            style={{
              paddingTop: containerPaddingTop,
              paddingBottom: containerPaddingBottom,
              paddingLeft: containerPaddingLeft,
              paddingRight: containerPaddingRight,
              gap: containerGap,
              borderColor: containerBorderColor,
              boxShadow: containerShadow,
            }}
          >
            <motion.a
              href="#"
              onClick={(event) => {
                event.preventDefault();
                scrollToTop();
              }}
              className="relative flex flex-col justify-center text-left pr-10 focus-ring rounded-xl"
              whileHover={{ y: -2 }}
              style={{
                paddingLeft: headingPaddingLeft,
                paddingTop: headingPaddingTop,
                paddingBottom: headingPaddingBottom,
              }}
            >
              <motion.div
                className="pointer-events-none absolute z-20 flex items-center justify-center bg-white"
              style={{
                  width: 240,
                  height: 240,
                  left: logoLeft,
                  top: logoTop,
                  translateY: '-50%',
                  scale: logoScale,
                  borderRadius: logoOuterRadius,
                  boxShadow: logoShadow,
                }}
              >
                <motion.span
                  className="absolute inset-0 bg-gradient-to-br from-brand-secondary/50 via-white/35 to-brand-accent/45 blur-xl opacity-80"
                  style={{ borderRadius: logoHaloRadius }}
                />
                <motion.div
                  className="relative z-10 flex items-center justify-center overflow-hidden bg-white shadow-sm"
                  style={{
                    width: logoInnerSize,
                    height: logoInnerSize,
                    borderRadius: logoInnerRadius,
                    padding: logoPadding,
                  }}
                >
                  <motion.img
                    src="/elevated-logo.png"
                    alt="ElevatED"
                    className="h-full w-full object-contain"
                    style={{ scale: logoImageScale, transformOrigin: '50% 50%' }}
                  />
                </motion.div>
                <motion.div className="absolute inset-0 border border-brand-primary/25" style={{ borderRadius: logoBorderRadius }} />
              </motion.div>
              <div className="leading-tight">
                <span className={`font-semibold uppercase tracking-[0.4em] text-brand-secondary/70 transition-all duration-500 ${isCondensed ? 'text-[0.68rem]' : 'text-sm'}`}>
                  ElevatED
                </span>
                <div className={`font-semibold text-brand-dark transition-all duration-500 ${isCondensed ? 'text-xl leading-tight' : 'text-3xl leading-snug'}`}>
                  Home Learning. Elevated Together.
                </div>
                <p className={`text-brand-dark/60 transition-all duration-500 ${isCondensed ? 'text-sm' : 'text-base'}`}>Adaptive AI tutoring with family-ready insights</p>
              </div>
            </motion.a>

            <div className="hidden md:flex items-center gap-6">
              {navItems.map((item, index) => (
                <motion.button
                  key={item.name}
                  onClick={() => scrollToSection(item.href)}
                  className="group relative text-sm font-medium text-brand-dark/85 transition-colors duration-300 hover:text-brand-dark focus-ring rounded-lg px-2 py-1"
                  initial={{ opacity: 0, y: -12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: index * 0.08 + 0.1 }}
                >
                  <span>{item.name}</span>
                  <span className="absolute -bottom-2 left-0 block h-0.5 w-0 rounded-full bg-gradient-to-r from-brand-secondary via-brand-primary to-brand-accent transition-all duration-300 group-hover:w-full" />
                </motion.button>
              ))}
              {legalLinks.map((link) => (
                <motion.a
                  key={link.name}
                  href={link.href}
                  className="text-sm font-medium text-brand-dark/80 hover:text-brand-blue transition-colors focus-ring rounded-lg px-2 py-1"
                  initial={{ opacity: 0, y: -12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.5 }}
                >
                  {link.name}
                </motion.a>
              ))}
            </div>

            <motion.div
              className="hidden shrink-0 md:flex items-center gap-3"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, delay: 0.25 }}
            >
              <button
                onClick={onGetStarted}
                className="group relative overflow-hidden rounded-2xl px-6 py-3 text-sm font-semibold text-white focus-ring"
              >
                <span className="absolute inset-0 bg-gradient-to-r from-brand-secondary via-brand-primary to-brand-accent transition-transform duration-500 group-hover:scale-110" />
                <span className="absolute inset-0 -z-10 blur-xl bg-gradient-to-r from-brand-secondary/50 via-brand-primary/45 to-brand-accent/50 opacity-80" />
                <span className="relative flex items-center gap-2">
                  Get Started Free
                  <motion.span
                    initial={{ x: 0 }}
                    animate={{ x: [0, 4, 0] }}
                    transition={{ repeat: Infinity, duration: 2 }}
                    className="inline-block h-1.5 w-1.5 rounded-full bg-white/80"
                  />
                </span>
              </button>
            </motion.div>

            <div className="md:hidden">
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/50 bg-white/70 text-brand-dark transition-all hover:border-brand-primary/40 hover:text-brand-primary focus-ring"
                aria-expanded={isMenuOpen}
                aria-controls="mobile-nav"
                aria-label={isMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              >
                {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
            </div>
          </motion.div>
        </div>
      </motion.div>

      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden"
          >
            <div className="mx-auto mt-4 max-w-7xl rounded-3xl border border-white/50 bg-white/90 px-6 py-6 shadow-xl backdrop-blur-xl" id="mobile-nav">
              {navItems.map((item) => (
                <button
                  key={item.name}
                  onClick={() => scrollToSection(item.href)}
                  className="block w-full rounded-2xl px-4 py-3 text-left text-sm font-semibold text-brand-dark/85 transition-colors hover:bg-brand-soft/80 hover:text-brand-dark focus-ring"
                >
                  {item.name}
                </button>
              ))}
              <button
                onClick={onGetStarted}
                className="mt-4 w-full rounded-2xl bg-gradient-to-r from-brand-secondary via-brand-primary to-brand-accent px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-primary/40 transition-transform hover:-translate-y-0.5 hover:shadow-brand-primary/60 focus-ring"
              >
                Get Started Free
              </button>
              <div className="mt-4 flex flex-wrap gap-4">
                {legalLinks.map((link) => (
                  <a
                    key={link.name}
                    href={link.href}
                    className="text-sm font-semibold text-brand-blue hover:text-brand-teal focus-ring rounded-lg px-1 py-0.5"
                  >
                    {link.name}
                  </a>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

export default Navigation;

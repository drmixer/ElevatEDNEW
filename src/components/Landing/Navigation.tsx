import React, { useState, useEffect } from 'react';
import { Menu, X } from 'lucide-react';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';

interface NavigationProps {
  onGetStarted: () => void;
}

const Navigation: React.FC<NavigationProps> = ({ onGetStarted }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const { scrollY } = useScroll();

  const logoHeight = useTransform(scrollY, [0, 50], ["6rem", "3rem"]); // h-24 to h-12
  const navPadding = useTransform(scrollY, [0, 50], ["1.5rem", "1rem"]); // py-6 to py-4

  useEffect(() => {
    const updateScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', updateScroll);
    return () => window.removeEventListener('scroll', updateScroll);
  }, []);

  const navItems = [
    { name: 'Features', href: '#features' },
    { name: 'How It Works', href: '#how-it-works' },
    { name: 'Pricing', href: '#pricing' },
    { name: 'FAQ', href: '#faq' },
  ];

  const scrollToSection = (href: string) => {
    const element = document.querySelector(href);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
    setIsMenuOpen(false);
  };

  return (
    <motion.nav
      style={{ paddingTop: navPadding, paddingBottom: navPadding }}
      className={`fixed top-0 left-0 right-0 z-50 transition-colors duration-300 ${isScrolled ? 'bg-white/90 backdrop-blur-md shadow-sm' : 'bg-transparent'
        }`}
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <div
            className="flex-shrink-0 flex items-center cursor-pointer"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          >
            <motion.img
              src="/elevated-logo.png"
              alt="ElevatED"
              style={{ height: logoHeight }}
              className="w-auto object-contain transition-all duration-300 drop-shadow-sm hover:drop-shadow-md"
            />
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-1">
            {navItems.map((item) => (
              <button
                key={item.name}
                onClick={() => scrollToSection(item.href)}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-brand-primary hover:bg-brand-soft/50 rounded-lg transition-all"
              >
                {item.name}
              </button>
            ))}
          </div>

          {/* CTA Button */}
          <div className="hidden md:flex items-center space-x-4">
            <button
              onClick={() => window.location.href = '/login'}
              className="text-sm font-medium text-gray-600 hover:text-brand-primary transition-colors px-4 py-2"
            >
              Log in
            </button>
            <button
              onClick={onGetStarted}
              className="px-6 py-2.5 rounded-full bg-brand-primary text-white text-sm font-semibold shadow-lg shadow-brand-primary/25 hover:bg-brand-secondary hover:shadow-brand-primary/40 transition-all transform hover:-translate-y-0.5 active:scale-95"
            >
              Get Started
            </button>
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
            >
              {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-white border-t border-gray-100 shadow-xl overflow-hidden"
          >
            <div className="px-4 pt-2 pb-6 space-y-2">
              {navItems.map((item) => (
                <button
                  key={item.name}
                  onClick={() => scrollToSection(item.href)}
                  className="block w-full text-left px-4 py-3 text-base font-medium text-gray-600 hover:bg-gray-50 hover:text-brand-primary rounded-lg transition-colors"
                >
                  {item.name}
                </button>
              ))}
              <div className="pt-4 mt-4 border-t border-gray-100 px-4">
                <button
                  onClick={() => window.location.href = '/login'}
                  className="block w-full text-center py-3 text-base font-medium text-gray-600 hover:text-brand-primary mb-2"
                >
                  Log in
                </button>
                <button
                  onClick={onGetStarted}
                  className="w-full py-3 rounded-xl bg-brand-primary text-white font-semibold shadow-lg shadow-brand-primary/25 active:scale-95 transition-all"
                >
                  Get Started
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
};

export default Navigation;

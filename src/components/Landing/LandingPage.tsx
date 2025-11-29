import React from 'react';
import Navigation from './Navigation';
import Hero from './Hero';
import Features from './Features';
import DashboardPreview from './DashboardPreview';
import LessonPreview from './LessonPreview';
import AboutFamilies from './AboutFamilies';
import HowItWorks from './HowItWorks';
import Pricing from './Pricing';
import FAQ from './FAQ';
import Footer from './Footer';
import ChatBot from './ChatBot';

interface LandingPageProps {
  onGetStarted: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onGetStarted }) => {
  return (
    <div className="font-inter">
      <Navigation onGetStarted={onGetStarted} />
      <Hero onGetStarted={onGetStarted} />
      <Features />
      <DashboardPreview />
      <LessonPreview />
      <AboutFamilies />
      <HowItWorks />
      <Pricing onGetStarted={onGetStarted} />
      <FAQ />
      <Footer />
      <ChatBot />
    </div>
  );
};

export default LandingPage;

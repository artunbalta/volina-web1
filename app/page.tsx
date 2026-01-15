'use client';

import { useState, useCallback } from 'react';
import { InteractiveRobotSpline } from '@/components/ui/interactive-3d-robot';
import { Spotlight } from '@/components/ui/spotlight';
import { Header } from '@/components/landing/Header';
import { FeaturesSection } from '@/components/landing/FeaturesSection';
import { TeamSection } from '@/components/landing/TeamSection';
import { PricingSection } from '@/components/landing/PricingSection';
import { Footer } from '@/components/landing/Footer';
import { startVoiceCall, stopVoiceCall, cleanupVapiListeners, isVapiDemoMode } from '@/lib/vapi';
import { Phone, Mic } from 'lucide-react';

// Robot scene URL - dark background version
const ROBOT_SCENE_URL = "https://prod.spline.design/PyzDhpQ9E5f1E3MT/scene.splinecode";

export default function Home() {
  const [isTalking, setIsTalking] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  const handleStartVapi = useCallback(async () => {
    if (isTalking) {
      stopVoiceCall();
      cleanupVapiListeners();
      setIsTalking(false);
      return;
    }

    setIsConnecting(true);

    try {
      await startVoiceCall({
        onCallStart: () => {
          setIsConnecting(false);
          setIsTalking(true);
        },
        onCallEnd: () => {
          setIsTalking(false);
        },
        onError: (error) => {
          console.error('Vapi error:', error);
          setIsConnecting(false);
          setIsTalking(false);
          if (isVapiDemoMode) {
            alert('Demo Mode: Vapi API key not configured. Voice calls are disabled.');
          }
        },
      });
    } catch (error) {
      console.error('Failed to start call:', error);
      setIsConnecting(false);
    }
  }, [isTalking]);

  const scrollToDemo = () => {
    const element = document.getElementById('demo');
    element?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <main className="min-h-screen">
      {/* Hero Section - Full Screen with Robot */}
      <section className="relative w-screen h-screen overflow-hidden bg-black">
        
        {/* Mouse tracking spotlight */}
        <Spotlight className="z-10 from-blue-500/20 via-blue-400/10 to-transparent" size={600} />

        {/* 3D Robot - Full screen background */}
        <InteractiveRobotSpline
          scene={ROBOT_SCENE_URL}
          className="absolute inset-0 z-0"
          onClick={handleStartVapi}
        />

        {/* UI Overlay */}
        <div className="absolute inset-0 z-20 pointer-events-none">
          {/* Header */}
          <Header />

           {/* Top content - Header altı */}
           <div className="absolute top-24 left-0 right-0 flex flex-col items-center px-4 pointer-events-auto">
             {/* Main headline */}
             <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white tracking-tight drop-shadow-2xl text-center mb-6">
               Never Miss a Call Again
             </h2>
             
             {/* Click Robot to Try Volina Button */}
             <div 
               className={`pointer-events-auto flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium transition-all duration-300 backdrop-blur-sm ${
                 isTalking 
                   ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                   : isConnecting 
                   ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                   : 'bg-white/10 text-white/80 border border-white/20 animate-bounce cursor-pointer'
               }`}
               onClick={handleStartVapi}
             >
               {isTalking ? (
                 <>
                   <Mic className="w-4 h-4 animate-pulse" />
                   Listening... Click to stop
                 </>
               ) : isConnecting ? (
                 <>
                   <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                   Connecting...
                 </>
               ) : (
                 <>
                   <Phone className="w-4 h-4" />
                   Click Robot to Try Volina
                 </>
               )}
             </div>
           </div>

           {/* Center content - Robot area */}
           <div className="absolute inset-0 flex flex-col items-center justify-center pt-16">
           </div>

          {/* Bottom actions */}
          <div className="absolute bottom-0 left-0 right-0 p-8 flex flex-col items-center gap-4 pointer-events-auto">
            <button 
              onClick={scrollToDemo}
              className="text-white/60 hover:text-white transition-colors underline underline-offset-4 font-medium"
            >
              Book a Demo Call
            </button>
            
            {/* Scroll indicator */}
            <div className="animate-bounce mt-2">
              <div className="w-6 h-10 border-2 border-white/30 rounded-full flex items-start justify-center p-2">
                <div className="w-1 h-2 bg-white/50 rounded-full" />
              </div>
            </div>
          </div>
        </div>

        {/* Active call glow */}
        {isTalking && (
          <div className="absolute inset-0 z-5 pointer-events-none">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-green-500/10 rounded-full blur-3xl animate-pulse" />
          </div>
        )}
      </section>

      {/* Other Sections */}
      <FeaturesSection />
      <TeamSection />
      <PricingSection />
      <Footer />
    </main>
  );
}

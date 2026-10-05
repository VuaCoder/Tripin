'use client';

import React from 'react';

export const AuthBackground: React.FC = () => {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      {/* Full panoramic hot-air balloon scenic background */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-transform duration-1000"
        style={{
          backgroundImage: `url("https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1920&q=80")`,
        }}
      />
      
      {/* Subtle sunrise lighting & warm sky gradient overlays */}
      <div className="absolute inset-0 bg-gradient-to-r from-white/80 via-white/45 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#f5faff]/85 via-transparent to-white/30" />
      
      {/* Ambient soft morning sun glow overlay */}
      <div className="absolute bottom-1/4 left-1/4 w-[550px] h-[380px] rounded-full bg-amber-100/35 blur-[100px] animate-sun-glow" />

      {/* Floating Hot Air Balloon 1: Top-Left Large Teal & Amber */}
      <div className="absolute top-10 left-[8%] w-12 h-16 text-[#087E8B]/45 animate-float-balloon filter drop-shadow-md">
        <svg viewBox="0 0 24 32" fill="currentColor" className="w-full h-full">
          <path d="M12 0C5.373 0 0 5.373 0 12c0 4.8 2.8 8.9 6.8 10.9L7.5 25h9l.7-2.1C21.2 20.9 24 16.8 24 12 24 5.373 18.627 0 12 0zm-1.5 27h3v2h-3v-2z" />
          <path d="M12 2c3 0 5.5 4 5.5 10s-2.5 10-5.5 10S6.5 18 6.5 12 9 2 12 2z" fill="rgba(245,166,35,0.4)" />
        </svg>
      </div>

      {/* Floating Hot Air Balloon 2: Top-Right Coral Red */}
      <div className="absolute top-16 right-[15%] w-14 h-18 text-[#E05638]/40 animate-drift-balloon filter drop-shadow-md" style={{ animationDelay: '-2s' }}>
        <svg viewBox="0 0 24 32" fill="currentColor" className="w-full h-full">
          <path d="M12 0C5.373 0 0 5.373 0 12c0 4.8 2.8 8.9 6.8 10.9L7.5 25h9l.7-2.1C21.2 20.9 24 16.8 24 12 24 5.373 18.627 0 12 0zm-1.5 27h3v2h-3v-2z" />
          <path d="M12 3c2.5 0 4.5 4 4.5 9s-2 9-4.5 9S7.5 17 7.5 12 9.5 3 12 3z" fill="rgba(255,255,255,0.3)" />
        </svg>
      </div>

      {/* Floating Hot Air Balloon 3: Top-Center Small Deep Cyan */}
      <div className="absolute top-8 left-[45%] w-8 h-11 text-[#00636e]/35 animate-float-balloon-slow filter drop-shadow-sm" style={{ animationDelay: '-4s' }}>
        <svg viewBox="0 0 24 32" fill="currentColor" className="w-full h-full">
          <path d="M12 0C5.373 0 0 5.373 0 12c0 4.8 2.8 8.9 6.8 10.9L7.5 25h9l.7-2.1C21.2 20.9 24 16.8 24 12 24 5.373 18.627 0 12 0zm-1.5 27h3v2h-3v-2z" />
        </svg>
      </div>

      {/* Floating Hot Air Balloon 4: Mid-Right Medium Orange Gold */}
      <div className="absolute top-1/3 right-[6%] w-10 h-14 text-[#F5A623]/45 animate-float-balloon filter drop-shadow-sm" style={{ animationDelay: '-1s' }}>
        <svg viewBox="0 0 24 32" fill="currentColor" className="w-full h-full">
          <path d="M12 0C5.373 0 0 5.373 0 12c0 4.8 2.8 8.9 6.8 10.9L7.5 25h9l.7-2.1C21.2 20.9 24 16.8 24 12 24 5.373 18.627 0 12 0zm-1.5 27h3v2h-3v-2z" />
          <path d="M12 3c2 0 3.5 3.5 3.5 8.5s-1.5 8.5-3.5 8.5S8.5 16.5 8.5 11.5 10 3 12 3z" fill="rgba(8,126,139,0.3)" />
        </svg>
      </div>

      {/* Floating Hot Air Balloon 5: Mid-Left Slate Teal */}
      <div className="absolute top-1/2 left-[5%] w-11 h-15 text-[#1B4965]/40 animate-drift-balloon filter drop-shadow-md" style={{ animationDelay: '-6s' }}>
        <svg viewBox="0 0 24 32" fill="currentColor" className="w-full h-full">
          <path d="M12 0C5.373 0 0 5.373 0 12c0 4.8 2.8 8.9 6.8 10.9L7.5 25h9l.7-2.1C21.2 20.9 24 16.8 24 12 24 5.373 18.627 0 12 0zm-1.5 27h3v2h-3v-2z" />
        </svg>
      </div>

      {/* Floating Hot Air Balloon 6: Bottom-Right Indigo Violet */}
      <div className="absolute bottom-20 right-[18%] w-12 h-16 text-[#5C4D7D]/35 animate-float-balloon-slow filter drop-shadow-md" style={{ animationDelay: '-3.5s' }}>
        <svg viewBox="0 0 24 32" fill="currentColor" className="w-full h-full">
          <path d="M12 0C5.373 0 0 5.373 0 12c0 4.8 2.8 8.9 6.8 10.9L7.5 25h9l.7-2.1C21.2 20.9 24 16.8 24 12 24 5.373 18.627 0 12 0zm-1.5 27h3v2h-3v-2z" />
          <path d="M12 3c2 0 3.5 4 3.5 9s-1.5 9-3.5 9S8.5 17 8.5 12 10 3 12 3z" fill="rgba(245,166,35,0.4)" />
        </svg>
      </div>

      {/* Floating Hot Air Balloon 7: Bottom-Left Emerald Green */}
      <div className="absolute bottom-24 left-[22%] w-9 h-12 text-[#2D6A4F]/35 animate-drift-balloon filter drop-shadow-sm" style={{ animationDelay: '-5s' }}>
        <svg viewBox="0 0 24 32" fill="currentColor" className="w-full h-full">
          <path d="M12 0C5.373 0 0 5.373 0 12c0 4.8 2.8 8.9 6.8 10.9L7.5 25h9l.7-2.1C21.2 20.9 24 16.8 24 12 24 5.373 18.627 0 12 0zm-1.5 27h3v2h-3v-2z" />
        </svg>
      </div>

      {/* Floating Hot Air Balloon 8: Far Top Right Tiny Distant */}
      <div className="absolute top-6 right-[4%] w-6 h-8 text-[#087E8B]/30 animate-float-balloon filter opacity-80" style={{ animationDelay: '-7s' }}>
        <svg viewBox="0 0 24 32" fill="currentColor" className="w-full h-full">
          <path d="M12 0C5.373 0 0 5.373 0 12c0 4.8 2.8 8.9 6.8 10.9L7.5 25h9l.7-2.1C21.2 20.9 24 16.8 24 12 24 5.373 18.627 0 12 0zm-1.5 27h3v2h-3v-2z" />
        </svg>
      </div>
    </div>
  );
};

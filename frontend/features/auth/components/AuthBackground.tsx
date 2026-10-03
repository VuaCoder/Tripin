'use client';

import React from 'react';

export const AuthBackground: React.FC = () => {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      {/* Full panoramic hot-air balloon scenic background */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-transform duration-1000"
        style={{
          backgroundImage: `url("https://lh3.googleusercontent.com/aida/AEtjO1WcrIRXrdE-lHH85h7FbqapUvbrzTet33fzwUSADrjqChusphrq02qqiwBUOotreB94iy-OmC_cdJmK548oZ4l-541WAKqNUkZtIfuRj6ZvawaKEJ2Oq5H69OOsDnsnXzRSVmk553H7D2WAaGsMAQlD8FeKOD2msxCxQ-jclG5SLBhQBj-qnI-5KeyfN6vZB9iHdIvn76YignWlNn7-ogeUkKm1Vudzy3cugC5MWrXDwQGBdc-z4fEFtV2Z")`,
        }}
      />
      
      {/* Subtle sunrise lighting & warm sky gradient overlays */}
      <div className="absolute inset-0 bg-gradient-to-r from-white/75 via-white/40 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#f5faff]/80 via-transparent to-white/30" />
      
      {/* Ambient soft morning sun glow overlay */}
      <div className="absolute bottom-1/4 left-1/4 w-[500px] h-[350px] rounded-full bg-amber-100/30 blur-[100px] animate-sun-glow" />

      {/* Gentle floating decorative hot-air balloon silhouette accents */}
      <div className="absolute top-12 left-1/3 w-8 h-12 text-[#226771]/35 animate-float-balloon hidden lg:block">
        <svg viewBox="0 0 24 32" fill="currentColor" className="w-full h-full drop-shadow-sm">
          <path d="M12 0C5.373 0 0 5.373 0 12c0 4.8 2.8 8.9 6.8 10.9L7.5 25h9l.7-2.1C21.2 20.9 24 16.8 24 12 24 5.373 18.627 0 12 0zm-1.5 27h3v2h-3v-2z" />
        </svg>
      </div>

      <div className="absolute top-24 right-1/4 w-12 h-16 text-[#bf4f34]/30 animate-drift-balloon hidden lg:block" style={{ animationDelay: '-3s' }}>
        <svg viewBox="0 0 24 32" fill="currentColor" className="w-full h-full drop-shadow-sm">
          <path d="M12 0C5.373 0 0 5.373 0 12c0 4.8 2.8 8.9 6.8 10.9L7.5 25h9l.7-2.1C21.2 20.9 24 16.8 24 12 24 5.373 18.627 0 12 0zm-1.5 27h3v2h-3v-2z" />
        </svg>
      </div>

      <div className="absolute top-1/3 right-12 w-6 h-9 text-[#00636e]/25 animate-float-balloon hidden lg:block" style={{ animationDelay: '-5s' }}>
        <svg viewBox="0 0 24 32" fill="currentColor" className="w-full h-full drop-shadow-sm">
          <path d="M12 0C5.373 0 0 5.373 0 12c0 4.8 2.8 8.9 6.8 10.9L7.5 25h9l.7-2.1C21.2 20.9 24 16.8 24 12 24 5.373 18.627 0 12 0zm-1.5 27h3v2h-3v-2z" />
        </svg>
      </div>
    </div>
  );
};

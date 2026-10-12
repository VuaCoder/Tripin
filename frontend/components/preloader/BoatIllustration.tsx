'use client';

import React, { forwardRef } from 'react';

export interface BoatIllustrationRefs {
  boatRef: React.RefObject<SVGGElement>;
  flagRef: React.RefObject<SVGPathElement>;
  waveBackRef: React.RefObject<SVGPathElement>;
  waveMidRef: React.RefObject<SVGPathElement>;
  waveFrontRef: React.RefObject<SVGPathElement>;
}

export interface BoatIllustrationProps {
  boatRef: React.RefObject<SVGGElement>;
  flagRef: React.RefObject<SVGPathElement>;
  waveBackRef: React.RefObject<SVGPathElement>;
  waveMidRef: React.RefObject<SVGPathElement>;
  waveFrontRef: React.RefObject<SVGPathElement>;
  className?: string;
}

/**
 * 2D Minimalist Sailing Boat on Multi-layer Animated Sea Waves.
 * Fully controlled by GSAP refs for independent physics & wave kinematics.
 */
export const BoatIllustration = forwardRef<SVGSVGElement, BoatIllustrationProps>(
  function BoatIllustration(
    { boatRef, flagRef, waveBackRef, waveMidRef, waveFrontRef, className = '' },
    svgRef,
  ) {
    return (
      <div className={`relative flex items-center justify-center ${className}`}>
        {/* Soft Ambient Radial Backdrop */}
        <div
          className="pointer-events-none absolute size-72 sm:size-96 md:size-[460px] lg:size-[560px] rounded-full bg-gradient-to-tr from-[#087E8B]/12 via-[#F5A623]/10 to-transparent blur-3xl"
          aria-hidden="true"
        />

        <svg
          ref={svgRef}
          viewBox="0 0 260 170"
          className="relative z-10 w-72 h-auto sm:w-[360px] md:w-[440px] lg:w-[500px] xl:w-[540px] overflow-hidden drop-shadow-sm transition-all duration-300"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <defs>
            {/* Soft gradient for mainsail */}
            <linearGradient id="mainSailGrad" x1="125" y1="34" x2="175" y2="86" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="100%" stopColor="#E2F0F2" />
            </linearGradient>

            {/* Soft gradient for foresail */}
            <linearGradient id="jibSailGrad" x1="80" y1="40" x2="123" y2="86" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#F5FCFD" />
              <stop offset="100%" stopColor="#CEE9EE" />
            </linearGradient>

            {/* Hull gradient */}
            <linearGradient id="hullGrad" x1="74" y1="99" x2="186" y2="128" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#087E8B" />
              <stop offset="60%" stopColor="#004F57" />
              <stop offset="100%" stopColor="#00353A" />
            </linearGradient>

            {/* Front wave gradient */}
            <linearGradient id="frontWaveGrad" x1="0" y1="112" x2="0" y2="170" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#087E8B" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#00464D" stopOpacity="0.98" />
            </linearGradient>

            {/* Soft mask so water edges fade gently at borders */}
            <linearGradient id="fadeMaskGrad" x1="0" y1="0" x2="260" y2="0" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.1" />
              <stop offset="12%" stopColor="#FFFFFF" stopOpacity="1" />
              <stop offset="88%" stopColor="#FFFFFF" stopOpacity="1" />
              <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.1" />
            </linearGradient>

            <mask id="waterFadeMask">
              <rect x="0" y="0" width="260" height="170" fill="url(#fadeMaskGrad)" />
            </mask>
          </defs>

          {/* ========================================================================= */}
          {/* LAYER 1: BACK WATER WAVES (Distant gentle swell)                          */}
          {/* Wavelength: 130px. Repeating seamlessly from x=-130 to x=390              */}
          {/* ========================================================================= */}
          <g mask="url(#waterFadeMask)">
            <path
              ref={waveBackRef}
              d="M -130 110 C -97.5 104, -65 104, -32.5 110 C 0 116, 32.5 116, 65 110 C 97.5 104, 130 104, 162.5 110 C 195 116, 227.5 116, 260 110 C 292.5 104, 325 104, 357.5 110 C 390 116, 422.5 116, 455 110 L 455 170 L -130 170 Z"
              fill="#79D4E2"
              fillOpacity="0.32"
            />
          </g>

          {/* ========================================================================= */}
          {/* LAYER 2: MID WATER WAVES (Behind boat hull, offset wave rhythm)           */}
          {/* ========================================================================= */}
          <g mask="url(#waterFadeMask)">
            <path
              ref={waveMidRef}
              d="M -130 116 C -97.5 122, -65 122, -32.5 116 C 0 110, 32.5 110, 65 116 C 97.5 122, 130 122, 162.5 116 C 195 110, 227.5 110, 260 116 C 292.5 122, 325 122, 357.5 116 C 390 110, 422.5 110, 455 116 L 455 170 L -130 170 Z"
              fill="#087E8B"
              fillOpacity="0.45"
            />
          </g>

          {/* ========================================================================= */}
          {/* LAYER 3: 2D SAILING BOAT (Gently bobbing and swaying)                     */}
          {/* ========================================================================= */}
          <g ref={boatRef} id="tripri-boat-group">
            {/* Rigging wires */}
            <line x1="125" y1="34" x2="80" y2="99" stroke="#004F57" strokeWidth="1.2" strokeDasharray="3 2" strokeOpacity="0.35" />
            <line x1="125" y1="34" x2="174" y2="99" stroke="#004F57" strokeWidth="1.2" strokeDasharray="3 2" strokeOpacity="0.35" />

            {/* Foresail / Jib (Left triangular aerodynamic sail) */}
            <path
              d="M 122 39 C 105 56, 88 74, 80 87 L 122 87 Z"
              fill="url(#jibSailGrad)"
              stroke="#004F57"
              strokeWidth="1.2"
              strokeLinejoin="round"
            />

            {/* Mainsail (Right curved dynamic sail) */}
            <path
              d="M 127 34 C 144 54, 164 73, 174 87 L 127 87 Z"
              fill="url(#mainSailGrad)"
              stroke="#004F57"
              strokeWidth="1.2"
              strokeLinejoin="round"
            />

            {/* Main mast */}
            <line x1="125" y1="28" x2="125" y2="100" stroke="#00353A" strokeWidth="3" strokeLinecap="round" />

            {/* Pennant Flag at mast peak */}
            <path
              ref={flagRef}
              d="M 125 28 L 140 33 L 125 38 Z"
              fill="#F5A623"
              stroke="#D98A0D"
              strokeWidth="0.8"
              strokeLinejoin="round"
            />

            {/* Boat Deck Cabin structure */}
            <path
              d="M 112 99 L 112 92 C 112 90 114 89 116 89 L 138 89 C 140 89 142 90 142 92 L 142 99 Z"
              fill="#FFFFFF"
              stroke="#004F57"
              strokeWidth="1.5"
            />
            {/* Cabin porthole */}
            <circle cx="127" cy="94" r="2.2" fill="#087E8B" />

            {/* Boat Hull - Elegant 2D silhouette */}
            <path
              d="M 74 103 C 84 122, 116 128, 130 128 C 144 128, 176 122, 186 103 L 178 98 C 158 100, 102 100, 82 98 Z"
              fill="url(#hullGrad)"
              stroke="#00353A"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />

            {/* Waterline golden stripe accent */}
            <path
              d="M 78 105 C 96 117, 118 121, 130 121 C 142 121, 164 117, 182 105"
              stroke="#F5A623"
              strokeWidth="2.2"
              strokeLinecap="round"
            />

            {/* Hull highlight rim */}
            <path
              d="M 83 99 L 177 99"
              stroke="#E2F0F2"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeOpacity="0.75"
            />
          </g>

          {/* ========================================================================= */}
          {/* LAYER 4: FRONT WATER WAVES (Overlaps lower hull - boat sits IN water)      */}
          {/* ========================================================================= */}
          <g mask="url(#waterFadeMask)">
            <path
              ref={waveFrontRef}
              d="M -130 122 C -97.5 114, -65 114, -32.5 122 C 0 129, 32.5 129, 65 122 C 97.5 114, 130 114, 162.5 122 C 195 129, 227.5 129, 260 122 C 292.5 114, 325 114, 357.5 122 C 390 129, 422.5 129, 455 122 L 455 170 L -130 170 Z"
              fill="url(#frontWaveGrad)"
            />

            {/* Crest highlight ripples */}
            <path
              d="M 40 121 C 52 117, 78 117, 90 121"
              stroke="#FFFFFF"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeOpacity="0.65"
            />
            <path
              d="M 170 121 C 182 117, 208 117, 220 121"
              stroke="#FFFFFF"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeOpacity="0.65"
            />
            <path
              d="M 105 124 C 117 122, 138 122, 150 124"
              stroke="#79D4E2"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeOpacity="0.5"
            />
          </g>
        </svg>
      </div>
    );
  },
);

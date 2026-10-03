'use client';

import React from 'react';
import { LoginForm } from './LoginForm';
import { LoginResultData } from '../types';

interface LoginCardProps {
  onSuccess?: (data: LoginResultData) => void;
  onError?: (errorMessage: string) => void;
}

export const LoginCard: React.FC<LoginCardProps> = ({ onSuccess, onError }) => {
  return (
    <div className="lg:col-span-5 flex justify-center order-2 lg:order-1" data-purpose="auth-container">
      <div className="w-full max-w-[400px] rounded-[38px] px-7 sm:px-9 py-8 sm:py-10 flex flex-col items-center border shadow-2xl relative bg-white border-white">
        {/* Subtle top mobile speaker notch indicator for faithful aesthetic */}
        <div className="w-16 h-1 bg-slate-200 rounded-full mb-6" />

        {/* Tripri Mobile Card Header Logo Icon */}
        <div className="flex flex-col items-center mb-5">
          <img
            alt="Tripri - Du lịch theo cách của bạn"
            className="h-20 w-auto object-contain mx-auto mb-4"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuBvgyrWOQJ_Pboo1MmnwXZli0jTh-C8sZAQbCs8MzFn_vgUnw_kluvF-Hql74XSvzuRjZEUidQy4HIox8FchlHXBop2MvKSBXZIU_1G19ykGDeRDpvNF7qGOz0jtqNON33xfk2l9fOVcZM9BLqI3mxg4oze3578r5T_EnK3J22_Y6yg1lJRT95VKZNmiEL7LBDdbV8Sfn0Dcg9UNzZb4nyso89EM-ouGte5ojp4HDZdeAwZviAMHlLqoB32buuHttnr4imYhkjQe8aHLDU"
          />
          {/* Carousel dots */}
          <div className="flex items-center gap-1.5 mt-1" data-purpose="carousel-dots">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-teal" />
            <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
            <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
          </div>
        </div>

        {/* Form authentication */}
        <LoginForm onSuccess={onSuccess} onError={onError} />
      </div>
    </div>
  );
};

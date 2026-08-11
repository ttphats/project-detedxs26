"use client";

import { Check } from "lucide-react";

interface Step {
  number: number;
  label: string;
}

const STEPS: Step[] = [
  { number: 1, label: "Select Tickets" },
  { number: 2, label: "Attendee Info" },
  { number: 3, label: "Payment" },
];

interface StepIndicatorProps {
  /** 1-indexed current step (1 = Select Tickets, 2 = Attendee Info, 3 = Payment) */
  currentStep: number;
}

export default function StepIndicator({ currentStep }: StepIndicatorProps) {
  return (
    <div className="w-full mb-8 animate-fade-in">
      <div className="flex items-center justify-center gap-0">
        {STEPS.map((step, idx) => {
          const isCompleted = step.number < currentStep;
          const isActive = step.number === currentStep;
          const isLast = idx === STEPS.length - 1;

          return (
            <div key={step.number} className="flex items-center">
              {/* Step circle + label */}
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className={`
                    w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center
                    font-bold text-sm transition-all duration-300 border-2
                    ${
                      isCompleted
                        ? "bg-red-600 border-red-600 text-white shadow-lg shadow-red-500/30"
                        : isActive
                          ? "bg-red-600/20 border-red-500 text-red-500 shadow-lg shadow-red-500/20"
                          : "bg-white/5 border-white/20 text-gray-500"
                    }
                  `}
                >
                  {isCompleted ? (
                    <Check className="w-4 h-4 sm:w-5 sm:h-5" />
                  ) : (
                    step.number
                  )}
                </div>
                <span
                  className={`text-[10px] sm:text-xs font-medium whitespace-nowrap transition-colors duration-300 ${
                    isCompleted
                      ? "text-red-400"
                      : isActive
                        ? "text-white"
                        : "text-gray-500"
                  }`}
                >
                  {step.label}
                </span>
              </div>

              {/* Connector line */}
              {!isLast && (
                <div className="relative w-16 sm:w-24 md:w-32 h-0.5 mx-2 sm:mx-3 mb-5">
                  <div className="absolute inset-0 bg-white/10 rounded-full" />
                  <div
                    className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 ${
                      isCompleted
                        ? "w-full bg-red-600"
                        : "w-0 bg-red-600"
                    }`}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

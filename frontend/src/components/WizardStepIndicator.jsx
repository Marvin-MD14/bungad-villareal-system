import React from 'react';
import { Check } from 'lucide-react';

/**
 * WizardStepIndicator - Displays step progress in a wizard flow
 *
 * Used in the business creation wizard to show:
 * - Current step highlighted with cyan/blue
 * - Completed steps with green checkmark
 * - Future steps grayed out
 *
 * Requirements: R1
 *
 * @param {Object} props
 * @param {number} props.currentStep - 0-indexed current step (0, 1, 2)
 * @param {number} props.totalSteps - Total number of steps (always 3)
 * @param {string[]} props.stepLabels - Labels for each step
 * @param {boolean} props.isDarkMode - Dark mode support
 */
export default function WizardStepIndicator({
  currentStep,
  totalSteps,
  stepLabels,
  isDarkMode = false,
}) {
  // Generate array of step indices [0, 1, 2, ...]
  const steps = Array.from({ length: totalSteps }, (_, i) => i);

  return (
    <div className="w-full py-6">
      {/* Step indicators container */}
      <div className="flex items-center justify-between relative">
        {/* Background connecting line */}
        <div className="absolute top-5 left-0 right-0 h-0.5 bg-slate-200 dark:bg-slate-700 mx-8" />

        {/* Progress line (filled up to current step) */}
        <div
          className="absolute top-5 left-0 h-0.5 bg-cyan-500 transition-all duration-300 mx-8"
          style={{
            width: `calc(${(currentStep / (totalSteps - 1)) * 100}% - 4rem)`,
          }}
        />

        {/* Step circles */}
        {steps.map((step) => {
          const isCompleted = step < currentStep;
          const isCurrent = step === currentStep;
          const isFuture = step > currentStep;

          return (
            <div
              key={step}
              className="relative flex flex-col items-center z-10"
            >
              {/* Step circle */}
              <div
                className={`
                  w-10 h-10 rounded-full flex items-center justify-center
                  font-semibold text-sm transition-all duration-300
                  ${isCompleted
                    ? 'bg-emerald-500 text-white'
                    : isCurrent
                    ? 'bg-cyan-500 text-white ring-4 ring-cyan-100 dark:ring-cyan-900'
                    : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                  }
                `}
              >
                {isCompleted ? (
                  <Check size={20} strokeWidth={3} />
                ) : (
                  step + 1
                )}
              </div>

              {/* Step label */}
              <span
                className={`
                  mt-2 text-xs font-medium text-center max-w-[80px]
                  ${isCurrent
                    ? 'text-cyan-600 dark:text-cyan-400'
                    : isCompleted
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-slate-400 dark:text-slate-500'
                  }
                `}
              >
                {stepLabels[step] || `Step ${step + 1}`}
              </span>
            </div>
          );
        })}
      </div>

      {/* Step counter text */}
      <p className="text-center mt-4 text-sm text-slate-500 dark:text-slate-400">
        Step {currentStep + 1} of {totalSteps}
      </p>
    </div>
  );
}

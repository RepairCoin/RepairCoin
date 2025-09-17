import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, Circle, ArrowRight } from 'lucide-react';

interface OnboardingStep {
  id: number;
  title: string;
  description: string;
  completed: boolean;
}

interface OnboardingGuideProps {
  hasRCG: boolean;
  isVerified: boolean;
  className?: string;
}

export function OnboardingGuide({ hasRCG, isVerified, className = '' }: OnboardingGuideProps) {
  const steps: OnboardingStep[] = [
    {
      id: 1,
      title: "Register Your Shop",
      description: "Complete registration with business details",
      completed: true // They're seeing this, so they registered
    },
    {
      id: 2,
      title: "Get Verified",
      description: "Admin approval for your shop",
      completed: isVerified
    },
    {
      id: 3,
      title: "Choose Your Path",
      description: "Buy RCG tokens OR subscribe to monthly plan (optional)",
      completed: hasRCG
    },
    {
      id: 4,
      title: "Start Operating",
      description: "Issue rewards and process redemptions",
      completed: isVerified
    }
  ];

  const currentStep = steps.findIndex(step => !step.completed) + 1 || steps.length;

  return (
    <Card className={`bg-[#212121] border-gray-700 ${className}`}>
      <CardHeader>
        <CardTitle className="text-lg text-[#FFCC00]">Getting Started</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-start gap-3">
              <div className="mt-0.5">
                {step.completed ? (
                  <CheckCircle2 className="h-5 w-5 text-green-400" />
                ) : (
                  <Circle className={`h-5 w-5 ${
                    currentStep === step.id ? 'text-[#FFCC00]' : 'text-gray-600'
                  }`} />
                )}
              </div>
              <div className="flex-1">
                <h3 className={`text-sm font-medium ${
                  step.completed ? 'text-white' : 
                  currentStep === step.id ? 'text-[#FFCC00]' : 'text-gray-400'
                }`}>
                  {step.title}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">{step.description}</p>
              </div>
              {index < steps.length - 1 && (
                <ArrowRight className="h-4 w-4 text-gray-600 mt-0.5" />
              )}
            </div>
          ))}
        </div>

        {!hasRCG && isVerified && (
          <div className="mt-4 p-3 bg-blue-900/20 rounded-lg">
            <p className="text-xs text-blue-300">
              <span className="font-semibold">Note:</span> You can operate without RCG tokens! 
              RCG is optional and only needed for tier discounts.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';

interface OperationalRequiredTabProps {
  feature: string;
}

export function OperationalRequiredTab({ feature }: OperationalRequiredTabProps) {
  return (
    <Card className="bg-gray-900 border-gray-700">
      <CardContent className="p-12">
        <div className="text-center">
          <AlertCircle className="h-16 w-16 text-amber-500 mx-auto mb-4" />
          <h3 className="text-2xl font-semibold text-white mb-2">
            Shop Partner Requirements Not Met
          </h3>
          <p className="text-gray-400 max-w-md mx-auto">
            You need to hold at least 10,000 RCG tokens or be enrolled in the Commitment Program to access {feature}.
          </p>
          <p className="text-gray-500 text-sm mt-4">
            Please check the requirements banner at the top of your dashboard for more information.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
import React from "react";
import { Dialog, DialogContent, DialogHeader } from "@/components/ui/dialog";
import { Button } from "../ui/button";
import { DialogDescription, DialogTitle } from "@radix-ui/react-dialog";

interface SuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  amount?: number;
  currency?: string;
  customContent?: React.ReactNode;
  showCoinsAnimation?: boolean;
  backgroundImage?: string;
}

const SuccessModal: React.FC<SuccessModalProps> = ({
  isOpen,
  onClose,
  title = "Payment Successful!",
  subtitle = "Your transaction has been completed successfully.",
  amount,
  currency = "RCN",
  customContent,
  showCoinsAnimation = true,
  backgroundImage = "/img/success-modal-bg.png",
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className="sm:max-w-lg md:max-w-xl w-full overflow-hidden"
        style={{
          backgroundImage: `url('${backgroundImage}')`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      >
        {/* Animated Coins Background */}
        <div className="absolute inset-0 bottom-[300px] overflow-hidden pointer-events-none">
          {/* Create multiple coins with different animation delays */}
          {[...Array(22)].map((_, i) => {
            const leftPosition = 10 + i * 7 + Math.random() * 10;
            const animationDelay = i * 0.3 + Math.random() * 0.5;
            const animationDuration = 4 + Math.random() * 2;

            return (
              <div
                key={i}
                className="absolute -bottom-12 opacity-0"
                style={{
                  left: `${leftPosition}%`,
                  animation: `floatUp ${animationDuration}s ${animationDelay}s ease-in-out infinite`,
                }}
              >
                <div
                  className="w-12 h-12 md:w-16 md:h-16"
                  style={{
                    animation: `spin ${3}s linear infinite`,
                    filter: "drop-shadow(0 0 10px #FFCC00)",
                  }}
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-full h-full"
                  >
                    <circle
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="#FFCC00"
                      strokeWidth="2"
                      fill="#FFCC00"
                    />
                    <circle
                      cx="12"
                      cy="12"
                      r="8"
                      stroke="#FFA500"
                      strokeWidth="1"
                      fill="none"
                      opacity="0.5"
                    />
                    <text
                      x="12"
                      y="16"
                      textAnchor="middle"
                      fill="#FFA500"
                      fontSize="10"
                      fontWeight="bold"
                    >
                      R
                    </text>
                  </svg>
                </div>
              </div>
            );
          })}
        </div>
        <div className="relative z-10 min-h-[300px] flex items-center justify-center p-8 md:p-12">
          <div className="w-full max-w-2xl mt-20">
            <DialogHeader className="space-y-4">
              <DialogTitle className="text-3xl md:text-2xl lg:text-3xl text-center text-[#FFCC00] font-bold drop-shadow-lg">
                {title}
              </DialogTitle>
              <DialogDescription className="text-center text-base md:text-base pt-4 text-white drop-shadow-md mx-auto">
                {subtitle}
              </DialogDescription>
            </DialogHeader>

            <div className="mt-20 flex justify-center">
              <Button
                onClick={onClose}
                className="bg-[#FFCC00] hover:bg-[#FFCC00]/90 text-gray-900 rounded-full px-12 py-4 text-base font-bold transform transition hover:scale-105 shadow-xl"
              >
                Continue
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>

      {/* Keyframe Animations */}
      <style jsx global>{`
        @keyframes floatUp {
          0% {
            transform: translateY(0) scale(0);
            opacity: 0;
          }
          10% {
            transform: translateY(-20px) scale(1);
            opacity: 1;
          }
          90% {
            transform: translateY(-400px) scale(1);
            opacity: 1;
          }
          100% {
            transform: translateY(-450px) scale(0.8);
            opacity: 0;
          }
        }

        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }

        @keyframes checkmarkPop {
          0% {
            transform: scale(0) rotate(-45deg);
            opacity: 0;
          }
          50% {
            transform: scale(1.2) rotate(10deg);
            opacity: 1;
          }
          100% {
            transform: scale(1) rotate(0deg);
            opacity: 1;
          }
        }
      `}</style>
    </Dialog>
  );
};

export default SuccessModal;

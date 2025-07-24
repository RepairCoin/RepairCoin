import { ConnectButton } from "thirdweb/react";
import { createThirdwebClient } from "thirdweb";

const client = createThirdwebClient({
  clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID || "1969ac335e07ba13ad0f8d1a1de4f6ab",
});

interface WalletConnectPromptProps {
  title: string;
  description: string;
  icon: string;
  bgColor?: string;
}

export default function WalletConnectPrompt({ 
  title, 
  description, 
  icon,
  bgColor = "from-blue-50 to-indigo-100"
}: WalletConnectPromptProps) {
  return (
    <div className={`min-h-screen flex items-center justify-center bg-gradient-to-br ${bgColor}`}>
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
        <div className="text-center">
          <div className="text-6xl mb-6">{icon}</div>
          <h1 className="text-3xl font-bold text-gray-900 mb-4">{title}</h1>
          <p className="text-gray-600 mb-8">{description}</p>
          <ConnectButton 
            client={client}
            theme="light"
            connectModal={{ size: "wide" }}
          />
        </div>
      </div>
    </div>
  );
}
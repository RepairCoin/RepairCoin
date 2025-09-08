import { ThirdWebStrategy } from "../utilities/GlobalTypes";
import { createThirdwebClient } from "thirdweb";
import { useActiveAccount, useConnect } from "thirdweb/react";
import { inAppWallet, preAuthenticate } from "thirdweb/wallets";

const clientId =
  process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID ||
  "99f01d5781fadab9f6a42660090e824b";

export const SocialConnectWalletService = async (
  strategy: ThirdWebStrategy
) => {
  const client = createThirdwebClient({
    clientId,
  });

  console.log("ffff");
  const wallet = inAppWallet();

  // const { connect } = useConnect();
  // const account = useActiveAccount();

  console.log("asdf");

  // await connect(async () => {
  await wallet.connect({
    client,
    strategy: strategy,
  });
  // });

  // console.log(account);
};

export const SendCodeViaEmailService = async (email: string) => {
  const client = createThirdwebClient({
    clientId,
  });

  const response = { success: false };

  await preAuthenticate({
    client,
    strategy: "email",
    email,
  })
    .then(() => (response.success = true))
    .catch(() => (response.success = false));

  // console.log(response);
  return response;
};

export const EmailConnectWalletService = async (
  email: string,
  code: string
) => {
  const client = createThirdwebClient({
    clientId,
  });

  const wallet = inAppWallet();

  const account = await wallet.connect({
    client,
    strategy: "email",
    email,
    verificationCode: code,
  });

  return account;
};

export const RegisterAsCustomerService = async (registrationData: {
  address?: string;
  name?: string;
  email: string;
  phone?: string;
  referralCode?: string;
  walletAddress: string;
  fixflowCustomerId?: string;
}) => {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

  console.log(JSON.stringify(registrationData));

  await fetch(`${apiUrl}/customers/register/`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(registrationData),
  })
    .then((res) => console.log("Customer registration response:", res))
    .catch((err) => console.log("Customer registration error:", err));
};

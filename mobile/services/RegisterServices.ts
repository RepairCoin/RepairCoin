import { ThirdWebStrategy } from "../utilities/GlobalTypes";
import { createThirdwebClient } from "thirdweb";
import { useActiveAccount, useConnect } from "thirdweb/react";
import { inAppWallet, preAuthenticate } from "thirdweb/wallets";
import { router } from "expo-router";

const clientId =
  process.env.EXPO_PUBLIC_THIRDWEB_CLIENT_ID ||
  "99f01d5781fadab9f6a42660090e824b";

export const SocialConnectWalletService = async (
  strategy: ThirdWebStrategy
) => {
  const client = createThirdwebClient({
    clientId,
  });
  const wallet = inAppWallet();

  // const { connect } = useConnect();
  // const account = useActiveAccount();

  // await connect(async () => {
  const account = await wallet.connect({
    client,
    strategy: strategy,
    redirectUrl: "mobile://auth/wallet/Social",
  });
  // });

  return account;
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
  const apiUrl =
    process.env.EXPO_PUBLIC_API_URL || "http://192.168.132.85:3001/api";

  console.log(JSON.stringify(registrationData));
  console.log(apiUrl);

  const response = { success: false, resData: {} };

  await fetch(`${apiUrl}/customers/register/`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(registrationData),
  })
    .then((res) => {
      response.success = true;
      response.resData = res;
    })
    .catch((err) => {
      response.success = false;
    });

  return response;
};

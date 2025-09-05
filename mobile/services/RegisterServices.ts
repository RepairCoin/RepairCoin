import { ThirdWebStrategy } from "../utilities/GlobalTypes";
import { createThirdwebClient } from "thirdweb";
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

  const wallet = inAppWallet();

  const account = await wallet
    .connect({
      client,
      strategy: strategy,
    })
    .then((res) => console.log(res));

  console.log("Connected as:", account);
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
    .then((res) => (response.success = true))
    .catch((err) => (response.success = false));

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

  console.log("asdf");
  const account = await wallet
    .connect({
      client,
      strategy: "email",
      email,
      verificationCode: code,
    })
    .then((res) => console.log(res))
    .catch((err) => console.log(err));
};

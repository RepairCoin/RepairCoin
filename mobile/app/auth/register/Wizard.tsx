import {
  EmailConnectWalletService,
  RegisterAsCustomerService,
  SendCodeViaEmailService,
} from "@/services/RegisterServices";
import { AntDesign, Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { OtpInput } from "react-native-otp-entry";
import PrimaryButton from "@/components/PrimaryButton";
import FooterNote from "@/components/FooterNote";

type Step = 1 | 2 | 3;

export default function RegisterWizard() {
  const [step, setStep] = useState<Step>(1);

  const [email, setEmail] = useState("");
  const [isValidEmail, setIsValidEmail] = useState(true);
  const [sendingCodeSuccess, setSendingCodeSuccess] = useState(true);

  const [code, setCode] = useState<string>("");

  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);

  const passReqs = useMemo(() => {
    const hasLen = password.length >= 8;
    const hasNum = /\d/.test(password);
    const hasSym = /[^A-Za-z0-9]/.test(password);
    return { hasLen, hasNum, hasSym };
  }, [password]);

  const passProgress = useMemo(() => {
    const { hasLen, hasNum, hasSym } = passReqs;
    const score = [hasLen, hasNum, hasSym].filter(Boolean).length;
    return score / 3;
  }, [passReqs]);

  const handleSendCode = async () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email)) {
      setIsValidEmail(false);
      return;
    } else {
      setIsValidEmail(true);
    }

    const response = await SendCodeViaEmailService(email);
    if (response.success) {
      setSendingCodeSuccess(true);
      setStep(2);
    } else {
      setSendingCodeSuccess(false);
    }
  };

  const handleConnectWallet = async () => {
    const account = await EmailConnectWalletService(email, code);
    await RegisterAsCustomerService({
      email: email,
      walletAddress: account.address,
    });
  };

  const handleRegisterCustomer = async () => {};

  const ProgressDots = ({ step }: { step: Step }) => (
    <View className="mt-2 flex-row items-center gap-2">
      <View
        className={`h-1.5 w-8 rounded-full ${step >= 1 ? "bg-yellow-400" : "bg-zinc-300"}`}
      />
      <View
        className={`h-1.5 w-8 rounded-full ${step >= 2 ? "bg-yellow-400" : "bg-zinc-300"}`}
      />
      <View
        className={`h-1.5 w-8 rounded-full ${step >= 3 ? "bg-yellow-400" : "bg-zinc-300"}`}
      />
    </View>
  );

  const ReqRow = ({ label, ok }: { label: string; ok: boolean }) => (
    <View className="flex-row items-center gap-3">
      <View
        className={`h-4 w-4 items-center justify-center rounded-full ${
          ok ? "bg-green-500" : "bg-zinc-300"
        }`}
      >
        {ok && <AntDesign name="check" size={10} color="#fff" />}
      </View>
      <Text className={`text-zinc-700 ${ok ? "font-semibold" : ""}`}>
        {label}
      </Text>
    </View>
  );

  return (
    <SafeAreaView className="flex-1 items-center bg-zinc-100">
      <View className="w-[92%] md:w-[80%] lg:w-[60%] flex-1">
        <View className="mt-2 mb-2 h-10 flex-row items-center">
          <Pressable
            className="h-10 w-10 items-center justify-center rounded-full active:opacity-70"
            onPress={() => {
              if (step === 1) router.back();
              setStep((s) => (s > 1 ? ((s - 1) as Step) : s));
            }}
          >
            <AntDesign name="left" size={18} color="#18181b" />
          </Pressable>
        </View>

        <View className="mb-4 items-center">
          <Text className="text-lg font-extrabold text-zinc-900">
            {step === 1 && "Add your email 1 / 3"}
            {step === 2 && "Verify your email 2 / 3"}
            {step === 3 && "Create your password 3 / 3"}
          </Text>
          <ProgressDots step={step} />
        </View>

        {step === 1 && (
          <View className="flex-1">
            <Text className="mb-2 text-zinc-700">Email</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              inputMode="email"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              placeholder="you@example.com"
              className={`rounded-xl border bg-white px-4 py-3 text-base text-zinc-900 ${isValidEmail ? "border-zinc-300" : "border-red-400"}`}
            />

            {!isValidEmail && (
              <Text className="mt-2 text-xs text-red-500">
                Please enter a valid email
              </Text>
            )}

            {!sendingCodeSuccess && (
              <Text className="mt-2 text-xs text-red-500">
                An error occured sending the code
              </Text>
            )}

            <PrimaryButton
              label="Create an account"
              onPress={() => handleSendCode()}
              className="mt-4"
            />

            <FooterNote />
          </View>
        )}

        {step === 2 && (
          <View className="flex-1">
            <Text className="text-center text-zinc-500">
              We just sent 6-digit code to{"\n"}
              <Text className="font-semibold text-zinc-700">
                {email}, enter it below:
              </Text>
            </Text>

            <View className="mt-3">
              <OtpInput
                numberOfDigits={6}
                onTextChange={setCode}
                focusColor="red"
              />
            </View>

            <PrimaryButton
              label="Verify email"
              disabled={code.length < 5}
              onPress={() => {
                handleConnectWallet();
              }}
              className="mt-4"
            />

            <Text className="mt-3 text-center text-zinc-500">
              Wrong email?{" "}
              <Text className="font-semibold text-zinc-700">
                Send to different email
              </Text>
            </Text>

            <FooterNote />
          </View>
        )}

        {step === 3 && (
          <View className="flex-1">
            <Text className="mb-2 text-zinc-700">Password</Text>

            <View className="relative">
              <TextInput
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPass}
                placeholder="Enter Password"
                className="rounded-xl border border-zinc-300 bg-white px-4 py-3 pr-12 text-base text-zinc-900"
              />
              <Pressable
                onPress={() => setShowPass((s) => !s)}
                className="absolute right-3 top-3 h-8 w-8 items-center justify-center"
              >
                <Feather
                  name={showPass ? "eye" : "eye-off"}
                  size={18}
                  color="#6b7280"
                />
              </Pressable>
            </View>

            <View className="mt-2 h-1.5 w-full rounded-full bg-zinc-200">
              <View
                className="h-1.5 rounded-full bg-yellow-400"
                style={{ width: `${Math.round(passProgress * 100)}%` }}
              />
            </View>

            <View className="mt-3 gap-2">
              <ReqRow label="8 characters minimum" ok={passReqs.hasLen} />
              <ReqRow label="a number" ok={passReqs.hasNum} />
              <ReqRow label="one symbol minimum" ok={passReqs.hasSym} />
            </View>

            <PrimaryButton
              label="Continue"
              disabled={passProgress < 1}
              onPress={() => router.push("/auth/register/Success")}
              className="mt-5"
            />

            <FooterNote />
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

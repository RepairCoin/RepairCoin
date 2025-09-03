import { AntDesign, Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type Step = 1 | 2 | 3 | 4;

export default function RegisterWizard() {
  const [step, setStep] = useState<Step>(1);

  const [email, setEmail] = useState("");

  const CODE_LEN = 5;
  const [code, setCode] = useState<string[]>(Array(CODE_LEN).fill(""));
  const isCodeFilled = code.every(Boolean);

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

  const PrimaryButton = ({
    label,
    onPress,
    disabled,
    className = "",
  }: {
    label: string;
    onPress: () => void;
    disabled?: boolean;
    className?: string;
  }) => (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={`items-center justify-center rounded-2xl py-4 ${
        disabled ? "bg-yellow-300" : "bg-yellow-400 active:opacity-90"
      } ${className}`}
    >
      <Text className="font-semibold text-zinc-900">{label}</Text>
    </Pressable>
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

  const FooterNote = ({ className = "" }: { className?: string }) => (
    <View className={`mt-auto mb-6 items-center px-6 ${className}`}>
      <Text className="text-center text-xs text-zinc-400">
        By using ReparCoin, you agree to the{" "}
        <Text className="text-zinc-600 underline">Terms</Text> and{" "}
        <Text className="text-zinc-600 underline">Privacy Policy</Text>
      </Text>
    </View>
  );

  return (
    <SafeAreaView className="flex-1 items-center bg-zinc-100">
      <View className="w-[92%] md:w-[80%] lg:w-[60%] flex-1">
        <View className="mt-2 mb-2 h-10 flex-row items-center">
          {step !== 4 ? (
            <Pressable
              className="h-10 w-10 items-center justify-center rounded-full active:opacity-70"
              onPress={() => {
                if (step === 1) router.back();
                setStep((s) => (s > 1 ? ((s - 1) as Step) : s));
              }}
            >
              <AntDesign name="left" size={18} color="#18181b" />
            </Pressable>
          ) : (
            <View className="h-10 w-10" />
          )}
        </View>

        {step !== 4 && (
          <View className="mb-4 items-center">
            <Text className="text-lg font-extrabold text-zinc-900">
              {step === 1 && "Add your email 1 / 3"}
              {step === 2 && "Verify your email 2 / 3"}
              {step === 3 && "Create your password 3 / 3"}
            </Text>
            <ProgressDots step={step} />
          </View>
        )}

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
              className="rounded-xl border border-zinc-300 bg-white px-4 py-3 text-base text-zinc-900"
            />

            <PrimaryButton
              label="Create an account"
              onPress={() => setStep(2)}
              className="mt-4"
            />

            <FooterNote />
          </View>
        )}

        {step === 2 && (
          <View className="flex-1">
            <Text className="text-center text-zinc-500">
              We just sent 5-digit code to{"\n"}
              <Text className="font-semibold text-zinc-700">
                {email}, enter it below:
              </Text>
            </Text>

            <View className="mt-3 flex-row items-center justify-between">
              {code.map((ch, i) => (
                <TextInput
                  key={i}
                  value={ch}
                  onChangeText={(t) => {
                    const v = t.slice(-1).replace(/\s/g, "");
                    setCode((prev) => {
                      const copy = [...prev];
                      copy[i] = v;
                      return copy;
                    });
                  }}
                  keyboardType="number-pad"
                  maxLength={1}
                  className="h-12 flex-1 mx-1 rounded-lg border border-zinc-300 bg-white text-center text-base"
                />
              ))}
            </View>

            <PrimaryButton
              label="Verify email"
              disabled={!isCodeFilled}
              onPress={() => setStep(3)}
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
              onPress={() => setStep(4)}
              className="mt-5"
            />

            <FooterNote />
          </View>
        )}

        {step === 4 && (
          <View className="flex-1 items-center justify-center px-6">
            <View className="mb-6 h-20 w-20 items-center justify-center rounded-full bg-yellow-100">
              <AntDesign name="check" size={28} color="#EAB308" />
            </View>

            <Text className="text-center text-2xl font-extrabold text-zinc-800">
              Your account{"\n"}was successfully created!
            </Text>
            <Text className="mt-3 text-center text-zinc-500">
              Thanks for joining the movement. Let&apos;s turn every{"\n"}repair
              into real value.
            </Text>

            <PrimaryButton
              label="Log in"
              onPress={() => {}}
              className="mt-6 w-[80%]"
            />
            <FooterNote />
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

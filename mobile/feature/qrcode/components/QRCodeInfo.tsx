import { Text } from "react-native";

export default function QRCodeInfo() {
  return (
    <>
      <Text className="text-black text-3xl text-center font-extrabold mt-12">
        Your QR Code
      </Text>
      <Text className="text-black text-lg text-center mt-4">
        This QR Code belongs to your personal profile, and can be scanned by
        people and shops.
      </Text>
    </>
  );
}

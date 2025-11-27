import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  Alert,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { MaterialIcons } from '@expo/vector-icons';

interface QRScannerProps {
  visible: boolean;
  onClose: () => void;
  onScan: (data: string) => void;
}

const { width } = Dimensions.get('window');
const SCAN_AREA_SIZE = width * 0.7;

export function QRScanner({ visible, onClose, onScan }: QRScannerProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  useEffect(() => {
    if (visible && !permission?.granted) {
      requestPermission();
    }
    if (visible) {
      setScanned(false);
    }
  }, [visible]);

  const handleBarCodeScanned = ({ data }: { data: string }) => {
    if (scanned) return;
    
    setScanned(true);
    
    // Check if it's a valid Ethereum address
    if (data.startsWith('0x') && data.length === 42) {
      onScan(data);
      onClose();
    } else {
      Alert.alert(
        'Invalid QR Code',
        'Please scan a valid wallet address QR code.',
        [
          {
            text: 'Try Again',
            onPress: () => setScanned(false),
          },
        ]
      );
    }
  };

  if (!visible) return null;

  if (!permission) {
    return (
      <Modal visible={visible} animationType="slide" transparent={false}>
        <View className="flex-1 bg-zinc-950 justify-center items-center">
          <Text className="text-white text-lg">Requesting camera permission...</Text>
        </View>
      </Modal>
    );
  }

  if (!permission.granted) {
    return (
      <Modal visible={visible} animationType="slide" transparent={false}>
        <View className="flex-1 bg-zinc-950 justify-center items-center p-6">
          <MaterialIcons name="camera-alt" size={64} color="#666" />
          <Text className="text-white text-lg mt-4 text-center">
            Camera permission is required to scan QR codes
          </Text>
          <TouchableOpacity
            onPress={requestPermission}
            className="mt-4 bg-[#FFCC00] px-8 py-3 rounded-xl"
          >
            <Text className="text-black font-bold">Grant Permission</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onClose}
            className="mt-4"
          >
            <Text className="text-gray-400">Cancel</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <View className="flex-1 bg-black">
        <CameraView
          style={StyleSheet.absoluteFillObject}
          facing="back"
          onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
          barcodeScannerSettings={{
            barcodeTypes: ["qr"],
          }}
        />
        
        {/* Header */}
        <View className="absolute top-0 left-0 right-0 pt-16 px-4 pb-4 bg-black/50">
          <View className="flex-row justify-between items-center">
            <TouchableOpacity onPress={onClose} className="p-2">
              <MaterialIcons name="close" size={28} color="white" />
            </TouchableOpacity>
            <Text className="text-white text-lg font-bold">Scan QR Code</Text>
            <View className="w-12" />
          </View>
        </View>

        {/* Scan Area Overlay */}
        <View className="flex-1 justify-center items-center">
          <View 
            style={{
              width: SCAN_AREA_SIZE,
              height: SCAN_AREA_SIZE,
              borderWidth: 2,
              borderColor: '#FFCC00',
              borderRadius: 20,
              backgroundColor: 'transparent',
            }}
          >
            {/* Corner markers */}
            <View className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-[#FFCC00] rounded-tl-lg" />
            <View className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-[#FFCC00] rounded-tr-lg" />
            <View className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-[#FFCC00] rounded-bl-lg" />
            <View className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-[#FFCC00] rounded-br-lg" />
          </View>

          {/* Instructions */}
          <Text className="text-white text-base mt-8 text-center px-8">
            Position the wallet QR code within the frame
          </Text>
          
          {scanned && (
            <TouchableOpacity
              onPress={() => setScanned(false)}
              className="mt-4 bg-[#FFCC00] px-6 py-2 rounded-xl"
            >
              <Text className="text-black font-bold">Tap to Scan Again</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Bottom hint */}
        <View className="absolute bottom-0 left-0 right-0 pb-8 px-6 bg-black/50">
          <Text className="text-gray-400 text-center text-sm">
            Make sure the QR code is well-lit and clearly visible
          </Text>
        </View>
      </View>
    </Modal>
  );
}
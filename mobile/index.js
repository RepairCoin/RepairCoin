// CRITICAL: Polyfills must be imported FIRST before anything else
// This ensures crypto is available before thirdweb or any other library tries to use it
import "react-native-get-random-values";

// Now load the expo-router entry point
import "expo-router/entry";

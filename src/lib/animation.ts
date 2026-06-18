import { Platform } from "react-native";

/** `useNativeDriver` is unsupported on web — falls back to JS with a console warning. */
export const USE_NATIVE_DRIVER = Platform.OS !== "web";

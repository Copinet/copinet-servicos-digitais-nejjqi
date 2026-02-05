
import "react-native-reanimated";
import React, { useEffect } from "react";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { SystemBars } from "react-native-edge-to-edge";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useColorScheme } from "react-native";
import { useNetworkState } from "expo-network";
import {
  DarkTheme,
  DefaultTheme,
  Theme,
  ThemeProvider,
} from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { WidgetProvider } from "@/contexts/WidgetContext";
import { AuthProvider } from "@/contexts/AuthContext";

SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  initialRouteName: "(tabs)",
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const networkState = useNetworkState();
  const [loaded] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
  });
  const [authInitialized, setAuthInitialized] = React.useState(false);

  useEffect(() => {
    if (loaded) {
      // Give AuthProvider time to initialize before hiding splash
      setTimeout(() => {
        setAuthInitialized(true);
        SplashScreen.hideAsync();
      }, 500);
    }
  }, [loaded]);

  if (!loaded || !authInitialized) {
    return null;
  }

  const CustomDefaultTheme: Theme = {
    ...DefaultTheme,
    dark: false,
    colors: {
      primary: "rgb(212, 175, 55)",
      background: "rgb(245, 245, 245)",
      card: "rgb(255, 255, 255)",
      text: "rgb(44, 44, 44)",
      border: "rgb(224, 224, 224)",
      notification: "rgb(255, 215, 0)",
    },
  };

  const CustomDarkTheme: Theme = {
    ...DarkTheme,
    colors: {
      primary: "rgb(212, 175, 55)",
      background: "rgb(28, 28, 28)",
      card: "rgb(44, 44, 44)",
      text: "rgb(245, 245, 245)",
      border: "rgb(66, 66, 66)",
      notification: "rgb(255, 215, 0)",
    },
  };

  return (
    <>
      <StatusBar style="auto" animated />
      <ThemeProvider
        value={colorScheme === "dark" ? CustomDarkTheme : CustomDefaultTheme}
      >
        <AuthProvider>
          <WidgetProvider>
            <GestureHandlerRootView>
              <Stack>
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen name="auth" options={{ headerShown: false }} />
                <Stack.Screen name="auth-popup" options={{ headerShown: false }} />
                <Stack.Screen name="auth-callback" options={{ headerShown: false }} />
                <Stack.Screen 
                  name="service-detail" 
                  options={{ 
                    headerShown: true,
                    title: "Detalhes do Serviço",
                    headerBackTitle: "Voltar"
                  }} 
                />
                <Stack.Screen 
                  name="faca-sozinho-form" 
                  options={{ 
                    headerShown: true,
                    title: "Faça Sozinho",
                    headerBackTitle: "Voltar"
                  }} 
                />
                <Stack.Screen 
                  name="fazemos-pra-voce-form" 
                  options={{ 
                    headerShown: true,
                    title: "Fazemos pra Você",
                    headerBackTitle: "Voltar"
                  }} 
                />
                <Stack.Screen 
                  name="payment" 
                  options={{ 
                    headerShown: true,
                    title: "Pagamento",
                    headerBackTitle: "Voltar"
                  }} 
                />
                <Stack.Screen 
                  name="stores-map" 
                  options={{ 
                    headerShown: true,
                    title: "Nossas Lojas",
                    headerBackTitle: "Voltar"
                  }} 
                />
                <Stack.Screen name="+not-found" />
              </Stack>
              <SystemBars style={"auto"} />
            </GestureHandlerRootView>
          </WidgetProvider>
        </AuthProvider>
      </ThemeProvider>
    </>
  );
}

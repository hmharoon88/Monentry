import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '../src/context/AuthContext';
import { HouseholdProvider } from '../src/context/HouseholdContext';
import { SettleProvider } from '../src/context/SettleContext';
import { SubscriptionProvider } from '../src/context/SubscriptionContext';
import { ThemeProvider, useTheme } from '../src/context/ThemeContext';
import { TransactionProvider } from '../src/context/TransactionContext';

function RootNavigator() {
  const { colors, isDark } = useTheme();

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="add-entry"
          options={{
            presentation: 'modal',
            animation: 'slide_from_bottom',
          }}
        />
        <Stack.Screen
          name="sign-in"
          options={{
            presentation: 'modal',
            animation: 'slide_from_bottom',
          }}
        />
        <Stack.Screen
          name="join"
          options={{
            presentation: 'modal',
            animation: 'fade',
          }}
        />
        <Stack.Screen name="settle-ledger/[id]" />
        <Stack.Screen
          name="join-settle"
          options={{
            presentation: 'modal',
            animation: 'fade',
          }}
        />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthProvider>
            <SubscriptionProvider>
              <HouseholdProvider>
                <SettleProvider>
                  <TransactionProvider>
                    <RootNavigator />
                  </TransactionProvider>
                </SettleProvider>
              </HouseholdProvider>
            </SubscriptionProvider>
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useFonts, JetBrainsMono_400Regular } from '@expo-google-fonts/jetbrains-mono';
import { TaskProvider } from '../src/context/TaskContext';
import { BottomActionBar } from '../src/components/BottomActionBar';
import { Colors } from '../src/theme';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ JetBrainsMono_400Regular });
  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={styles.root}>
      <StatusBar style="light" />
      <TaskProvider>
        <View style={styles.root}>
          <Stack
            screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Colors.background } }}
          >
            <Stack.Screen name="index" />
            <Stack.Screen name="focus" />
            <Stack.Screen name="list" />
            <Stack.Screen name="search" />
            <Stack.Screen name="report" />
            <Stack.Screen name="settings" />
            <Stack.Screen
              name="task/[line]"
              options={{ presentation: 'formSheet', headerShown: false }}
            />
          </Stack>
          <BottomActionBar />
        </View>
      </TaskProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
});

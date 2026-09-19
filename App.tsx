import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { HomeScreen } from './src/screens/HomeScreen';
import { CreateBillScreen } from './src/screens/CreateBillScreen';
import { BillDetailScreen } from './src/screens/BillDetailScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { COLORS } from './src/constants/theme';

export type RootStackParamList = {
  Home: undefined;
  CreateBill: { editBillId?: string } | undefined;
  BillDetail: { billId: string };
  Settings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <NavigationContainer>
      <StatusBar style="light" />
      <Stack.Navigator
        initialRouteName="Home"
        screenOptions={{
          headerStyle: {
            backgroundColor: COLORS.primary,
          },
          headerTintColor: '#FFFFFF',
          headerTitleStyle: {
            fontWeight: '800',
          },
          contentStyle: {
            backgroundColor: COLORS.background,
          },
        }}
      >
        <Stack.Screen
          name="Home"
          component={HomeScreen}
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="CreateBill"
          component={CreateBillScreen}
          options={({ route }) => ({
            title: route.params?.editBillId ? 'Edit Bill / Quotation' : 'New Bill / Quotation',
          })}
        />
        <Stack.Screen
          name="BillDetail"
          component={BillDetailScreen}
          options={{
            title: 'Bill Letterhead Preview',
          }}
        />
        <Stack.Screen
          name="Settings"
          component={SettingsScreen}
          options={{
            title: 'Contractor Profile Settings',
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

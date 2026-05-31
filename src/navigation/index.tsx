import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { colors } from '../theme';
import type {
  HistoryStackParamList,
  HomeStackParamList,
  MainTabParamList,
  PetsStackParamList,
  RootStackParamList,
  SettingsStackParamList,
} from './types';
import { LaunchScreen } from '../screens/LaunchScreen';
import { DisclaimerScreen } from '../screens/DisclaimerScreen';
import HomeScreen from '../screens/HomeScreen';
import { ProductSearchScreen } from '../screens/ProductSearchScreen';
import { ResultScreen } from '../screens/ResultScreen';
import HistoryScreen from '../screens/HistoryScreen';
import PetsScreen from '../screens/PetsScreen';
import AddPetScreen from '../screens/AddPetScreen';
import EditPetScreen from '../screens/EditPetScreen';
import SettingsScreen from '../screens/SettingsScreen';
import { TwoStepScanScreen } from '../screens/TwoStepScanScreen';
import { ManualIngredientsScreen } from '../screens/ManualIngredientsScreen';
import { FoodCheckScreen } from '../screens/FoodCheckScreen';
import SignupScreen from '../screens/SignupScreen';
import LoginScreen from '../screens/LoginScreen';

const RootStack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();
const HomeStack = createNativeStackNavigator<HomeStackParamList>();
const HistoryStack = createNativeStackNavigator<HistoryStackParamList>();
const PetsStack = createNativeStackNavigator<PetsStackParamList>();
const SettingsStack = createNativeStackNavigator<SettingsStackParamList>();

function HomeStackNavigator() {
  return (
    <HomeStack.Navigator screenOptions={{ headerShown: false }}>
      <HomeStack.Screen name="Home" component={HomeScreen} />
      <HomeStack.Screen name="ProductSearch" component={ProductSearchScreen} />
      <HomeStack.Screen name="Result" component={ResultScreen} />
      <HomeStack.Screen
        name="TwoStepScan"
        component={TwoStepScanScreen}
        options={{ presentation: 'fullScreenModal', headerShown: false }}
      />
      <HomeStack.Screen
        name="ManualIngredients"
        component={ManualIngredientsScreen}
        options={{ presentation: 'fullScreenModal', headerShown: false }}
      />
      <HomeStack.Screen
        name="FoodCheck"
        component={FoodCheckScreen}
        options={{ presentation: 'fullScreenModal', headerShown: false }}
      />
      <HomeStack.Screen
        name="AddPet"
        component={AddPetScreen}
        options={{ presentation: 'modal', headerShown: false }}
      />
    </HomeStack.Navigator>
  );
}

function HistoryStackNavigator() {
  return (
    <HistoryStack.Navigator screenOptions={{ headerShown: false }}>
      <HistoryStack.Screen name="History" component={HistoryScreen} />
      <HistoryStack.Screen name="Result" component={ResultScreen} />
    </HistoryStack.Navigator>
  );
}

function PetsStackNavigator() {
  return (
    <PetsStack.Navigator screenOptions={{ headerShown: false }}>
      <PetsStack.Screen name="Pets" component={PetsScreen} />
      <PetsStack.Screen
        name="AddPet"
        component={AddPetScreen}
        options={{ presentation: 'modal', headerShown: false }}
      />
      <PetsStack.Screen
        name="EditPet"
        component={EditPetScreen}
        options={{ presentation: 'modal', headerShown: false }}
      />
    </PetsStack.Navigator>
  );
}

function SettingsStackNavigator() {
  return (
    <SettingsStack.Navigator screenOptions={{ headerShown: false }}>
      <SettingsStack.Screen name="Settings" component={SettingsScreen} />
    </SettingsStack.Navigator>
  );
}

function MainTabsNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: { backgroundColor: colors.white },
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeStackNavigator}
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="HistoryTab"
        component={HistoryStackNavigator}
        options={{
          title: 'History',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'time' : 'time-outline'} color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="PetsTab"
        component={PetsStackNavigator}
        options={{
          title: 'Pets',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'paw' : 'paw-outline'} color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="SettingsTab"
        component={SettingsStackNavigator}
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'settings' : 'settings-outline'} color={color} size={size} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

function RootStackNavigator() {
  useApp();

  return (
    <RootStack.Navigator screenOptions={{ headerShown: false }} initialRouteName="Launch">
      <RootStack.Screen name="Launch" component={LaunchScreen} />
      <RootStack.Screen name="Disclaimer" component={DisclaimerScreen} />
      <RootStack.Screen name="Signup" component={SignupScreen} />
      <RootStack.Screen name="Login" component={LoginScreen} />
      <RootStack.Screen name="MainTabs" component={MainTabsNavigator} />
    </RootStack.Navigator>
  );
}

export function RootNavigator() {
  return (
    <NavigationContainer>
      <RootStackNavigator />
    </NavigationContainer>
  );
}

export type {
  HistoryStackParamList,
  HomeStackParamList,
  MainTabParamList,
  PetsStackParamList,
  RootStackParamList,
  SettingsStackParamList,
} from './types';

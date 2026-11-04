import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from '@features/auth/screens/LoginScreen';
import SignupScreen from '@features/auth/screens/SignupScreen';
import OtpVerificationScreen from '@features/auth/screens/OtpVerificationScreen';
import ForgotPasswordScreen from '@features/auth/screens/ForgotPasswordScreen';
import ResetPasswordScreen from '@features/auth/screens/ResetPasswordScreen';
import { AUTH_ROUTES } from './routes';

const Stack = createNativeStackNavigator();

const AuthNavigator = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name={AUTH_ROUTES.login} component={LoginScreen} />
    <Stack.Screen name={AUTH_ROUTES.signup} component={SignupScreen} />
    <Stack.Screen name={AUTH_ROUTES.otpVerification} component={OtpVerificationScreen} />
    <Stack.Screen name={AUTH_ROUTES.forgotPassword} component={ForgotPasswordScreen} />
    <Stack.Screen name={AUTH_ROUTES.resetPassword} component={ResetPasswordScreen} />
  </Stack.Navigator>
);

export default AuthNavigator;

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from '@features/auth/screens/LoginScreen';
import ForgotPasswordScreen from '@features/auth/screens/ForgotPasswordScreen';
import ResetPasswordScreen from '@features/auth/screens/ResetPasswordScreen';
import PrivacyPolicyScreen from '@features/settings/screens/PrivacyPolicyScreen';
import TermsConditionsScreen from '@features/settings/screens/TermsConditionsScreen';
import { AUTH_ROUTES } from './routes';

const Stack = createNativeStackNavigator();

const AuthNavigator = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name={AUTH_ROUTES.login} component={LoginScreen} />
    <Stack.Screen name={AUTH_ROUTES.signup} component={LoginScreen} />
    <Stack.Screen name={AUTH_ROUTES.otpVerification} component={LoginScreen} />
    <Stack.Screen name={AUTH_ROUTES.forgotPassword} component={ForgotPasswordScreen} />
    <Stack.Screen name={AUTH_ROUTES.resetPassword} component={ResetPasswordScreen} />
    {/* Read from the sign-in screen's terms line; the pages are public, so no account is needed. */}
    <Stack.Screen name="TermsConditions" component={TermsConditionsScreen} />
    <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
  </Stack.Navigator>
);

export default AuthNavigator;

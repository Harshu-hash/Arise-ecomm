import React from 'react';
import { useSelector } from 'react-redux';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import OnboardingScreen from '@features/onboarding/screens/OnboardingScreen';
import { selectHasCompletedOnboarding } from '@features/onboarding/redux/onboarding.selectors';
import AuthNavigator from './AuthNavigator';
import CustomerNavigator from './CustomerNavigator';
import { ROOT_ROUTES } from './routes';

const Stack = createNativeStackNavigator();

const RootNavigator = () => {
  const onboardingCompleted = useSelector(selectHasCompletedOnboarding);

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!onboardingCompleted ? (
        <Stack.Screen name={ROOT_ROUTES.onboarding} component={OnboardingScreen} />
      ) : (
        <>
          <Stack.Screen name={ROOT_ROUTES.customer} component={CustomerNavigator} />
          <Stack.Screen
            name={ROOT_ROUTES.auth}
            component={AuthNavigator}
            options={{ presentation: 'fullScreenModal' }}
          />
        </>
      )}
    </Stack.Navigator>
  );
};

export default RootNavigator;

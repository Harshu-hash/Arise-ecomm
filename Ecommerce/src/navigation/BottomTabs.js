import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import HomeScreen from '../features/home/screens/HomeScreen';
import { PlayScreen } from '../features/play';
import CategoryScreen from '../features/category/screens/CategoryScreen';
import ProfileScreen from '../features/profile/screens/ProfileScreen';
import CartScreen from '../features/cart/screens/CartScreen';
import CustomTabBar from './CustomTabBar';

const Tab = createBottomTabNavigator();

const BottomTabs = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          elevation: 0,
          shadowOpacity: 0,
        },
      }}
      tabBar={(props) => <CustomTabBar {...props} />}>
      <Tab.Screen name="Home" component={HomeScreen} options={{ tabBarLabel: 'Home' }} />
      <Tab.Screen name="Play" component={PlayScreen} options={{ tabBarLabel: 'Play' }} />
      <Tab.Screen name="Categories" component={CategoryScreen} options={{ tabBarLabel: 'Categories' }} />
      <Tab.Screen name="Account" component={ProfileScreen} options={{ tabBarLabel: 'Account' }} />
      <Tab.Screen
        name="Cart"
        component={CartScreen}
        options={{ tabBarLabel: 'Cart', tabBarStyle: { display: 'none' } }}
      />
    </Tab.Navigator>
  );
};

export default BottomTabs;

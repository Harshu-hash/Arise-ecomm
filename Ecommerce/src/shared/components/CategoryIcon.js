import React from 'react';
import Ionicons from 'react-native-vector-icons/Ionicons';

// Keys are the icon values the admin panel saves; glyphs match the ones shown in its picker.
const GLYPHS = {
  'shopping-bag': 'bag-handle-outline',
  tag: 'shirt-outline',
  smartphone: 'phone-portrait-outline',
  monitor: 'laptop-outline',
  home: 'home-outline',
  gift: 'gift-outline',
  headphones: 'headset-outline',
  'book-open': 'book-outline',
  camera: 'camera-outline',
  coffee: 'cafe-outline',
  award: 'trophy-outline',
  truck: 'car-outline',
  'shopping-cart': 'cart-outline',
  package: 'cube-outline',
  watch: 'time-outline',
  heart: 'heart-outline',
  star: 'star-outline',
  tool: 'construct-outline',
  wifi: 'wifi-outline',
  printer: 'print-outline',
  scissors: 'cut-outline',
  image: 'image-outline',
  video: 'videocam-outline',
  globe: 'globe-outline',
  'map-pin': 'location-outline',
  shield: 'shield-checkmark-outline',
  key: 'key-outline',
  users: 'people-outline',
  zap: 'flash-outline',
  'play-circle': 'play-circle-outline',
};

const CategoryIcon = ({ name, size = 22, color }) => (
  <Ionicons name={GLYPHS[name] ?? 'grid-outline'} size={size} color={color} />
);

export default CategoryIcon;

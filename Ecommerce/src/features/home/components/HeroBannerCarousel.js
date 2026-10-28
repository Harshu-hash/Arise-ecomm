import React, { useState, useRef } from 'react';
import { View, Image, StyleSheet, Dimensions, FlatList } from 'react-native';
import LottieView from 'lottie-react-native';
import { COLORS } from '../../../constants/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/** Full-bleed campaign creative carousel with line/dot pagination, sat below the gradient header. */
const HeroBannerCarousel = ({ banners }) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const onScroll = useRef((e) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    setActiveIndex(idx);
  }).current;

  return (
    <View style={styles.wrapper}>
      <FlatList
        data={banners}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.id}
        onScroll={onScroll}
        scrollEventThrottle={16}
        renderItem={({ item }) => (
          <Image 
            source={typeof item.image === 'string' ? { uri: item.image } : item.image} 
            style={styles.image} 
            resizeMode="cover" 
          />
        )}
      />
      <View style={styles.dotsRow}>
        {banners.map((b, i) => (
          <View key={b.id} style={[styles.dot, i === activeIndex && styles.dotActive]} />
        ))}
      </View>
      <View style={styles.lottieContainer} pointerEvents="none">
        <LottieView
          source={require('../../../../assets/animations/delivery.json')}
          autoPlay
          loop
          style={styles.lottieAnimation}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: COLORS.white,
  },
  image: {
    width: SCREEN_WIDTH,
    height: 190,
    backgroundColor: COLORS.white,
  },
  dotsRow: {
    position: 'absolute',
    bottom: 28,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.6)',
    marginHorizontal: 3,
  },
  dotActive: {
    width: 16,
    backgroundColor: COLORS.white,
  },
  lottieContainer: {
    position: 'absolute',
    bottom: 10,
    right: 15,
    width: 80,
    height: 80,
    zIndex: 10,
    elevation: 10,
  },
  lottieAnimation: {
    width: '100%',
    height: '100%',
  },
});

export default HeroBannerCarousel;

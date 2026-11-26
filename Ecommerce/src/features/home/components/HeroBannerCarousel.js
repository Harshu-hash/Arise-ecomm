import React, { useState, useRef } from 'react';
import { View, Image, StyleSheet, Dimensions, FlatList } from 'react-native';
import { COLORS } from '../../../constants/colors';

// loaded when first needed, so a build without the native module still shows image banners
let Video = null;
try {
  Video = require('react-native-video').default;
} catch {
  Video = null;
}

// An app build made before react-native-video was installed has the JS but not the native view, and rendering it throws.
// Catch that here so the home screen keeps working (the video banner stays blank until the app is rebuilt).
class VideoGuard extends React.Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    // keep the banner's slot: with nothing in it the carousel row would collapse to zero height
    return this.state.failed ? <View style={styles.image} /> : this.props.children;
  }
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/** Full-bleed campaign creative carousel with line/dot pagination, sat below the gradient header. */
const HeroBannerCarousel = ({ banners }) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const onScroll = useRef(e => {
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
        keyExtractor={item => item.id}
        onScroll={onScroll}
        scrollEventThrottle={16}
        extraData={activeIndex}
        renderItem={({ item, index }) =>
          item.video ? (
            <VideoGuard>
              <Video
                source={{ uri: item.video }}
                style={styles.image}
                resizeMode="cover"
                repeat
                muted
                paused={index !== activeIndex} // only the banner in view plays
                playInBackground={false}
                disableFocus
              />
            </VideoGuard>
          ) : item.image ? (
            <Image
              source={typeof item.image === 'string' ? { uri: item.image } : item.image}
              style={styles.image}
              resizeMode="cover"
            />
          ) : null
        }
      />
      <View style={styles.dotsRow}>
        {banners.map((b, i) => (
          <View key={b.id} style={[styles.dot, i === activeIndex && styles.dotActive]} />
        ))}
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
});

export default HeroBannerCarousel;

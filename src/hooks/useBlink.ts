import { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';

/** Valeur animée qui oscille entre `low` et 1 (clignotement doux, thread natif). */
export function useBlink(period = 900, enabled = true, low = 0.25) {
  const v = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!enabled) {
      v.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: low, duration: period / 2, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(v, { toValue: 1, duration: period / 2, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v, period, enabled, low]);
  return v;
}

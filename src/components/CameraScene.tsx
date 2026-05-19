import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';

/**
 * Stylised camera viewfinder placeholder.
 *
 * Used in Scan, Disambiguate, Result, and the home Bug-of-the-day hero.
 * Renders a soft radial backdrop + leaf silhouettes + an abstract butterfly
 * silhouette in the middle. The `dark` variant tints it like night-mode
 * camera, the light variant is for results / preview cards.
 */
export function CameraScene({ dark = true }: { dark?: boolean }) {
  return (
    <View style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%" viewBox="0 0 360 720" preserveAspectRatio="xMidYMid slice">
        <Defs>
          <RadialGradient id="bg" cx="50%" cy="60%" r="80%">
            <Stop offset="0%"   stopColor={dark ? '#2d3a2a' : '#d8e0c4'} />
            <Stop offset="70%"  stopColor={dark ? '#0e1410' : '#a4ad8b'} />
            <Stop offset="100%" stopColor={dark ? '#050805' : '#7a8466'} />
          </RadialGradient>
          <RadialGradient id="bug-body" cx="50%" cy="40%" r="60%">
            <Stop offset="0%"   stopColor="#f4a93a" />
            <Stop offset="60%"  stopColor="#c44a1a" />
            <Stop offset="100%" stopColor="#3a1208" />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width={360} height={720} fill="url(#bg)" />
        {/* Leaf silhouettes */}
        <Ellipse cx={60}  cy={120} rx={80}  ry={180} fill="#1a2a18" opacity={dark ? 0.25 : 0.4} transform="rotate(-20 60 120)" />
        <Ellipse cx={320} cy={200} rx={60}  ry={140} fill="#1a2a18" opacity={dark ? 0.25 : 0.4} transform="rotate(30 320 200)" />
        <Ellipse cx={280} cy={600} rx={100} ry={200} fill="#0e1610" opacity={dark ? 0.25 : 0.4} transform="rotate(-15 280 600)" />

        {/* Stylised butterfly */}
        <Svg x={90} y={270} width={180} height={180} viewBox="0 0 180 180">
          <Ellipse cx={55}  cy={80}  rx={50} ry={62} fill="#e8782c" opacity={0.92} transform="rotate(-15 55 80)" />
          <Ellipse cx={125} cy={80}  rx={50} ry={62} fill="#e8782c" opacity={0.92} transform="rotate(15 125 80)" />
          <Ellipse cx={55}  cy={80}  rx={32} ry={38} fill="#1a0a04" opacity={0.65} transform="rotate(-15 55 80)" />
          <Ellipse cx={125} cy={80}  rx={32} ry={38} fill="#1a0a04" opacity={0.65} transform="rotate(15 125 80)" />
          <Circle cx={38}  cy={68}  r={6}  fill="#ffe4a8" />
          <Circle cx={142} cy={68}  r={6}  fill="#ffe4a8" />
          <Circle cx={42}  cy={100} r={4}  fill="#ffe4a8" />
          <Circle cx={138} cy={100} r={4}  fill="#ffe4a8" />
          <Ellipse cx={90} cy={90} rx={9} ry={55} fill="url(#bug-body)" />
          <Circle cx={90} cy={40} r={11} fill="#1a0a04" />
          <Path d="M84,32 Q70,18 65,8"  stroke="#1a0a04" strokeWidth={2} fill="none" strokeLinecap="round" />
          <Path d="M96,32 Q110,18 115,8" stroke="#1a0a04" strokeWidth={2} fill="none" strokeLinecap="round" />
          <Circle cx={65}  cy={8} r={2} fill="#1a0a04" />
          <Circle cx={115} cy={8} r={2} fill="#1a0a04" />
        </Svg>
      </Svg>
    </View>
  );
}

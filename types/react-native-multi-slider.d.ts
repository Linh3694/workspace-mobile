declare module 'react-native-multi-slider' {
  import { Component } from 'react';
  import { ViewStyle } from 'react-native';

  interface MultiSliderProps {
    values: number[];
    sliderLength?: number;
    onValuesChange?: (values: number[]) => void;
    onValuesChangeStart?: () => void;
    onValuesChangeFinish?: (values: number[]) => void;
    min?: number;
    max?: number;
    step?: number;
    allowOverlap?: boolean;
    snapped?: boolean;
    selectedStyle?: ViewStyle;
    unselectedStyle?: ViewStyle;
    markerStyle?: ViewStyle;
    pressedMarkerStyle?: ViewStyle;
    trackStyle?: ViewStyle;
    touchDimensions?: {
      height: number;
      width: number;
      borderRadius: number;
      slipDisplacement: number;
    };
    customMarker?: () => JSX.Element;
    customMarkerLeft?: () => JSX.Element;
    customMarkerRight?: () => JSX.Element;
    isMarkersSeparated?: boolean;
    imageBackgroundSource?: any;
    markerOffsetX?: number;
    markerOffsetY?: number;
    minMarkerOverlapDistance?: number;
    optionsArray?: number[];
    containerStyle?: ViewStyle;
    sliderContainerStyle?: ViewStyle;
    markerContainerStyle?: ViewStyle;
    trackContainerStyle?: ViewStyle;
    vertical?: boolean;
  }

  export default class MultiSlider extends Component<MultiSliderProps> {}
} 
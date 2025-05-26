import React from 'react';
import { BaseToast, ErrorToast } from 'react-native-toast-message';

const centeredToastStyle = {
  borderRadius: 10,
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 60,
  marginHorizontal: 10,
};

const centeredText1Style = {
  fontSize: 16,
  fontWeight: 'bold',
  color: '#166534',
  textAlign: 'center',
};

const centeredText2Style = {
  fontSize: 14,
  color: '#166534',
  textAlign: 'center',
};

const CustomToastConfig = {
  success: (props: any) => (
    <BaseToast
      {...props}
      style={{ ...centeredToastStyle, backgroundColor: '#f0fdf4', borderLeftWidth: 0, minWidth: 150, maxWidth: 350 }}
      contentContainerStyle={{ alignItems: 'center', justifyContent: 'center', width: '85%' }}
      text1Style={{ ...centeredText1Style, color: '#166534' }}
      text2Style={{ ...centeredText2Style, color: '#166534' }}
    />
  ),
  error: (props: any) => (
    <ErrorToast
      {...props}
      style={{ ...centeredToastStyle, backgroundColor: '#fef2f2', borderLeftWidth: 0, minWidth: 150, maxWidth: 350 }}
      contentContainerStyle={{ alignItems: 'center', justifyContent: 'center', width: '85%' }}
      text1Style={{ ...centeredText1Style, color: '#991b1b' }}
      text2Style={{ ...centeredText2Style, color: '#991b1b' }}
    />
  ),
  info: (props: any) => (
    <BaseToast
      {...props}
      style={{ ...centeredToastStyle, backgroundColor: '#f0f9ff', borderLeftWidth: 0, minWidth: 150, maxWidth: 350 }}
      contentContainerStyle={{ alignItems: 'center', justifyContent: 'center', width: '85%' }}
      text1Style={{ ...centeredText1Style, color: '#0369a1' }}
      text2Style={{ ...centeredText2Style, color: '#0369a1' }}
    />
  ),
};

export default CustomToastConfig; 
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';

export const useLanguage = () => {
  const { i18n, t } = useTranslation();

  const currentLanguage = i18n.language;

  const availableLanguages = [
    { code: 'vi', name: t('profile.vietnamese'), nativeName: 'Tiếng Việt' },
    { code: 'en', name: t('profile.english'), nativeName: 'English' },
  ];

  const getCurrentLanguageName = () => {
    const current = availableLanguages.find((lang) => lang.code === currentLanguage);
    return current?.nativeName || 'Tiếng Việt';
  };

  const changeLanguage = async (languageCode: string) => {
    try {
      await i18n.changeLanguage(languageCode);
      await AsyncStorage.setItem('userLanguage', languageCode);
      Alert.alert(t('common.success'), t('profile.language_changed'));
    } catch (error) {
      console.error('Error changing language:', error);
      Alert.alert(t('common.error'), 'Could not change language');
    }
  };

  const showLanguageSelector = () => {
    const options = availableLanguages.map((lang) => lang.nativeName);

    Alert.alert(t('profile.change_language'), '', [
      ...availableLanguages.map((lang) => ({
        text: lang.nativeName + (lang.code === currentLanguage ? ' ✓' : ''),
        onPress: () => {
          if (lang.code !== currentLanguage) {
            changeLanguage(lang.code);
          }
        },
      })),
      {
        text: t('common.cancel'),
        style: 'cancel' as const,
      },
    ]);
  };

  return {
    currentLanguage,
    availableLanguages,
    getCurrentLanguageName,
    changeLanguage,
    showLanguageSelector,
    t,
  };
};

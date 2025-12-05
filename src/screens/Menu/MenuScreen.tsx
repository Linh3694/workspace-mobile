import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  addMonths,
  isSameMonth,
  isToday,
  isSameDay,
} from 'date-fns';
import { vi } from 'date-fns/locale';
import { useLanguage } from '../../hooks/useLanguage';
import menuService, {
  type BuffetEvent,
  type DailyMenuData,
  type MealData,
} from '../../services/menuService';
import { getApiBaseUrl } from '../../config/constants';

const { width: screenWidth } = Dimensions.get('window');
const ITEM_WIDTH = (screenWidth - 48) / 2; // 2 columns with padding

// Helper function to get full image URL
const getFullImageUrl = (imagePath: string | null | undefined): string => {
  if (!imagePath) return '';
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    return imagePath;
  }
  return `${getApiBaseUrl()}${imagePath}`;
};

// Static calorie data based on meal type
const getStaticCalories = (mealType: string): { elementary: string; secondary: string } => {
  const calorieMap: Record<string, { elementary: string; secondary: string }> = {
    breakfast: { elementary: '356-534', secondary: '500-750' },
    lunch: { elementary: '535-713', secondary: '750-1000' },
    dinner: { elementary: '89.2-178.3', secondary: '125-250' },
    snack: { elementary: '200-300', secondary: '250-350' },
  };

  return calorieMap[mealType.toLowerCase()] || { elementary: '400-500', secondary: '500-600' };
};

// Helper function to get meal display name
const getMealDisplayName = (mealType: string, t: (key: string) => string): string => {
  const mealTypeKey = mealType.toLowerCase() as keyof typeof mealTypes;
  const mealTypes = {
    breakfast: 'menu.mealTypes.breakfast',
    lunch: 'menu.mealTypes.lunch',
    dinner: 'menu.mealTypes.dinner',
    snack: 'menu.mealTypes.snack',
  };

  return mealTypes[mealTypeKey] ? t(mealTypes[mealTypeKey]) : mealType;
};

// Helper function to get breakfast option display name - giống parent portal
const getBreakfastOptionDisplayName = (optionKey: string, t: (key: string) => string): string => {
  const optionTypes: Record<string, string> = {
    option1: 'menu.breakfastOptions.option1',
    option2: 'menu.breakfastOptions.option2',
    external: 'menu.breakfastOptions.external',
  };

  return optionTypes[optionKey] ? t(optionTypes[optionKey]) : optionKey;
};

// Helper function to get lunch set dishes
const getLunchSetDishes = (
  meal: MealData,
  setType: string
): { image: string; name: string; itemType: string }[] => {
  const dishes: { image: string; name: string; itemType: string }[] = [];
  let items: any[] = [];

  switch (setType) {
    case 'set_a':
      items = meal.set_a_config?.items || [];
      break;
    case 'set_au':
      items = meal.set_au_config?.items || [];
      break;
    case 'eat_clean':
      items = meal.eat_clean_config?.items || [];
      break;
  }

  items.forEach((item: any, index: number) => {
    const imageUrl = item.menu_category_details?.image_url
      ? getFullImageUrl(item.menu_category_details.image_url)
      : '';
    dishes.push({
      image: imageUrl,
      name:
        item.menu_category_details?.display_name ||
        item.menu_category_details?.title_vn ||
        'Món ăn',
      itemType: `Lựa chọn ${index + 1}`,
    });
  });

  return dishes;
};

// Helper function to get dinner dishes by education stage
const getDinnerDishesByStage = (
  meal: MealData,
  educationStage: string
): { image: string; name: string; optionType: string; index: number }[] => {
  const dishes: { image: string; name: string; optionType: string; index: number }[] = [];
  let optionIndex = 0;

  if (meal.dinner_items) {
    meal.dinner_items.forEach((item: any) => {
      if (item.education_stage === educationStage) {
        optionIndex++;
        const imageUrl = item.menu_category_details?.image_url
          ? getFullImageUrl(item.menu_category_details.image_url)
          : '';
        dishes.push({
          image: imageUrl,
          name:
            item.menu_category_details?.display_name ||
            item.menu_category_details?.title_vn ||
            'Món ăn',
          optionType: item.option_type || 'snack',
          index: optionIndex,
        });
      }
    });
  }

  return dishes;
};

// Helper function to collect all available dishes with images and names
const getMealDishes = (
  meal: MealData
): { image: string; name: string; optionType?: string; index: number }[] => {
  const dishes: { image: string; name: string; optionType?: string; index: number }[] = [];
  let optionIndex = 0;

  // Special handling for breakfast - include option type
  if (meal.meal_type === 'breakfast' && meal.breakfast_options) {
    Object.entries(meal.breakfast_options).forEach(([optionKey, option]: [string, any]) => {
      optionIndex++;
      const imageUrl = option.menu_category_details?.image_url
        ? getFullImageUrl(option.menu_category_details.image_url)
        : '';
      dishes.push({
        image: imageUrl,
        name:
          option.menu_category_details?.display_name ||
          option.menu_category_details?.title_vn ||
          'Món ăn',
        optionType: optionKey,
        index: optionIndex,
      });
    });
  } else {
    // Collect from dinner_items
    if (meal.dinner_items) {
      meal.dinner_items.forEach((item: any) => {
        if (item.menu_category_details?.image_url) {
          optionIndex++;
          dishes.push({
            image: getFullImageUrl(item.menu_category_details.image_url),
            name: item.menu_category_details.display_name || item.menu_category_details.title_vn,
            index: optionIndex,
          });
        }
      });
    }

    // Collect from lunch sets
    if (meal.set_a_config?.items) {
      meal.set_a_config.items.forEach((item: any) => {
        if (item.menu_category_details?.image_url) {
          optionIndex++;
          dishes.push({
            image: getFullImageUrl(item.menu_category_details.image_url),
            name: item.menu_category_details.display_name || item.menu_category_details.title_vn,
            index: optionIndex,
          });
        }
      });
    }

    if (meal.set_au_config?.items) {
      meal.set_au_config.items.forEach((item: any) => {
        if (item.menu_category_details?.image_url) {
          optionIndex++;
          dishes.push({
            image: getFullImageUrl(item.menu_category_details.image_url),
            name: item.menu_category_details.display_name || item.menu_category_details.title_vn,
            index: optionIndex,
          });
        }
      });
    }

    if (meal.eat_clean_config?.items) {
      meal.eat_clean_config.items.forEach((item: any) => {
        if (item.menu_category_details?.image_url) {
          optionIndex++;
          dishes.push({
            image: getFullImageUrl(item.menu_category_details.image_url),
            name: item.menu_category_details.display_name || item.menu_category_details.title_vn,
            index: optionIndex,
          });
        }
      });
    }

    // Collect from buffet_config
    if (meal.buffet_config?.items) {
      meal.buffet_config.items.forEach((item: any) => {
        if (item.menu_category_details?.image_url) {
          optionIndex++;
          dishes.push({
            image: getFullImageUrl(item.menu_category_details.image_url),
            name: item.menu_category_details.display_name || item.menu_category_details.title_vn,
            index: optionIndex,
          });
        }
      });
    }
  }

  // Remove duplicates based on image URL and return up to 6 dishes
  const uniqueDishes = dishes.filter((dish, index, self) => {
    if (!dish.image) return true;
    return index === self.findIndex((d) => d.image === dish.image);
  });

  return uniqueDishes.slice(0, 6);
};

// Vietnamese day labels - T ở trên, số ở dưới
const VI_DAY_LABELS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

const MenuScreen = () => {
  const navigation = useNavigation();
  const { t } = useLanguage();

  // Always use Vietnamese locale for calendar
  const dateLocale = vi;

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [mealDetails, setMealDetails] = useState<DailyMenuData | null>(null);
  const [buffetEvents, setBuffetEvents] = useState<BuffetEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Generate month selector data (5 months: -2, -1, 0, +1, +2)
  const monthSelectorData = useMemo(() => {
    const months = [];
    for (let i = -2; i <= 2; i++) {
      const monthDate = addMonths(currentMonth, i);
      const monthName = format(monthDate, 'MMMM', { locale: vi });
      const formattedMonthName = monthName.charAt(0).toUpperCase() + monthName.slice(1);

      months.push({
        date: monthDate,
        formatted: formattedMonthName,
        isCurrent: i === 0,
        offset: i,
      });
    }
    return months;
  }, [currentMonth]);

  // Generate calendar days for current month
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

    const calendarGrid: (Date | null)[][] = [];
    let week: (Date | null)[] = [];

    const firstDayOfMonth = monthStart;
    const firstDayOfWeek = getDay(firstDayOfMonth);
    const mondayOffset = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;

    for (let i = 0; i < mondayOffset; i++) {
      week.push(null);
    }

    days.forEach((day) => {
      if (week.length === 7) {
        calendarGrid.push(week);
        week = [];
      }
      week.push(day);
    });

    while (week.length < 7) {
      week.push(null);
    }
    calendarGrid.push(week);

    return calendarGrid;
  }, [currentMonth]);

  // Fetch menu data
  const fetchMenuData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await menuService.getDailyMenuByDate(selectedDate);
      if (response.success && response.data) {
        setMealDetails(response.data);
      } else {
        setMealDetails(null);
      }
    } catch (error) {
      console.error('Error fetching menu:', error);
      setMealDetails(null);
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  // Fetch buffet events
  const fetchBuffetEvents = useCallback(async () => {
    try {
      const response = await menuService.getBuffetEventsByMonth(currentMonth);
      if (response.success && response.data) {
        setBuffetEvents(response.data);
      } else {
        setBuffetEvents([]);
      }
    } catch (error) {
      console.error('Error fetching buffet events:', error);
      setBuffetEvents([]);
    }
  }, [currentMonth]);

  useEffect(() => {
    fetchMenuData();
  }, [fetchMenuData]);

  useEffect(() => {
    fetchBuffetEvents();
  }, [fetchBuffetEvents]);

  // Check if date has buffet event
  const hasBuffetEvent = useCallback(
    (date: Date): BuffetEvent | null => {
      const dateStr = format(date, 'yyyy-MM-dd');
      return buffetEvents.find((event) => event.date === dateStr) || null;
    },
    [buffetEvents]
  );

  // Handler for month selection
  const handleMonthSelect = (monthDate: Date) => {
    setCurrentMonth(monthDate);
    const newMonthSelectedDate = isSameMonth(selectedDate, monthDate)
      ? selectedDate
      : new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
    setSelectedDate(newMonthSelectedDate);
  };

  // Handler for date selection
  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
  };

  // Pull to refresh
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchMenuData(), fetchBuffetEvents()]);
    setRefreshing(false);
  }, [fetchMenuData, fetchBuffetEvents]);

  // Render dish item component for grid layout
  const renderDishItem = (
    dish: { image: string; name: string; optionType?: string; index: number },
    dishIndex: number,
    showOptionLabel: boolean = true
  ) => (
    <View key={dishIndex} style={{ width: ITEM_WIDTH }} className="mb-10 items-center gap-2 px-4">
      <View className="mx-4 mb-2 h-44 w-full overflow-hidden rounded-xl border border-[#E0E0E0]">
        {showOptionLabel && (
          <View className="absolute left-2 top-2 z-10 rounded-full bg-white/80 px-3 py-1">
            <Text className="text-xs font-bold text-[#002855]">
              {dish.optionType
                ? getBreakfastOptionDisplayName(dish.optionType, t)
                : `Lựa chọn ${dish.index}`}
            </Text>
          </View>
        )}
        {dish.image ? (
          <Image source={{ uri: dish.image }} className="h-full w-full" resizeMode="cover" />
        ) : (
          <View className="h-full w-full items-center justify-center">
            <Text className="text-3xl">🍽️</Text>
          </View>
        )}
      </View>
      <Text className=" w-full text-center text-gray-700" numberOfLines={2}>
        {dish.name}
      </Text>
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center justify-between bg-white px-4 py-4">
        <TouchableOpacity onPress={() => navigation.goBack()} className="p-2">
          <Ionicons name="arrow-back" size={28} color="#002855" />
        </TouchableOpacity>
        <Text className="text-2xl font-bold text-primary">{t('menu.title')}</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        style={{ backgroundColor: '#FFFFFF' }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Month Selector */}
        <View className="flex-row items-center justify-center bg-white py-6">
          {monthSelectorData.map((month, index) => (
            <TouchableOpacity
              key={index}
              onPress={() => handleMonthSelect(month.date)}
              className="px-4 py-2">
              <Text
                className={`${
                  month.isCurrent
                    ? 'text-2xl font-bold text-[#F05023]'
                    : Math.abs(month.offset) === 1
                      ? 'text-lg font-semibold text-primary'
                      : 'text-base text-gray-300'
                }`}>
                {month.formatted}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Calendar Grid */}
        <View className="mx-4 mb-6 rounded-2xl bg-white p-4">
          {/* Days of week header - Format: T ở trên */}
          <View className="mb-4 flex-row justify-between">
            {VI_DAY_LABELS.map((day, index) => (
              <View key={index} className="flex-1 items-center">
                <Text className="text-base font-bold text-primary">{day}</Text>
              </View>
            ))}
          </View>

          {/* Calendar days */}
          {calendarDays.map((week, weekIndex) => (
            <View key={weekIndex} className="mb-2 flex-row justify-between">
              {week.map((day, dayIndex) => {
                if (!day) {
                  return <View key={`${weekIndex}-${dayIndex}`} className="h-12 flex-1" />;
                }

                const buffetEvent = hasBuffetEvent(day);
                const isCurrentMonth = isSameMonth(day, currentMonth);
                const isTodayDate = isToday(day);
                const isSelectedDate = isSameDay(day, selectedDate);

                return (
                  <TouchableOpacity
                    key={`${weekIndex}-${dayIndex}`}
                    onPress={() => isCurrentMonth && handleDateSelect(day)}
                    className="flex-1 items-center justify-center py-1">
                    <View
                      className={`h-10 w-10 items-center justify-center ${
                        isSelectedDate ? 'rounded-full bg-[#F05023]' : ''
                      }`}>
                      <Text
                        className={`text-base font-semibold ${
                          isSelectedDate
                            ? 'text-white'
                            : !isCurrentMonth
                              ? 'text-gray-300'
                              : buffetEvent
                                ? 'font-bold text-[#F05023]'
                                : isTodayDate
                                  ? 'text-[#F05023]'
                                  : 'text-primary'
                        }`}>
                        {format(day, 'd')}
                      </Text>
                    </View>
                    {buffetEvent && isCurrentMonth && !isSelectedDate && (
                      <View className="mt-1 h-1.5 w-1.5 rounded-full bg-[#F05023]" />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </View>

        {/* Menu Details */}
        <View className="mx-4">
          {loading ? (
            <View className="items-center justify-center py-12">
              <ActivityIndicator size="large" color="#F05023" />
              <Text className="mt-4 text-gray-500">{t('menu.loading')}</Text>
            </View>
          ) : !mealDetails || !mealDetails.meals || mealDetails.meals.length === 0 ? (
            <View className="items-center justify-center py-12">
              <Text className="mb-2 text-5xl">🍽️</Text>
              <Text className="mb-2 text-xl font-medium text-gray-600">{t('menu.noMenu')}</Text>
              <Text className="text-center text-base text-gray-500">
                {t('menu.noMenuForDate', {
                  date: format(selectedDate, 'dd/MM/yyyy', { locale: dateLocale }),
                })}
              </Text>
            </View>
          ) : (
            mealDetails.meals.map((meal, index) => {
              const calories = getStaticCalories(meal.meal_type);
              const mealDishes = getMealDishes(meal);

              return (
                <View key={index} className="mb-8">
                  <Text className="mb-4 text-2xl font-bold capitalize text-primary">
                    {getMealDisplayName(meal.meal_type, t)}
                  </Text>

                  {/* Calorie Info - border và bg-transparent */}
                  <View className="mb-6 rounded-2xl border border-gray-200 bg-transparent p-4">
                    <View className="my-2 flex-row items-center justify-between">
                      <View className="flex-row items-center">
                        <View className="mr-3 h-4 w-4 rounded-full bg-[#BED232]" />
                        <Text className="text-base font-medium text-primary">
                          {t('menu.educationLevels.elementary')}
                        </Text>
                      </View>
                      <Text className="text-base font-bold text-primary">
                        {calories.elementary} {t('menu.units.kcal')}
                      </Text>
                    </View>
                    <View className="my-2 flex-row items-center justify-between">
                      <View className="flex-row items-center">
                        <View className="mr-3 h-4 w-4 rounded-full bg-[#00687F]" />
                        <Text className="text-base font-medium text-primary">
                          {t('menu.educationLevels.secondary')}
                        </Text>
                      </View>
                      <Text className="text-base font-bold text-primary">
                        {calories.secondary} {t('menu.units.kcal')}
                      </Text>
                    </View>
                  </View>

                  {/* Breakfast - Grid 2 columns */}
                  {meal.meal_type === 'breakfast' && (
                    <View className="flex-row flex-wrap justify-center">
                      {mealDishes.map((dish, dishIndex) => renderDishItem(dish, dishIndex, true))}
                    </View>
                  )}

                  {/* Lunch Sets - Grid 2 columns */}
                  {meal.meal_type === 'lunch' && (
                    <View>
                      {/* Set Á */}
                      {meal.set_a_config?.enabled &&
                        meal.set_a_config.items &&
                        meal.set_a_config.items.length > 0 && (
                          <View className="mb-6">
                            <View className="mb-4 rounded-lg bg-primary py-3">
                              <Text className="text-center text-lg font-bold text-white">
                                {t('menu.lunchSets.set_a')}
                              </Text>
                            </View>
                            <View className="flex-row flex-wrap justify-center">
                              {getLunchSetDishes(meal, 'set_a').map((dish, dishIndex) => (
                                <View
                                  key={dishIndex}
                                  style={{ width: ITEM_WIDTH }}
                                  className="mb-10 items-center px-4">
                                  <View className="mb-4 h-44 w-full overflow-hidden rounded-xl border border-[#E0E0E0] bg-gray-100">
                                    <View className="absolute left-2 top-2 z-10 rounded-full bg-white/80 px-3 py-1">
                                      <Text className="text-xs font-bold text-[#002855]">
                                        {dish.itemType}
                                      </Text>
                                    </View>
                                    {dish.image ? (
                                      <Image
                                        source={{ uri: dish.image }}
                                        className="h-full w-full"
                                        resizeMode="cover"
                                      />
                                    ) : (
                                      <View className="h-full w-full items-center justify-center">
                                        <Text className="text-3xl">🍽️</Text>
                                      </View>
                                    )}
                                  </View>
                                  <Text
                                    className=" w-full text-center text-gray-700"
                                    numberOfLines={2}>
                                    {dish.name}
                                  </Text>
                                </View>
                              ))}
                            </View>
                          </View>
                        )}

                      {/* Set Âu */}
                      {meal.set_au_config?.enabled &&
                        meal.set_au_config.items &&
                        meal.set_au_config.items.length > 0 && (
                          <View className="mb-6">
                            <View className="mb-4 rounded-lg bg-[#F05023] py-3">
                              <Text className="text-center text-lg font-bold text-white">
                                {t('menu.lunchSets.set_au')}
                              </Text>
                            </View>
                            <View className="flex-row flex-wrap justify-center">
                              {getLunchSetDishes(meal, 'set_au').map((dish, dishIndex) => (
                                <View
                                  key={dishIndex}
                                  style={{ width: ITEM_WIDTH }}
                                  className="mb-10 items-center px-4">
                                  <View className="mb-4 h-44 w-full overflow-hidden rounded-xl border border-[#E0E0E0] bg-gray-100">
                                    <View className="absolute left-2 top-2 z-10 rounded-full bg-white/80 px-3 py-1">
                                      <Text className="text-xs font-bold text-[#002855]">
                                        {dish.itemType}
                                      </Text>
                                    </View>
                                    {dish.image ? (
                                      <Image
                                        source={{ uri: dish.image }}
                                        className="h-full w-full"
                                        resizeMode="cover"
                                      />
                                    ) : (
                                      <View className="h-full w-full items-center justify-center">
                                        <Text className="text-3xl">🍽️</Text>
                                      </View>
                                    )}
                                  </View>
                                  <Text
                                    className=" w-full text-center text-gray-700"
                                    numberOfLines={2}>
                                    {dish.name}
                                  </Text>
                                </View>
                              ))}
                            </View>
                          </View>
                        )}

                      {/* Eat Clean */}
                      {meal.eat_clean_config?.enabled &&
                        meal.eat_clean_config.items &&
                        meal.eat_clean_config.items.length > 0 && (
                          <View className="mb-6">
                            <View className="mb-4 rounded-lg bg-[#009485] py-3">
                              <Text className="text-center text-lg font-bold text-white">
                                {t('menu.lunchSets.eat_clean')}
                              </Text>
                            </View>
                            <View className="flex-row flex-wrap justify-center">
                              {getLunchSetDishes(meal, 'eat_clean').map((dish, dishIndex) => (
                                <View
                                  key={dishIndex}
                                  style={{ width: ITEM_WIDTH }}
                                  className="mb-10 items-center px-4">
                                  <View className="mb-4 h-44 w-full overflow-hidden rounded-xl border border-[#E0E0E0] bg-gray-100">
                                    <View className="absolute left-2 top-2 z-10 rounded-full bg-white/80 px-3 py-1">
                                      <Text className="text-xs font-bold text-[#002855]">
                                        {dish.itemType}
                                      </Text>
                                    </View>
                                    {dish.image ? (
                                      <Image
                                        source={{ uri: dish.image }}
                                        className="h-full w-full"
                                        resizeMode="cover"
                                      />
                                    ) : (
                                      <View className="h-full w-full items-center justify-center">
                                        <Text className="text-3xl">🍽️</Text>
                                      </View>
                                    )}
                                  </View>
                                  <Text
                                    className=" w-full text-center text-gray-700"
                                    numberOfLines={2}>
                                    {dish.name}
                                  </Text>
                                </View>
                              ))}
                            </View>
                          </View>
                        )}

                      {/* Buffet */}
                      {meal.buffet_config?.enabled &&
                        meal.buffet_config.items &&
                        meal.buffet_config.items.length > 0 && (
                          <View className="mb-6">
                            <View className="mb-4 rounded-lg bg-[#DAA520] py-3">
                              <Text className="text-center text-lg font-bold text-white">
                                {meal.buffet_config.name_vn || 'Buffet'}
                              </Text>
                            </View>
                            <View className="flex-row flex-wrap justify-center">
                              {meal.buffet_config.items.map((item, itemIndex) => {
                                const imageUrl = item.menu_category_details?.image_url
                                  ? getFullImageUrl(item.menu_category_details.image_url)
                                  : '';
                                return (
                                  <View
                                    key={itemIndex}
                                    style={{ width: ITEM_WIDTH }}
                                    className="mb-10 items-center px-4">
                                    <View className="mb-4 h-44 w-full overflow-hidden rounded-xl border border-[#E0E0E0] bg-gray-100">
                                      <View className="absolute left-2 top-2 z-10 rounded-full bg-white/80 px-3 py-1">
                                        <Text className="text-xs font-bold text-[#002855]">
                                          Lựa chọn {itemIndex + 1}
                                        </Text>
                                      </View>
                                      {imageUrl ? (
                                        <Image
                                          source={{ uri: imageUrl }}
                                          className="h-full w-full"
                                          resizeMode="cover"
                                        />
                                      ) : (
                                        <View className="h-full w-full items-center justify-center">
                                          <Text className="text-3xl">🍽️</Text>
                                        </View>
                                      )}
                                    </View>
                                    <Text
                                      className=" w-full text-center text-gray-700"
                                      numberOfLines={2}>
                                      {item.menu_category_details?.display_name ||
                                        item.menu_category_details?.title_vn ||
                                        'Món ăn'}
                                    </Text>
                                  </View>
                                );
                              })}
                            </View>
                          </View>
                        )}
                    </View>
                  )}

                  {/* Dinner - Grid 2 columns */}
                  {meal.meal_type === 'dinner' && (
                    <View>
                      {/* Tiểu học */}
                      {getDinnerDishesByStage(meal, 'Tiểu học').length > 0 && (
                        <View className="mb-6">
                          <View className="mb-4 rounded-lg bg-[#BED232] py-3">
                            <Text className="text-center text-lg font-bold text-white">
                              {t('menu.educationLevels.elementary')}
                            </Text>
                          </View>
                          <View className="flex-row flex-wrap justify-center">
                            {getDinnerDishesByStage(meal, 'Tiểu học').map((dish, dishIndex) => (
                              <View
                                key={dishIndex}
                                style={{ width: ITEM_WIDTH }}
                                className="mb-10 items-center px-4">
                                <View className="mb-4 h-44 w-full overflow-hidden rounded-xl border border-[#E0E0E0] bg-gray-100">
                                  <View className="absolute left-2 top-2 z-10 rounded-full bg-white/80 px-3 py-1">
                                    <Text className="text-xs font-bold text-[#002855]">
                                      Lựa chọn {dish.index}
                                    </Text>
                                  </View>
                                  {dish.image ? (
                                    <Image
                                      source={{ uri: dish.image }}
                                      className="h-full w-full"
                                      resizeMode="cover"
                                    />
                                  ) : (
                                    <View className="h-full w-full items-center justify-center">
                                      <Text className="text-3xl">🍽️</Text>
                                    </View>
                                  )}
                                </View>
                                <Text
                                  className=" w-full text-center text-gray-700"
                                  numberOfLines={2}>
                                  {dish.name}
                                </Text>
                              </View>
                            ))}
                          </View>
                        </View>
                      )}

                      {/* Trung học */}
                      {getDinnerDishesByStage(meal, 'Trung học').length > 0 && (
                        <View className="mb-6">
                          <View className="mb-4 rounded-lg bg-[#00687F] py-3">
                            <Text className="text-center text-lg font-bold text-white">
                              {t('menu.educationLevels.secondary')}
                            </Text>
                          </View>
                          <View className="flex-row flex-wrap justify-center">
                            {getDinnerDishesByStage(meal, 'Trung học').map((dish, dishIndex) => (
                              <View
                                key={dishIndex}
                                style={{ width: ITEM_WIDTH }}
                                className="mb-10 items-center px-4">
                                <View className="mb-4 h-44 w-full overflow-hidden rounded-xl border border-[#E0E0E0] bg-gray-100">
                                  <View className="absolute left-2 top-2 z-10 rounded-full bg-white/80 px-3 py-1">
                                    <Text className="text-xs font-bold text-[#002855]">
                                      Lựa chọn {dish.index}
                                    </Text>
                                  </View>
                                  {dish.image ? (
                                    <Image
                                      source={{ uri: dish.image }}
                                      className="h-full w-full"
                                      resizeMode="cover"
                                    />
                                  ) : (
                                    <View className="h-full w-full items-center justify-center">
                                      <Text className="text-3xl">🍽️</Text>
                                    </View>
                                  )}
                                </View>
                                <Text
                                  className=" w-full text-center text-gray-700"
                                  numberOfLines={2}>
                                  {dish.name}
                                </Text>
                              </View>
                            ))}
                          </View>
                        </View>
                      )}
                    </View>
                  )}

                  {/* Other meals - Grid 2 columns */}
                  {meal.meal_type !== 'breakfast' &&
                    meal.meal_type !== 'lunch' &&
                    meal.meal_type !== 'dinner' && (
                      <View className="flex-row flex-wrap justify-center">
                        {mealDishes.map((dish, dishIndex) => renderDishItem(dish, dishIndex, true))}
                      </View>
                    )}
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default MenuScreen;

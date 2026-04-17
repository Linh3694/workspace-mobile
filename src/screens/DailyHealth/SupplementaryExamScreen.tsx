// @ts-nocheck
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { TouchableOpacity } from '../../components/Common';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { ROUTES } from '../../constants/routes';
import dailyHealthService, {
  DailyHealthVisit,
  HealthExamination,
} from '../../services/dailyHealthService';
import SupplementaryExamForm from './components/SupplementaryExamForm';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Params = RouteProp<RootStackParamList, typeof ROUTES.SCREENS.HEALTH_EXAM_SUPPLEMENTARY>;

/** Màn full-screen thăm khám bổ sung (thay bottom sheet) */
const SupplementaryExamScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const { visitId, examId } = useRoute<Params>().params;

  const [loading, setLoading] = useState(true);
  const [visit, setVisit] = useState<DailyHealthVisit | null>(null);
  const [exam, setExam] = useState<HealthExamination | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const v = await dailyHealthService.getVisitDetail(visitId);
      if (!v?.student_id) {
        setVisit(null);
        setExam(null);
        return;
      }
      const history = await dailyHealthService.getStudentExaminationHistory(v.student_id, 50);
      const e = (history || []).find((x) => x.name === examId) || null;
      setVisit(v);
      setExam(e);
    } catch {
      setVisit(null);
      setExam(null);
    } finally {
      setLoading(false);
    }
  }, [visitId, examId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleClose = () => navigation.goBack();

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#FFFFFF', paddingTop: insets.top }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderBottomWidth: 1,
            borderBottomColor: '#F3F4F6',
          }}>
          <TouchableOpacity onPress={handleClose} style={{ padding: 8 }}>
            <Ionicons name="arrow-back" size={24} color="#1F2937" />
          </TouchableOpacity>
          <Text
            style={{
              marginLeft: 8,
              flex: 1,
              fontSize: 18,
              fontWeight: '600',
              color: '#002855',
              fontFamily: 'Mulish',
            }}>
            Thăm khám bổ sung
          </Text>
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#002855" />
        </View>
      </View>
    );
  }

  if (!visit || !exam) {
    return (
      <View style={{ flex: 1, backgroundColor: '#FFFFFF', paddingTop: insets.top }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderBottomWidth: 1,
            borderBottomColor: '#F3F4F6',
          }}>
          <TouchableOpacity onPress={handleClose} style={{ padding: 8 }}>
            <Ionicons name="arrow-back" size={24} color="#1F2937" />
          </TouchableOpacity>
          <Text
            style={{
              marginLeft: 8,
              flex: 1,
              fontSize: 18,
              fontWeight: '600',
              color: '#002855',
              fontFamily: 'Mulish',
            }}>
            Thăm khám bổ sung
          </Text>
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <Text style={{ fontSize: 16, color: '#6B7280', fontFamily: 'Mulish', textAlign: 'center' }}>
            Không tìm thấy hồ sơ khám hoặc lượt thăm.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF', paddingTop: insets.top }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderBottomColor: '#F3F4F6',
        }}>
        <TouchableOpacity onPress={handleClose} style={{ padding: 8 }}>
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text
          style={{
            marginLeft: 8,
            flex: 1,
            fontSize: 18,
            fontWeight: '600',
            color: '#002855',
            fontFamily: 'Mulish',
          }}>
          Thăm khám bổ sung
        </Text>
      </View>

      {/* Không dùng KeyboardAvoidingView: ScrollView trong form có automaticallyAdjustKeyboardInsets */}
      <View style={{ flex: 1 }}>
        <SupplementaryExamForm exam={exam} onClose={handleClose} onSaved={() => {}} />
      </View>
    </View>
  );
};

export default SupplementaryExamScreen;

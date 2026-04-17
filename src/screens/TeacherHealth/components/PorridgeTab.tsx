import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  Alert,
  Pressable,
} from 'react-native';
import { TouchableOpacity } from '../../../components/Common';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useLanguage } from '../../../hooks/useLanguage';
import healthReportService, { HealthReport } from '../../../services/healthReportService';
import AddHealthReportModal from './AddHealthReportModal';

interface Props {
  classId: string;
  date: string;
  refreshing: boolean;
  onRefresh: () => void;
}

// Helper để sắp xếp tên tiếng Việt
const sortVietnameseName = (nameA: string, nameB: string): number => {
  const partsA = nameA
    .trim()
    .split(' ')
    .filter((part) => part.length > 0);
  const partsB = nameB
    .trim()
    .split(' ')
    .filter((part) => part.length > 0);

  if (partsA.length === 0 && partsB.length === 0) return 0;
  if (partsA.length === 0) return 1;
  if (partsB.length === 0) return -1;

  // So sánh tên (phần cuối) trước
  const firstNameA = partsA[partsA.length - 1]?.toLowerCase() || '';
  const firstNameB = partsB[partsB.length - 1]?.toLowerCase() || '';
  const firstNameCompare = firstNameA.localeCompare(firstNameB, 'vi');
  if (firstNameCompare !== 0) return firstNameCompare;

  // So sánh họ (phần đầu)
  const lastNameA = partsA[0]?.toLowerCase() || '';
  const lastNameB = partsB[0]?.toLowerCase() || '';
  return lastNameA.localeCompare(lastNameB, 'vi');
};

const PorridgeTab: React.FC<Props> = ({ classId, date, refreshing, onRefresh }) => {
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();

  // State
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState<HealthReport[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingReport, setEditingReport] = useState<HealthReport | null>(null);

  // Deleting state
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch reports
  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const response = await healthReportService.getClassHealthReports({
        class_id: classId,
        date: date,
      });

      if (response.success && response.data) {
        setReports(response.data.data || []);
      } else {
        setReports([]);
      }
    } catch (error) {
      console.error('Error fetching health reports:', error);
      setReports([]);
    } finally {
      setLoading(false);
    }
  }, [classId, date]);

  // Load reports when classId or date changes
  useEffect(() => {
    if (classId && date) {
      fetchReports();
    }
  }, [classId, date, fetchReports]);

  // Refresh when parent triggers
  useEffect(() => {
    if (refreshing) {
      fetchReports();
    }
  }, [refreshing, fetchReports]);

  // Filter và sort reports
  const filteredReports = useMemo(() => {
    // Đảm bảo reports luôn là array
    const safeReports = Array.isArray(reports) ? reports : [];

    let filtered = safeReports;

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = safeReports.filter(
        (r) =>
          r.student_name?.toLowerCase().includes(term) ||
          r.student_code?.toLowerCase().includes(term)
      );
    }

    // Sử dụng slice() thay vì spread để tránh lỗi Hermes
    return filtered
      .slice()
      .sort((a, b) => sortVietnameseName(a.student_name || '', b.student_name || ''));
  }, [reports, searchTerm]);

  // Stats
  const porridgeCount = useMemo(() => {
    const safeReports = Array.isArray(reports) ? reports : [];
    return safeReports.filter((r) => r.porridge_registration).length;
  }, [reports]);

  // Handlers
  const handleAdd = () => {
    setEditingReport(null);
    setModalOpen(true);
  };

  const handleEdit = (report: HealthReport) => {
    setEditingReport(report);
    setModalOpen(true);
  };

  const handleDelete = (report: HealthReport) => {
    Alert.alert(
      t('teacher_health.delete_confirm_title') || 'Xác nhận xóa',
      t('teacher_health.delete_confirm_message', { name: report.student_name }) ||
        `Bạn có chắc muốn xóa báo cháo của ${report.student_name}?`,
      [
        { text: t('common.cancel') || 'Hủy', style: 'cancel' },
        {
          text: t('common.delete') || 'Xóa',
          style: 'destructive',
          onPress: async () => {
            setIsDeleting(true);
            try {
              const response = await healthReportService.deleteHealthReport(report.name);
              if (response.success) {
                fetchReports();
              } else {
                Alert.alert(
                  t('common.error') || 'Lỗi',
                  response.message || t('teacher_health.delete_error') || 'Xóa thất bại'
                );
              }
            } catch (error) {
              console.error('Error deleting report:', error);
              Alert.alert(
                t('common.error') || 'Lỗi',
                t('teacher_health.delete_error') || 'Xóa thất bại'
              );
            } finally {
              setIsDeleting(false);
            }
          },
        },
      ]
    );
  };

  const handleModalClose = () => {
    setModalOpen(false);
    setEditingReport(null);
  };

  const handleModalSuccess = () => {
    handleModalClose();
    fetchReports();
  };

  // Render badge ăn cháo
  const renderPorridgeBadge = (report: HealthReport) => {
    if (!report.porridge_registration || !report.porridge_dates?.length) {
      return (
        <View className="rounded-full bg-gray-100 px-2 py-1">
          <Text className="text-xs text-gray-500">Không</Text>
        </View>
      );
    }

    return (
      <View className="rounded-full bg-[#002855] px-2 py-1">
        <Text className="text-xs font-medium text-white">{report.porridge_dates.length} ngày</Text>
      </View>
    );
  };

  // Render report item
  const renderReportItem = ({ item }: { item: HealthReport }) => {
    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => handleEdit(item)}
        className="mb-3 rounded-xl border border-gray-200 bg-white p-4">
        <View className="flex-row items-start justify-between">
          <View className="flex-1">
            <Text className="text-base font-semibold text-[#002855]">{item.student_name}</Text>
            <Text className="mt-1 text-sm text-gray-500">{item.student_code}</Text>
            {item.description && (
              <Text className="mt-2 text-sm text-gray-700" numberOfLines={2}>
                {item.description}
              </Text>
            )}
          </View>

          <View className="ml-2 items-end">{renderPorridgeBadge(item)}</View>
        </View>

        {/* Actions */}
        <View className="mt-3 flex-row items-center justify-end border-t border-gray-100 pt-3">
          <TouchableOpacity
            onPress={() => handleDelete(item)}
            className="flex-row items-center rounded-lg bg-[#F05023]/20 px-3 py-2">
            <Ionicons name="trash-outline" size={16} color="#F05023" />
            <Text className="ml-1 text-sm font-medium text-[#F05023]">Xóa</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  // Loading lần đầu (chưa có data)
  const isInitialLoading = loading && reports.length === 0 && !modalOpen;

  return (
    <View className="flex-1">
      {isInitialLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#002855" />
          <Text className="mt-4 text-gray-500">Đang tải...</Text>
        </View>
      ) : (
        <>
          {/* Search bar và Stats */}
          <View className="border-b border-gray-100 bg-white px-4 pb-3">
            {/* Search bar */}
            <View className="mb-3 flex-row items-center rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
              <Ionicons name="search" size={20} color="#9CA3AF" />
              <TextInput
                placeholder={t('teacher_health.search_placeholder') || 'Tìm học sinh...'}
                value={searchTerm}
                onChangeText={setSearchTerm}
                className="ml-2 flex-1 text-base text-[#002855]"
                placeholderTextColor="#9CA3AF"
              />
              {searchTerm.length > 0 && (
                <TouchableOpacity onPress={() => setSearchTerm('')}>
                  <Ionicons name="close-circle" size={20} color="#9CA3AF" />
                </TouchableOpacity>
              )}
            </View>

            {/* Stats */}
            {reports.length > 0 && (
              <View className="flex-row items-center">
                <View className="mr-4 flex-row items-center">
                  <Text className="text-sm text-gray-600">Tổng: </Text>
                  <Text className="text-sm font-bold text-[#002855]">{reports.length}</Text>
                </View>
                <View className="flex-row items-center">
                  <Text className="text-sm text-gray-600">Ăn cháo: </Text>
                  <Text className="text-sm font-bold text-[#002855]">{porridgeCount}</Text>
                </View>
              </View>
            )}
          </View>

          {/* List */}
          <FlatList
            data={filteredReports}
            keyExtractor={(item) => item.name}
            renderItem={renderReportItem}
            contentContainerStyle={{
              padding: 16,
              paddingBottom: 100 + insets.bottom,
            }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing || loading}
                onRefresh={onRefresh}
                colors={['#002855']}
              />
            }
            ListEmptyComponent={
              <View className="items-center justify-center py-16">
                <MaterialIcons name="description" size={64} color="#ccc" />
                <Text className="mt-4 text-base text-gray-500">
                  {searchTerm
                    ? t('teacher_health.no_search_results') || 'Không tìm thấy kết quả'
                    : t('teacher_health.no_reports_today') || 'Chưa có báo cáo nào hôm nay'}
                </Text>
              </View>
            }
          />

          {/* FAB - Báo cháo */}
          <TouchableOpacity
            onPress={handleAdd}
            activeOpacity={0.8}
            style={{
              position: 'absolute',
              right: 20,
              bottom: 20 + insets.bottom,
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 16,
              paddingVertical: 12,
              borderRadius: 28,
              backgroundColor: '#002855',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 4,
              elevation: 8,
            }}>
            <Text className="text-sm font-semibold text-white">Báo cháo</Text>
          </TouchableOpacity>
        </>
      )}

      {/* Modal luôn được render, không bị unmount bởi loading guard */}
      <AddHealthReportModal
        visible={modalOpen}
        onClose={handleModalClose}
        classId={classId}
        editingReport={editingReport}
        onSuccess={handleModalSuccess}
      />
    </View>
  );
};

export default PorridgeTab;

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
  FlatList,
  Keyboard,
  Platform,
} from 'react-native';
import { TouchableOpacity, BottomSheetModal } from '../../../components/Common';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import dailyHealthService, {
  CreateExaminationParams,
  ExaminationImage,
  HealthExamination,
  TreatmentType,
  MedicalStaffUser,
  VisitStatus,
} from '../../../services/dailyHealthService';
import healthConfigService, {
  DiseaseClassificationItem,
  MedicineItem,
  FirstAidItem,
} from '../../../services/healthConfigService';
import { normalizeVietnameseName } from '../../../utils/nameFormatter';
import { formatTimeHHMM, normalizeTimeForApi } from '../../../utils/dateUtils';

// ============= COMPONENT: SearchableSelect có search =============
interface SearchableSelectProps {
  label: string;
  placeholder: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  required?: boolean;
}

const SearchableSelect: React.FC<SearchableSelectProps> = ({
  label,
  placeholder,
  value,
  options,
  onChange,
  required,
}) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const selectedOption = options.find((o) => o.value === value);
  const displayText = selectedOption ? selectedOption.label : placeholder;

  const filteredOptions = options.filter((o) =>
    o.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setModalVisible(false);
    setSearchQuery('');
  };

  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={{ fontSize: 14, fontWeight: '500', color: '#374151', marginBottom: 8 }}>
        {label} {required && <Text style={{ color: '#BE123C' }}>*</Text>}
      </Text>

      <TouchableOpacity
        onPress={() => setModalVisible(true)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 16,
          paddingVertical: 14,
          borderRadius: 12,
          backgroundColor: '#F9FAFB',
        }}>
        <Text
          style={{
            fontSize: 15,
            color: value ? '#1F2937' : '#9CA3AF',
            flex: 1,
          }}
          numberOfLines={1}>
          {displayText}
        </Text>
        <Ionicons name="chevron-down" size={20} color="#9CA3AF" />
      </TouchableOpacity>

      <BottomSheetModal
        visible={modalVisible}
        onClose={() => {
          setModalVisible(false);
          setSearchQuery('');
        }}
        maxHeightPercent={80}>
        {/* Header */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 16,
            borderBottomWidth: 1,
            borderBottomColor: '#F3F4F6',
          }}>
          <TouchableOpacity
            onPress={() => {
              setModalVisible(false);
              setSearchQuery('');
            }}>
            <Text style={{ fontSize: 16, color: '#6B7280' }}>Huỷ</Text>
          </TouchableOpacity>
          <Text style={{ fontSize: 17, fontWeight: '600', color: '#1F2937' }}>{label}</Text>
          <TouchableOpacity
            onPress={() => {
              onChange('');
              setModalVisible(false);
              setSearchQuery('');
            }}>
            <Text style={{ fontSize: 16, color: '#BE123C' }}>Xoá</Text>
          </TouchableOpacity>
        </View>

        {/* Search input */}
        <View style={{ padding: 16, paddingBottom: 8 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: '#F3F4F6',
              borderRadius: 12,
              paddingHorizontal: 12,
              paddingVertical: 10,
            }}>
            <Ionicons name="search-outline" size={20} color="#9CA3AF" />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Tìm kiếm..."
              placeholderTextColor="#9CA3AF"
              style={{
                flex: 1,
                marginLeft: 8,
                fontSize: 15,
                color: '#1F2937',
              }}
              autoFocus
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={20} color="#9CA3AF" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Options List */}
        <FlatList
          data={filteredOptions}
          keyExtractor={(item) => item.value}
          contentContainerStyle={{ paddingHorizontal: 16 }}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingVertical: 32 }}>
              <Ionicons name="search-outline" size={48} color="#D1D5DB" />
              <Text style={{ marginTop: 8, color: '#6B7280' }}>Không tìm thấy kết quả</Text>
            </View>
          }
          renderItem={({ item }) => {
            const isSelected = value === item.value;
            return (
              <TouchableOpacity
                onPress={() => handleSelect(item.value)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                  marginBottom: 8,
                  borderRadius: 12,
                  backgroundColor: isSelected ? '#FFF7ED' : '#F9FAFB',
                  borderWidth: isSelected ? 2 : 0,
                  borderColor: isSelected ? '#FED7AA' : 'transparent',
                }}>
                <Text
                  style={{
                    fontSize: 15,
                    fontWeight: isSelected ? '600' : '400',
                    color: isSelected ? '#C2410C' : '#374151',
                    flex: 1,
                  }}>
                  {item.label}
                </Text>
                {isSelected && <Ionicons name="checkmark-circle" size={22} color="#C2410C" />}
              </TouchableOpacity>
            );
          }}
        />
      </BottomSheetModal>
    </View>
  );
};

// Thứ tự điều trị theo web: Sơ cứu, Dùng thuốc, Nghỉ ngơi, Khác
const treatmentTypeOptions: { value: TreatmentType; label: string }[] = [
  { value: 'first_aid', label: 'Sơ cứu' },
  { value: 'medication', label: 'Dùng thuốc' },
  { value: 'rest', label: 'Nghỉ ngơi' },
  { value: 'other', label: 'Khác' },
];

// ============= COMPONENT: TreatmentItem - mỗi dòng có item_type (giống web) =============
interface TreatmentItemData {
  id: string;
  item_type: TreatmentType | '';
  treatment_name: string;
  quantity: string;
  notes: string;
}

interface TreatmentItemRowProps {
  item: TreatmentItemData;
  medicines: { value: string; label: string }[];
  firstAidItems: { value: string; label: string }[];
  onUpdate: (field: keyof TreatmentItemData, value: string) => void;
  onRemove: () => void;
  canRemove: boolean;
}

const TreatmentItemRow: React.FC<TreatmentItemRowProps> = ({
  item,
  medicines,
  firstAidItems,
  onUpdate,
  onRemove,
  canRemove,
}) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const options = item.item_type === 'first_aid' ? firstAidItems : medicines;
  // Khớp theo value; fallback theo label (bản ghi cũ / lệch format) để prefill hiển thị đúng
  const selectedOption = useMemo(() => {
    const byValue = options.find((o) => o.value === item.treatment_name);
    if (byValue) return byValue;
    if (!item.treatment_name?.trim()) return undefined;
    return options.find(
      (o) =>
        o.label === item.treatment_name ||
        o.label.startsWith(`${item.treatment_name.trim()} (`)
    );
  }, [options, item.treatment_name]);
  const displayText = selectedOption
    ? selectedOption.label
    : item.item_type === 'first_aid'
      ? 'Chọn vật tư sơ cứu...'
      : 'Chọn thuốc...';
  const filteredOptions = options.filter((o) =>
    o.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Chọn loại xử trí - gộp cập nhật để tránh mất state khi gọi nhiều onUpdate liên tiếp
  const handleSelectType = (typeValue: TreatmentType) => {
    if (item.item_type === typeValue) return;
    onUpdate('item_type', typeValue);
    onUpdate('treatment_name', '');
    onUpdate('quantity', '');
    onUpdate('notes', '');
  };

  return (
    <View style={{ marginBottom: 12, backgroundColor: '#F9FAFB', borderRadius: 12, padding: 12 }}>
      {/* Chọn loại xử trí: Sơ cứu, Dùng thuốc, Nghỉ ngơi, Khác - nút xóa đặt cuối hàng tránh đè badge */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 8,
        }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, flex: 1 }}>
          {treatmentTypeOptions.map((type) => (
            <TouchableOpacity
              key={type.value}
              onPress={() => handleSelectType(type.value)}
              activeOpacity={0.7}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 20,
                backgroundColor: item.item_type === type.value ? '#FFF7ED' : '#FFFFFF',
                borderWidth: 1,
                borderColor: item.item_type === type.value ? '#FED7AA' : '#E5E7EB',
              }}>
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '500',
                  color: item.item_type === type.value ? '#C2410C' : '#374151',
                }}>
                {type.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {canRemove && (
          <TouchableOpacity
            onPress={onRemove}
            style={{
              marginLeft: 8,
              width: 32,
              height: 32,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Ionicons name="trash-outline" size={20} color="#BE123C" />
          </TouchableOpacity>
        )}
      </View>

      {/* Nội dung theo loại */}
      {(item.item_type === 'first_aid' || item.item_type === 'medication') && (
        <>
          <TouchableOpacity
            onPress={() => setModalVisible(true)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingVertical: 8,
              borderBottomWidth: 1,
              borderBottomColor: '#E5E7EB',
            }}>
            <Text
              style={{
                fontSize: 15,
                color: item.treatment_name ? '#1F2937' : '#9CA3AF',
                flex: 1,
              }}
              numberOfLines={1}>
              {displayText}
            </Text>
            <Ionicons name="chevron-down" size={18} color="#9CA3AF" />
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', marginTop: 8, gap: 8 }}>
            <TextInput
              value={item.quantity}
              onChangeText={(text) => onUpdate('quantity', text)}
              placeholder="Số lượng"
              placeholderTextColor="#9CA3AF"
              style={{
                flex: 1,
                backgroundColor: '#FFFFFF',
                borderRadius: 8,
                paddingHorizontal: 12,
                paddingVertical: 10,
                fontSize: 14,
                color: '#1F2937',
              }}
            />
            <TextInput
              value={item.notes}
              onChangeText={(text) => onUpdate('notes', text)}
              placeholder="Ghi chú"
              placeholderTextColor="#9CA3AF"
              style={{
                flex: 2,
                backgroundColor: '#FFFFFF',
                borderRadius: 8,
                paddingHorizontal: 12,
                paddingVertical: 10,
                fontSize: 14,
                color: '#1F2937',
              }}
            />
          </View>
          <BottomSheetModal
            visible={modalVisible}
            onClose={() => {
              setModalVisible(false);
              setSearchQuery('');
            }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: 16,
                borderBottomWidth: 1,
                borderBottomColor: '#F3F4F6',
              }}>
              <TouchableOpacity
                onPress={() => {
                  setModalVisible(false);
                  setSearchQuery('');
                }}>
                <Text style={{ fontSize: 16, color: '#6B7280' }}>Huỷ</Text>
              </TouchableOpacity>
              <Text style={{ fontSize: 17, fontWeight: '600', color: '#1F2937' }}>
                {item.item_type === 'first_aid' ? 'Vật tư sơ cứu' : 'Thuốc'}
              </Text>
              <View style={{ width: 40 }} />
            </View>
            <View style={{ padding: 16, paddingBottom: 8 }}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: '#F3F4F6',
                  borderRadius: 12,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                }}>
                <Ionicons name="search-outline" size={20} color="#9CA3AF" />
                <TextInput
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="Tìm kiếm..."
                  placeholderTextColor="#9CA3AF"
                  style={{
                    flex: 1,
                    marginLeft: 8,
                    fontSize: 15,
                    color: '#1F2937',
                  }}
                  autoFocus
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery('')}>
                    <Ionicons name="close-circle" size={20} color="#9CA3AF" />
                  </TouchableOpacity>
                )}
              </View>
            </View>
            <FlatList
              data={filteredOptions}
              keyExtractor={(opt) => opt.value}
              contentContainerStyle={{ paddingHorizontal: 16 }}
              ListEmptyComponent={
                <View style={{ alignItems: 'center', paddingVertical: 32 }}>
                  <Ionicons name="search-outline" size={48} color="#D1D5DB" />
                  <Text style={{ marginTop: 8, color: '#6B7280' }}>Không tìm thấy kết quả</Text>
                </View>
              }
              renderItem={({ item: opt }) => {
                const isSelected = selectedOption?.value === opt.value;
                return (
                  <TouchableOpacity
                    onPress={() => {
                      onUpdate('treatment_name', opt.value);
                      setModalVisible(false);
                      setSearchQuery('');
                    }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingHorizontal: 16,
                      paddingVertical: 14,
                      marginBottom: 8,
                      borderRadius: 12,
                      backgroundColor: isSelected ? '#FFF7ED' : '#F9FAFB',
                      borderWidth: isSelected ? 2 : 0,
                      borderColor: isSelected ? '#FED7AA' : 'transparent',
                    }}>
                    <Text
                      style={{
                        fontSize: 15,
                        fontWeight: isSelected ? '600' : '400',
                        color: isSelected ? '#C2410C' : '#374151',
                        flex: 1,
                      }}>
                      {opt.label}
                    </Text>
                    {isSelected && <Ionicons name="checkmark-circle" size={22} color="#C2410C" />}
                  </TouchableOpacity>
                );
              }}
            />
          </BottomSheetModal>
        </>
      )}

      {(item.item_type === 'rest' || item.item_type === 'other') && (
        <TextInput
          value={item.treatment_name}
          onChangeText={(text) => onUpdate('treatment_name', text)}
          placeholder={
            item.item_type === 'rest' ? 'Ghi chú nghỉ ngơi...' : 'Mô tả xử trí khác...'
          }
          placeholderTextColor="#9CA3AF"
          multiline
          numberOfLines={2}
          style={{
            minHeight: 60,
            backgroundColor: '#FFFFFF',
            borderRadius: 8,
            paddingHorizontal: 12,
            paddingVertical: 10,
            fontSize: 14,
            color: '#1F2937',
            textAlignVertical: 'top',
          }}
        />
      )}

      {!item.item_type && (
        <Text style={{ fontSize: 14, color: '#9CA3AF', fontStyle: 'italic' }}>
          Chọn loại xử trí...
        </Text>
      )}
    </View>
  );
};

// ============= MAIN COMPONENT: ExaminationForm =============
interface ExaminationFormProps {
  visitId: string;
  visitReason?: string;
  /** Thời gian về từ checkout Daily Health - chỉ hiển thị khi học sinh đã checkout */
  visitLeaveClinicTime?: string | null;
  /** Trạng thái visit - dùng để chỉ hiển thị Thời gian về khi đã checkout */
  visitStatus?: VisitStatus;
  initialData?: HealthExamination;
  onSave: (data: CreateExaminationParams, visitReason?: string) => Promise<void>;
  onUploadImage: (file: { uri: string; name: string; type: string }) => Promise<string | null>;
  loading?: boolean;
}

// Các trạng thái đã checkout - khi đó mới hiển thị Thời gian về
const CHECKOUT_STATUSES: VisitStatus[] = ['returned', 'picked_up', 'transferred'];

/**
 * Parse treatment_details từ API → các dòng chăm sóc y tế (đồng bộ HealthExaminationPage + utils web).
 * Hỗ trợ: [first_aid|medication] Tên x SL (ghi chú), Tên x SL, Tên (ghi chú) không có SL, rest/other.
 */
function parseTreatmentDetailsToItems(
  treatmentDetails: string,
  globalType: string
): TreatmentItemData[] {
  const lines = treatmentDetails.split(/\r?\n/).filter((l) => l.trim());
  const baseId = Date.now();
  return lines.map((line, idx) => {
    const trimmed = line.trim();
    const typeMarkerMatch = trimmed.match(/^\[(\w+)\]\s*(.*)$/);
    let lineType = globalType;
    let content = trimmed;
    if (typeMarkerMatch) {
      lineType = typeMarkerMatch[1];
      content = typeMarkerMatch[2].trim();
    }
    const lt = lineType as TreatmentType | '';
    if (lt === 'other' || lt === 'rest') {
      return {
        id: `${baseId}_${idx}`,
        item_type: lt,
        treatment_name: content,
        quantity: '',
        notes: '',
      };
    }
    const matchWithNotes = content.match(/^(.+?)\s+x\s+(.+?)\s+\((.+)\)$/);
    if (matchWithNotes) {
      return {
        id: `${baseId}_${idx}`,
        item_type: lt as TreatmentType,
        treatment_name: matchWithNotes[1].trim(),
        quantity: matchWithNotes[2].trim(),
        notes: matchWithNotes[3].trim(),
      };
    }
    const matchQty = content.match(/^(.+?)\s+x\s+(.+)$/);
    if (matchQty) {
      return {
        id: `${baseId}_${idx}`,
        item_type: lt as TreatmentType,
        treatment_name: matchQty[1].trim(),
        quantity: matchQty[2].trim(),
        notes: '',
      };
    }
    // Tên (Ghi chú) — không có " x SL" (prefill khi sửa, giống web)
    const matchNameWithNotesOnly = content.match(/^(.+?)\s+\((.+)\)$/);
    if (matchNameWithNotesOnly) {
      return {
        id: `${baseId}_${idx}`,
        item_type: lt as TreatmentType,
        treatment_name: matchNameWithNotesOnly[1].trim(),
        quantity: '',
        notes: matchNameWithNotesOnly[2].trim(),
      };
    }
    return {
      id: `${baseId}_${idx}`,
      item_type: lt as TreatmentType,
      treatment_name: content,
      quantity: '',
      notes: '',
    };
  });
}

const defaultTreatmentRow: TreatmentItemData = {
  id: '1',
  item_type: '',
  treatment_name: '',
  quantity: '',
  notes: '',
};

const ExaminationForm: React.FC<ExaminationFormProps> = ({
  visitId,
  visitReason: initialVisitReason = '',
  visitLeaveClinicTime,
  visitStatus,
  initialData,
  onSave,
  onUploadImage,
  loading = false,
}) => {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const [androidKeyboardHeight, setAndroidKeyboardHeight] = useState(0);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const subShow = Keyboard.addListener('keyboardDidShow', (e) => {
      setAndroidKeyboardHeight(e.endCoordinates?.height ?? 0);
    });
    const subHide = Keyboard.addListener('keyboardDidHide', () => setAndroidKeyboardHeight(0));
    return () => {
      subShow.remove();
      subHide.remove();
    };
  }, []);

  // Config data
  const [diseaseClassifications, setDiseaseClassifications] = useState<DiseaseClassificationItem[]>(
    []
  );
  const [medicines, setMedicines] = useState<MedicineItem[]>([]);
  const [firstAidItems, setFirstAidItems] = useState<FirstAidItem[]>([]);
  const [loadingConfig, setLoadingConfig] = useState(true);

  // Form state - theo thứ tự của web (InitialExamFormFields)
  const [visitReason, setVisitReason] = useState(initialVisitReason);
  const [symptoms, setSymptoms] = useState(initialData?.symptoms || '');
  const [dietHistory, setDietHistory] = useState(initialData?.diet_history || '');
  const [images, setImages] = useState<ExaminationImage[]>(initialData?.images || []);
  const [examinationNotes, setExaminationNotes] = useState(initialData?.examination_notes || '');
  const [diseaseClassification, setDiseaseClassification] = useState(
    initialData?.disease_classification || ''
  );
  // Chăm sóc y tế: mỗi dòng có item_type (first_aid/medication/rest/other)
  const [treatmentItems, setTreatmentItems] = useState<TreatmentItemData[]>([
    { id: '1', item_type: '', treatment_name: '', quantity: '', notes: '' },
  ]);
  const [notes, setNotes] = useState(initialData?.notes || '');
  // NVYT thăm khám
  const [medicalStaff, setMedicalStaff] = useState(initialData?.medical_staff || '');
  const [medicalStaffList, setMedicalStaffList] = useState<MedicalStaffUser[]>([]);
  // Thời gian vào/về y tế
  const [clinicCheckinTime, setClinicCheckinTime] = useState(
    formatTimeHHMM(initialData?.clinic_checkin_time) || ''
  );

  const [uploadingImage, setUploadingImage] = useState(false);

  // Sync visitReason khi prop thay đổi
  useEffect(() => {
    setVisitReason(initialVisitReason);
  }, [initialVisitReason]);

  // Load config on mount
  useEffect(() => {
    loadConfig();
  }, []);

  // Hydrate chăm sóc y tế khi mở sửa hồ sơ — dependency theo id + nội dung, tránh reset khi parent truyền lại object mới cùng bản ghi
  useEffect(() => {
    if (!initialData?.name) return;

    if (initialData.treatment_details?.trim()) {
      const items = parseTreatmentDetailsToItems(
        initialData.treatment_details,
        initialData.treatment_type || ''
      );
      setTreatmentItems(items.length > 0 ? items : [{ ...defaultTreatmentRow }]);
    } else if (initialData.treatment_type === 'rest') {
      setTreatmentItems([
        { id: '1', item_type: 'rest', treatment_name: '', quantity: '', notes: '' },
      ]);
    } else {
      setTreatmentItems([{ ...defaultTreatmentRow }]);
    }
  }, [initialData?.name, initialData?.treatment_details, initialData?.treatment_type]);

  const loadConfig = async () => {
    try {
      setLoadingConfig(true);
      // Load song song
      const [diseases, meds, aids, staff] = await Promise.all([
        healthConfigService.getDiseaseClassifications(),
        healthConfigService.getMedicines(),
        healthConfigService.getFirstAidItems(),
        dailyHealthService.getMedicalStaffList(),
      ]);
      setDiseaseClassifications(diseases);
      setMedicines(meds);
      setFirstAidItems(aids);
      setMedicalStaffList(staff);
    } catch (error) {
      console.error('Error loading health config:', error);
    } finally {
      setLoadingConfig(false);
    }
  };

  // Handle image pick
  const handlePickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('Cần quyền truy cập', 'Vui lòng cho phép truy cập thư viện ảnh');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsMultipleSelection: false,
    });

    if (!result.canceled && result.assets[0]) {
      await uploadImage(result.assets[0]);
    }
  };

  // Handle camera
  const handleTakePhoto = async () => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('Cần quyền truy cập', 'Vui lòng cho phép truy cập camera');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      await uploadImage(result.assets[0]);
    }
  };

  const uploadImage = async (asset: ImagePicker.ImagePickerAsset) => {
    try {
      setUploadingImage(true);
      const fileName = asset.uri.split('/').pop() || 'image.jpg';
      const fileType = asset.mimeType || 'image/jpeg';

      const fileUrl = await onUploadImage({
        uri: asset.uri,
        name: fileName,
        type: fileType,
      });

      if (fileUrl) {
        setImages((prev) => [...prev, { image: fileUrl }]);
      } else {
        Alert.alert('Lỗi', 'Không thể tải ảnh lên');
      }
    } catch {
      Alert.alert('Lỗi', 'Không thể tải ảnh lên');
    } finally {
      setUploadingImage(false);
    }
  };

  // Remove image
  const handleRemoveImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  // Treatment items handlers
  const handleAddTreatmentItem = () => {
    setTreatmentItems([
      ...treatmentItems,
      { id: Date.now().toString(), item_type: '', treatment_name: '', quantity: '', notes: '' },
    ]);
  };

  const handleRemoveTreatmentItem = (id: string) => {
    if (treatmentItems.length > 1) {
      setTreatmentItems(treatmentItems.filter((item) => item.id !== id));
    }
  };

  const handleUpdateTreatmentItem = (id: string, field: keyof TreatmentItemData, value: string) => {
    setTreatmentItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  // Validate & save
  const handleSave = () => {
    if (!medicalStaff) {
      Alert.alert('Thiếu thông tin', 'Vui lòng chọn nhân viên y tế thăm khám');
      return;
    }

    if (!symptoms.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập lý do vào phòng y tế');
      return;
    }

    if (!examinationNotes.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập nhận định ban đầu');
      return;
    }

    if (!diseaseClassification.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng chọn phân loại bệnh');
      return;
    }

    const hasValidTreatment = treatmentItems.some((item) => item.item_type);
    if (!hasValidTreatment) {
      Alert.alert('Thiếu thông tin', 'Vui lòng chọn ít nhất một loại chăm sóc y tế');
      return;
    }

    const invalidOther = treatmentItems.find(
      (item) => item.item_type === 'other' && !item.treatment_name?.trim()
    );
    if (invalidOther) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập mô tả cho loại chăm sóc "Khác"');
      return;
    }

    // Build treatment_details theo format web: [item_type] content
    const validItems = treatmentItems.filter((item) => item.item_type);
    const treatmentDetails = validItems
      .filter((item) => item.treatment_name.trim())
      .map((item) => {
        if (item.item_type === 'other' || item.item_type === 'rest') {
          return `[${item.item_type}] ${item.treatment_name}`;
        }
        return `[${item.item_type}] ${item.treatment_name}${item.quantity ? ` x ${item.quantity}` : ''}${item.notes ? ` (${item.notes})` : ''}`;
      })
      .join('\n');
    const primaryTreatmentType = validItems[0]?.item_type || '';

    const data: CreateExaminationParams = {
      visit_id: visitId,
      symptoms: symptoms.trim(),
      diet_history: dietHistory.trim() || undefined,
      images: images.length > 0 ? images : undefined,
      disease_classification: diseaseClassification || undefined,
      examination_notes: examinationNotes.trim() || undefined,
      treatment_type: (primaryTreatmentType as TreatmentType) || undefined,
      treatment_details: treatmentDetails.trim() || undefined,
      notes: notes.trim() || undefined,
      medical_staff: medicalStaff || undefined,
      clinic_checkin_time: normalizeTimeForApi(clinicCheckinTime) || undefined,
      clinic_checkout_time:
        normalizeTimeForApi(visitLeaveClinicTime?.trim() || initialData?.clinic_checkout_time) || undefined,
    };

    onSave(data, visitReason.trim() !== initialVisitReason ? visitReason.trim() : undefined);
  };

  // Options cho medicines và first aid
  const medicineOptions = medicines.map((item) => ({
    value: item.title,
    label: item.unit ? `${item.title} (${item.unit})` : item.title,
  }));

  const firstAidOptions = firstAidItems.map((item) => ({
    value: item.title,
    label: item.unit ? `${item.title} (${item.unit})` : item.title,
  }));

  // Check form validity - giống web
  const hasValidTreatment = treatmentItems.some((item) => item.item_type);
  const isFormValid =
    medicalStaff &&
    symptoms.trim() &&
    examinationNotes.trim() &&
    diseaseClassification.trim() &&
    hasValidTreatment;

  if (loadingConfig) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <ActivityIndicator size="large" color="#C2410C" />
        <Text style={{ marginTop: 12, color: '#6B7280' }}>Đang tải cấu hình...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      ref={scrollRef}
      style={{ flex: 1, backgroundColor: '#FFFFFF' }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
      contentContainerStyle={{
        paddingBottom: insets.bottom + 100 + (Platform.OS === 'android' ? androidKeyboardHeight : 0) + 12,
      }}>
      <View style={{ padding: 16 }}>
        {/* 1. Nhân viên Y tế thăm khám (*) */}
        <SearchableSelect
          label="Nhân viên Y tế thăm khám"
          placeholder="Chọn nhân viên y tế..."
          value={medicalStaff}
          options={medicalStaffList.map((u) => ({
            value: u.name,
            label: normalizeVietnameseName(u.full_name || u.email) || u.full_name || u.email,
          }))}
          onChange={setMedicalStaff}
          required
        />

        {/* 2. Lưu ý của Giáo viên về tình trạng học sinh */}
        <View style={{ marginBottom: 16 }}>
          <Text
            style={{
              fontSize: 14,
              fontWeight: '500',
              color: '#374151',
              marginBottom: 8,
              fontFamily: 'Mulish',
            }}>
            Lưu ý của Giáo viên về tình trạng học sinh
          </Text>
          <TextInput
            value={visitReason}
            onChangeText={setVisitReason}
            placeholder="Mô tả lưu ý của giáo viên về tình trạng học sinh..."
            placeholderTextColor="#9CA3AF"
            multiline
            numberOfLines={2}
            style={{
              minHeight: 60,
              borderRadius: 12,
              backgroundColor: images.length > 0 ? '#FFFBEB' : '#F9FAFB',
              borderWidth: 1,
              borderColor: images.length > 0 ? '#FDE68A' : '#E5E7EB',
              padding: 12,
              fontSize: 15,
              color: '#1F2937',
              textAlignVertical: 'top',
            }}
          />
        </View>

        {/* 3. Thời gian vào */}
        <View style={{ marginBottom: 16 }}>
          <Text
            style={{
              fontSize: 14,
              fontWeight: '500',
              color: '#374151',
              marginBottom: 8,
              fontFamily: 'Mulish',
            }}>
            Thời gian vào
          </Text>
          <TextInput
            value={clinicCheckinTime}
            onChangeText={setClinicCheckinTime}
            placeholder="HH:MM"
            placeholderTextColor="#9CA3AF"
            keyboardType="numbers-and-punctuation"
            style={{
              borderRadius: 12,
              backgroundColor: '#F9FAFB',
              padding: 12,
              fontSize: 15,
              color: '#1F2937',
            }}
          />
        </View>

        {/* 4. Lý do vào phòng y tế (*) */}
        <View style={{ marginBottom: 16 }}>
          <Text
            style={{
              fontSize: 14,
              fontWeight: '500',
              color: '#374151',
              marginBottom: 8,
              fontFamily: 'Mulish',
            }}>
            Lý do vào phòng y tế <Text style={{ color: '#BE123C', fontFamily: 'Mulish' }}>*</Text>
          </Text>
          <TextInput
            value={symptoms}
            onChangeText={setSymptoms}
            placeholder="Mô tả lý do vào phòng y tế..."
            placeholderTextColor="#9CA3AF"
            multiline
            numberOfLines={3}
            style={{
              minHeight: 80,
              borderRadius: 12,
              backgroundColor: '#F9FAFB',
              padding: 12,
              fontSize: 15,
              color: '#1F2937',
              textAlignVertical: 'top',
            }}
          />
        </View>

        {/* 5. Lịch sử ăn uống */}
        <View style={{ marginBottom: 16 }}>
          <Text
            style={{
              fontSize: 14,
              fontWeight: '500',
              color: '#374151',
              marginBottom: 8,
              fontFamily: 'Mulish',
            }}>
            Lịch sử ăn uống
          </Text>
          <TextInput
            value={dietHistory}
            onChangeText={setDietHistory}
            placeholder="Mô tả lịch sử ăn uống của học sinh (nếu có)..."
            placeholderTextColor="#9CA3AF"
            multiline
            numberOfLines={2}
            style={{
              minHeight: 60,
              borderRadius: 12,
              backgroundColor: '#F9FAFB',
              padding: 12,
              fontSize: 15,
              color: '#1F2937',
              textAlignVertical: 'top',
            }}
          />
        </View>

        {/* 6. Hình ảnh (nếu có) */}
        <View style={{ marginBottom: 16 }}>
          <Text
            style={{
              fontSize: 14,
              fontWeight: '500',
              color: '#374151',
              marginBottom: 8,
              fontFamily: 'Mulish',
            }}>
            Hình ảnh (nếu có)
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {images.map((img, index) => (
              <View key={index} style={{ position: 'relative' }}>
                <Image
                  source={{ uri: img.image }}
                  style={{ width: 80, height: 80, borderRadius: 8 }}
                  resizeMode="cover"
                />
                <TouchableOpacity
                  onPress={() => handleRemoveImage(index)}
                  style={{
                    position: 'absolute',
                    top: -8,
                    right: -8,
                    width: 24,
                    height: 24,
                    borderRadius: 12,
                    backgroundColor: '#FFF1F2',
                    borderWidth: 1,
                    borderColor: '#FECDD3',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                  <Ionicons name="close" size={14} color="#BE123C" />
                </TouchableOpacity>
              </View>
            ))}

            {/* Nút thêm ảnh */}
            <TouchableOpacity
              onPress={handlePickImage}
              disabled={uploadingImage}
              style={{
                width: 80,
                height: 80,
                borderRadius: 8,
                backgroundColor: '#F3F4F6',
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 2,
                borderStyle: 'dashed',
                borderColor: '#D1D5DB',
              }}>
              {uploadingImage ? (
                <ActivityIndicator size="small" color="#C2410C" />
              ) : (
                <>
                  <Ionicons name="image-outline" size={24} color="#9CA3AF" />
                  <Text style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>Thư viện</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleTakePhoto}
              disabled={uploadingImage}
              style={{
                width: 80,
                height: 80,
                borderRadius: 8,
                backgroundColor: '#F3F4F6',
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 2,
                borderStyle: 'dashed',
                borderColor: '#D1D5DB',
              }}>
              <Ionicons name="camera-outline" size={24} color="#9CA3AF" />
              <Text style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>Chụp ảnh</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 7. Nhận định ban đầu (*) */}
        <View style={{ marginBottom: 16 }}>
          <Text
            style={{
              fontSize: 14,
              fontWeight: '500',
              color: '#374151',
              marginBottom: 8,
              fontFamily: 'Mulish',
            }}>
            Nhận định ban đầu <Text style={{ color: '#BE123C', fontFamily: 'Mulish' }}>*</Text>
          </Text>
          <TextInput
            value={examinationNotes}
            onChangeText={setExaminationNotes}
            placeholder="Nhận định ban đầu..."
            placeholderTextColor="#9CA3AF"
            multiline
            numberOfLines={3}
            style={{
              minHeight: 80,
              borderRadius: 12,
              backgroundColor: '#F9FAFB',
              padding: 12,
              fontSize: 15,
              color: '#1F2937',
              textAlignVertical: 'top',
            }}
          />
        </View>

        {/* 8. Phân loại bệnh (*) */}
        <SearchableSelect
          label="Phân loại bệnh"
          placeholder="Chọn phân loại bệnh..."
          value={diseaseClassification}
          options={diseaseClassifications.map((item) => ({
            value: item.title,
            label: item.title,
          }))}
          onChange={setDiseaseClassification}
          required
        />

        {/* 9. Chăm sóc y tế (*) - mỗi dòng có loại xử trí (giống web) */}
        <View style={{ marginBottom: 16 }}>
          <Text
            style={{
              fontSize: 14,
              fontWeight: '500',
              color: '#374151',
              marginBottom: 8,
              fontFamily: 'Mulish',
            }}>
            Chăm sóc y tế <Text style={{ color: '#BE123C', fontFamily: 'Mulish' }}>*</Text>
          </Text>
          {treatmentItems.map((item) => (
            <TreatmentItemRow
              key={item.id}
              item={item}
              medicines={medicineOptions}
              firstAidItems={firstAidOptions}
              onUpdate={(field, value) => handleUpdateTreatmentItem(item.id, field, value)}
              onRemove={() => handleRemoveTreatmentItem(item.id)}
              canRemove={treatmentItems.length > 1}
            />
          ))}
          <TouchableOpacity
            onPress={handleAddTreatmentItem}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: 12,
              borderRadius: 12,
              borderWidth: 1,
              borderStyle: 'dashed',
              borderColor: '#FED7AA',
            }}>
            <Ionicons name="add-circle-outline" size={20} color="#C2410C" />
            <Text style={{ marginLeft: 8, fontSize: 14, color: '#C2410C', fontWeight: '500' }}>
              Thêm dòng
            </Text>
          </TouchableOpacity>
        </View>

        {/* Thời gian về - chỉ hiển thị khi học sinh đã checkout (returned/picked_up/transferred) */}
        {visitStatus &&
          CHECKOUT_STATUSES.includes(visitStatus) &&
          (visitLeaveClinicTime?.trim() || initialData?.clinic_checkout_time) && (
          <View style={{ marginBottom: 16 }}>
            <Text
              style={{
                fontSize: 14,
                fontWeight: '500',
                color: '#374151',
                marginBottom: 8,
                fontFamily: 'Mulish',
              }}>
              Thời gian về
            </Text>
            <View
              style={{
                borderRadius: 12,
                backgroundColor: '#F3F4F6',
                padding: 12,
              }}>
              <Text
                style={{
                  fontSize: 15,
                  color: '#1F2937',
                  fontFamily: 'Mulish',
                }}>
                {formatTimeHHMM(
                  visitLeaveClinicTime || initialData?.clinic_checkout_time
                ) || '-'}
              </Text>
            </View>
          </View>
        )}

        {/* 7. Ghi chú */}
        <View style={{ marginBottom: 24 }}>
          <Text
            style={{
              fontSize: 14,
              fontWeight: '500',
              color: '#374151',
              marginBottom: 8,
              fontFamily: 'Mulish',
            }}>
            Ghi chú
          </Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            onFocus={() => {
              requestAnimationFrame(() =>
                setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150)
              );
            }}
            placeholder="Ghi chú thêm (nếu có)..."
            placeholderTextColor="#9CA3AF"
            multiline
            numberOfLines={2}
            style={{
              minHeight: 60,
              borderRadius: 12,
              backgroundColor: '#F9FAFB',
              padding: 12,
              fontSize: 15,
              color: '#1F2937',
              textAlignVertical: 'top',
            }}
          />
        </View>

        {/* Nút Lưu */}
        <TouchableOpacity
          onPress={handleSave}
          disabled={loading || !isFormValid}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: 16,
            borderRadius: 12,
            backgroundColor: loading || !isFormValid ? '#E5E7EB' : '#FFF7ED',
            borderWidth: loading || !isFormValid ? 0 : 1,
            borderColor: loading || !isFormValid ? 'transparent' : '#FED7AA',
          }}>
          {loading ? (
            <ActivityIndicator size="small" color="#C2410C" />
          ) : (
            <>
              <Ionicons name="save-outline" size={20} color="#C2410C" />
              <Text
                style={{
                  marginLeft: 8,
                  fontSize: 16,
                  fontWeight: '600',
                  color: '#C2410C',
                  fontFamily: 'Mulish',
                }}>
                Lưu hồ sơ khám
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

export default ExaminationForm;

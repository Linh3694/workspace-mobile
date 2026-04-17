/**
 * Tạo / sửa vấn đề CRM — giao diện theo DisciplineAddEditScreen; nghiệp vụ khớp web AddEditIssue (HTML nội dung, đính kèm upload khi Lưu)
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
  KeyboardAvoidingView,
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TouchableOpacity, BottomSheetModal, ActionSheet } from '../../components/Common';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import DatePickerModal from '../../components/DatePickerModal';
import TimePickerModal from '../../components/TimePickerModal';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { ROUTES } from '../../constants/routes';
import { useAuth } from '../../context/AuthContext';
import {
  canWriteCrmIssue,
  CRM_ISSUE_DIRECT_ISSUE_ROLES,
  hasCrmAccess,
} from '../../utils/crmIssuePermissions';
import {
  createIssue,
  getIssue,
  getModules,
  getDepartments,
  getIssuePicCandidates,
  updateIssue,
  uploadIssueAttachment,
  searchCrmStudents,
  collectDepartmentMemberEmailsForIssue,
  type CrmStudentSearchHit,
} from '../../services/crmIssueService';
import type { CRMIssueModule, CRMIssueDepartment, IssuePicCandidate } from '../../types/crmIssue';
import { normalizeStudentClassTitle } from '../../utils/studentClassUtils';
import { getPicDisplayName } from '../../utils/nameUtils';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type RAdd = RouteProp<RootStackParamList, typeof ROUTES.SCREENS.CRM_ISSUE_ADD>;
type REdit = RouteProp<RootStackParamList, typeof ROUTES.SCREENS.CRM_ISSUE_EDIT>;

const PRIMARY = '#002855';
const ERROR = '#EF4444';
const MULISH = 'Mulish';

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const ALLOWED_ATTACHMENT_EXT = ['png', 'jpg', 'jpeg', 'heic', 'docx', 'pdf'] as const;

/** Plain text → HTML — đồng bộ web AddEditIssue */
function plainTextToHtml(text: string): string {
  if (!text.trim()) return text;
  if (text.trim().startsWith('<')) return text;

  const lines = text.split('\n');
  const parts: string[] = [];
  let inList = false;

  for (const raw of lines) {
    const line = raw.trimEnd();
    const bulletMatch = line.match(/^\s*[-•►*]\s+(.*)/);
    if (bulletMatch) {
      if (!inList) {
        parts.push('<ul>');
        inList = true;
      }
      parts.push(`<li>${bulletMatch[1]}</li>`);
    } else {
      if (inList) {
        parts.push('</ul>');
        inList = false;
      }
      if (line.trim() === '') {
        parts.push('<br>');
      } else {
        parts.push(`<p>${line}</p>`);
      }
    }
  }
  if (inList) parts.push('</ul>');
  return parts.join('');
}

/** HTML → plain — khi load từ API */
function htmlToPlainText(html: string): string {
  if (!html.trim()) return html;
  if (!html.trim().startsWith('<')) return html;
  let text = html;
  text = text.replace(/<li>/gi, '• ').replace(/<\/li>/gi, '\n');
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<\/p>\s*<p>/gi, '\n');
  text = text.replace(/<\/?(?:p|ul|ol|div)[^>]*>/gi, '\n');
  text = text.replace(/<[^>]+>/g, '');
  text = text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  return text.replace(/\n{3,}/g, '\n\n').trim();
}

const toIsoDate = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const formatOccurredForApi = (d: Date): string => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

const timeStrFromDate = (d: Date): string => {
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
};

const mergeDateAndTime = (datePart: Date, timeHHmm: string): Date => {
  const m = timeHHmm.trim().match(/^(\d{1,2}):(\d{2})/);
  const h = m ? parseInt(m[1], 10) : datePart.getHours();
  const min = m ? parseInt(m[2], 10) : datePart.getMinutes();
  return new Date(
    datePart.getFullYear(),
    datePart.getMonth(),
    datePart.getDate(),
    h,
    min,
    0,
    0
  );
};

const extFromName = (name: string) => name.split('.').pop()?.toLowerCase() ?? '';

const CRMIssueAddEditScreen: React.FC = () => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const route = useRoute<RAdd | REdit>();
  const { user } = useAuth();
  const roles: string[] = Array.isArray(user?.roles) ? user.roles : [];
  const sessionUserId = (user?.email || (user as { name?: string } | undefined)?.name || '').trim();
  useEffect(() => {
    if (!sessionUserId && user) {
      // eslint-disable-next-line no-console
      console.warn('[CRMIssue] User thiếu email/name — phân quyền phòng ban có thể sai');
    }
  }, [sessionUserId, user]);

  const canCreateDirectSales = useMemo(
    () => CRM_ISSUE_DIRECT_ISSUE_ROLES.some((r) => roles.includes(r)),
    [roles],
  );

  const issueId = route.params?.issueId;
  const isEdit = Boolean(issueId);

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [modules, setModules] = useState<CRMIssueModule[]>([]);
  const [departments, setDepartments] = useState<CRMIssueDepartment[]>([]);
  const [moduleId, setModuleId] = useState<string>('');
  /** Nhiều CRM Issue Department — khớp web departments[] */
  const [selectedDeptIds, setSelectedDeptIds] = useState<string[]>([]);
  const [picId, setPicId] = useState<string>('');
  const [candidates, setCandidates] = useState<IssuePicCandidate[]>([]);
  const [occurredAt, setOccurredAt] = useState(new Date());
  const [occurredTimeStr, setOccurredTimeStr] = useState(() => timeStrFromDate(new Date()));
  const [showDate, setShowDate] = useState(false);
  const [showTime, setShowTime] = useState(false);
  const [showStudents, setShowStudents] = useState(false);
  const [showModule, setShowModule] = useState(false);
  const [showDept, setShowDept] = useState(false);
  const [showAttachSheet, setShowAttachSheet] = useState(false);
  const [showPic, setShowPic] = useState(false);
  /** URL từ server (sửa) */
  const [serverAttachmentUrl, setServerAttachmentUrl] = useState<string>('');
  /** File chọn cục bộ — chỉ upload khi bấm Lưu (giống web) */
  const [pendingAttachment, setPendingAttachment] = useState<{
    uri: string;
    name: string;
    mime?: string;
    size?: number;
  } | null>(null);
  /** Đã chọn — có mã + lớp khi tìm từ CRM (khớp web badge) */
  const [students, setStudents] = useState<
    { name: string; student_name: string; student_code?: string; current_class_title?: string }[]
  >([]);
  const [studentSheetSearch, setStudentSheetSearch] = useState('');
  const [studentHits, setStudentHits] = useState<CrmStudentSearchHit[]>([]);
  const [picSearch, setPicSearch] = useState('');

  const loadMeta = useCallback(async () => {
    const [m, d, p] = await Promise.all([getModules(), getDepartments(), getIssuePicCandidates()]);
    if (m.success && m.data) setModules(m.data);
    if (d.success && d.data) setDepartments(d.data);
    if (p.success && p.data) setCandidates(p.data);
  }, []);

  useEffect(() => {
    if (!hasCrmAccess(roles)) {
      Alert.alert(t('common.error'), t('crm_issue.no_crm_access') || 'Không có quyền truy cập CRM');
      navigation.goBack();
      return;
    }
    loadMeta();
  }, [loadMeta, navigation, roles, t]);

  useEffect(() => {
    const run = async () => {
      if (!isEdit || !issueId) return;
      setLoading(true);
      try {
        const res = await getIssue(issueId);
        if (res.success && res.data) {
          const doc = res.data;
          const memberEmails = await collectDepartmentMemberEmailsForIssue(doc);
          const canEdit =
            doc.can_write_issue === true || doc.can_write_issue === false
              ? doc.can_write_issue
              : canWriteCrmIssue(sessionUserId, memberEmails, roles);
          if (!canEdit) {
            Alert.alert(t('common.error'), t('crm_issue.cannot_edit'));
            navigation.goBack();
            return;
          }
          setTitle(doc.title);
          setContent(htmlToPlainText(doc.content || ''));
          setModuleId(doc.issue_module);
          const fromRows = (doc.issue_departments ?? [])
            .map((r) => r.department)
            .filter(Boolean) as string[];
          setSelectedDeptIds(
            fromRows.length > 0 ? fromRows : doc.department ? [doc.department] : []
          );
          setPicId(doc.pic || '');
          if (doc.occurred_at) {
            const d = new Date(doc.occurred_at);
            if (!Number.isNaN(d.getTime())) {
              setOccurredAt(d);
              setOccurredTimeStr(timeStrFromDate(d));
            }
          }
          setServerAttachmentUrl(doc.attachment || '');
          setPendingAttachment(null);
          const rows = doc.issue_students || [];
          const studs = rows
            .filter((r) => r.student)
            .map((r) => {
              return {
                name: r.student!,
                student_name: r.student_display_name || r.student!,
                student_code: (r as any).student_code,
                current_class_title: r.student_class_title,
              };
            });
          setStudents(studs);
        }
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [isEdit, issueId, navigation, roles, sessionUserId, t]);

  // Tìm học sinh trong sheet (chỉ khi sheet mở — khớp web)
  useEffect(() => {
    if (!showStudents) return;
    const timer = setTimeout(async () => {
      if (studentSheetSearch.trim().length < 2) {
        setStudentHits([]);
        return;
      }
      const r = await searchCrmStudents(studentSheetSearch);
      if (r.success) setStudentHits(r.data);
    }, 400);
    return () => clearTimeout(timer);
  }, [studentSheetSearch, showStudents]);

  const filteredPicCandidates = useMemo(() => {
    const q = picSearch.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter(
      (c) =>
        (c.full_name || '').toLowerCase().includes(q) ||
        getPicDisplayName(c.full_name, c.email).toLowerCase().includes(q) ||
        (c.email || '').toLowerCase().includes(q)
    );
  }, [candidates, picSearch]);

  const attachmentDisplayName = useMemo(() => {
    if (pendingAttachment) return pendingAttachment.name;
    if (serverAttachmentUrl) {
      try {
        const seg = serverAttachmentUrl.split('/').filter(Boolean).pop() || serverAttachmentUrl;
        return decodeURIComponent(seg.replace(/\+/g, ' '));
      } catch {
        return serverAttachmentUrl;
      }
    }
    return '';
  }, [pendingAttachment, serverAttachmentUrl]);

  const hasAttachment = Boolean(pendingAttachment || serverAttachmentUrl);

  const stageFileAsset = (uri: string, name: string, mime?: string, size?: number) => {
    const ext = extFromName(name);
    if (!ALLOWED_ATTACHMENT_EXT.includes(ext as (typeof ALLOWED_ATTACHMENT_EXT)[number])) {
      Alert.alert(t('common.error'), t('crm_issue.attachment_allowed_formats') || 'Định dạng không hỗ trợ');
      return;
    }
    if (size != null && size > MAX_ATTACHMENT_BYTES) {
      Alert.alert(t('common.error'), t('crm_issue.attachment_max_size') || 'Tối đa 10MB');
      return;
    }
    setPendingAttachment({ uri, name, mime, size });
    setServerAttachmentUrl('');
  };

  const pickFromCamera = async () => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(t('common.error'), t('crm_issue.camera_permission_denied') || 'Cần cấp quyền camera');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.8,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const a = result.assets[0];
      const name = a.fileName || `photo_${Date.now()}.jpg`;
      stageFileAsset(a.uri, name, a.mimeType ?? 'image/jpeg', a.fileSize ?? undefined);
    } catch (e: any) {
      Alert.alert(t('common.error'), e?.message || 'Lỗi chụp ảnh');
    }
  };

  const pickFromGallery = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(t('common.error'), t('crm_issue.gallery_permission_denied') || 'Cần cấp quyền thư viện ảnh');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const a = result.assets[0];
      const name = a.fileName || `image_${Date.now()}.jpg`;
      stageFileAsset(a.uri, name, a.mimeType ?? 'image/jpeg', a.fileSize ?? undefined);
    } catch (e: any) {
      Alert.alert(t('common.error'), e?.message || 'Lỗi chọn ảnh');
    }
  };

  const pickDocument = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
      if ((res as any).canceled) return;
      const asset = (res as any).assets?.[0] || res;
      if (!asset?.uri) return;
      stageFileAsset(asset.uri, asset.name || 'file', asset.mimeType, asset.size as number | undefined);
    } catch (e: any) {
      Alert.alert(t('common.error'), e?.message || 'Lỗi chọn file');
    }
  };

  const pendingAttachAction = React.useRef<string | null>(null);

  const onAttachAction = (value: string) => {
    pendingAttachAction.current = value;
    setShowAttachSheet(false);
  };

  const onAttachSheetDismiss = () => {
    const action = pendingAttachAction.current;
    if (!action) return;
    pendingAttachAction.current = null;
    // Delay nhỏ để iOS native view controller sẵn sàng present picker
    setTimeout(() => {
      if (action === 'camera') pickFromCamera();
      else if (action === 'gallery') pickFromGallery();
      else if (action === 'document') pickDocument();
    }, 150);
  };

  const clearAttachment = () => {
    setPendingAttachment(null);
    setServerAttachmentUrl('');
  };

  const toggleDepartment = (id: string) => {
    setSelectedDeptIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleStudent = (s: CrmStudentSearchHit) => {
    setStudents((prev) => {
      const exists = prev.find((x) => x.name === s.name);
      if (exists) return prev.filter((x) => x.name !== s.name);
      return [
        ...prev,
        {
          name: s.name,
          student_name: s.student_name,
          student_code: s.student_code,
          current_class_title: s.current_class_title,
        },
      ];
    });
  };

  const onSubmit = async () => {
    if (!title.trim() || !content.trim() || !moduleId) {
      Alert.alert(t('common.error'), t('crm_issue.required_fields'));
      return;
    }
    setSaving(true);
    try {
      let attachmentFinal: string | undefined = serverAttachmentUrl || undefined;
      if (pendingAttachment) {
        const up = await uploadIssueAttachment(
          pendingAttachment.uri,
          pendingAttachment.name,
          pendingAttachment.mime
        );
        if (!up.success || !up.fileUrl) {
          Alert.alert(t('common.error'), up.message || 'Upload thất bại');
          setSaving(false);
          return;
        }
        attachmentFinal = up.fileUrl;
      }

      const occurred = mergeDateAndTime(occurredAt, occurredTimeStr);
      const contentHtml = plainTextToHtml(content.trim());
      const studentIds = students.map((s) => s.name);

      if (isEdit && issueId) {
        const res = await updateIssue({
          name: issueId,
          title: title.trim(),
          content: contentHtml,
          issue_module: moduleId,
          department: selectedDeptIds[0] || undefined,
          departments: selectedDeptIds.length ? selectedDeptIds : undefined,
          pic: picId || undefined,
          occurred_at: formatOccurredForApi(occurred),
          attachment: attachmentFinal,
          students: studentIds,
          student: studentIds[0] || '',
        });
        if (res.success) {
          Alert.alert(t('common.success'), res.message || '');
          navigation.goBack();
        } else Alert.alert(t('common.error'), res.message || '');
      } else {
        const res = await createIssue({
          title: title.trim(),
          content: contentHtml,
          issue_module: moduleId,
          department: selectedDeptIds[0] || undefined,
          departments: selectedDeptIds.length ? selectedDeptIds : undefined,
          pic: picId || undefined,
          occurred_at: formatOccurredForApi(occurred),
          attachment: attachmentFinal,
          students: studentIds,
          student: studentIds[0] || '',
        });
        if (res.success) {
          Alert.alert(t('common.success'), res.message || '');
          navigation.goBack();
        } else Alert.alert(t('common.error'), res.message || '');
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={PRIMARY} />
        <Text style={styles.loadingText}>{t('common.loading')}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View className="flex-row items-center border-b border-gray-100 bg-white px-4 py-3">
        <TouchableOpacity onPress={() => navigation.goBack()} className="rounded-full p-2">
          <Ionicons name="arrow-back" size={22} color={PRIMARY} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {isEdit ? t('crm_issue.edit_title') : t('crm_issue.create_title')}
        </Text>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
        <ScrollView
          className="flex-1 px-4"
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 40, paddingTop: 16 }}>
          {!isEdit && !canCreateDirectSales ? (
            <View
              style={{
                marginBottom: 12,
                borderRadius: 8,
                backgroundColor: '#FFFBEB',
                borderWidth: 1,
                borderColor: '#FDE68A',
                padding: 12,
              }}>
              <Text style={{ fontSize: 13, color: '#92400E', fontFamily: MULISH }}>
                Vấn đề của bạn sẽ được gửi chờ duyệt trước khi hiển thị cho phòng xử lý (khớp web).
              </Text>
            </View>
          ) : null}
          {/* Học sinh — mở bottom sheet (cùng pattern loại vấn đề / phòng ban / PIC) */}
          <View style={styles.fieldWrapper}>
            <Text style={styles.fieldLabel}>{t('crm_issue.students')}</Text>
            <TouchableOpacity onPress={() => { Keyboard.dismiss(); setTimeout(() => setShowStudents(true), 100); }} style={styles.inputRow}>
              <Text
                style={[styles.inputText, students.length === 0 && styles.placeholder]}
                numberOfLines={1}>
                {students.length > 0
                  ? t('crm_issue.students_selected_count', { count: students.length })
                  : t('crm_issue.students_pick_placeholder')}
              </Text>
              <Ionicons name="chevron-down" size={20} color="#9CA3AF" />
            </TouchableOpacity>
            {students.length > 0 ? (
              <View style={styles.chipRow}>
                {students.map((s) => {
                  const classSub = normalizeStudentClassTitle(s.current_class_title);
                  const line1 =
                    s.student_code && String(s.student_code).trim()
                      ? `${s.student_name} (${s.student_code})`
                      : s.student_name;
                  return (
                    <TouchableOpacity
                      key={s.name}
                      onPress={() => setStudents((p) => p.filter((x) => x.name !== s.name))}
                      style={styles.chip}>
                      <View style={styles.chipTextCol}>
                        <Text style={styles.chipText} numberOfLines={1}>
                          {line1}
                        </Text>
                        {classSub ? (
                          <Text style={styles.chipSub} numberOfLines={1}>
                            {classSub}
                          </Text>
                        ) : null}
                      </View>
                      <Ionicons name="close-circle" size={18} color={PRIMARY} />
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : null}
          </View>

          <View style={styles.fieldWrapper}>
            <Text style={styles.fieldLabel}>
              {t('crm_issue.field_title')} <Text style={styles.asterisk}>*</Text>
            </Text>
            <TextInput
              style={styles.textInput}
              value={title}
              onChangeText={setTitle}
              placeholderTextColor="#9CA3AF"
            />
          </View>

          <View style={styles.fieldWrapper}>
            <Text style={styles.fieldLabel}>
              {t('crm_issue.module')} <Text style={styles.asterisk}>*</Text>
            </Text>
            <TouchableOpacity onPress={() => { Keyboard.dismiss(); setTimeout(() => setShowModule(true), 100); }} style={styles.inputRow}>
              <Text style={[styles.inputText, !moduleId && styles.placeholder]} numberOfLines={1}>
                {modules.find((m) => m.name === moduleId)?.module_name || t('crm_issue.select_module')}
              </Text>
              <Ionicons name="chevron-down" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          </View>

          <View style={styles.fieldWrapper}>
            <Text style={styles.fieldLabel}>{t('crm_issue.occurred_at')}</Text>
            <TouchableOpacity onPress={() => setShowDate(true)} style={styles.inputRow}>
              <Text style={styles.inputText}>{toIsoDate(occurredAt)}</Text>
              <Ionicons name="calendar-outline" size={20} color="#9CA3AF" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setShowTime(true)}
              style={[styles.inputRow, { marginTop: 8 }]}>
              <Text style={styles.inputText}>{occurredTimeStr}</Text>
              <Ionicons name="time-outline" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          </View>

          <View style={styles.fieldWrapper}>
            <Text style={styles.fieldLabel}>{t('crm_issue.department')}</Text>
            <TouchableOpacity onPress={() => { Keyboard.dismiss(); setTimeout(() => setShowDept(true), 100); }} style={styles.inputRow}>
              <Text
                style={[styles.inputText, selectedDeptIds.length === 0 && styles.placeholder]}
                numberOfLines={2}>
                {selectedDeptIds.length === 0
                  ? t('crm_issue.optional')
                  : selectedDeptIds
                      .map((id) => departments.find((d) => d.name === id)?.department_name || id)
                      .join(', ')}
              </Text>
              <Ionicons name="chevron-down" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          </View>

          <View style={styles.fieldWrapper}>
            <Text style={styles.fieldLabel}>{t('crm_issue.pic')}</Text>
            <TouchableOpacity onPress={() => { Keyboard.dismiss(); setTimeout(() => setShowPic(true), 100); }} style={styles.inputRow}>
              <Text style={[styles.inputText, !picId && styles.placeholder]} numberOfLines={1}>
                {(() => {
                  const c = candidates.find((x) => x.user_id === picId);
                  return c ? getPicDisplayName(c.full_name, c.email) : t('crm_issue.optional');
                })()}
              </Text>
              <Ionicons name="chevron-down" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          </View>

          <View style={styles.fieldWrapper}>
            <Text style={styles.fieldLabel}>
              {t('crm_issue.field_content')} <Text style={styles.asterisk}>*</Text>
            </Text>
            <TextInput
              style={[styles.textInput, { minHeight: 160, textAlignVertical: 'top' }]}
              multiline
              value={content}
              onChangeText={setContent}
              placeholder={t('crm_issue.content_placeholder')}
              placeholderTextColor="#9CA3AF"
            />
          </View>

          <View style={styles.fieldWrapper}>
            <Text style={styles.fieldLabel}>{t('crm_issue.attachment')}</Text>
            <TouchableOpacity onPress={() => { Keyboard.dismiss(); setTimeout(() => setShowAttachSheet(true), 100); }} style={styles.attachZone}>
              <Ionicons name="cloud-upload-outline" size={36} color="#F59E0B" />
              <Text style={styles.attachHint}>{t('crm_issue.tap_to_select_file')}</Text>
              <Text style={styles.attachSub}>
                {t('crm_issue.attachment_upload_on_save')}
              </Text>
              <Text style={styles.attachFormats}>
                {t('crm_issue.attachment_allowed_formats')} · {t('crm_issue.attachment_max_size')}
              </Text>
            </TouchableOpacity>
            {hasAttachment ? (
              <View style={styles.fileRow}>
                <Ionicons name="document-attach-outline" size={22} color={PRIMARY} />
                <Text style={styles.fileName} numberOfLines={2}>
                  {attachmentDisplayName}
                </Text>
                <TouchableOpacity onPress={clearAttachment} className="p-1">
                  <Ionicons name="close-circle" size={22} color="#9CA3AF" />
                </TouchableOpacity>
              </View>
            ) : null}
          </View>

          <View style={styles.btnRow}>
            <TouchableOpacity
              onPress={onSubmit}
              disabled={saving}
              style={[styles.btnPrimary, { flex: 1 }]}>
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.btnPrimaryText}>{t('common.save')}</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              disabled={saving}
              style={[styles.btnSecondary, { flex: 1 }]}>
              <Text style={styles.btnSecondaryText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <DatePickerModal
        visible={showDate}
        value={occurredAt}
        onSelect={(d) => {
          setOccurredAt(mergeDateAndTime(d, occurredTimeStr));
          setShowDate(false);
        }}
        onClose={() => setShowDate(false)}
      />
      <TimePickerModal
        visible={showTime}
        value={occurredTimeStr}
        onSelect={(tStr) => {
          setOccurredTimeStr(tStr);
          setOccurredAt(mergeDateAndTime(occurredAt, tStr));
          setShowTime(false);
        }}
        onClose={() => setShowTime(false)}
      />

      {/* Bottom sheet: học sinh liên quan — tìm ≥2 ký tự, chọn nhiều */}
      <BottomSheetModal
        visible={showStudents}
        onClose={() => {
          setShowStudents(false);
          setStudentSheetSearch('');
          setStudentHits([]);
        }}
        maxHeightPercent={70}
        fillHeight>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.sheetKeyboard}>
          <View style={styles.sheetInner}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{t('crm_issue.students')}</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowStudents(false);
                  setStudentSheetSearch('');
                  setStudentHits([]);
                }}
                style={styles.sheetDone}>
                <Text style={styles.sheetDoneText}>{t('common.close')}</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              placeholder={t('crm_issue.student_search_placeholder')}
              value={studentSheetSearch}
              onChangeText={setStudentSheetSearch}
              style={styles.searchInput}
              placeholderTextColor="#9CA3AF"
            />
            {studentSheetSearch.trim().length < 2 ? (
              <Text style={styles.sheetHint}>{t('crm_issue.student_sheet_min_chars')}</Text>
            ) : studentHits.length === 0 ? (
              <Text style={styles.sheetHint}>{t('crm_issue.student_sheet_empty')}</Text>
            ) : null}
            <ScrollView
              keyboardShouldPersistTaps="handled"
              style={styles.sheetScrollFlex}
              onScrollBeginDrag={() => Keyboard.dismiss()}>
              {studentHits.map((h) => {
                const selected = students.some((s) => s.name === h.name);
                return (
                  <TouchableOpacity
                    key={h.name}
                    onPress={() => toggleStudent(h)}
                    style={[styles.sheetItem, selected && styles.sheetItemSelected]}>
                    <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
                      {selected ? <Ionicons name="checkmark" size={14} color="#fff" /> : null}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[styles.sheetItemText, selected && styles.sheetItemTextSelected]}
                        numberOfLines={1}>
                        {h.student_name}
                      </Text>
                      <Text style={styles.studentCodeSub} numberOfLines={1}>
                        {h.student_code}
                      </Text>
                      {normalizeStudentClassTitle(h.current_class_title) ? (
                        <Text style={styles.studentClassSub} numberOfLines={2}>
                          {normalizeStudentClassTitle(h.current_class_title)}
                        </Text>
                      ) : null}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </BottomSheetModal>

      {/* Bottom sheet: loại vấn đề */}
      <BottomSheetModal visible={showModule} onClose={() => setShowModule(false)} maxHeightPercent={50} keyboardAvoiding={false} fillHeight>
        <View style={styles.sheetInner}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{t('crm_issue.select_module')}</Text>
            <TouchableOpacity onPress={() => setShowModule(false)} style={styles.sheetDone}>
              <Text style={styles.sheetDoneText}>{t('common.close')}</Text>
            </TouchableOpacity>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" style={{ flex: 1 }}>
            {modules.length === 0 ? (
              <Text style={styles.sheetHint}>{t('crm_issue.no_modules')}</Text>
            ) : null}
            {modules.map((m) => (
              <TouchableOpacity
                key={m.name}
                onPress={() => {
                  setModuleId(m.name);
                  setShowModule(false);
                }}
                style={[styles.sheetItem, moduleId === m.name && styles.sheetItemSelected]}>
                <Text
                  style={[styles.sheetItemText, moduleId === m.name && styles.sheetItemTextSelected]}
                  numberOfLines={2}>
                  {m.module_name}
                </Text>
                {moduleId === m.name ? (
                  <Ionicons name="checkmark-circle" size={22} color={PRIMARY} />
                ) : null}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </BottomSheetModal>

      <BottomSheetModal visible={showDept} onClose={() => setShowDept(false)} maxHeightPercent={50} keyboardAvoiding={false} fillHeight>
        <View style={styles.sheetInner}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{t('crm_issue.select_department')}</Text>
            <TouchableOpacity onPress={() => setShowDept(false)} style={styles.sheetDone}>
              <Text style={styles.sheetDoneText}>{t('common.close')}</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            onPress={() => {
              setSelectedDeptIds([]);
              setShowDept(false);
            }}
            style={styles.sheetItem}>
            <Text style={styles.clearText}>{t('crm_issue.clear_department')}</Text>
          </TouchableOpacity>
          <ScrollView keyboardShouldPersistTaps="handled" style={{ flex: 1 }}>
            {departments.length === 0 ? (
              <Text style={styles.sheetHint}>{t('crm_issue.no_departments')}</Text>
            ) : null}
            {departments.map((d) => {
              const selected = selectedDeptIds.includes(d.name);
              return (
                <TouchableOpacity
                  key={d.name}
                  onPress={() => toggleDepartment(d.name)}
                  style={[styles.sheetItem, selected && styles.sheetItemSelected]}>
                  <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
                    {selected ? <Ionicons name="checkmark" size={14} color="#fff" /> : null}
                  </View>
                  <Text
                    style={[styles.sheetItemText, selected && styles.sheetItemTextSelected]}
                    numberOfLines={2}>
                    {d.department_name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </BottomSheetModal>

      <BottomSheetModal visible={showPic} onClose={() => setShowPic(false)} maxHeightPercent={70} fillHeight>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1, minHeight: 200 }}>
          <View style={styles.sheetInner}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{t('crm_issue.select_pic')}</Text>
              <TouchableOpacity onPress={() => setShowPic(false)} style={styles.sheetDone}>
                <Text style={styles.sheetDoneText}>{t('common.close')}</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              placeholder={t('crm_issue.pic_search_placeholder')}
              value={picSearch}
              onChangeText={setPicSearch}
              style={styles.searchInput}
              placeholderTextColor="#9CA3AF"
            />
            <TouchableOpacity
              onPress={() => {
                setPicId('');
                setShowPic(false);
              }}
              style={styles.sheetItem}>
              <Text style={styles.clearText}>{t('crm_issue.clear_pic')}</Text>
            </TouchableOpacity>
            <ScrollView keyboardShouldPersistTaps="handled" style={{ flex: 1 }}>
              {filteredPicCandidates.map((c) => (
                <TouchableOpacity
                  key={c.user_id}
                  onPress={() => {
                    setPicId(c.user_id);
                    setShowPic(false);
                    setPicSearch('');
                  }}
                  style={[styles.sheetItem, picId === c.user_id && styles.sheetItemSelected]}>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[styles.sheetItemText, picId === c.user_id && styles.sheetItemTextSelected]}
                      numberOfLines={1}>
                      {getPicDisplayName(c.full_name, c.email)}
                    </Text>
                    <Text style={styles.picEmail} numberOfLines={1}>
                      {c.email}
                    </Text>
                  </View>
                  {picId === c.user_id ? (
                    <Ionicons name="checkmark-circle" size={22} color={PRIMARY} />
                  ) : null}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </BottomSheetModal>

      <ActionSheet
        visible={showAttachSheet}
        title={t('crm_issue.attach_source_title')}
        options={[
          { label: t('crm_issue.attach_camera'), value: 'camera' },
          { label: t('crm_issue.attach_gallery'), value: 'gallery' },
          { label: t('crm_issue.attach_document'), value: 'document' },
        ]}
        onSelect={onAttachAction}
        onCancel={() => setShowAttachSheet(false)}
        onDismiss={onAttachSheetDismiss}
        cancelText={t('common.cancel')}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 16,
    color: '#6B7280',
    fontFamily: MULISH,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
    color: PRIMARY,
    fontFamily: MULISH,
    marginRight: 40,
  },
  fieldWrapper: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
    fontFamily: MULISH,
  },
  asterisk: { color: ERROR },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
  },
  inputText: {
    fontSize: 15,
    color: '#1F2937',
    flex: 1,
    fontFamily: MULISH,
  },
  placeholder: { color: '#9CA3AF' },
  sheetKeyboard: {
    flex: 1,
    minHeight: 200,
  },
  sheetScrollFlex: {
    flex: 1,
  },
  sheetHint: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 8,
    fontFamily: MULISH,
  },
  studentCodeSub: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
    fontFamily: MULISH,
  },
  /** Dòng lớp trong sheet tìm học sinh — cùng logic phụ đề web */
  studentClassSub: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
    fontFamily: MULISH,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  checkboxSelected: {
    borderColor: PRIMARY,
    backgroundColor: PRIMARY,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    backgroundColor: '#F9FAFB',
    fontFamily: MULISH,
    color: '#1F2937',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: '#E5EAF0',
    maxWidth: '100%',
  },
  chipTextCol: {
    flexShrink: 1,
    maxWidth: 220,
  },
  chipText: {
    fontSize: 13,
    color: PRIMARY,
    fontWeight: '600',
    fontFamily: MULISH,
  },
  chipSub: {
    fontSize: 10,
    color: '#6B7280',
    marginTop: 2,
    fontFamily: MULISH,
  },
  attachZone: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#D1D5DB',
    backgroundColor: '#FAFAFA',
  },
  attachHint: {
    marginTop: 8,
    fontSize: 14,
    color: '#4B5563',
    fontFamily: MULISH,
  },
  attachSub: {
    marginTop: 4,
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    fontFamily: MULISH,
  },
  attachFormats: {
    marginTop: 8,
    fontSize: 11,
    color: '#9CA3AF',
    textAlign: 'center',
    fontFamily: MULISH,
  },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
  },
  fileName: { flex: 1, fontSize: 13, color: '#374151', fontFamily: MULISH },
  btnRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  btnPrimary: {
    backgroundColor: '#3F4246',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  btnPrimaryText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
    fontFamily: MULISH,
  },
  btnSecondary: {
    backgroundColor: '#F3F4F6',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  btnSecondaryText: {
    color: '#374151',
    fontWeight: '600',
    fontSize: 16,
    fontFamily: MULISH,
  },
  sheetInner: {
    padding: 16,
    flex: 1,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: PRIMARY,
    fontFamily: MULISH,
    flex: 1,
  },
  sheetDone: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  sheetDoneText: {
    color: PRIMARY,
    fontWeight: '600',
    fontFamily: MULISH,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    marginBottom: 8,
    fontFamily: MULISH,
  },
  sheetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    gap: 8,
  },
  sheetItemSelected: {
    backgroundColor: '#EFF6FF',
    marginHorizontal: -8,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  sheetItemText: {
    flex: 1,
    fontSize: 15,
    color: '#374151',
    fontFamily: MULISH,
  },
  sheetItemTextSelected: {
    fontWeight: '600',
    color: PRIMARY,
  },
  clearText: { fontSize: 14, color: '#6B7280', fontFamily: MULISH },
  picEmail: { fontSize: 12, color: '#6B7280', marginTop: 2, fontFamily: MULISH },
});

export default CRMIssueAddEditScreen;

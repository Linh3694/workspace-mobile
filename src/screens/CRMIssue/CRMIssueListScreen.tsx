/**
 * Danh sách vấn đề CRM — layout theo DisciplineScreen: SafeAreaView, FAB thêm (#F05023), search rounded-2xl
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Modal,
  ScrollView,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { TouchableOpacity } from '../../components/Common';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { ROUTES } from '../../constants/routes';
import { useAuth } from '../../context/AuthContext';
import { canSeeFullIssueListTabs, hasCrmAccess } from '../../utils/crmIssuePermissions';
import {
  getIssues,
  getPendingIssues,
  getModules,
  getDepartments,
  getMyIssueUnits,
} from '../../services/crmIssueService';
import type { CRMIssue, CRMIssueStatus } from '../../types/crmIssue';
import { CRM_ISSUE_STATUS_LABELS } from '../../types/crmIssue';
import { IssueCard } from './components/IssueCard';

const PER_PAGE = 20;

/** Docname phòng ban trên dòng issue — khớp web rowDepartmentIds */
function rowDepartmentIds(row: CRMIssue): string[] {
  if (row.departments?.length) return row.departments;
  const d = row.department?.trim();
  return d ? [d] : [];
}

/** Danh sách nhãn phòng ban liên quan — dùng render badge trên thẻ */
function departmentLabelListForRow(row: CRMIssue, deptMap: Record<string, string>): string[] {
  const ids = rowDepartmentIds(row);
  return ids.map((id) => deptMap[id] || id).filter(Boolean);
}

/** Tab danh sách — khớp web `IssueListTab` */
type IssueListTab = 'all' | 'mine' | 'related' | 'pending';

const CRMIssueListScreen: React.FC = () => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user } = useAuth();
  const roles: string[] = Array.isArray(user?.roles) ? user.roles : [];
  const sessionUserId = (user?.email || (user as { name?: string })?.name || '').trim();
  const canSeeCrm = hasCrmAccess(roles);
  const [isMemberOfAnyIssueDept, setIsMemberOfAnyIssueDept] = useState(false);
  /**
   * Tab "Tất cả" + "Chờ duyệt" chỉ dành cho System Manager / BOD / nhóm Care — khớp web
   * `CRM_ISSUE_FULL_LIST_TAB_ROLES`. Trước đây mobile cho mọi user có quyền CRM đều thấy.
   */
  const canSeeAllAndPending = canSeeFullIssueListTabs(roles);
  const showPendingQueueTab = canSeeAllAndPending;
  const showRelatedTab = isMemberOfAnyIssueDept;

  const [tab, setTab] = useState<IssueListTab>(canSeeAllAndPending ? 'all' : 'mine');
  const [items, setItems] = useState<CRMIssue[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState('');
  /** Từ khoá đã debounce — gửi lên API (tìm trên toàn bộ dữ liệu, không chỉ trang đang tải) */
  const [searchQuery, setSearchQuery] = useState('');
  const [moduleMap, setModuleMap] = useState<Record<string, string>>({});
  const [deptMap, setDeptMap] = useState<Record<string, string>>({});
  const [filterStatus, setFilterStatus] = useState<CRMIssueStatus | ''>('');
  const [filterModule, setFilterModule] = useState<string>('');
  const [filterDept, setFilterDept] = useState<string>('');
  const [modules, setModules] = useState<{ name: string; module_name: string }[]>([]);
  const [departments, setDepartments] = useState<{ name: string; department_name: string }[]>([]);
  const [showFilter, setShowFilter] = useState(false);

  const loadMeta = useCallback(async () => {
    const [m, d] = await Promise.all([getModules(), getDepartments()]);
    if (m.success && m.data) {
      setModules(m.data.map((x) => ({ name: x.name, module_name: x.module_name })));
      const map: Record<string, string> = {};
      m.data.forEach((x) => {
        map[x.name] = x.module_name;
      });
      setModuleMap(map);
    }
    if (d.success && d.data) {
      setDepartments(d.data.map((x) => ({ name: x.name, department_name: x.department_name })));
      const dm: Record<string, string> = {};
      d.data.forEach((x) => {
        dm[x.name] = x.department_name;
      });
      setDeptMap(dm);
    }
  }, []);

  /**
   * User có thuộc đơn vị (Sơ đồ tổ chức) liên quan issue không — quyết định tab "Liên quan".
   * Một lời gọi `get_my_issue_units` như web; trước đây duyệt hết phòng ban rồi gọi chi tiết
   * từng cái (N+1) qua API `issue_department` nay đã bị gỡ khỏi backend.
   */
  useEffect(() => {
    if (!sessionUserId) {
      setIsMemberOfAnyIssueDept(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const res = await getMyIssueUnits();
      if (cancelled) return;
      setIsMemberOfAnyIssueDept(res.success && Array.isArray(res.data) && res.data.length > 0);
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionUserId]);

  useEffect(() => {
    const timer = setTimeout(() => setSearchQuery(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  /** Tab không còn hợp lệ (mất quyền / không thuộc đơn vị nào) → rơi về tab an toàn */
  useEffect(() => {
    if (tab === 'related' && !isMemberOfAnyIssueDept) {
      setTab(canSeeAllAndPending ? 'all' : 'mine');
    }
    if ((tab === 'all' || tab === 'pending') && !canSeeAllAndPending) {
      setTab('mine');
    }
  }, [tab, isMemberOfAnyIssueDept, canSeeAllAndPending]);

  const fetchPage = useCallback(
    async (p: number, append: boolean) => {
      if (!canSeeCrm) return;
      try {
        if (p === 1 && !append) setLoading(true);
        if (p > 1) setLoadingMore(true);

        const params: Parameters<typeof getIssues>[0] = {
          page: p,
          per_page: PER_PAGE,
        };
        if (filterStatus) params.status = filterStatus;
        if (filterModule) params.issue_module = filterModule;
        if (filterDept) params.department = filterDept;
        if (searchQuery) params.search = searchQuery;
        if (tab === 'related') {
          params.only_my_departments = true;
        }
        if (tab === 'mine') {
          params.mine = true;
        }

        let res;
        if (tab === 'pending' && showPendingQueueTab) {
          res = await getPendingIssues({
            page: p,
            per_page: PER_PAGE,
            ...(searchQuery ? { search: searchQuery } : {}),
          });
        } else {
          res = await getIssues(params);
        }

        if (res.success && res.data) {
          const list = res.data;
          setItems((prev) => (append ? [...prev, ...list] : list));
          setPage(p);
          if (res.pagination) {
            setTotalPages(res.pagination.total_pages || 1);
          }
        } else {
          if (!append) setItems([]);
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    },
    [canSeeCrm, tab, showPendingQueueTab, filterStatus, filterModule, filterDept, searchQuery]
  );

  useEffect(() => {
    loadMeta();
  }, [loadMeta]);

  useFocusEffect(
    useCallback(() => {
      if (canSeeCrm) {
        fetchPage(1, false);
      } else {
        setLoading(false);
      }
    }, [canSeeCrm, fetchPage, tab, showPendingQueueTab])
  );

  /**
   * Server đã lọc theo `search` trên toàn bộ dữ liệu (mã, tiêu đề, học sinh, phụ huynh).
   * Trước đây lọc bằng JS trên `items` nên chỉ tìm được trong các trang đã tải về.
   */
  const displayItems = items;

  const onRefresh = () => {
    setRefreshing(true);
    fetchPage(1, false);
  };

  const loadMore = () => {
    if (loadingMore || page >= totalPages) return;
    fetchPage(page + 1, true);
  };

  const moduleLabel = useMemo(() => moduleMap, [moduleMap]);

  /** Tab hiển thị + nhãn — khớp thứ tự web: Tất cả · Của tôi · Liên quan · Chờ duyệt */
  const tabOptions = useMemo(() => {
    const opts: { value: IssueListTab; label: string }[] = [];
    if (canSeeAllAndPending) opts.push({ value: 'all', label: t('crm_issue.all_issues') });
    opts.push({ value: 'mine', label: t('crm_issue.tab_mine') });
    if (showRelatedTab) opts.push({ value: 'related', label: t('crm_issue.tab_related') });
    if (showPendingQueueTab) opts.push({ value: 'pending', label: t('crm_issue.pending_approval') });
    return opts;
  }, [canSeeAllAndPending, showRelatedTab, showPendingQueueTab, t]);

  /** Thông báo rỗng theo ngữ cảnh — khớp web `emptyMessage` */
  const emptyMessage = useMemo(() => {
    if (search.trim() || filterStatus || filterModule || filterDept) {
      return t('crm_issue.not_found');
    }
    if (tab === 'mine') return t('crm_issue.empty_mine');
    if (tab === 'related') return t('crm_issue.empty_related');
    if (tab === 'pending') return t('crm_issue.empty_pending');
    return t('crm_issue.empty');
  }, [search, filterStatus, filterModule, filterDept, tab, t]);

  // Không quyền CRM — giống DisciplineScreen (không header, chỉ icon + nội dung + nút)
  if (!canSeeCrm) {
    return (
      <SafeAreaView
        className="flex-1 bg-white"
        style={{ paddingTop: Platform.OS === 'android' ? insets.top : 0 }}
        edges={['top']}>
        <View className="flex-1 items-center justify-center px-6">
          <MaterialIcons name="lock-outline" size={56} color="#D1D5DB" />
          <Text className="mt-4 text-center text-base font-medium text-gray-600">
            {t('crm_issue.no_crm_access')}
          </Text>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            className="mt-6 rounded-xl bg-[#002855] px-6 py-3">
            <Text className="text-base font-semibold text-white">{t('common.back')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      className="flex-1 bg-white"
      style={{ paddingTop: Platform.OS === 'android' ? insets.top : 0 }}
      edges={['top']}>
      <View className="flex-1">
        {/* Header — cùng pattern DisciplineScreen (Ticket) */}
        <View className="flex-row items-center px-4 py-4">
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            className="-ml-2 mr-1 items-center justify-center p-2"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="arrow-back" size={24} color="#002855" />
          </TouchableOpacity>
          <View className="flex-1 items-center justify-center">
            <Text className="text-xl font-bold text-[#002855]">{t('crm_issue.list_title')}</Text>
          </View>
          {/* Cân phải giống Discipline — FAB thêm mới ở dưới */}
          <View style={{ width: 40 }} />
        </View>

        {/* Tabs — Tất cả / Của tôi / Liên quan / Chờ duyệt, đúng thứ tự và phân quyền như web */}
        <View className="mb-2 flex-row border-b border-gray-200 px-2">
          {tabOptions.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              onPress={() => setTab(opt.value)}
              className={`min-w-[24%] flex-1 items-center border-b-2 py-3 ${
                tab === opt.value ? 'border-[#002855]' : 'border-transparent'
              }`}>
              <Text
                className={`text-center text-sm font-semibold ${tab === opt.value ? 'text-[#002855]' : 'text-gray-500'}`}
                numberOfLines={1}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Search — rounded-2xl bg-gray-100 như Discipline */}
        <View className="flex-row items-center gap-2 px-4 py-2">
          <View className="flex-1 flex-row items-center rounded-2xl bg-gray-100 px-3 py-2">
            <Ionicons name="search" size={20} color="#666" />
            <TextInput
              className="ml-2 flex-1 text-base text-gray-800"
              placeholder={t('crm_issue.search_placeholder')}
              value={search}
              onChangeText={setSearch}
              returnKeyType="search"
              placeholderTextColor="#9CA3AF"
            />
            {search ? (
              <TouchableOpacity onPress={() => setSearch('')}>
                <Ionicons name="close-circle" size={20} color="#666" />
              </TouchableOpacity>
            ) : null}
          </View>
          <TouchableOpacity
            onPress={() => setShowFilter(true)}
            className="rounded-2xl bg-gray-100 p-2">
            <Ionicons name="filter" size={22} color="#374151" />
          </TouchableOpacity>
        </View>

        {loading && !refreshing ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#002855" />
            <Text className="mt-4 text-gray-500">{t('common.loading')}</Text>
          </View>
        ) : (
          <FlatList
            data={displayItems}
            keyExtractor={(it) => it.name}
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <IssueCard
                item={item}
                moduleLabel={moduleLabel[item.issue_module]}
                departmentLabels={departmentLabelListForRow(item, deptMap)}
                onPress={() =>
                  navigation.navigate(ROUTES.SCREENS.CRM_ISSUE_DETAIL, { issueId: item.name })
                }
              />
            )}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={['#002855']}
              />
            }
            onEndReached={loadMore}
            onEndReachedThreshold={0.3}
            ListFooterComponent={
              loadingMore ? (
                <ActivityIndicator className="py-4" color="#002855" />
              ) : (
                <View className="h-8" />
              )
            }
            ListEmptyComponent={
              <View className="items-center justify-center px-6 py-20">
                <Ionicons name="document-text-outline" size={64} color="#D1D5DB" />
                <Text className="mt-4 text-center text-base font-medium text-gray-500">
                  {emptyMessage}
                </Text>
              </View>
            }
          />
        )}

        {/* FAB thêm vấn đề — giống Discipline (nền cam #F05023) */}
        <TouchableOpacity
          onPress={() => navigation.navigate(ROUTES.SCREENS.CRM_ISSUE_ADD)}
          className="absolute bottom-[10%] right-[5%] h-14 w-14 items-center justify-center rounded-full bg-[#F05023] shadow-lg">
          <Ionicons name="add" size={30} color="white" />
        </TouchableOpacity>

        {/* Modal bộ lọc — màu nhấn #002855 cho đồng bộ Discipline */}
        <Modal visible={showFilter} animationType="slide" transparent>
          <View className="flex-1 justify-end bg-black/40">
            <View
              className="max-h-[70%] rounded-t-3xl bg-white"
              style={{ paddingBottom: insets.bottom + 16 }}>
              <View className="flex-row items-center justify-between border-b border-gray-100 px-4 py-3">
                <Text className="text-lg font-bold text-[#002855]">{t('crm_issue.filters')}</Text>
                <TouchableOpacity onPress={() => setShowFilter(false)} className="p-1">
                  <Ionicons name="close" size={24} color="#666" />
                </TouchableOpacity>
              </View>
              <ScrollView className="mt-4 px-4">
                <Text className="text-sm text-gray-600">{t('crm_issue.status')}</Text>
                <View className="mt-2 flex-row flex-wrap gap-2">
                  <TouchableOpacity
                    onPress={() => setFilterStatus('')}
                    className={`rounded-full border px-3 py-1 ${!filterStatus ? 'border-[#002855] bg-blue-50' : 'border-gray-200'}`}>
                    <Text className="text-xs">{t('crm_issue.all')}</Text>
                  </TouchableOpacity>
                  {(Object.keys(CRM_ISSUE_STATUS_LABELS) as CRMIssueStatus[]).map((s) => (
                    <TouchableOpacity
                      key={s}
                      onPress={() => setFilterStatus(s)}
                      className={`rounded-full border px-3 py-1 ${filterStatus === s ? 'border-[#002855] bg-blue-50' : 'border-gray-200'}`}>
                      <Text className="text-xs">{CRM_ISSUE_STATUS_LABELS[s]}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text className="mt-4 text-sm text-gray-600">{t('crm_issue.module')}</Text>
                <ScrollView horizontal className="mt-2" showsHorizontalScrollIndicator={false}>
                  <TouchableOpacity
                    onPress={() => setFilterModule('')}
                    className={`mr-2 rounded-full border px-3 py-1 ${!filterModule ? 'border-[#002855] bg-blue-50' : 'border-gray-200'}`}>
                    <Text className="text-xs">{t('crm_issue.all')}</Text>
                  </TouchableOpacity>
                  {modules.map((m) => (
                    <TouchableOpacity
                      key={m.name}
                      onPress={() => setFilterModule(m.name)}
                      className={`mr-2 rounded-full border px-3 py-1 ${filterModule === m.name ? 'border-[#002855] bg-blue-50' : 'border-gray-200'}`}>
                      <Text className="text-xs" numberOfLines={1}>
                        {m.module_name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <Text className="mt-4 text-sm text-gray-600">{t('crm_issue.department')}</Text>
                <ScrollView horizontal className="mt-2" showsHorizontalScrollIndicator={false}>
                  <TouchableOpacity
                    onPress={() => setFilterDept('')}
                    className={`mr-2 rounded-full border px-3 py-1 ${!filterDept ? 'border-[#002855] bg-blue-50' : 'border-gray-200'}`}>
                    <Text className="text-xs">{t('crm_issue.all')}</Text>
                  </TouchableOpacity>
                  {departments.map((d) => (
                    <TouchableOpacity
                      key={d.name}
                      onPress={() => setFilterDept(d.name)}
                      className={`mr-2 rounded-full border px-3 py-1 ${filterDept === d.name ? 'border-[#002855] bg-blue-50' : 'border-gray-200'}`}>
                      <Text className="text-xs" numberOfLines={1}>
                        {d.department_name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </ScrollView>
              <View className="mt-4 flex-row justify-end gap-4 px-4">
                <TouchableOpacity onPress={() => setShowFilter(false)}>
                  <Text className="text-[#002855]">{t('common.close')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    setShowFilter(false);
                    fetchPage(1, false);
                  }}>
                  <Text className="font-semibold text-[#002855]">{t('crm_issue.apply')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
};

export default CRMIssueListScreen;

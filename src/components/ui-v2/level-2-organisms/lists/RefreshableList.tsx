import React from 'react';
import { FlatList, RefreshControl, View, type ListRenderItem } from 'react-native';

import { Spinner, AppText } from '../../level-0-atoms';
import { color, layout, space } from '../../../../theme/tokens';
import EmptyState, { type EmptyStateProps } from '../states/EmptyState';

/**
 * Danh sách cuộn — gộp `FlatList` + kéo-để-làm-mới + tải-thêm + trạng thái rỗng +
 * trạng thái đang tải vào MỘT organism.
 *
 * Hiện 38 file dùng `FlatList` và 39 file dùng `RefreshControl`, mỗi màn tự nối
 * lại bốn mảnh này từ đầu — và nối mỗi nơi một kiểu (màu spinner khác nhau, chỗ
 * có footer chỗ không, chỗ hiện empty state ngay cả khi đang tải).
 *
 * Khác web: không có phân trang bằng nút. Trên mobile danh sách dài phải virtualize
 * và tải thêm khi chạm đáy — nên `onEndReached` là một phần của organism, không
 * phải component riêng.
 */

export interface RefreshableListProps<T> {
  data: T[];
  renderItem: ListRenderItem<T>;
  keyExtractor: (item: T, index: number) => string;

  /** Đang tải trang đầu — hiện spinner giữa vùng nội dung thay cho trạng thái rỗng. */
  loading?: boolean;
  /** Đang tải thêm trang sau — hiện spinner nhỏ ở chân danh sách. */
  loadingMore?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  onEndReached?: () => void;

  /** Hiện khi `data` rỗng và không `loading`. */
  empty?: EmptyStateProps;
  /** Chèn trên đầu danh sách và CUỘN THEO danh sách (khác với header cố định của template). */
  header?: React.ReactNode;

  contentPadding?: number;
  /** Chừa chỗ dưới đáy cho FAB / thanh hành động khỏi che mất mục cuối. */
  bottomInset?: number;
}

function RefreshableList<T>({
  data,
  renderItem,
  keyExtractor,
  loading = false,
  loadingMore = false,
  refreshing = false,
  onRefresh,
  onEndReached,
  empty,
  header,
  contentPadding = layout.screenPadding,
  bottomInset = 0,
}: RefreshableListProps<T>) {
  return (
    <FlatList
      data={data}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{
        paddingHorizontal: contentPadding,
        paddingTop: space[4],
        paddingBottom: contentPadding + bottomInset,
        gap: space[10],
        // Cho spinner / trạng thái rỗng nở ra giữa màn thay vì dính lên đỉnh.
        flexGrow: data.length === 0 ? 1 : undefined,
      }}
      ListHeaderComponent={header ? <>{header}</> : null}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[color.brand.DEFAULT]}
            tintColor={color.brand.DEFAULT}
          />
        ) : undefined
      }
      onEndReached={onEndReached}
      onEndReachedThreshold={0.2}
      ListFooterComponent={
        loadingMore ? (
          <View style={{ paddingVertical: space[16] }}>
            <Spinner label="Đang tải thêm…" />
          </View>
        ) : null
      }
      ListEmptyComponent={
        loading ? (
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <Spinner size="large" label="Đang tải…" padded />
          </View>
        ) : empty ? (
          <EmptyState {...empty} />
        ) : (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <AppText variant="footnote" tone="description">
              Không có dữ liệu
            </AppText>
          </View>
        )
      }
    />
  );
}

export default RefreshableList;

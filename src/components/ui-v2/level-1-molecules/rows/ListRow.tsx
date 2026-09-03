import React from 'react';
import { View } from 'react-native';

import { Card, AppText, Icon, Avatar, Badge, type BadgeTone, type IconSet } from '../../level-0-atoms';
import { color, radius, space } from '../../../../theme/tokens';

/**
 * Hàng danh sách dạng THẺ — pattern lặp nhiều nhất của app.
 *
 * Khác web: đây không phải một `<tr>`. Trên màn 6 inch không có cột, nên thông tin
 * xếp theo thứ bậc dọc: dòng tiêu đề nổi bật, dòng phụ xám, nhãn trạng thái bên phải.
 *
 * Bố cục:
 *
 *   ┌──────────────────────────────────────────────┐
 *   │ [leading]  Tiêu đề              [trailing]   │
 *   │            Dòng phụ                          │
 *   │            ─────────────────────────────     │  ← footer (tuỳ chọn)
 *   └──────────────────────────────────────────────┘
 */

export interface ListRowProps {
  title: string;
  /** Dòng phụ dưới tiêu đề. */
  subtitle?: string | null;
  /** Ảnh đại diện đầu hàng. Ưu tiên thấp hơn `icon` nếu truyền cả hai. */
  avatarName?: string | null;
  avatarUri?: string | null;
  /** Icon đầu hàng, đặt trong ô bo tròn nền nhạt (§NGÔN NGỮ THIẾT KẾ mục 6). */
  icon?: string;
  iconSet?: IconSet;
  /** Nhãn trạng thái góc phải trên. */
  status?: { label: string; tone: BadgeTone } | null;
  /** Nội dung tự do góc phải trên — dùng khi `status` không đủ. */
  trailing?: React.ReactNode;
  /** Dải nội dung dưới cùng, ngăn bởi đường kẻ mảnh. */
  footer?: React.ReactNode;
  onPress?: () => void;
}

const ListRow: React.FC<ListRowProps> = ({
  title,
  subtitle,
  avatarName,
  avatarUri,
  icon,
  iconSet = 'auto',
  status,
  trailing,
  footer,
  onPress,
}) => {
  const hasLeading = !!icon || !!avatarName || !!avatarUri;

  return (
    <Card onPress={onPress} padding={space[16]}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space[12] }}>
        {hasLeading ? (
          icon ? (
            <View
              style={{
                width: 40,
                height: 40,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: radius[12],
                backgroundColor: color.brandSecondary[50],
              }}>
              <Icon name={icon} set={iconSet} size={20} tone="brandSecondary" />
            </View>
          ) : (
            <Avatar uri={avatarUri} name={avatarName} size="lg" />
          )
        ) : null}

        <View style={{ flex: 1, gap: space[2] }}>
          <AppText variant="headline" numberOfLines={1}>
            {title}
          </AppText>
          {subtitle ? (
            <AppText variant="footnote" tone="description" numberOfLines={1}>
              {subtitle}
            </AppText>
          ) : null}
        </View>

        {status ? <Badge label={status.label} tone={status.tone} dot /> : trailing}
      </View>

      {footer ? (
        <View
          style={{
            marginTop: space[12],
            paddingTop: space[12],
            borderTopWidth: 1,
            borderTopColor: color.line.subtle,
          }}>
          {footer}
        </View>
      ) : null}
    </Card>
  );
};

export default ListRow;

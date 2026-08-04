import React from 'react';
import { useAppUpdatePrompt } from '../hooks/useAppUpdate';
import UpdateRequiredModal from './UpdateRequiredModal';

interface VersionCheckerProps {
  children: React.ReactNode;
}

/**
 * Host popup cập nhật phiên bản — bọc quanh navigator để hiện được ở mọi màn hình.
 * Tự tra store (remote config → App Store / Google Play) sau khi splash chạy xong
 * và mỗi lần app quay lại foreground.
 */
export const VersionChecker: React.FC<VersionCheckerProps> = ({ children }) => {
  const { status, visible, mandatory, dismiss, openStore } = useAppUpdatePrompt();

  return (
    <>
      {children}
      {status?.latestVersion ? (
        <UpdateRequiredModal
          visible={visible}
          currentVersion={status.currentVersion}
          latestVersion={status.latestVersion}
          onUpdate={() => void openStore()}
          onLater={mandatory ? undefined : dismiss}
          forceUpdate={mandatory}
        />
      ) : null}
    </>
  );
};

export default VersionChecker;

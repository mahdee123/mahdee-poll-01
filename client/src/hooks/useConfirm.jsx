import { useCallback, useState } from 'react';
import ConfirmDialog from '../components/ConfirmDialog';

/**
 * Promise-based replacement for window.confirm().
 *
 *   const [confirm, confirmDialog] = useConfirm();
 *   if (!(await confirm({ title: 'Delete this sale?', destructive: true }))) return;
 *   ...
 *   return (<>{confirmDialog}<rest of the page/></>);
 */
export default function useConfirm() {
  const [request, setRequest] = useState(null);

  const confirm = useCallback(
    (options = {}) =>
      new Promise((resolve) => {
        setRequest({ ...options, resolve });
      }),
    [],
  );

  const settle = useCallback(
    (result) => {
      setRequest((current) => {
        current?.resolve(result);
        return null;
      });
    },
    [],
  );

  const confirmDialog = (
    <ConfirmDialog
      isOpen={!!request}
      title={request?.title || 'Are you sure?'}
      message={request?.message}
      confirmText={request?.confirmText || 'Confirm'}
      cancelText={request?.cancelText || 'Cancel'}
      destructive={request?.destructive}
      onConfirm={() => settle(true)}
      onCancel={() => settle(false)}
    />
  );

  return [confirm, confirmDialog];
}

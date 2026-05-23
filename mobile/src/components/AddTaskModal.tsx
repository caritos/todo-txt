import { Modal, View } from 'react-native';

type Props = { visible: boolean; onClose: () => void };

export function AddTaskModal({ visible, onClose }: Props) {
  return <Modal visible={visible} onRequestClose={onClose}><View style={{ flex: 1 }} /></Modal>;
}

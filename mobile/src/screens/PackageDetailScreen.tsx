import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  SafeAreaView, TextInput, Alert, Modal, ScrollView,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Crypto from 'expo-crypto';

import { RootStackParamList } from '../navigation/types';
import {
  getPackingList,
  getItemsForPackage, getPhotosForPackage,
  getItemTypeCache, ItemTypeCacheRow,
  upsertPackageItem, deletePackageItem,
  updatePackingListSyncState,
  PackageItemRow, PackagePhotoRow,
} from '../db/queries';

type Props = NativeStackScreenProps<RootStackParamList, 'PackageDetail'>;

export default function PackageDetailScreen({ route, navigation }: Props) {
  const { packageId, packingListLocalId } = route.params;

  const [items, setItems] = useState<PackageItemRow[]>([]);
  const [photos, setPhotos] = useState<PackagePhotoRow[]>([]);
  const [itemTypes, setItemTypes] = useState<ItemTypeCacheRow[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showTypePickerModal, setShowTypePickerModal] = useState(false);
  const [typeSearch, setTypeSearch] = useState('');
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [customName, setCustomName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [note, setNote] = useState('');
  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    const [its, phs, types, pl] = await Promise.all([
      getItemsForPackage(packageId),
      getPhotosForPackage(packageId),
      getItemTypeCache(),
      getPackingList(packingListLocalId),
    ]);
    setItems(its);
    setPhotos(phs);
    setItemTypes(types);
    const closedLike =
      pl?.status === 'CLOSED' ||
      pl?.status === 'COMPLETE' ||
      pl?.status === 'COMPLETE_PENDING_SYNC' ||
      pl?.sync_state === 'CLOSED' ||
      pl?.sync_state === 'COMPLETING' ||
      pl?.sync_state === 'COMPLETE_PENDING_SYNC';
    setIsReadOnly(!!closedLike);
  }, [packageId, packingListLocalId]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleAddItem = async () => {
    if (isReadOnly) {
      Alert.alert('Lista no editable', 'Esta lista ya fue completada o esta en proceso de cierre.');
      return;
    }
    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty < 1) {
      Alert.alert('Cantidad inválida', 'La cantidad debe ser un número entero mayor a 0.');
      return;
    }
    if (!selectedTypeId && !customName.trim()) {
      Alert.alert('Descripción requerida', 'Selecciona un tipo de artículo o ingresa un nombre personalizado.');
      return;
    }

    const id = await generateUUID();
    const newItem: PackageItemRow = {
      id,
      server_id: null,
      package_id: packageId,
      packing_item_type_id: selectedTypeId,
      custom_name: selectedTypeId ? null : customName.trim(),
      quantity: qty,
      note: note.trim() || null,
    };
    await upsertPackageItem(newItem);
    await updatePackingListSyncState(packingListLocalId, 'LOCAL', { syncError: null });
    setCustomName('');
    setQuantity('1');
    setNote('');
    setSelectedTypeId(null);
    setShowAddModal(false);
    await loadData();
  };

  const handleDeleteItem = (id: string) => {
    if (isReadOnly) {
      Alert.alert('Lista no editable', 'Esta lista ya fue completada o esta en proceso de cierre.');
      return;
    }
    Alert.alert('Eliminar artículo', '¿Estás seguro?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar', style: 'destructive',
        onPress: async () => {
          await deletePackageItem(id);
          await updatePackingListSyncState(packingListLocalId, 'LOCAL', { syncError: null });
          await loadData();
        },
      },
    ]);
  };

  const selectedTypeName = selectedTypeId
    ? (itemTypes.find(t => t.id === selectedTypeId)?.name_es ?? '')
    : null;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.toolbar}>
        <TouchableOpacity
          style={[styles.addBtn, isReadOnly && styles.disabledBtn]}
          onPress={() => setShowAddModal(true)}
          disabled={isReadOnly}
          accessibilityRole="button"
        >
          <Text style={styles.addBtnText}>+ Agregar Artículo</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.photoBtn, isReadOnly && styles.disabledBtn]}
          onPress={() => navigation.navigate('Photo', { packageId, packingListLocalId })}
          disabled={isReadOnly}
          accessibilityRole="button"
        >
          <Text style={styles.photoBtnText}>📷 Fotos ({photos.length})</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={items}
        keyExtractor={item => item.id}
        contentContainerStyle={{ padding: 16 }}
        renderItem={({ item }) => {
          const typeName = item.packing_item_type_id
            ? (itemTypes.find(t => t.id === item.packing_item_type_id)?.name_es ?? item.packing_item_type_id)
            : item.custom_name ?? '—';
          return (
            <View style={styles.itemCard}>
              <View style={styles.itemInfo}>
                <Text style={styles.itemName}>{typeName}</Text>
                <Text style={styles.itemQty}>× {item.quantity}</Text>
                {item.note ? <Text style={styles.itemNote}>{item.note}</Text> : null}
              </View>
              <TouchableOpacity onPress={() => handleDeleteItem(item.id)} accessibilityRole="button">
                <Text style={styles.deleteBtn}>✕</Text>
              </TouchableOpacity>
            </View>
          );
        }}
        ListEmptyComponent={<Text style={styles.empty}>Sin artículos. Agrega uno arriba.</Text>}
      />

      <Modal visible={showAddModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Agregar Artículo</Text>
            <TouchableOpacity onPress={() => setShowAddModal(false)} accessibilityRole="button">
              <Text style={styles.modalClose}>Cancelar</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.modalBody}>
            <Text style={styles.label}>Tipo de artículo</Text>
            <TouchableOpacity
              style={styles.pickerField}
              onPress={() => { setTypeSearch(''); setShowTypePickerModal(true); }}
              accessibilityRole="button"
            >
              <Text style={selectedTypeId ? styles.pickerFieldText : styles.pickerFieldPlaceholder}>
                {selectedTypeName ?? 'Seleccionar tipo…'}
              </Text>
              <Text style={styles.pickerArrow}>▾</Text>
            </TouchableOpacity>
            {selectedTypeId && (
              <TouchableOpacity onPress={() => setSelectedTypeId(null)}>
                <Text style={styles.clearType}>✕ Limpiar selección</Text>
              </TouchableOpacity>
            )}

            <Text style={styles.label}>O nombre personalizado</Text>
            <TextInput
              style={styles.input}
              value={customName}
              onChangeText={t => { setCustomName(t); if (t) setSelectedTypeId(null); }}
              placeholder="Ej: Cuadros de arte"
            />

            <Text style={styles.label}>Cantidad</Text>
            <TextInput
              style={styles.input}
              value={quantity}
              onChangeText={setQuantity}
              keyboardType="number-pad"
            />

            <Text style={styles.label}>Nota (opcional)</Text>
            <TextInput
              style={[styles.input, styles.inputMulti]}
              value={note}
              onChangeText={setNote}
              placeholder="Ej: Frágil"
              multiline
            />

            <TouchableOpacity style={styles.submitBtn} onPress={handleAddItem} accessibilityRole="button">
              <Text style={styles.submitBtnText}>Agregar</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Type picker modal */}
      <Modal visible={showTypePickerModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Tipo de artículo</Text>
            <TouchableOpacity onPress={() => setShowTypePickerModal(false)} accessibilityRole="button">
              <Text style={styles.modalClose}>Cerrar</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.searchBox}>
            <TextInput
              style={styles.searchInput}
              value={typeSearch}
              onChangeText={setTypeSearch}
              placeholder="Buscar tipo…"
              autoFocus
              clearButtonMode="while-editing"
            />
          </View>
          <FlatList
            data={itemTypes.filter(t =>
              t.name_es.toLowerCase().includes(typeSearch.toLowerCase()) ||
              (t.name_en ?? '').toLowerCase().includes(typeSearch.toLowerCase())
            )}
            keyExtractor={item => item.id}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.typeListRow, selectedTypeId === item.id && styles.typeListRowSelected]}
                onPress={() => {
                  setSelectedTypeId(item.id);
                  setCustomName('');
                  setShowTypePickerModal(false);
                }}
                accessibilityRole="button"
              >
                <Text style={[styles.typeListText, selectedTypeId === item.id && styles.typeListTextSelected]}>
                  {item.name_es}
                </Text>
                {selectedTypeId === item.id && <Text style={styles.typeListCheck}>✓</Text>}
              </TouchableOpacity>
            )}
            ListEmptyComponent={<Text style={styles.empty}>Sin resultados.</Text>}
          />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

async function generateUUID(): Promise<string> {
  const bytes = await Crypto.getRandomBytesAsync(16);
  const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16)}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  toolbar: { flexDirection: 'row', padding: 12, gap: 8, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e0e0e0' },
  addBtn: { flex: 1, backgroundColor: '#1a73e8', borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  photoBtn: { flex: 1, backgroundColor: '#fff', borderRadius: 8, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: '#1a73e8' },
  photoBtnText: { color: '#1a73e8', fontWeight: '700', fontSize: 14 },
  disabledBtn: { opacity: 0.45 },
  itemCard: { backgroundColor: '#fff', borderRadius: 10, padding: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'center', elevation: 1 },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 15, fontWeight: '600', color: '#333' },
  itemQty: { fontSize: 13, color: '#888', marginTop: 2 },
  itemNote: { fontSize: 12, color: '#aaa', marginTop: 2, fontStyle: 'italic' },
  deleteBtn: { fontSize: 18, color: '#d32f2f', paddingHorizontal: 8 },
  empty: { textAlign: 'center', color: '#aaa', marginTop: 48, fontSize: 15 },
  // Modal
  modal: { flex: 1, backgroundColor: '#fff' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#e0e0e0' },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#333' },
  modalClose: { color: '#1a73e8', fontSize: 15, fontWeight: '600' },
  modalBody: { padding: 16 },
  label: { fontSize: 13, fontWeight: '600', color: '#555', marginTop: 16, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.3 },
  pickerField: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#f5f5f5', borderRadius: 8, padding: 12, borderWidth: 1, borderColor: '#e0e0e0' },
  pickerFieldText: { fontSize: 15, color: '#333', flex: 1 },
  pickerFieldPlaceholder: { fontSize: 15, color: '#aaa', flex: 1 },
  pickerArrow: { fontSize: 16, color: '#888', marginLeft: 8 },
  clearType: { fontSize: 12, color: '#d32f2f', marginTop: 6, fontWeight: '600' },
  searchBox: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#e0e0e0', backgroundColor: '#fff' },
  searchInput: { backgroundColor: '#f5f5f5', borderRadius: 8, padding: 10, fontSize: 15, borderWidth: 1, borderColor: '#e0e0e0' },
  typeListRow: { paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f0f0f0', flexDirection: 'row', alignItems: 'center' },
  typeListRowSelected: { backgroundColor: '#e8f0fe' },
  typeListText: { fontSize: 15, color: '#333', flex: 1 },
  typeListTextSelected: { color: '#1a73e8', fontWeight: '600' },
  typeListCheck: { fontSize: 16, color: '#1a73e8' },
  typeScroll: { marginBottom: 8 },
  typeChip: { backgroundColor: '#f0f0f0', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, marginRight: 8 },
  typeChipSelected: { backgroundColor: '#1a73e8' },
  typeChipText: { fontSize: 13, color: '#333' },
  typeChipTextSelected: { color: '#fff', fontWeight: '600' },
  selectedType: { fontSize: 13, color: '#34a853', fontWeight: '600', marginBottom: 8 },
  input: { backgroundColor: '#f5f5f5', borderRadius: 8, padding: 12, fontSize: 15, borderWidth: 1, borderColor: '#e0e0e0' },
  inputMulti: { height: 80, textAlignVertical: 'top' },
  submitBtn: { backgroundColor: '#1a73e8', borderRadius: 8, paddingVertical: 14, alignItems: 'center', marginTop: 24 },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});

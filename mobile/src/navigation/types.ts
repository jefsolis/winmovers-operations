export type RootStackParamList = {
  Home: undefined;
  NewPackingList: undefined;
  PackingList: { localId: string; movingFileId: string; movingFileRef: string };
  Scan: { packingListLocalId: string };
  PackageDetail: { packageId: string; packingListLocalId: string };
  Photo: { packageId: string; packingListLocalId: string };
  Signature: { packingListLocalId: string; serverId: string };
};

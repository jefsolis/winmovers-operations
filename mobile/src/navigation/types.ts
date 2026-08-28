export type IngressEgressType = 'INGRESS_TRUCK' | 'INGRESS_WAREHOUSE' | 'EGRESS_WAREHOUSE';

export type RootStackParamList = {
  Home: undefined;
  NewPackingList: undefined;
  PackingList: { localId: string; movingFileId: string; movingFileRef: string };
  Scan: { packingListLocalId: string; assignToPackageId?: string };
  PackageDetail: { packageId: string; packingListLocalId: string };
  Photo: { packageId: string; packingListLocalId: string };
  ArrivalAcknowledgement: { packingListLocalId: string; serverId: string; eventType?: 'DAY_START' | 'DAY_CLOSE' };
  Signature: { packingListLocalId: string; serverId: string };
  IngressEgress: { packingListLocalId: string; serverId: string; operationType: IngressEgressType };
  IngressEgressSignature: { packingListLocalId: string; serverId: string; operationLocalId: string };
};

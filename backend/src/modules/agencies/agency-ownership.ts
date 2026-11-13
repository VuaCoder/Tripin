/** Stable creation identity: never infer the primary owner from mutable roles/order. */
export const agencyOwnershipSelect = { userId: true, creationKey: { select: { userId: true } } } as const;

export function primaryAgencyOwnerId(agency: { userId: string | null; creationKey: { userId: string } | null }) {
  return agency.creationKey?.userId ?? agency.userId;
}

export function agencyOwnerLabel(isPrimaryOwner: boolean) {
  return isPrimaryOwner ? 'Owner' : 'Co_Owner';
}

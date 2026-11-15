export interface TourExtra {
  id: string; name: string; description: string;
  kind: 'PICKUP' | 'MEAL' | 'EQUIPMENT' | 'OTHER';
  pricing: 'PER_PERSON' | 'PER_BOOKING' | 'PER_UNIT';
  unit: string; price: number; active: boolean; cutoffHours: number; maxQuantity: number;
  ages: Array<'ADULT' | 'CHILD' | 'INFANT'>;
  pickup?: { mode: 'ADDRESS' | 'POINT'; area: string; points: string[]; instructions: string };
}
export interface ExtraSelection {
  serviceId: string; terms: string; passengerIds: string[]; quantity: number;
  pickups: Array<{ passengerId: string; address: string }>;
}
export interface ExtraPassenger { passengerId: string; fullName: string; ageGroup: 'ADULT' | 'CHILD' | 'INFANT' }
export interface BookedExtra {
  serviceId: string; name: string; kind: TourExtra['kind']; description: string; unit: string;
  unitPrice: number; quantity: number; total: number; terms: string;
  participants: ExtraPassenger[]; pickups: ExtraSelection['pickups']; instructions?: string;
}
export function extraTerms(s: TourExtra): string {
  return JSON.stringify([s.id, s.name, s.description, s.kind, s.pricing, s.unit, s.price, s.active,
    s.cutoffHours, s.maxQuantity, [...s.ages].sort(), s.pickup ? [s.pickup.mode, s.pickup.area, s.pickup.points, s.pickup.instructions] : null]);
}
export function quoteExtras(services: TourExtra[], selections: ExtraSelection[], passengers: ExtraPassenger[], departure: string | Date, now = Date.now()): BookedExtra[] {
  const fail = (message: string): never => { throw new Error(message); };
  if (new Set(passengers.map(p => p.passengerId)).size !== passengers.length) fail('Danh sách hành khách bị trùng mã.');
  if (new Set(selections.map(s => s.serviceId)).size !== selections.length) fail('Dịch vụ bị chọn trùng.');
  const pickupPeople = new Set<string>();
  return selections.map(selection => {
    const s = services.find(s => s.id === selection.serviceId);
    if (!s?.active) return fail('Dịch vụ đã ngừng bán. Vui lòng chọn lại.');
    if (extraTerms(s) !== selection.terms) fail(`Điều kiện hoặc giá ${s.name} đã thay đổi. Vui lòng chọn lại dịch vụ.`);
    if (new Date(departure).getTime() - now <= s.cutoffHours * 3600000) fail(`${s.name} đã hết hạn đăng ký.`);
    if (new Set(selection.passengerIds).size !== selection.passengerIds.length) fail('Hành khách sử dụng dịch vụ bị trùng.');
    const people = selection.passengerIds.map(id => passengers.find(p => p.passengerId === id) ?? fail('Hành khách sử dụng dịch vụ không tồn tại.'));
    if (people.some(p => !s.ages.includes(p.ageGroup))) fail(`${s.name} không áp dụng cho nhóm tuổi đã chọn.`);
    const quantity = s.pricing === 'PER_PERSON' ? people.length : s.pricing === 'PER_BOOKING' ? 1 : selection.quantity;
    if (s.pricing !== 'PER_PERSON' && people.length) fail('Dịch vụ này không phân bổ theo hành khách.');
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > s.maxQuantity) fail(`Số lượng ${s.name} phải từ 1 đến ${s.maxQuantity}.`);
    if (s.kind === 'PICKUP') {
      if (selection.pickups.length !== people.length || new Set(selection.pickups.map(p => p.passengerId)).size !== people.length) fail('Vui lòng nhập điểm đón cho từng người sử dụng.');
      for (const pickup of selection.pickups) {
        if (!selection.passengerIds.includes(pickup.passengerId) || pickupPeople.has(pickup.passengerId)) fail('Mỗi hành khách chỉ được chọn một dịch vụ đưa đón.');
        pickupPeople.add(pickup.passengerId);
        if (pickup.address.trim().length < 5 || pickup.address.length > 300) fail('Địa chỉ đón phải có từ 5 đến 300 ký tự.');
        if (s.pickup?.mode === 'POINT' && !s.pickup.points.includes(pickup.address)) fail('Vui lòng chọn điểm đón do đơn vị tổ chức cung cấp.');
      }
    } else if (selection.pickups.length) fail('Chỉ dịch vụ đưa đón được nhập địa chỉ đón.');
    const total = s.price * quantity;
    if (!Number.isSafeInteger(total)) fail('Giá dịch vụ vượt giới hạn.');
    return { serviceId: s.id, name: s.name, kind: s.kind, description: s.description, unit: s.unit,
      unitPrice: s.price, quantity, total, terms: selection.terms, participants: people,
      pickups: selection.pickups.map(p => ({ ...p, address: p.address.trim() })), instructions: s.pickup?.instructions };
  });
}

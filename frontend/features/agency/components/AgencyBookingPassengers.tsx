import type { AgencyBooking } from '../types';

const guestLabels = { ADULT: 'Người lớn', CHILD: 'Trẻ em', INFANT: 'Em bé' };

export function AgencyBookingPassengers({ booking }: { booking: AgencyBooking }) {
  return (
    <ul className="space-y-3 text-sm">
      {booking.passengers?.map((passenger, index) => {
        const group = 'guestType' in passenger ? passenger.guestType : passenger.ageGroup;
        const phone = passenger.phone?.trim();
        const contactPhone = booking.traveler?.phone?.trim();
        const passengerId = 'passengerId' in passenger ? passenger.passengerId : undefined;
        const services = passengerId
          ? (booking.services ?? []).filter(service => service.participants.some(person => person.passengerId === passengerId))
          : [];
        const pickups = services.flatMap(service => service.pickups.filter(pickup => pickup.passengerId === passengerId));
        const pickupPoint = pickups.map(pickup => pickup.address).join('; ')
          || ('pickupPoint' in passenger ? passenger.pickupPoint?.trim() : undefined);
        const notes = 'specialNotes' in passenger ? passenger.specialNotes?.trim() : undefined;

        return (
          <li key={passengerId ?? index} className="rounded-lg border border-slate-200 p-4">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h3 className="font-semibold text-slate-900">{passenger.fullName}</h3>
              <span className="text-xs font-medium text-slate-600">{guestLabels[group]}</span>
            </div>
            <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-2 text-slate-700">
              {'birthYear' in passenger && passenger.birthYear && (
                <div className="flex gap-1.5"><dt className="text-slate-500">Năm sinh:</dt><dd>{passenger.birthYear}</dd></div>
              )}
              <div className="flex flex-wrap gap-x-1.5">
                <dt className="text-slate-500">Điện thoại:</dt>
                <dd className="break-words">{phone || contactPhone || 'Chưa cập nhật'}{!phone && contactPhone && <span className="text-slate-500"> (người đặt)</span>}</dd>
              </div>
              {'idCard' in passenger && passenger.idCard && (
                <div className="flex flex-wrap gap-x-1.5"><dt className="text-slate-500">CCCD:</dt><dd className="break-all">{passenger.idCard}</dd></div>
              )}
            </dl>
            {(pickupPoint || services.length > 0 || notes) && (
              <dl className="mt-3 space-y-1.5 border-t border-slate-100 pt-3 leading-6 text-slate-700">
                {pickupPoint && <div><dt className="inline text-slate-500">Điểm đón: </dt><dd className="inline break-words">{pickupPoint}</dd></div>}
                {services.length > 0 && <div><dt className="inline text-slate-500">Dịch vụ: </dt><dd className="inline break-words">{services.map(service => service.name).join(', ')}</dd></div>}
                {notes && <div><dt className="inline text-slate-500">Ghi chú: </dt><dd className="inline whitespace-pre-wrap break-words">{notes}</dd></div>}
              </dl>
            )}
          </li>
        );
      })}
    </ul>
  );
}

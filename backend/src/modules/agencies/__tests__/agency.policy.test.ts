import { describe, expect, it } from 'vitest';
import { effectiveAgencyPermissions as effective, OWNER_CONTROL_PERMISSIONS } from '../agency.policy';
describe('effective agency permissions', () => {
  it('combines role grants and individual ALLOW, with DENY taking priority', () => {
    expect(effective({ role: 'STAFF', assignedRole: { permissions: ['agency:finance-view','tour:create'] }, permissionOverrides: [
      { permission: 'agency:finance-view', effect: 'DENY' }, { permission: 'tour:import', effect: 'ALLOW' },
      { permission: 'tour:import', effect: 'DENY' },
    ] })).toEqual(['agency:context-view','tour:create']);
  });
  it('does not infer ordinary business grants from OWNER identity', () => {
    const permissions = effective({ role: 'OWNER', assignedRole: { permissions: [] } });
    expect(permissions).not.toContain('tour:create');
    expect(permissions).not.toContain('agency:finance-view');
    expect(permissions).toEqual([...OWNER_CONTROL_PERMISSIONS].sort());
  });
  it('filters platform permissions even if a bad row exists', () => {
    expect(effective({ role: 'STAFF', assignedRole: { permissions: ['user:assign-permissions','tour:create'] } })).toEqual(['agency:context-view','tour:create']);
  });
  it('keeps security recovery independent from an OWNER override', () => {
    expect(effective({ role: 'OWNER', assignedRole: { permissions: [] }, permissionOverrides: [{ permission: 'agency:team-manage', effect: 'DENY' }] })).toContain('agency:team-manage');
  });
  it('does not give Manager Finance, import, delete, or permission administration by default', () => {
    const permissions = effective({ role: 'MANAGER' });
    for (const denied of ['agency:finance-view','tour:import','tour:delete-own','agency:permissions-manage']) expect(permissions).not.toContain(denied);
  });
  it('does not give Staff broad write/customer export grants', () => {
    const permissions = effective({ role: 'STAFF' });
    for (const denied of ['tour:update-own','tour:set-availability','agency:bookings-view','agency:export-customers','complaint:respond']) expect(permissions).not.toContain(denied);
  });
});

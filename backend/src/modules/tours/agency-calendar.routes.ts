import { Router } from 'express';
import { PERMISSIONS } from '@travel-platform/constants';
import { requirePermission } from '../../middlewares/authorize';
import { agencyContext } from '../../middlewares/agency-context';
import { validate, validated } from '../../middlewares/validate';
import { sendCreated, sendNoContent, sendOk } from '../../utils/api-response';
import { agencyCalendarRepository as calendar } from './agency-calendar.repository';
import { calendarQuery, calendarTourParams, calendarDepartureParams, createDeparturesBody, updateDepartureBody, deleteDepartureBody } from './agency-calendar.validation';
import type { z } from 'zod';

export const agencyCalendarRouter = Router();
agencyCalendarRouter.get('/', requirePermission(PERMISSIONS.TOUR_UPDATE_OWN), validate({ query: calendarQuery }), async (req, res) => {
  const { query } = validated<unknown, z.infer<typeof calendarQuery>>(req);
  sendOk(res, await calendar.list(agencyContext(req).agencyId, query));
});
export const agencyDeparturesRouter = Router();
agencyDeparturesRouter.post('/:tourId/departures', requirePermission(PERMISSIONS.TOUR_SET_AVAILABILITY), validate({ params: calendarTourParams, body: createDeparturesBody }), async (req, res) => {
  const { params, body } = validated<z.infer<typeof createDeparturesBody>, unknown, z.infer<typeof calendarTourParams>>(req);
  sendCreated(res, await calendar.create(agencyContext(req).agencyId, params.tourId, body.departures));
});
agencyDeparturesRouter.patch('/:tourId/departures/:departureId', requirePermission(PERMISSIONS.TOUR_SET_AVAILABILITY), validate({ params: calendarDepartureParams, body: updateDepartureBody }), async (req, res) => {
  const { params, body } = validated<z.infer<typeof updateDepartureBody>, unknown, z.infer<typeof calendarDepartureParams>>(req);
  sendOk(res, await calendar.update(agencyContext(req).agencyId, params.tourId, params.departureId, body));
});
agencyDeparturesRouter.delete('/:tourId/departures/:departureId', requirePermission(PERMISSIONS.TOUR_SET_AVAILABILITY), validate({ params: calendarDepartureParams, body: deleteDepartureBody }), async (req, res) => {
  const { params, body } = validated<z.infer<typeof deleteDepartureBody>, unknown, z.infer<typeof calendarDepartureParams>>(req);
  await calendar.remove(agencyContext(req).agencyId, params.tourId, params.departureId, body.expectedDate);
  sendNoContent(res);
});

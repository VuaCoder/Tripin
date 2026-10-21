import { Router } from 'express';
import { PERMISSIONS } from '@travel-platform/constants';
import multer from 'multer';
import { z } from 'zod';
import { requirePermission } from '../../middlewares/authorize';
import { validate } from '../../middlewares/validate';
import { AppError } from '../../utils/app-error';
import { TOUR_DOCUMENT_LIMITS } from './tour-document-extraction.service';
import { tourDocumentExtractionController } from './tour-document-extraction.controller';
import { toursController } from './tours.controller';
import {
  agencyToursQuery,
  assignGuideBody,
  availabilityBody,
  createCategoryQuickBody,
  createTourBody,
  guideTourParams,
  guideVerificationBody,
  importToursBody,
  itineraryBody,
  searchToursQuery,
  tourIdParams,
  updateTourBody,
} from './tours.validation';

const P = PERMISSIONS;
const emptyMultipartBody = z.object({}).strict();
const documentUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: TOUR_DOCUMENT_LIMITS.MAX_FILE_BYTES, files: 1 } }).single('file');
const uploadTourDocument: import('express').RequestHandler = (req, res, next) => {
  documentUpload(req, res, (error: unknown) => {
    if (!error) return next();
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      return next(AppError.badRequest('File must be 10 MB or smaller'));
    }
    return next(AppError.badRequest('Upload one DOCX or PDF file'));
  });
};

const imageUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 } }).single('file');
const uploadTourImage: import('express').RequestHandler = (req, res, next) => {
  imageUpload(req, res, (error: unknown) => {
    if (!error) return next();
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      return next(AppError.badRequest('File ảnh phải từ 5 MB trở xuống'));
    }
    return next(AppError.badRequest('Upload một file ảnh hợp lệ'));
  });
};

/** Mounted at /api/v1/tours — public discovery (GUEST allowed). */
export const publicToursRouter = Router();
publicToursRouter.get('/', validate({ query: searchToursQuery }), toursController.search);
publicToursRouter.get('/destinations', toursController.getDestinations);
publicToursRouter.get('/:id', validate({ params: tourIdParams }), toursController.detail);

/** Mounted at /api/v1/agency/tours — the logged-in agency's own tours. */
export const agencyToursRouter = Router();
agencyToursRouter.get('/', requirePermission(P.TOUR_UPDATE_OWN), validate({ query: agencyToursQuery }), toursController.listOwn);
agencyToursRouter.post('/', requirePermission(P.TOUR_CREATE), validate({ body: createTourBody }), toursController.create);
// Declared before '/:id' routes so "import", "categories" and "upload-image" are not read as an id.
agencyToursRouter.post('/categories', requirePermission(P.TOUR_CREATE), validate({ body: createCategoryQuickBody }), toursController.createCategory);
agencyToursRouter.post('/import', requirePermission(P.TOUR_IMPORT), validate({ body: importToursBody }), toursController.importTours);
agencyToursRouter.post('/upload-image', requirePermission(P.TOUR_UPDATE_OWN), uploadTourImage, validate({ body: emptyMultipartBody }), toursController.uploadImage);
agencyToursRouter.post('/extract-document', requirePermission(P.TOUR_IMPORT), uploadTourDocument, validate({ body: emptyMultipartBody }), tourDocumentExtractionController.extract);
agencyToursRouter.get('/:id', requirePermission(P.TOUR_UPDATE_OWN), validate({ params: tourIdParams }), toursController.getOwn);
agencyToursRouter.patch(
  '/:id',
  requirePermission(P.TOUR_UPDATE_OWN),
  validate({ params: tourIdParams, body: updateTourBody }),
  toursController.update,
);
agencyToursRouter.delete('/:id', requirePermission(P.TOUR_DELETE_OWN), validate({ params: tourIdParams }), toursController.remove);
agencyToursRouter.post(
  '/:id/restore',
  requirePermission(P.TOUR_UPDATE_OWN),
  validate({ params: tourIdParams }),
  toursController.restore,
);
agencyToursRouter.put(
  '/:id/availability',
  requirePermission(P.TOUR_SET_AVAILABILITY),
  validate({ params: tourIdParams, body: availabilityBody }),
  toursController.setAvailability,
);
agencyToursRouter.put(
  '/:id/itinerary',
  requirePermission(P.TOUR_CONFIGURE_ITINERARY),
  validate({ params: tourIdParams, body: itineraryBody }),
  toursController.setItinerary,
);
agencyToursRouter.put(
  '/:id/guide',
  requirePermission(P.TOUR_ASSIGN_GUIDE),
  validate({ params: tourIdParams, body: assignGuideBody }),
  toursController.assignGuide,
);
agencyToursRouter.post('/:id/submit', requirePermission(P.TOUR_UPDATE_OWN), validate({ params: tourIdParams }), toursController.submit);

/** Mounted at /api/v1/guide/tours — tours assigned to the logged-in tour guide. */
export const guideToursRouter = Router();
guideToursRouter.get('/', requirePermission(P.GUIDE_TOURS_VIEW), validate({ query: agencyToursQuery }), toursController.listAssigned);
guideToursRouter.post(
  '/:tourId/verification',
  requirePermission(P.GUIDE_TOURS_VERIFY),
  validate({ params: guideTourParams, body: guideVerificationBody }),
  toursController.answerAssignment,
);

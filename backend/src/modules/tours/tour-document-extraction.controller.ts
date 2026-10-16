import type { RequestHandler } from 'express';
import { AppError } from '../../utils/app-error';
import { sendOk } from '../../utils/api-response';
import { tourDocumentExtractionService, type TourDocumentExtractionService } from './tour-document-extraction.service';

export class TourDocumentExtractionController {
  constructor(private readonly service: TourDocumentExtractionService = tourDocumentExtractionService) {}

  extract: RequestHandler = async (req, res) => {
    if (!req.file) throw AppError.badRequest('Choose a DOCX or PDF file');
    sendOk(res, await this.service.extract(req.file));
  };
}

export const tourDocumentExtractionController = new TourDocumentExtractionController();

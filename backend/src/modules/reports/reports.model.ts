import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { REPORT_CATEGORY, REPORT_STATUS, REPORT_TARGET } from './reports.types';

const agencyResponseSchema = new Schema(
  {
    text: { type: String, required: true, maxlength: 2000 },
    respondedAt: { type: Date, required: true },
    by: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { _id: false },
);

const resolutionSchema = new Schema(
  {
    decision: { type: String, enum: [REPORT_STATUS.RESOLVED, REPORT_STATUS.REJECTED], required: true },
    note: { type: String, required: true, maxlength: 2000 },
    by: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    resolvedAt: { type: Date, required: true },
  },
  { _id: false },
);

const reportSchema = new Schema(
  {
    reporterId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    targetType: { type: String, enum: Object.values(REPORT_TARGET), required: true },
    targetId: { type: Schema.Types.ObjectId, required: true },
    category: { type: String, enum: Object.values(REPORT_CATEGORY), required: true },
    description: { type: String, required: true, trim: true, maxlength: 2000 },
    bookingId: { type: Schema.Types.ObjectId, ref: 'Booking' },

    // Routing, derived on the server from the target (never from the client).
    agencyId: { type: Schema.Types.ObjectId, ref: 'User' },
    tourId: { type: Schema.Types.ObjectId, ref: 'Tour' },

    status: { type: String, enum: Object.values(REPORT_STATUS), default: REPORT_STATUS.OPEN },
    /** `reporter:type:target` while the report is open, removed when it is closed. The unique index below enforces one open report per reporter and target. */
    openKey: { type: String },
    agencyResponse: { type: agencyResponseSchema },
    resolution: { type: resolutionSchema },
  },
  { timestamps: true },
);

// "My reports".
reportSchema.index({ reporterId: 1, createdAt: -1, _id: -1 });
// One open report per reporter and target (also serves the duplicate check).
reportSchema.index({ openKey: 1 }, { unique: true, sparse: true }); // sparse (not partial): plain equality queries can use it
// Agency complaints inbox.
reportSchema.index({ agencyId: 1, status: 1, createdAt: -1 });
// Moderator queue.
reportSchema.index({ status: 1, createdAt: -1 });

export type ReportAttributes = InferSchemaType<typeof reportSchema>;
export type ReportDocument = HydratedDocument<ReportAttributes>;
export const ReportModel = model('Report', reportSchema);

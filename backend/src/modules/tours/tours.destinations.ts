export interface DestinationDto {
  destination: string;
  count: number;
  icon: string;
  description: string;
  summary?: string | null;
  colorClass: string;
  iconBgClass: string;
}

interface ProvinceVisual {
  icon: string;
  colorClass: string;
  iconBgClass: string;
}

/**
 * Characteristic province icon and badge color tokens.
 * All text (destination name, descriptions, tour titles, and summaries)
 * is sourced directly from the database records.
 */
const PROVINCE_VISUALS: Record<string, ProvinceVisual> = {
  'quang ninh': {
    icon: 'sailing',
    colorClass: 'text-cyan-700',
    iconBgClass: 'bg-cyan-50 border-cyan-200 text-cyan-700',
  },
  'lao cai': {
    icon: 'terrain',
    colorClass: 'text-emerald-700',
    iconBgClass: 'bg-emerald-50 border-emerald-200 text-emerald-700',
  },
  'da nang': {
    icon: 'waves',
    colorClass: 'text-sky-700',
    iconBgClass: 'bg-sky-50 border-sky-200 text-sky-700',
  },
  'quang nam': {
    icon: 'light_mode',
    colorClass: 'text-amber-700',
    iconBgClass: 'bg-amber-50 border-amber-200 text-amber-700',
  },
  'tp. ho chi minh': {
    icon: 'location_city',
    colorClass: 'text-indigo-700',
    iconBgClass: 'bg-indigo-50 border-indigo-200 text-indigo-700',
  },
  'ho chi minh': {
    icon: 'location_city',
    colorClass: 'text-indigo-700',
    iconBgClass: 'bg-indigo-50 border-indigo-200 text-indigo-700',
  },
  'ha noi': {
    icon: 'account_balance',
    colorClass: 'text-rose-700',
    iconBgClass: 'bg-rose-50 border-rose-200 text-rose-700',
  },
  'kien giang': {
    icon: 'beach_access',
    colorClass: 'text-teal-700',
    iconBgClass: 'bg-teal-50 border-teal-200 text-teal-700',
  },
  'thua thien hue': {
    icon: 'fort',
    colorClass: 'text-purple-700',
    iconBgClass: 'bg-purple-50 border-purple-200 text-purple-700',
  },
  'hue': {
    icon: 'fort',
    colorClass: 'text-purple-700',
    iconBgClass: 'bg-purple-50 border-purple-200 text-purple-700',
  },
  'khanh hoa': {
    icon: 'scuba_diving',
    colorClass: 'text-blue-700',
    iconBgClass: 'bg-blue-50 border-blue-200 text-blue-700',
  },
  'lam dong': {
    icon: 'local_florist',
    colorClass: 'text-pink-700',
    iconBgClass: 'bg-pink-50 border-pink-200 text-pink-700',
  },
  'ninh binh': {
    icon: 'landscape',
    colorClass: 'text-teal-800',
    iconBgClass: 'bg-teal-50 border-teal-200 text-teal-800',
  },
  'can tho': {
    icon: 'rowing',
    colorClass: 'text-orange-700',
    iconBgClass: 'bg-orange-50 border-orange-200 text-orange-700',
  },
  'an giang': {
    icon: 'nature',
    colorClass: 'text-lime-800',
    iconBgClass: 'bg-lime-50 border-lime-200 text-lime-800',
  },
  'quang binh': {
    icon: 'explore',
    colorClass: 'text-emerald-800',
    iconBgClass: 'bg-emerald-50 border-emerald-200 text-emerald-800',
  },
  'ha giang': {
    icon: 'filter_hdr',
    colorClass: 'text-amber-800',
    iconBgClass: 'bg-amber-50 border-amber-200 text-amber-800',
  },
  'binh thuan': {
    icon: 'wb_sunny',
    colorClass: 'text-yellow-800',
    iconBgClass: 'bg-yellow-50 border-yellow-200 text-yellow-800',
  },
  'ba ria – vung tau': {
    icon: 'anchor',
    colorClass: 'text-sky-800',
    iconBgClass: 'bg-sky-50 border-sky-200 text-sky-800',
  },
  'ba ria - vung tau': {
    icon: 'anchor',
    colorClass: 'text-sky-800',
    iconBgClass: 'bg-sky-50 border-sky-200 text-sky-800',
  },
  'son la': {
    icon: 'park',
    colorClass: 'text-emerald-800',
    iconBgClass: 'bg-emerald-50 border-emerald-200 text-emerald-800',
  },
};

function normalizeKey(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .trim();
}

/**
 * Enriches database tour destination record with provincial icon and color tokens.
 * All text fields (destination, description, summary) originate 100% from the database.
 */
export function enrichDestination(dbRecord: {
  destination: string;
  count: number;
  sampleTitle: string;
  sampleSummary: string | null;
}): DestinationDto {
  const norm = normalizeKey(dbRecord.destination);

  let visual = PROVINCE_VISUALS[norm];
  if (!visual) {
    for (const [key, val] of Object.entries(PROVINCE_VISUALS)) {
      if (norm.includes(key) || key.includes(norm)) {
        visual = val;
        break;
      }
    }
  }

  // Description is sourced directly from the database tour record (title / summary)
  const description = dbRecord.sampleTitle || dbRecord.sampleSummary || dbRecord.destination;

  return {
    destination: dbRecord.destination,
    count: dbRecord.count,
    icon: visual?.icon || 'place',
    description,
    summary: dbRecord.sampleSummary,
    colorClass: visual?.colorClass || 'text-teal-700',
    iconBgClass: visual?.iconBgClass || 'bg-teal-50 border-teal-200 text-teal-700',
  };
}

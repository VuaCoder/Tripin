'use client';

import { useState, useMemo } from 'react';
import {
  Plus,
  Trash2,
  BusFront,
  Utensils,
  Camera,
  Package,
  Search,
  Check,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Car,
  Bike,
  Coffee,
  ShieldCheck,
  Compass,
  Tent,
  Waves,
  X,
  Flame,
  Wine,
  Shirt,
  UserCheck,
  BedDouble,
  type LucideIcon,
} from 'lucide-react';
import type { TourExtra } from '@travel-platform/constants';
import styles from './tour-services.module.css';

type ServiceCategory = 'ALL' | 'MEAL' | 'PICKUP' | 'EQUIPMENT' | 'OTHER';

interface CatalogPreset {
  id: string;
  name: string;
  kind: TourExtra['kind'];
  category: Exclude<ServiceCategory, 'ALL'>;
  icon: LucideIcon;
}

const CATALOG_ITEMS: CatalogPreset[] = [
  // Ẩm thực & Bữa ăn
  {
    id: 'meal-breakfast',
    name: 'Ăn sáng bổ sung',
    kind: 'MEAL',
    category: 'MEAL',
    icon: Utensils,
  },
  {
    id: 'meal-bbq-seafood',
    name: 'Bữa tối hải sản / BBQ đặc sản',
    kind: 'MEAL',
    category: 'MEAL',
    icon: Flame,
  },
  {
    id: 'meal-drinks',
    name: 'Gói đồ uống không giới hạn',
    kind: 'MEAL',
    category: 'MEAL',
    icon: Wine,
  },
  {
    id: 'meal-teatime',
    name: 'Tiệc trà chiều hoàng hôn',
    kind: 'MEAL',
    category: 'MEAL',
    icon: Coffee,
  },
  {
    id: 'meal-vegetarian',
    name: 'Thực đơn chay / Thực dưỡng đặc biệt',
    kind: 'MEAL',
    category: 'MEAL',
    icon: Utensils,
  },

  // Đưa đón & Phương tiện
  {
    id: 'pickup-door',
    name: 'Đưa đón tận nơi',
    kind: 'PICKUP',
    category: 'PICKUP',
    icon: BusFront,
  },
  {
    id: 'pickup-limousine',
    name: 'Nâng hạng xe Limousine VIP',
    kind: 'OTHER',
    category: 'PICKUP',
    icon: Car,
  },
  {
    id: 'pickup-motorbike',
    name: 'Thuê xe máy tự lái',
    kind: 'EQUIPMENT',
    category: 'PICKUP',
    icon: Bike,
  },
  {
    id: 'pickup-bicycle',
    name: 'Thuê xe đạp dạo phố / địa hình',
    kind: 'EQUIPMENT',
    category: 'PICKUP',
    icon: Bike,
  },

  // Trang thiết bị & Dụng cụ
  {
    id: 'equip-general',
    name: 'Thuê thiết bị',
    kind: 'EQUIPMENT',
    category: 'EQUIPMENT',
    icon: Package,
  },
  {
    id: 'equip-snorkeling',
    name: 'Thuê đồ lặn & ống thở cao cấp',
    kind: 'EQUIPMENT',
    category: 'EQUIPMENT',
    icon: Waves,
  },
  {
    id: 'equip-camping',
    name: 'Thuê lều trại & túi ngủ dã ngoại',
    kind: 'EQUIPMENT',
    category: 'EQUIPMENT',
    icon: Tent,
  },
  {
    id: 'equip-gopro',
    name: 'Thuê camera hành trình / GoPro',
    kind: 'EQUIPMENT',
    category: 'EQUIPMENT',
    icon: Camera,
  },
  {
    id: 'equip-trekking',
    name: 'Thuê gậy leo núi & balo trekking',
    kind: 'EQUIPMENT',
    category: 'EQUIPMENT',
    icon: Compass,
  },
  {
    id: 'equip-costume',
    name: 'Thuê trang phục chụp ảnh / Cổ phục',
    kind: 'EQUIPMENT',
    category: 'EQUIPMENT',
    icon: Shirt,
  },

  // Trải nghiệm & Tiện ích khác
  {
    id: 'other-photo',
    name: 'Gói ảnh riêng',
    kind: 'OTHER',
    category: 'OTHER',
    icon: Camera,
  },
  {
    id: 'other-guide',
    name: 'Hướng dẫn viên riêng',
    kind: 'OTHER',
    category: 'OTHER',
    icon: UserCheck,
  },
  {
    id: 'other-kayak',
    name: 'Vé chèo thuyền SUP / Kayak',
    kind: 'OTHER',
    category: 'OTHER',
    icon: Waves,
  },
  {
    id: 'other-spa',
    name: 'Gói massage / Trị liệu Spa thảo dược',
    kind: 'OTHER',
    category: 'OTHER',
    icon: Sparkles,
  },
  {
    id: 'other-insurance',
    name: 'Bảo hiểm du lịch nâng cao',
    kind: 'OTHER',
    category: 'OTHER',
    icon: ShieldCheck,
  },
  {
    id: 'other-single-room',
    name: 'Phụ thu phòng đơn (ở riêng)',
    kind: 'OTHER',
    category: 'OTHER',
    icon: BedDouble,
  },
];

const QUICK_PRESETS = [
  { name: 'Đưa đón tận nơi', kind: 'PICKUP' as const, icon: BusFront },
  { name: 'Ăn sáng bổ sung', kind: 'MEAL' as const, icon: Utensils },
  { name: 'Thuê thiết bị', kind: 'EQUIPMENT' as const, icon: Package },
  { name: 'Gói ảnh riêng', kind: 'OTHER' as const, icon: Camera },
];

const CATEGORY_TABS: Array<{ key: ServiceCategory; label: string }> = [
  { key: 'ALL', label: 'Tất cả' },
  { key: 'MEAL', label: 'Ẩm thực & Bữa ăn' },
  { key: 'PICKUP', label: 'Đưa đón & Xe' },
  { key: 'EQUIPMENT', label: 'Trang thiết bị' },
  { key: 'OTHER', label: 'Trải nghiệm & Khác' },
];

function getKindLabel(kind: TourExtra['kind']): string {
  switch (kind) {
    case 'PICKUP': return 'Đưa đón';
    case 'MEAL': return 'Ẩm thực';
    case 'EQUIPMENT': return 'Thiết bị';
    case 'OTHER': default: return 'Tiện ích';
  }
}

export function TourServicesEditor({
  value,
  onChange,
  showTitle = true,
}: {
  value: TourExtra[];
  onChange: (value: TourExtra[]) => void;
  showTitle?: boolean;
}) {
  const [showCatalog, setShowCatalog] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<ServiceCategory>('ALL');

  const isServiceAdded = (name: string) => {
    const norm = name.trim().toLowerCase();
    return value.some(s => s.name.trim().toLowerCase() === norm);
  };

  const update = (id: string, patch: Partial<TourExtra>) =>
    onChange(value.map(s => (s.id === id ? { ...s, ...patch } : s)));

  const add = (preset?: {
    name?: string;
    kind?: TourExtra['kind'];
  }) => {
    if (value.length >= 20) return;
    if (preset?.name && isServiceAdded(preset.name)) return;

    const kind = preset?.kind ?? 'OTHER';
    onChange([
      ...value,
      {
        id: crypto.randomUUID(),
        name: preset?.name ?? '',
        description: '',
        kind,
        pricing: 'PER_PERSON',
        unit: 'người',
        price: Number.NaN,
        active: true,
        cutoffHours: 24,
        maxQuantity: 100,
        ages: ['ADULT', 'CHILD', 'INFANT'],
        ...(kind === 'PICKUP'
          ? { pickup: { mode: 'ADDRESS' as const, area: '', points: [], instructions: '' } }
          : {}),
      },
    ]);
  };

  const filteredCatalog = useMemo(() => {
    const normQuery = searchQuery.trim().toLowerCase();
    return CATALOG_ITEMS.filter(item => {
      const matchCat = activeCategory === 'ALL' || item.category === activeCategory;
      if (!matchCat) return false;
      if (!normQuery) return true;
      return (
        item.name.toLowerCase().includes(normQuery) ||
        getKindLabel(item.kind).toLowerCase().includes(normQuery)
      );
    });
  }, [searchQuery, activeCategory]);

  return (
    <section className={styles.section} aria-label="Cấu hình dịch vụ bổ sung">
      <div className={styles.heading}>
        <div>
          {showTitle && <h3>Dịch vụ bổ sung</h3>}
          <p>Dịch vụ mua thêm, tính theo người.</p>
        </div>
        <span className={styles.badge}>{value.length}/20 dịch vụ</span>
      </div>

      {/* Rút gọn nút: Các dịch vụ phổ biến nhất */}
      <div className={styles.presets}>
        {QUICK_PRESETS.map(p => {
          const added = isServiceAdded(p.name);
          const disabled = value.length >= 20 || added;
          return (
            <button
              key={p.name}
              type="button"
              aria-label={p.name}
              disabled={disabled}
              className={added ? styles.presetAdded : undefined}
              onClick={() => add(p)}
              title={added ? `${p.name} (Đã thêm vào danh sách)` : undefined}
            >
              <p.icon size={18} aria-hidden="true" />
              <span>{p.name}</span>
              {added ? (
                <span className={styles.addedBadge}>
                  <Check size={14} aria-hidden="true" /> Đã thêm
                </span>
              ) : (
                <Plus size={15} aria-hidden="true" />
              )}
            </button>
          );
        })}
      </div>

      {/* Nút mở rộng danh mục dịch vụ đầy đủ */}
      <button
        type="button"
        className={styles.catalogToggle}
        onClick={() => setShowCatalog(prev => !prev)}
        aria-expanded={showCatalog}
      >
        <div className={styles.catalogToggleLeft}>
          <Sparkles size={16} aria-hidden="true" />
          <span>{showCatalog ? 'Ẩn gợi ý dịch vụ' : 'Xem thêm gợi ý dịch vụ'}</span>
        </div>
        {showCatalog ? <ChevronUp size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}
      </button>

      {/* Panel mở rộng: Search bar, category filter pills, catalog grid */}
      {showCatalog && (
        <div className={styles.catalogPanel}>
          <div className={styles.catalogToolbar}>
            <div className={styles.searchWrapper}>
              <Search size={16} className={styles.searchIcon} aria-hidden="true" />
              <input
                type="text"
                className={styles.searchInput}
                placeholder="Tìm kiếm dịch vụ…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                aria-label="Tìm kiếm mẫu dịch vụ"
              />
              {searchQuery && (
                <button
                  type="button"
                  className={styles.searchClear}
                  onClick={() => setSearchQuery('')}
                  aria-label="Xóa nội dung tìm kiếm"
                >
                  <X size={15} aria-hidden="true" />
                </button>
              )}
            </div>

            <div className={styles.categoryPills} role="tablist" aria-label="Lọc theo nhóm dịch vụ">
              {CATEGORY_TABS.map(tab => (
                <button
                  key={tab.key}
                  type="button"
                  role="tab"
                  aria-selected={activeCategory === tab.key}
                  className={`${styles.categoryPill} ${activeCategory === tab.key ? styles.categoryPillActive : ''}`}
                  onClick={() => setActiveCategory(tab.key)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className={`${styles.catalogGrid} ${styles.presets}`}>
            {filteredCatalog.map(item => {
              const added = isServiceAdded(item.name);
              const disabled = value.length >= 20 || added;
              return (
                <button key={item.id} type="button" disabled={disabled}
                  className={added ? styles.presetAdded : undefined}
                  onClick={() => add(item)} aria-label={`Thêm dịch vụ ${item.name}`}>
                  <item.icon size={18} aria-hidden="true" />
                  <span>{item.name}</span>
                  {added ? <span className={styles.addedBadge}><Check size={14} aria-hidden="true" />Đã thêm</span> : <Plus size={15} aria-hidden="true" />}
                </button>
              );
            })}
          </div>

          {filteredCatalog.length === 0 && (
            <div className={styles.catalogEmpty}>
              <p>Không tìm thấy dịch vụ nào phù hợp với &ldquo;{searchQuery}&rdquo;.</p>
              <button
                type="button"
                className={styles.addCustomFromSearch}
                onClick={() => {
                  add({ name: searchQuery.trim(), kind: 'OTHER' });
                  setSearchQuery('');
                }}
              >
                <Plus size={15} aria-hidden="true" /> Thêm dịch vụ tùy chỉnh &ldquo;{searchQuery.trim()}&rdquo;
              </button>
            </div>
          )}
        </div>
      )}

      {/* Danh sách dịch vụ đã thêm vào tour */}
      <div className={styles.listHeading}>
        <h4>Dịch vụ đã thêm ({value.length})</h4>
        <button
          type="button"
          className={styles.add}
          disabled={value.length >= 20}
          onClick={() => add()}
        >
          <Plus size={17} aria-hidden="true" />
          Tạo dịch vụ khác
        </button>
      </div>

      {value.length === 0 && (
        <p className={styles.empty}>Chưa có dịch vụ. Chọn mẫu phía trên hoặc tạo dịch vụ khác.</p>
      )}

      <div className={styles.list}>
        {value.map((s, i) => (
          <details key={s.id} open className={styles.editorRow}>
            <summary>
              <span>{s.name || `Dịch vụ ${i + 1}`}</span>
              <small className={styles.rowPrice}>
                {!Number.isFinite(s.price) ? 'Chưa nhập giá' : s.price === 0 ? 'Miễn phí' : `${s.price.toLocaleString('vi-VN')} đ/người`}
              </small>
              <button
                className={styles.removeService}
                type="button"
                aria-label={`Xóa dịch vụ ${s.name || i + 1}`}
                onClick={event => {
                  event.preventDefault();
                  event.stopPropagation();
                  onChange(value.filter(x => x.id !== s.id));
                }}
              >
                <Trash2 size={16} aria-hidden="true" />
                Xóa
              </button>
            </summary>
            <div className={styles.fields}>
              <label className={styles.wide}>
                Tên dịch vụ
                <input
                  required
                  minLength={2}
                  maxLength={120}
                  value={s.name}
                  onChange={e => update(s.id, { name: e.target.value })}
                />
              </label>
              <label>
                Giá / người (VND)
                <input
                  required
                  type="number"
                  min={0}
                  max={1000000000}
                  step={1}
                  value={Number.isFinite(s.price) ? s.price : ''}
                  placeholder="Nhập giá"
                  onChange={e => update(s.id, { price: e.target.value === '' ? Number.NaN : Number(e.target.value) })}
                />
                <small>Nhập 0 nếu miễn phí.</small>
              </label>
              <label>
                Đặt trước khởi hành (giờ)
                <input
                  required
                  type="number"
                  min={0}
                  max={720}
                  value={s.cutoffHours}
                  onChange={e => update(s.id, { cutoffHours: Number(e.target.value) })}
                />
              </label>
              <label className={styles.wide}>
                Mô tả (không bắt buộc)
                <textarea
                  rows={2}
                  maxLength={1000}
                  value={s.description}
                  placeholder="Dịch vụ bao gồm những gì?"
                  onChange={e => update(s.id, { description: e.target.value })}
                />
              </label>
              {s.pickup && (
                <>
                  <label>
                    Hình thức đón
                    <select
                      value={s.pickup.mode}
                      onChange={e =>
                        update(s.id, {
                          pickup: {
                            ...s.pickup!,
                            mode: e.target.value as 'ADDRESS' | 'POINT',
                          },
                        })
                      }
                    >
                      <option value="ADDRESS">Địa chỉ trong khu vực phục vụ</option>
                      <option value="POINT">Chọn điểm đón có sẵn</option>
                    </select>
                  </label>
                  <label>
                    Khu vực phục vụ
                    <input
                      required
                      minLength={2}
                      maxLength={300}
                      value={s.pickup.area}
                      placeholder="Ví dụ: khu vực trung tâm Hà Nội"
                      onChange={e =>
                        update(s.id, { pickup: { ...s.pickup!, area: e.target.value } })
                      }
                    />
                  </label>
                  {s.pickup.mode === 'POINT' && (
                    <label className={styles.wide}>
                      Danh sách điểm đón (mỗi dòng một địa chỉ)
                      <textarea
                        required
                        value={s.pickup.points.join('\n')}
                        onChange={e =>
                          update(s.id, {
                            pickup: { ...s.pickup!, points: e.target.value.split('\n') },
                          })
                        }
                      />
                    </label>
                  )}
                  <label className={styles.wide}>
                    Hướng dẫn đón (không bắt buộc)
                    <textarea
                      rows={2}
                      maxLength={1000}
                      value={s.pickup.instructions}
                      placeholder="Một chiều hay khứ hồi, giờ đón, cách liên hệ."
                      onChange={e =>
                        update(s.id, {
                          pickup: { ...s.pickup!, instructions: e.target.value },
                        })
                      }
                    />
                  </label>
                </>
              )}
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}

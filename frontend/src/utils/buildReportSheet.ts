/** Dựng hàng sheet báo cáo UC011 — giữ đúng nội dung nghiệp vụ, code gọn */
import type { ReportOverview } from '../services/admin/reportadminservice';
import {
  headerRow,
  sectionRow,
  valuesRow,
  type ExcelRow,
  type ExcelSheet,
} from './exportReportExcel';
import { formatDelta, payLabel } from './reportMetrics';

export type PrevPack = NonNullable<ReportOverview['previousPeriod']>;

function metricBlock(
  ov: ReportOverview,
  compare: boolean,
): ExcelRow[] {
  const m = ov.metrics;
  const prev = ov.previousPeriod;
  const cols = compare ? 4 : 2;
  const head = compare
    ? headerRow(['Chỉ số', 'Kỳ này', 'Kỳ trước', 'So với kỳ trước'])
    : headerRow(['Chỉ số', 'Giá trị']);

  const pick = {
    gross: m?.grossRevenue ?? ov.revenue.total ?? 0,
    delivered: m?.deliveredOrders ?? ov.orders.delivered ?? 0,
    cancelled: m?.cancelledOrders ?? ov.orders.cancelled ?? 0,
    products: m?.productsSold ?? 0,
    aov: m?.avgOrderValue ?? 0,
    active: m?.activeUsers ?? ov.users.activeUsers,
    onPlan: m?.usersOnPlan ?? ov.subscriptions.activeUsers,
  };

  const row = (label: string, cur: number, prevVal?: number): ExcelRow =>
    compare
      ? valuesRow([label, cur, prevVal ?? 0, formatDelta(cur, prevVal ?? 0)])
      : valuesRow([label, cur]);

  return [
    sectionRow('TỔNG QUAN BÁO CÁO', cols, 'section'),
    head,
    row('Tổng doanh thu (Gross Revenue)', pick.gross, prev?.grossRevenue),
    row('Đơn hàng thành công', pick.delivered, prev?.deliveredOrders),
    row('Đơn hàng bị hủy', pick.cancelled, prev?.cancelledOrders),
    row('Số lượng sản phẩm bán ra', pick.products, prev?.productsSold),
    row('Giá trị TB mỗi đơn (AOV)', pick.aov, prev?.avgOrderValue),
    row('Người dùng đang sử dụng', pick.active, prev?.activeUsers),
    row('Người dùng đang dùng gói', pick.onPlan, prev?.usersOnPlan),
  ];
}

export function buildReportSheet(opts: {
  name: string;
  periodLabel: string;
  from: string;
  to: string;
  exportedAt: string;
  compare: boolean;
  overview: ReportOverview;
  bestItems: { bookId: number; title: string; quantitySold: number; revenue: number }[];
  subs: {
    newSubscriptions: number;
    freeClaims: number;
    byPlan: { planName: string; planType: string; count: number; revenue: number }[];
  };
  revenuePoints: { label: string; orderRevenue: number; planRevenue: number; total: number }[];
  revenueTitle: string;
  revenueCol0: string;
}): ExcelSheet {
  const cols = opts.compare ? 4 : 2;
  const rows: ExcelRow[] = [
    sectionRow('BÁO CÁO THỐNG KÊ — OnlineBookReader', cols, 'title'),
    valuesRow(['Thời gian báo cáo', opts.periodLabel]),
    valuesRow(['Từ ngày', opts.from]),
    valuesRow(['Đến ngày', opts.to]),
    valuesRow(['Ngày xuất báo cáo', opts.exportedAt]),
  ];

  if (opts.compare && opts.overview.previousPeriod) {
    const p = opts.overview.previousPeriod;
    rows.push(valuesRow(['Kỳ trước (so sánh)', `${p.from} → ${p.to}`]));
  }

  rows.push([]);
  rows.push(...metricBlock(opts.overview, opts.compare));

  rows.push([]);
  rows.push(sectionRow('TOP SÁCH BÁN CHẠY (Best Sellers)', cols, 'section'));
  rows.push(headerRow(['Hạng', 'Mã sách', 'Tên sách', 'Số lượng', 'Doanh thu']));
  if (!opts.bestItems.length) rows.push(valuesRow(['(Chưa có dữ liệu)']));
  else opts.bestItems.forEach((b, i) => rows.push(valuesRow([i + 1, b.bookId, b.title, b.quantitySold, b.revenue])));

  rows.push([]);
  rows.push(sectionRow('TÌNH HÌNH GÓI ĐỌC (Subscription Performance)', cols, 'section'));
  rows.push(valuesRow(['Tổng lượt đăng ký', opts.subs.newSubscriptions]));
  rows.push(valuesRow(['Gói miễn phí', opts.subs.freeClaims]));
  rows.push(headerRow(['Tên gói', 'Loại', 'Lượt', 'Doanh thu']));
  if (!opts.subs.byPlan.length) rows.push(valuesRow(['(Chưa có đăng ký gói)']));
  else opts.subs.byPlan.forEach((p) => rows.push(valuesRow([p.planName, p.planType, p.count, p.revenue])));

  rows.push([]);
  rows.push(sectionRow('HIỆU SUẤT THEO HÌNH THỨC THANH TOÁN', cols, 'section'));
  rows.push(headerRow(['Hình thức', 'Số đơn thành công', 'Doanh thu']));
  const pays = opts.overview.paymentMethods ?? [];
  if (!pays.length) rows.push(valuesRow(['(Chưa có đơn thành công)']));
  else pays.forEach((p) => rows.push(valuesRow([payLabel(p.method), p.orderCount, p.revenue])));

  rows.push([]);
  rows.push(sectionRow(opts.revenueTitle, cols, 'section'));
  rows.push(headerRow([opts.revenueCol0, 'Đơn hàng', 'Gói đọc', 'Tổng']));
  if (!opts.revenuePoints.length) rows.push(valuesRow(['(Chưa có dữ liệu)']));
  else opts.revenuePoints.forEach((p) => rows.push(valuesRow([p.label, p.orderRevenue, p.planRevenue, p.total])));

  return { name: opts.name, rows, colCount: cols };
}

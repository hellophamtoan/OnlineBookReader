// UC011 — Thống kê & báo cáo + xuất Excel
import { useMemo, useState } from 'react';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import { ErrorState, LoadingBlock } from '../../components/common/States';
import { ROUTES } from '../../config/routes';
import { useAsync } from '../../hooks/useAsync';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { reportAdminService } from '../../services/admin/reportadminservice';
import { buildReportSheet } from '../../utils/buildReportSheet';
import { downloadExcelXml } from '../../utils/exportReportExcel';
import { toMessage } from '../../utils/errors';
import { formatPrice } from '../../utils/format';
import { formatDelta, payLabel, rangeMonth, rangeYear } from '../../utils/reportMetrics';


type RangeMode = 'month' | 'year' | 'custom';

const MONTHS = Array.from({ length: 12 }, (_, i) => ({ v: i + 1, label: `Tháng ${i + 1}` }));
// [Xử lý] Tạo danh sách năm cho ô chọn kỳ báo cáo.
const yearOptions = () => {
  const y = new Date().getFullYear();
  return Array.from({ length: 7 }, (_, i) => y - i);
};

// [Trang] Admin > Báo cáo (/admin/reports): thẻ tổng quan, biểu đồ doanh thu, sách bán chạy, gói đọc; xuất Excel.
export default function AdminReportsPage() {
  useDocumentTitle('Báo cáo');
  const now = useMemo(() => new Date(), []);
  const years = useMemo(() => yearOptions(), []);
  const [mode, setMode] = useState<RangeMode>('month');
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const initial = useMemo(() => rangeMonth(now.getFullYear(), now.getMonth() + 1), [now]);
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [applied, setApplied] = useState(initial);
  const [exporting, setExporting] = useState(false);

  const overview = useAsync(() => reportAdminService.overview(applied.from, applied.to), [applied.from, applied.to]);
  const revenue = useAsync(
    () => reportAdminService.revenue(applied.from, applied.to, mode === 'year' ? 'month' : 'day'),
    [applied.from, applied.to, mode],
  );
  const best = useAsync(() => reportAdminService.bestSellers(applied.from, applied.to, 20), [applied.from, applied.to]);
  const subs = useAsync(() => reportAdminService.subscriptions(applied.from, applied.to), [applied.from, applied.to]);

  const loading = overview.loading || revenue.loading || best.loading || subs.loading;
  const error = overview.error || revenue.error || best.error || subs.error;
  const ov = overview.data;
  const exportedAt = useMemo(() => new Date().toLocaleString('vi-VN'), [applied.from, applied.to, ov]);

  const periodLabel =
    mode === 'year' ? `Năm ${year}` : mode === 'month' ? `Tháng ${month}/${year}` : `${applied.from} → ${applied.to}`;
  const showCompare = mode !== 'custom';

  const applySelection = (next: RangeMode = mode, y = year, m = month, f = from, t = to) => {
    if (next === 'month') {
      const r = rangeMonth(y, m);
      setApplied(r);
      setFrom(r.from);
      setTo(r.to);
      return;
    }
    if (next === 'year') {
      const r = rangeYear(y);
      setApplied(r);
      setFrom(r.from);
      setTo(r.to);
      return;
    }
    setApplied({ from: f, to: t });
  };

  const met = ov?.metrics;
  const gross = met?.grossRevenue ?? ov?.revenue.total ?? 0;
  const delivered = met?.deliveredOrders ?? ov?.orders.delivered ?? 0;
  const cancelled = met?.cancelledOrders ?? ov?.orders.cancelled ?? 0;
  const productsSold = met?.productsSold ?? 0;
  const aov = met?.avgOrderValue ?? 0;

  const exportExcel = async () => {
    if (!ov) return;
    setExporting(true);
    try {
      const exported = new Date().toLocaleString('vi-VN');
      const base = {
        periodLabel,
        from: applied.from,
        to: applied.to,
        exportedAt: exported,
        compare: showCompare,
        overview: ov,
        bestItems: best.data?.items ?? [],
        subs: {
          newSubscriptions: subs.data?.newSubscriptions ?? 0,
          freeClaims: subs.data?.freeClaims ?? 0,
          byPlan: subs.data?.byPlan ?? [],
        },
        revenuePoints: revenue.data?.points ?? [],
        revenueTitle: mode === 'year' ? 'DOANH THU THEO THÁNG' : 'DOANH THU THEO NGÀY',
        revenueCol0: mode === 'year' ? 'Tháng' : 'Ngày',
      };

      const sheets = [
        buildReportSheet({
          ...base,
          name:
            mode === 'year'
              ? `Tong_Quan(nam ${year})`
              : mode === 'month'
                ? `Tong_Quan(thang ${String(month).padStart(2, '0')}-${year})`
                : 'Tong_Quan(khoang_ngay)',
        }),
      ];

      if (mode === 'year') {
        for (let mth = 1; mth <= 12; mth++) {
          const r = rangeMonth(year, mth);
          try {
            const [ovM, bestM, subM, revM] = await Promise.all([
              reportAdminService.overview(r.from, r.to),
              reportAdminService.bestSellers(r.from, r.to, 20),
              reportAdminService.subscriptions(r.from, r.to),
              reportAdminService.revenue(r.from, r.to, 'day'),
            ]);
            sheets.push(
              buildReportSheet({
                name: `Thang_${String(mth).padStart(2, '0')}_${year}`,
                periodLabel: `Tháng ${mth}/${year}`,
                from: r.from,
                to: r.to,
                exportedAt: exported,
                compare: true,
                overview: ovM,
                bestItems: bestM.items,
                subs: {
                  newSubscriptions: subM.newSubscriptions,
                  freeClaims: subM.freeClaims,
                  byPlan: subM.byPlan,
                },
                revenuePoints: revM.points,
                revenueTitle: 'DOANH THU THEO NGÀY',
                revenueCol0: 'Ngày',
              }),
            );
          } catch {
            sheets.push(
              buildReportSheet({
                name: `Thang_${String(mth).padStart(2, '0')}_${year}`,
                periodLabel: `Tháng ${mth}/${year}`,
                from: r.from,
                to: r.to,
                exportedAt: exported,
                compare: false,
                overview: ov,
                bestItems: [],
                subs: { newSubscriptions: 0, freeClaims: 0, byPlan: [] },
                revenuePoints: [],
                revenueTitle: 'DOANH THU THEO NGÀY',
                revenueCol0: 'Ngày',
              }),
            );
          }
        }
      }

      downloadExcelXml(`Bao_cao_${periodLabel.replace(/[\\/:*?"<>| ]/g, '_')}`, sheets);
    } finally {
      setExporting(false);
    }
  };

  const compareCells = (cur: number, prev: number | undefined, money = false) =>
    showCompare ? (
      <>
        <td className="table__num">
          <span className="report-clip">{money ? formatPrice(prev ?? 0) : (prev ?? '—')}</span>
        </td>
        <td>
          <span className="report-clip report-delta">
            {typeof prev === 'number' ? formatDelta(cur, prev) : '—'}
          </span>
        </td>
      </>
    ) : null;

  const overviewRow = (label: string, cur: number | string, prev?: number, money = false) => (
    <tr key={label}>
      <th scope="row">
        <span className="report-clip" title={label}>
          {label}
        </span>
      </th>
      <td className={`table__num${typeof cur === 'number' && money ? ' table__strong' : ''}`}>
        <span className="report-clip">{money && typeof cur === 'number' ? formatPrice(cur) : cur}</span>
      </td>
      {typeof cur === 'number' ? compareCells(cur, prev, money) : showCompare && (
        <>
          <td className="table__num">—</td>
          <td>—</td>
        </>
      )}
    </tr>
  );

  return (
    <>
      <AdminPageHeader
        title="Thống kê & báo cáo"
        subtitle="Báo cáo tổng quan, so sánh kỳ trước, bán chạy, gói đọc, thanh toán."
        crumbs={[{ label: 'Tổng quan', to: ROUTES.ADMIN_HOME }, { label: 'Báo cáo' }]}
        actions={
          <button
            type="button"
            className="btn btn--primary"
            disabled={!ov || loading || exporting}
            onClick={() => void exportExcel()}
          >
            {exporting ? 'Đang xuất...' : 'Xuất Excel'}
          </button>
        }
      />

      <div className="report-toolbar">
        <div className="report-toolbar__presets" role="group" aria-label="Kiểu kỳ">
          {(
            [
              ['month', 'Theo tháng'],
              ['year', 'Theo năm'],
              ['custom', 'Khoảng ngày'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={`btn btn--sm ${mode === key ? 'btn--primary' : 'btn--ghost'}`}
              onClick={() => {
                setMode(key);
                if (key !== 'custom') applySelection(key, year, month, from, to);
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="report-toolbar__dates">
          {(mode === 'month' || mode === 'year') && (
            <label className="field report-toolbar__field">
              <span className="field__label">Năm</span>
              <select
                className="input"
                value={year}
                onChange={(e) => {
                  const y = Number(e.target.value);
                  setYear(y);
                  applySelection(mode, y, month, from, to);
                }}
              >
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </label>
          )}
          {mode === 'month' && (
            <label className="field report-toolbar__field">
              <span className="field__label">Tháng</span>
              <select
                className="input"
                value={month}
                onChange={(e) => {
                  const mth = Number(e.target.value);
                  setMonth(mth);
                  applySelection('month', year, mth, from, to);
                }}
              >
                {MONTHS.map((mth) => (
                  <option key={mth.v} value={mth.v}>
                    {mth.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          {mode === 'custom' && (
            <>
              <label className="field report-toolbar__field">
                <span className="field__label">Từ ngày</span>
                <input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} />
              </label>
              <label className="field report-toolbar__field">
                <span className="field__label">Đến ngày</span>
                <input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} />
              </label>
              <button
                type="button"
                className="btn btn--primary report-toolbar__apply"
                onClick={() => applySelection('custom', year, month, from, to)}
              >
                Xem báo cáo
              </button>
            </>
          )}
        </div>
      </div>

      {error && (
        <ErrorState
          message={toMessage(error)}
          onRetry={() => {
            overview.reload();
            revenue.reload();
            best.reload();
            subs.reload();
          }}
        />
      )}

      {loading && !ov ? (
        <LoadingBlock label="Đang tải báo cáo..." />
      ) : ov ? (
        <div className="report-page">
          <section className="report-panel report-panel--full">
            <h2 className="report-panel__title">Tổng quan báo cáo</h2>
            <p className="field__hint report-panel__meta">
              <span className="report-clip" title={periodLabel}>
                Thời gian: <b>{periodLabel}</b>
              </span>
              <span className="report-panel__sep">·</span>
              <span className="report-clip" title={`${applied.from} → ${applied.to}`}>
                {applied.from} → {applied.to}
              </span>
              <span className="report-panel__sep">·</span>
              <span className="report-clip" title={exportedAt}>
                Xuất: {exportedAt}
              </span>
            </p>
            {showCompare && ov.previousPeriod && (
              <p className="field__hint report-panel__meta">
                Kỳ trước:{' '}
                <span className="report-clip" title={`${ov.previousPeriod.from} → ${ov.previousPeriod.to}`}>
                  {ov.previousPeriod.from} → {ov.previousPeriod.to}
                </span>
              </p>
            )}
            <div className="table-wrap report-table-wrap">
              <table className="table report-table report-table--overview">
                <thead>
                  <tr>
                    <th scope="col">Chỉ số</th>
                    <th scope="col" className="table__num">
                      {showCompare ? 'Kỳ này' : 'Giá trị'}
                    </th>
                    {showCompare && (
                      <>
                        <th scope="col" className="table__num">
                          Kỳ trước
                        </th>
                        <th scope="col">So với kỳ trước</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {overviewRow('Tổng doanh thu (Gross Revenue)', gross, ov.previousPeriod?.grossRevenue, true)}
                  {overviewRow('Đơn hàng thành công', delivered, ov.previousPeriod?.deliveredOrders)}
                  {overviewRow('Đơn hàng bị hủy', cancelled, ov.previousPeriod?.cancelledOrders)}
                  {overviewRow('Số lượng sản phẩm bán ra', productsSold, ov.previousPeriod?.productsSold)}
                  {overviewRow('Giá trị TB mỗi đơn (AOV)', aov, ov.previousPeriod?.avgOrderValue, true)}
                  {overviewRow(
                    'Người dùng đang sử dụng',
                    met?.activeUsers ?? ov.users.activeUsers,
                    ov.previousPeriod?.activeUsers,
                  )}
                  {overviewRow(
                    'Người dùng đang dùng gói',
                    met?.usersOnPlan ?? ov.subscriptions.activeUsers,
                    ov.previousPeriod?.usersOnPlan,
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <div className="report-grid">
            <section className="report-panel">
              <h2 className="report-panel__title">Top sách bán chạy (Best Sellers)</h2>
              {(best.data?.items.length ?? 0) === 0 ? (
                <p className="field__hint">Chưa có dữ liệu.</p>
              ) : (
                <div className="table-wrap">
                  <table className="table report-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Sách</th>
                        <th className="table__num">SL</th>
                        <th className="table__num">Doanh thu</th>
                      </tr>
                    </thead>
                    <tbody>
                      {best.data!.items.map((b, i) => (
                        <tr key={b.bookId}>
                          <td>{i + 1}</td>
                          <td>{b.title}</td>
                          <td className="table__num">{b.quantitySold}</td>
                          <td className="table__num">{formatPrice(b.revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="report-panel">
              <h2 className="report-panel__title">Tình hình gói đọc (Subscription)</h2>
              <p className="field__hint report-panel__meta">
                Lượt đăng ký: <b>{subs.data?.newSubscriptions ?? 0}</b>
                <span className="report-panel__sep">·</span>
                Free: <b>{subs.data?.freeClaims ?? 0}</b>
              </p>
              {(subs.data?.byPlan.length ?? 0) === 0 ? (
                <p className="field__hint">Chưa có đăng ký gói.</p>
              ) : (
                <div className="table-wrap">
                  <table className="table report-table">
                    <thead>
                      <tr>
                        <th>Gói</th>
                        <th>Loại</th>
                        <th className="table__num">Lượt</th>
                        <th className="table__num">DT</th>
                      </tr>
                    </thead>
                    <tbody>
                      {subs.data!.byPlan.map((p) => (
                        <tr key={p.planId}>
                          <td>{p.planName}</td>
                          <td>{p.planType}</td>
                          <td className="table__num">{p.count}</td>
                          <td className="table__num">{formatPrice(p.revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>

          <div className="report-grid">
            <section className="report-panel">
              <h2 className="report-panel__title">Hiệu suất theo hình thức thanh toán</h2>
              {(ov.paymentMethods?.length ?? 0) === 0 ? (
                <p className="field__hint">Chưa có đơn thành công trong kỳ.</p>
              ) : (
                <div className="table-wrap">
                  <table className="table report-table">
                    <thead>
                      <tr>
                        <th>Hình thức</th>
                        <th className="table__num">Số đơn</th>
                        <th className="table__num">Doanh thu</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ov.paymentMethods!.map((p) => (
                        <tr key={p.method}>
                          <td>{payLabel(p.method)}</td>
                          <td className="table__num">{p.orderCount}</td>
                          <td className="table__num">{formatPrice(p.revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="report-panel">
              <h2 className="report-panel__title">{mode === 'year' ? 'Doanh thu theo tháng' : 'Doanh thu theo ngày'}</h2>
              {(revenue.data?.points.length ?? 0) === 0 ? (
                <p className="field__hint">Chưa có dữ liệu.</p>
              ) : (
                <div className="table-wrap">
                  <table className="table report-table">
                    <thead>
                      <tr>
                        <th>{mode === 'year' ? 'Tháng' : 'Ngày'}</th>
                        <th className="table__num">Đơn</th>
                        <th className="table__num">Gói</th>
                        <th className="table__num">Tổng</th>
                      </tr>
                    </thead>
                    <tbody>
                      {revenue.data!.points.map((p) => (
                        <tr key={p.label}>
                          <td>{p.label}</td>
                          <td className="table__num">{formatPrice(p.orderRevenue)}</td>
                          <td className="table__num">{formatPrice(p.planRevenue)}</td>
                          <td className="table__num table__strong">{formatPrice(p.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        </div>
      ) : null}
    </>
  );
}

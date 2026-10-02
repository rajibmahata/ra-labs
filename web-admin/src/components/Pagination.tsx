const PAGE_SIZES = [10, 25, 50];

export function Pagination({
  page,
  pageSize,
  totalCount,
  onPageChange,
  onPageSizeChange,
}: {
  page: number;
  pageSize: number;
  totalCount: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const from = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalCount);

  const pages: number[] = [];
  for (let p = 1; p <= totalPages; p += 1) {
    if (p === 1 || p === totalPages || Math.abs(p - page) <= 1) pages.push(p);
  }

  return (
    <div className="pagination">
      <span className="pagination-summary">
        {from}–{to} of {totalCount}
      </span>
      <div className="pagination-controls">
        <button
          type="button"
          className="btn btn--outline btn--sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Prev
        </button>
        {pages.map((p, i) => {
          const prev = pages[i - 1];
          return (
            <span key={p} className="pagination-pages">
              {prev !== undefined && p - prev > 1 && <span className="pagination-ellipsis">…</span>}
              <button
                type="button"
                className={`btn btn--sm ${p === page ? 'btn--primary' : 'btn--outline'}`}
                aria-current={p === page ? 'page' : undefined}
                onClick={() => onPageChange(p)}
              >
                {p}
              </button>
            </span>
          );
        })}
        <button
          type="button"
          className="btn btn--outline btn--sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </button>
      </div>
      {onPageSizeChange && (
        <label className="pagination-size">
          Per page
          <select value={pageSize} onChange={(e) => onPageSizeChange(Number(e.target.value))}>
            {PAGE_SIZES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}

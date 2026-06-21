import { useCallback } from 'react';

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
  const isFirstPage = currentPage <= 1;
  const isLastPage = currentPage >= totalPages;

  const handlePrevious = useCallback(() => {
    if (!isFirstPage) {
      onPageChange(currentPage - 1);
    }
  }, [currentPage, isFirstPage, onPageChange]);

  const handleNext = useCallback(() => {
    if (!isLastPage) {
      onPageChange(currentPage + 1);
    }
  }, [currentPage, isLastPage, onPageChange]);

  if (totalPages <= 1) {
    return null;
  }

  // Build page numbers to display
  const pages: number[] = [];
  for (let i = 1; i <= totalPages; i++) {
    pages.push(i);
  }

  return (
    <nav aria-label="Pagination">
      <ul style={{ display: 'flex', listStyle: 'none', padding: 0, gap: '4px' }}>
        <li>
          <button
            type="button"
            onClick={handlePrevious}
            disabled={isFirstPage}
            aria-label="Previous page"
          >
            Previous
          </button>
        </li>
        {pages.map((page) => (
          <li key={page}>
            <button
              type="button"
              onClick={() => onPageChange(page)}
              aria-label={`Page ${page}`}
              aria-current={page === currentPage ? 'page' : undefined}
              style={{
                fontWeight: page === currentPage ? 'bold' : 'normal',
              }}
            >
              {page}
            </button>
          </li>
        ))}
        <li>
          <button
            type="button"
            onClick={handleNext}
            disabled={isLastPage}
            aria-label="Next page"
          >
            Next
          </button>
        </li>
      </ul>
    </nav>
  );
}

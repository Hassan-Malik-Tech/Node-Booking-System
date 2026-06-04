export function getLimitAndOffset({ page, pageSize }) {
  const limit = pageSize;
  const offset = (page - 1) * limit;

  return { limit, offset };
}

export function buildPagination({ page, pageSize, total }) {
  return {
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize),
  };
}

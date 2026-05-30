export function getOrderByParts({
  sortBy,
  sortDirection,
  allowList,
  defaultSortBy = 'createdAt',
}) {
  const direction = sortDirection === 'asc' ? 'ASC' : 'DESC';
  const orderByColumn = allowList[sortBy] ?? allowList[defaultSortBy];

  return { orderByColumn, direction };
}

export function buildSetClause(items) {
  const entries = Object.entries(items);

  const values = [];
  const setClauseItems = [];

  for (const [key, value] of entries) {
    if (value !== undefined) {
      values.push(value);
      setClauseItems.push(`${key} = $${values.length}`);
    }
  }

  const setClause = setClauseItems.join(', ');

  return { values, setClause };
}

/*
always make sure to do:

 if (setClause.length === 0) {
    return null;
  }

after destructuring this function in the sql function it is used in
*/

// Also always make sure to convert any item that is not sql(my shcema) friendly to sql snake toLowerCase
// like buildSetClause({ start_time: startTime })

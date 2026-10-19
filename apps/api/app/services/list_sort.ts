/** Ordenações aceitas na lista (valor da query `sort`); qualquer outro valor cai em "mais recentes". */
export function applySort(
  builder: { orderBy: (column: string, direction: 'asc' | 'desc') => unknown },
  sort: string,
  nameColumn: string
) {
  if (sort === 'oldest') builder.orderBy('updated_at', 'asc')
  else if (sort === 'name') builder.orderBy(nameColumn, 'asc')
  else if (sort === 'name_desc') builder.orderBy(nameColumn, 'desc')
  else if (sort === 'created') builder.orderBy('created_at', 'desc')
  else builder.orderBy('updated_at', 'desc')
  builder.orderBy('id', 'desc')
}
